const express  = require('express');
const router   = express.Router();
const { generateCountdownGif } = require('../services/countdown-generator');
const prisma   = require('../lib/prisma');
const { requireAuth } = require('../lib/auth');

/**
 * Construit l'URL publique d'un GIF.
 * Priorité : variable d'env BASE_URL → reconstruction depuis la requête.
 * Render + autres reverse proxies renvoient parfois http/localhost,
 * d'où la nécessité de BASE_URL en production.
 */
function buildGifUrl(req, countdownId) {
    if (process.env.BASE_URL) {
        return `${process.env.BASE_URL.replace(/\/+$/, '')}/gif/${countdownId}`;
    }
    const proto = req.get('X-Forwarded-Proto') || req.protocol;
    const host  = req.get('X-Forwarded-Host')  || req.get('host');
    return `${proto}://${host}/gif/${countdownId}`;
}

// ── Santé ──────────────────────────────────────────────────────
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Créer un countdown ─────────────────────────────────────────
router.post('/countdown', requireAuth, async (req, res) => {
    try {
        const plan = req.user.plan;
        const {
            name             = 'Mon countdown',
            endDate,
            bgColor          = '#ffffff',
            textColor        = '#2563eb',
            fontSize         = 36,
            width            = 400,
            timezone         = 'Europe/Paris',
            fontFamily       = 'monospace',
            style            = 'rounded',
            orientation      = 'horizontal',
            showUnits        = 'days,hours,minutes,seconds',
            labelDays        = 'JOURS',
            labelHours       = 'HEURES',
            labelMinutes     = 'MIN',
            labelSeconds     = 'SEC',
            expiredBehavior  = 'SHOW_ZEROS',
            expiredText      = 'Offre terminée',
            expiredRedirect  = null,
            bgImageUrl       = null,
            perpetual        = false,
            perpetualSeconds = 86400,
        } = req.body;

        if (!endDate) return res.status(400).json({ error: 'endDate est requis' });

        // Limite Free : 3 countdowns max
        if (plan === 'FREE') {
            const count = await prisma.countdown.count({ where: { userId: req.user.id } });
            if (count >= 3) {
                return res.status(403).json({
                    error: 'Limite atteinte',
                    message: 'Le plan Free est limité à 3 countdowns. Passez à Pro pour en créer davantage.',
                });
            }
        }

        // Labels personnalisés — Pro uniquement
        const finalLabels = plan === 'FREE'
            ? { labelDays:'JOURS', labelHours:'HEURES', labelMinutes:'MIN', labelSeconds:'SEC' }
            : { labelDays, labelHours, labelMinutes, labelSeconds };

        // Redirect, bgImage — Pro uniquement
        const finalBgImageUrl      = plan === 'FREE' ? null : bgImageUrl;
        const finalExpiredRedirect = plan === 'FREE' ? null : expiredRedirect;
        const finalExpiredBehavior = plan === 'FREE' && expiredBehavior === 'REDIRECT' ? 'SHOW_ZEROS' : expiredBehavior;

        // Perpétuel — Business uniquement
        const finalPerpetual        = plan === 'BUSINESS' ? perpetual : false;
        const finalPerpetualSeconds = plan === 'BUSINESS' ? parseInt(perpetualSeconds) : 86400;

        const countdown = await prisma.countdown.create({
            data: {
                userId:           req.user.id,
                name,
                endDate:          new Date(endDate),
                bgColor,
                textColor,
                fontSize:         parseInt(fontSize),
                width:            parseInt(width),
                timezone,
                fontFamily,
                style,
                orientation,
                showUnits,
                ...finalLabels,
                expiredBehavior:  finalExpiredBehavior,
                expiredText,
                expiredRedirect:  finalExpiredRedirect,
                bgImageUrl:       finalBgImageUrl,
                perpetual:        finalPerpetual,
                perpetualSeconds: finalPerpetualSeconds,
            },
        });

        res.json({
            id:     countdown.id,
            gifUrl: buildGifUrl(req, countdown.id),
            countdown,
        });

    } catch (err) {
        console.error('Erreur création countdown :', err);
        res.status(500).json({ error: 'Erreur lors de la création du countdown' });
    }
});

// ── Lister les countdowns ──────────────────────────────────────
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

