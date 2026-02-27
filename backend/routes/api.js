const express  = require('express');
const router   = express.Router();
const { generateCountdownGif } = require('../services/countdown-generator');
const prisma   = require('../lib/prisma');
const { requireAuth, requirePlan } = require('../lib/auth');

// ── Santé ─────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Créer un countdown ────────────────────────────────────────────
// POST /countdown  (authentifié)
router.post('/countdown', requireAuth, async (req, res) => {
    try {
        const {
            name      = 'Mon countdown',
            endDate,
            bgColor   = '#ffffff',
            textColor = '#2563eb',
            fontSize  = 36,
            width     = 400,
            timezone  = 'Europe/Paris',
        } = req.body;

        if (!endDate) {
            return res.status(400).json({ error: 'endDate est requis' });
        }

        // Vérifier la limite du plan Free (3 countdowns max)
        if (req.user.plan === 'FREE') {
            const count = await prisma.countdown.count({ where: { userId: req.user.id } });
            if (count >= 3) {
                return res.status(403).json({
                    error: 'Limite atteinte',
                    message: 'Le plan Free est limité à 3 countdowns. Passez à Pro pour en créer davantage.',
                });
            }
        }

        const countdown = await prisma.countdown.create({
            data: {
                userId:    req.user.id,
                name,
                endDate:   new Date(endDate),
                bgColor,
                textColor,
                fontSize:  parseInt(fontSize),
                width:     parseInt(width),
                timezone,
            },
        });

        res.json({
            id:     countdown.id,
            gifUrl: `${req.protocol}://${req.get('host')}/gif/${countdown.id}`,
            countdown,
        });

    } catch (err) {
        console.error('Erreur création countdown :', err);
        res.status(500).json({ error: 'Erreur lors de la création du countdown' });
    }
});

// ── Lister les countdowns ─────────────────────────────────────────
// GET /countdowns  (authentifié)
router.get('/countdowns', requireAuth, async (req, res) => {
    try {
        const countdowns = await prisma.countdown.findMany({
            where:   { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { impressions: true } } },
        });
        res.json(countdowns);
    } catch (err) {
        console.error('Erreur liste :', err);
        res.status(500).json({ error: 'Erreur lors de la récupération' });
    }
});

// ── Supprimer un countdown ────────────────────────────────────────
// DELETE /countdown/:id  (authentifié)
router.delete('/countdown/:id', requireAuth, async (req, res) => {
    try {
        const cd = await prisma.countdown.findUnique({ where: { id: req.params.id } });
        if (!cd) return res.status(404).json({ error: 'Countdown introuvable' });
        if (cd.userId !== req.user.id) return res.status(403).json({ error: 'Non autorisé' });

        await prisma.countdown.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur suppression' });
    }
});

// ── GIF depuis la base (avec log impression) ──────────────────────
// GET /gif/:id  (public — intégré dans les emails)
router.get('/gif/:id', async (req, res) => {
    try {
        const countdown = await prisma.countdown.findUnique({ where: { id: req.params.id } });
        if (!countdown) return res.status(404).send('Countdown introuvable');

        // Log impression en arrière-plan
        prisma.impression.create({
            data: {
                countdownId: countdown.id,
                userId:      countdown.userId,
                userAgent:   req.get('User-Agent') || null,
                ip:          req.ip || null,
            },
        }).catch(err => console.error('Erreur log impression :', err));

        const gifBuffer = await generateCountdownGif(
            countdown.endDate.toISOString(),
            countdown.bgColor,
            countdown.textColor,
            countdown.fontSize,
            countdown.width,
        );

        res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
        res.send(gifBuffer);

    } catch (err) {
        console.error('Erreur GIF :', err);
        res.status(500).send('Erreur génération GIF');
    }
});

// ── GIF à la volée (sans sauvegarde, pour preview) ────────────────
// GET /gif?endDate=...
router.get('/gif', async (req, res) => {
    try {
        const { endDate = new Date(Date.now() + 86400000).toISOString(), bgColor = '#ffffff', textColor = '#2563eb', fontSize = 36, width = 400 } = req.query;
        if (isNaN(new Date(endDate).getTime())) return res.status(400).json({ error: 'endDate invalide' });

        const gifBuffer = await generateCountdownGif(endDate, bgColor, textColor, fontSize, width);
        res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
        res.send(gifBuffer);
    } catch (err) {
        res.status(500).json({ error: 'Erreur génération GIF' });
    }
});

module.exports = router;