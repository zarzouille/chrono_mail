const express  = require('express');
const router   = express.Router();
const passport = require('../lib/passport');
const prisma   = require('../lib/prisma');
const crypto   = require('crypto');
const { hashPassword, verifyPassword, generateToken, requireAuth } = require('../lib/auth');
const { sendWelcome, sendVerifyEmail } = require('../services/email-service');

// ── Inscription ───────────────────────────────────────────────────
router.post('/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
        if (password.length < 8) return res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum)' });

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

        const hashed = await hashPassword(password);
        const emailVerifyToken = crypto.randomBytes(32).toString('hex');
        const user   = await prisma.user.create({
            data: { email, password: hashed, name: name || null, plan: 'FREE', emailVerifyToken },
        });

        const token = generateToken(user);
        res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan, emailVerified: false } });

        // Email de vérification (non bloquant)
        sendVerifyEmail(user.email, user.name, emailVerifyToken).catch(() => {});

    } catch (err) {
        console.error('Erreur register :', err);
        res.status(500).json({ error: 'Erreur lors de l\'inscription' });
    }
});

// ── Connexion ─────────────────────────────────────────────────────
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.password === 'google_oauth') {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        const valid = await verifyPassword(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

        const token = generateToken(user);
        res.json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan, emailVerified: user.emailVerified } });

    } catch (err) {
        console.error('Erreur login :', err);
        res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
});

// ── Profil ────────────────────────────────────────────────────────
router.get('/auth/me', requireAuth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where:  { id: req.user.id },
            select: { id: true, email: true, name: true, plan: true, emailVerified: true, createdAt: true },
        });
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ── Vérification email ───────────────────────────────────────────
router.get('/auth/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: 'Token manquant' });

        const user = await prisma.user.findFirst({ where: { emailVerifyToken: token } });
        if (!user) return res.status(400).json({ error: 'Token invalide ou déjà utilisé' });

        await prisma.user.update({
            where: { id: user.id },
            data:  { emailVerified: true, emailVerifyToken: null },
        });

        // Rediriger vers le frontend avec confirmation
        res.redirect('/?verified=1');
    } catch (err) {
        console.error('Erreur verify-email :', err);
        res.status(500).json({ error: 'Erreur lors de la vérification' });
    }
});

// ── Renvoyer l'email de vérification ─────────────────────────────
router.post('/auth/resend-verification', requireAuth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
        if (user.emailVerified) return res.json({ message: 'Email déjà vérifié' });

        const emailVerifyToken = crypto.randomBytes(32).toString('hex');
        await prisma.user.update({
            where: { id: user.id },
            data:  { emailVerifyToken },
        });

        await sendVerifyEmail(user.email, user.name, emailVerifyToken);
        res.json({ success: true });
    } catch (err) {
        console.error('Erreur resend-verification :', err);
        res.status(500).json({ error: 'Erreur lors du renvoi' });
    }
});

// ── Google OAuth — étape 1 : redirection vers Google ─────────────
router.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// ── Google OAuth — étape 2 : callback après authentification ─────
router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/?error=google', session: false }),
    (req, res) => {
        // Générer un JWT et rediriger vers le frontend avec le token en query param
        const token = generateToken(req.user);
        const user  = encodeURIComponent(JSON.stringify({
            id:    req.user.id,
            email: req.user.email,
            name:  req.user.name,
            plan:  req.user.plan,
            emailVerified: req.user.emailVerified,
        }));
        // Rediriger vers le frontend — le JS récupère le token depuis l'URL
        res.redirect(`/?token=${token}&user=${user}`);
    }
);

// ── Suppression de compte (RGPD) ────────────────────────────────
router.delete('/auth/account', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

        // Annuler l'abonnement Stripe si existant
        if (user.stripeSubscriptionId) {
            try {
                const Stripe = require('stripe');
                const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
                await stripe.subscriptions.cancel(user.stripeSubscriptionId);
            } catch (err) {
                console.error('Erreur annulation Stripe :', err.message);
            }
        }

        // Suppression en cascade (grâce à onDelete: Cascade dans le schema)
        await prisma.user.delete({ where: { id: userId } });

        console.log(`🗑️ Compte supprimé : ${user.email}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Erreur suppression compte :', err);
        res.status(500).json({ error: 'Erreur lors de la suppression du compte' });
    }
});

module.exports = router;