// ── Modifier un countdown ──────────────────────────────────────
router.put('/countdown/:id', requireAuth, async (req, res) => {
    try {
        const plan = req.user.plan;
        const cd = await prisma.countdown.findUnique({ where: { id: req.params.id } });
        if (!cd) return res.status(404).json({ error: 'Countdown introuvable' });
        if (cd.userId !== req.user.id) return res.status(403).json({ error: 'Non autorisé' });

        const {
            name, endDate, bgColor, textColor, fontSize, width, timezone,
            fontFamily, style, orientation, showUnits,
            labelDays, labelHours, labelMinutes, labelSeconds,
            expiredBehavior, expiredText, expiredRedirect,
        } = req.body;

        const finalLabels = plan === 'FREE'
            ? { labelDays: 'JOURS', labelHours: 'HEURES', labelMinutes: 'MIN', labelSeconds: 'SEC' }
            : { labelDays, labelHours, labelMinutes, labelSeconds };

        const finalExpiredRedirect = plan === 'FREE' ? null : (expiredRedirect || null);
        const finalExpiredBehavior = plan === 'FREE' && expiredBehavior === 'REDIRECT'
            ? 'SHOW_ZEROS'
            : (expiredBehavior || cd.expiredBehavior);

        const updated = await prisma.countdown.update({
            where: { id: req.params.id },
            data: {
                ...(name       !== undefined && { name }),
                ...(endDate    !== undefined && { endDate: new Date(endDate) }),
                ...(bgColor    !== undefined && { bgColor }),
                ...(textColor  !== undefined && { textColor }),
                ...(fontSize   !== undefined && { fontSize: parseInt(fontSize) }),
                ...(width      !== undefined && { width: parseInt(width) }),
                ...(timezone   !== undefined && { timezone }),
                ...(fontFamily !== undefined && { fontFamily }),
                ...(style      !== undefined && { style }),
                ...(orientation !== undefined && { orientation }),
                ...(showUnits  !== undefined && { showUnits }),
                ...finalLabels,
                expiredBehavior: finalExpiredBehavior,
                ...(expiredText !== undefined && { expiredText }),
                expiredRedirect: finalExpiredRedirect,
            },
        });

        res.json({
            id:     updated.id,
            gifUrl: buildGifUrl(req, updated.id),
            countdown: updated,
        });
    } catch (err) {
        console.error('Erreur édition countdown :', err);
        res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
});

// ── Supprimer un countdown ─────────────────────────────────────
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

// ── GIF depuis la base ─────────────────────────────────────────
router.get('/gif/:id', async (req, res) => {
    try {
        const countdown = await prisma.countdown.findUnique({ where: { id: req.params.id } });
        if (!countdown) return res.status(404).send('Countdown introuvable');

        // Redirect post-expiration (Pro)
        if (countdown.expiredBehavior === 'REDIRECT' && countdown.expiredRedirect) {
            const isExpired = !countdown.perpetual && new Date(countdown.endDate) <= new Date();
            if (isExpired) return res.redirect(countdown.expiredRedirect);
        }

        // Log impression (arrière-plan)
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
            {
                fontFamily:       countdown.fontFamily,
                style:            countdown.style,
                orientation:      countdown.orientation,
                showUnits:        countdown.showUnits,
                labelDays:        countdown.labelDays,
                labelHours:       countdown.labelHours,
                labelMinutes:     countdown.labelMinutes,
                labelSeconds:     countdown.labelSeconds,
                expiredBehavior:  countdown.expiredBehavior,
                expiredText:      countdown.expiredText,
                bgImageUrl:       countdown.bgImageUrl,
                perpetual:        countdown.perpetual,
                perpetualSeconds: countdown.perpetualSeconds,
            }
        );

        res.set({
            'Content-Type':  'image/gif',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma':        'no-cache',
            'Expires':       '0',
        });
        res.send(gifBuffer);

    } catch (err) {
        console.error('Erreur GIF :', err);
        res.status(500).send('Erreur génération GIF');
    }
});

// ── GIF preview (sans sauvegarde) ─────────────────────────────
router.get('/gif', async (req, res) => {
    try {
        const {
            endDate      = new Date(Date.now() + 86400000).toISOString(),
            bgColor      = '#ffffff',
            textColor    = '#2563eb',
            fontSize     = 36,
            width        = 400,
            fontFamily   = 'monospace',
            fontLabels      = null,
            blockBgColor    = null,
            sepColor        = null,
            showSeparators  = '1',
            style        = 'rounded',
            orientation  = 'horizontal',
            showUnits    = 'days,hours,minutes,seconds',
            labelDays    = 'JOURS',
            labelHours   = 'HEURES',
            labelMinutes = 'MIN',
            labelSeconds = 'SEC',
        } = req.query;

        if (isNaN(new Date(endDate).getTime())) return res.status(400).json({ error: 'endDate invalide' });

        const gifBuffer = await generateCountdownGif(endDate, bgColor, textColor, fontSize, width, {
            fontFamily,
            fontLabels:      fontLabels     || null,
            blockBgColor:    blockBgColor   || null,
            sepColor:        sepColor       || null,
            showSeparators:  showSeparators !== '0',
            previewMode:     true,
            style, orientation, showUnits,
            labelDays, labelHours, labelMinutes, labelSeconds,
        });

        res.set({
            'Content-Type':  'image/gif',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma':        'no-cache',
            'Expires':       '0',
        });
        res.send(gifBuffer);

    } catch (err) {
        res.status(500).json({ error: 'Erreur génération GIF' });
    }
});

module.exports = router;