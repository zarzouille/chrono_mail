require('dotenv').config();
const jwt    = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('./prisma');

// Pas de fallback : un secret par défaut visible dans le code source
// permettrait de forger un token valide pour n'importe quel compte si
// la variable est absente en production. On préfère planter au
// démarrage plutôt que de signer silencieusement avec un secret public.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET manquant — définis-la dans .env (ou les variables d\'environnement de l\'hébergeur) avant de démarrer le serveur.');
}
const JWT_EXPIRES = '7d';
const SALT_ROUNDS = 10;

// ── Hash mot de passe ─────────────────────────────────────────────
async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

// ── Vérifier mot de passe ─────────────────────────────────────────
async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// ── Générer un token JWT ──────────────────────────────────────────
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, plan: user.plan },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
    );
}

// ── Vérifier un token JWT ─────────────────────────────────────────
function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

/**
 * Un jeton signé avant la dernière révocation du compte est-il périmé ?
 *
 * La comparaison se fait à la seconde, pas à la milliseconde : `iat` est
 * un entier de secondes, arrondi vers le bas. Comparer à un instant plus
 * fin rejetterait un jeton émis dans la même seconde que la révocation —
 * or c'est le cas courant, pas un cas limite : après avoir réinitialisé
 * son mot de passe, on se reconnecte dans la foulée.
 *
 * En contrepartie, un jeton émis pendant cette même seconde survit à la
 * révocation. Fenêtre négligeable : dans le scénario visé, celui de
 * l'attaquant a été émis bien avant.
 */
function isTokenRevoked(payload, sessionsValidFrom) {
    if (!sessionsValidFrom) return false; // aucune révocation sur ce compte
    if (!payload.iat) return true;        // jeton sans date d'émission : refusé
    return payload.iat < Math.floor(sessionsValidFrom.getTime() / 1000);
}

// ── Middleware Express : protège les routes ───────────────────────
async function requireAuth(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    const token = header.slice(7);

    let payload;
    try {
        payload = verifyToken(token);
    } catch (err) {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }

    try {
        // Le JWT peut survivre jusqu'à 7 jours à un compte supprimé ou à un
        // changement de plan (upgrade/downgrade Stripe) : on revérifie
        // l'existence de l'utilisateur et on relit son plan actuel en base
        // plutôt que de faire confiance aveuglément au payload signé.
        const user = await prisma.user.findUnique({
            where:  { id: payload.id },
            select: { id: true, email: true, name: true, plan: true, sessionsValidFrom: true },
        });
        if (!user) return res.status(401).json({ error: 'Compte introuvable' });

        // Exister ne suffit pas : les identifiants ont pu être invalidés
        // depuis (reprise du compte via Google, réinitialisation du mot de
        // passe). Le jeton d'alors ne doit plus ouvrir la porte.
        if (isTokenRevoked(payload, user.sessionsValidFrom)) {
            return res.status(401).json({ error: 'Session expirée, reconnectez-vous' });
        }

        const { sessionsValidFrom, ...safeUser } = user;
        req.user = safeUser; // { id, email, name, plan } à jour
        next();
    } catch (err) {
        console.error('Erreur requireAuth :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
}

// ── Administrateurs ───────────────────────────────────────────────
// Liste blanche d'adresses, séparées par des virgules (ADMIN_EMAILS).
// Aucune valeur par défaut : si la variable est absente, personne n'est
// administrateur et la console d'assistance reste fermée. Ouvrir l'accès
// « en attendant de configurer » exposerait les demandes de tous les
// clients au premier compte créé.
function adminEmails() {
    return (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);
}

function isAdmin(email) {
    if (!email) return false;
    return adminEmails().includes(email.trim().toLowerCase());
}

// À chaîner après requireAuth, qui a déjà relu le compte en base.
function requireAdmin(req, res, next) {
    if (isAdmin(req.user?.email)) return next();
    return res.status(403).json({ error: 'Accès réservé' });
}

// ── Middleware : authentification optionnelle ─────────────────────
// Renseigne req.user si un token valide est présent, sans jamais bloquer.
// Utilisé par le formulaire de contact : accessible à tous, mais on
// rattache la demande au compte quand on peut.
async function optionalAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return next();

    try {
        const payload = verifyToken(header.slice(7));
        const user = await prisma.user.findUnique({
            where:  { id: payload.id },
            select: { id: true, email: true, name: true, plan: true, sessionsValidFrom: true },
        });
        // Même règle de révocation qu'ici requireAuth : un jeton périmé ne
        // doit pas rattacher une demande au compte qu'il a cessé d'ouvrir.
        if (user && !isTokenRevoked(payload, user.sessionsValidFrom)) {
            const { sessionsValidFrom, ...safeUser } = user;
            req.user = safeUser;
        }
    } catch (err) {
        // Token absent, expiré ou compte supprimé : on continue en anonyme.
    }
    next();
}

// ── Middleware : limites du plan Free ─────────────────────────────
function requirePlan(minPlan) {
    const hierarchy = { FREE: 0, PRO: 1, BUSINESS: 2 };
    return (req, res, next) => {
        const userLevel = hierarchy[req.user?.plan] ?? 0;
        const required  = hierarchy[minPlan] ?? 0;
        if (userLevel >= required) return next();
        return res.status(403).json({
            error:   'Plan insuffisant',
            current: req.user?.plan,
            required: minPlan,
        });
    };
}

module.exports = {
    hashPassword, verifyPassword, generateToken, verifyToken, isTokenRevoked,
    requireAuth, optionalAuth, requirePlan, requireAdmin, isAdmin,
};