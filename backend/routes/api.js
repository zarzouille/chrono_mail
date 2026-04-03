const express  = require('express');
const router   = express.Router();
const { generateCountdownGif } = require('../services/countdown-generator');
const prisma   = require('../lib/prisma');
const { requireAuth } = require('../lib/auth');
const gifCache       = require('../services/gif-cache');

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
            blockBgColor     = null,
            fontLabels       = null,
            sepColor         = null,
            perpetual        = false,
            perpetualSeconds = 86400,
        } = req.body;

        if (!endDate) return res.status(400).json({ error: 'endDate est requis' });
        const parsedEndDate = new Date(endDate);
        if (isNaN(parsedEndDate.getTime())) return res.status(400).json({ error: 'endDate invalide' });
        if (parsedEndDate <= new Date()) return res.status(400).json({ error: 'endDate doit être dans le futur' });

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

        // Style — gating par plan
        const PRO_STYLES      = ['glass', 'pill', 'circle'];
        const BUSINESS_STYLES = ['neon'];
        let finalStyle = style;
        if (plan === 'FREE' && (PRO_STYLES.includes(style) || BUSINESS_STYLES.includes(style))) finalStyle = 'rounded';
        if (plan === 'PRO'  && BUSINESS_STYLES.includes(style)) finalStyle = 'rounded';

        // Labels personnalisés — Pro uniquement
        const finalLabels = plan === 'FREE'
            ? { labelDays:'JOURS', labelHours:'HEURES', labelMinutes:'MIN', labelSeconds:'SEC' }
            : { labelDays, labelHours, labelMinutes, labelSeconds };

        // Redirect, bgImage — Pro uniquement
        const finalBgImageUrl      = plan === 'FREE' ? null : bgImageUrl;
        const finalExpiredRedirect = plan === 'FREE' ? null : expiredRedirect;
        const finalExpiredBehavior = plan === 'FREE' && expiredBehavior === 'REDIRECT' ? 'SHOW_ZEROS' : expiredBehavior;

        // Apparence avancée — Pro uniquement
        const finalBlockBgColor = plan === 'FREE' ? null : (blockBgColor || null);
        const finalFontLabels   = plan === 'FREE' ? null : (fontLabels || null);
        const finalSepColor     = plan === 'FREE' ? null : (sepColor || null);

        // Perpétuel — Business uniquement
        const finalPerpetual        = plan === 'BUSINESS' ? perpetual : false;
        const finalPerpetualSeconds = plan === 'BUSINESS' ? Math.max(3600, parseInt(perpetualSeconds) || 86400) : 86400;

        // Borner fontSize et width
        const finalFontSize = Math.max(16, Math.min(50, parseInt(fontSize) || 36));
        const finalWidth    = Math.max(200, Math.min(800, parseInt(width) || 400));

        const countdown = await prisma.countdown.create({
            data: {
                userId:           req.user.id,
                name,
                endDate:          parsedEndDate,
                bgColor,
                textColor,
                fontSize:         finalFontSize,
                width:            finalWidth,
                timezone,
                fontFamily,
                style:            finalStyle,
                orientation,
                showUnits,
                ...finalLabels,
                expiredBehavior:  finalExpiredBehavior,
                expiredText,
                expiredRedirect:  finalExpiredRedirect,
                bgImageUrl:       finalBgImageUrl,
                blockBgColor:     finalBlockBgColor,
                fontLabels:       finalFontLabels,
                sepColor:         finalSepColor,
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
            bgImageUrl,
            blockBgColor, fontLabels, sepColor,
            perpetual, perpetualSeconds,
        } = req.body;

        const finalLabels = plan === 'FREE'
            ? { labelDays: 'JOURS', labelHours: 'HEURES', labelMinutes: 'MIN', labelSeconds: 'SEC' }
            : { labelDays, labelHours, labelMinutes, labelSeconds };

        // Style — gating par plan
        const PRO_STYLES      = ['glass', 'pill', 'circle'];
        const BUSINESS_STYLES = ['neon'];
        let finalStyle = style;
        if (style !== undefined) {
            if (plan === 'FREE' && (PRO_STYLES.includes(style) || BUSINESS_STYLES.includes(style))) finalStyle = cd.style;
            if (plan === 'PRO'  && BUSINESS_STYLES.includes(style)) finalStyle = cd.style;
        }

        const finalExpiredRedirect = plan === 'FREE' ? null : (expiredRedirect || null);
        const finalExpiredBehavior = plan === 'FREE' && expiredBehavior === 'REDIRECT'
            ? 'SHOW_ZEROS'
            : (expiredBehavior || cd.expiredBehavior);
        const finalBgImageUrl   = plan === 'FREE' ? null : (bgImageUrl !== undefined ? (bgImageUrl || null) : undefined);
        const finalBlockBgColor = plan === 'FREE' ? null : (blockBgColor !== undefined ? (blockBgColor || null) : undefined);
        const finalFontLabels   = plan === 'FREE' ? null : (fontLabels !== undefined ? (fontLabels || null) : undefined);
        const finalSepColor     = plan === 'FREE' ? null : (sepColor !== undefined ? (sepColor || null) : undefined);
        const finalPerpetual        = plan === 'BUSINESS' && perpetual !== undefined ? !!perpetual : undefined;
        const finalPerpetualSeconds = plan === 'BUSINESS' && perpetualSeconds !== undefined ? Math.max(3600, parseInt(perpetualSeconds) || 86400) : undefined;

        const updated = await prisma.countdown.update({
            where: { id: req.params.id },
            data: {
                ...(name       !== undefined && { name }),
                ...(endDate    !== undefined && { endDate: new Date(endDate) }),
                ...(bgColor    !== undefined && { bgColor }),
                ...(textColor  !== undefined && { textColor }),
                ...(fontSize   !== undefined && { fontSize: Math.max(16, Math.min(50, parseInt(fontSize) || 36)) }),
                ...(width      !== undefined && { width: Math.max(200, Math.min(800, parseInt(width) || 400)) }),
                ...(timezone   !== undefined && { timezone }),
                ...(fontFamily !== undefined && { fontFamily }),
                ...(finalStyle !== undefined && { style: finalStyle }),
                ...(orientation !== undefined && { orientation }),
                ...(showUnits  !== undefined && { showUnits }),
                ...finalLabels,
                expiredBehavior: finalExpiredBehavior,
                ...(expiredText !== undefined && { expiredText }),
                expiredRedirect: finalExpiredRedirect,
                ...(finalBgImageUrl !== undefined && { bgImageUrl: finalBgImageUrl }),
                ...(finalBlockBgColor !== undefined && { blockBgColor: finalBlockBgColor }),
                ...(finalFontLabels !== undefined && { fontLabels: finalFontLabels }),
                ...(finalSepColor !== undefined && { sepColor: finalSepColor }),
                ...(finalPerpetual !== undefined && { perpetual: finalPerpetual }),
                ...(finalPerpetualSeconds !== undefined && { perpetualSeconds: finalPerpetualSeconds }),
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

        // Redirect post-expiration (Pro) — valider l'URL pour éviter open redirect
        if (countdown.expiredBehavior === 'REDIRECT' && countdown.expiredRedirect) {
            const isExpired = !countdown.perpetual && new Date(countdown.endDate) <= new Date();
            if (isExpired) {
                try {
                    const url = new URL(countdown.expiredRedirect);
                    if (url.protocol === 'http:' || url.protocol === 'https:') {
                        return res.redirect(countdown.expiredRedirect);
                    }
                } catch {}
                // URL invalide ou protocole dangereux → afficher zéros
            }
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
                blockBgColor:     countdown.blockBgColor,
                fontLabels:       countdown.fontLabels,
                sepColor:         countdown.sepColor,
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
        // Vérifie le cache avant de générer
        const cacheKey = gifCache.makeCacheKey(req.query);
        const cached   = gifCache.get(cacheKey);
        if (cached) {
            res.set({
                'Content-Type':  'image/gif',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Cache':       'HIT',
            });
            return res.send(cached);
        }
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

        // Stocke en cache pour les prochaines requêtes identiques
        gifCache.set(cacheKey, gifBuffer);

        res.set({
            'Content-Type':  'image/gif',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma':        'no-cache',
            'Expires':       '0',
            'X-Cache':       'MISS',
        });
        res.send(gifBuffer);

    } catch (err) {
        res.status(500).json({ error: 'Erreur génération GIF' });
    }
});

// ── Analytics : résumé global ─────────────────────────────────
router.get('/analytics/summary', requireAuth, async (req, res) => {
    try {
        if (req.user.plan === 'FREE') return res.status(403).json({ error: 'Réservé aux plans Pro et Business' });

        const countdowns = await prisma.countdown.findMany({
            where: { userId: req.user.id },
            select: { id: true, name: true },
        });
        if (!countdowns.length) return res.json({ total: 0, countdowns: [], daily: [] });

        const cdIds = countdowns.map(c => c.id);

        // Total impressions
        const total = await prisma.impression.count({
            where: { countdownId: { in: cdIds } },
        });

        // Impressions par countdown
        const perCountdown = await prisma.impression.groupBy({
            by: ['countdownId'],
            where: { countdownId: { in: cdIds } },
            _count: { id: true },
        });
        const cdStats = countdowns.map(cd => ({
            id:    cd.id,
            name:  cd.name,
            count: perCountdown.find(p => p.countdownId === cd.id)?._count.id || 0,
        }));

        // Impressions par jour (30 derniers jours)
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const daily = await prisma.$queryRaw`
            SELECT DATE("createdAt") as date, COUNT(*)::int as count
            FROM "Impression"
            WHERE "userId" = ${req.user.id}
              AND "createdAt" >= ${since}
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
        `;

        res.json({ total, countdowns: cdStats, daily });
    } catch (err) {
        console.error('Erreur analytics summary :', err);
        res.status(500).json({ error: 'Erreur analytics' });
    }
});

// ── Analytics : détail par countdown ──────────────────────────
router.get('/analytics/:countdownId', requireAuth, async (req, res) => {
    try {
        if (req.user.plan === 'FREE') return res.status(403).json({ error: 'Réservé aux plans Pro et Business' });

        const cd = await prisma.countdown.findUnique({ where: { id: req.params.countdownId } });
        if (!cd) return res.status(404).json({ error: 'Countdown introuvable' });
        if (cd.userId !== req.user.id) return res.status(403).json({ error: 'Non autorisé' });

        const days = parseInt(req.query.days) || 30;
        const since = new Date();
        since.setDate(since.getDate() - days);

        const total = await prisma.impression.count({
            where: { countdownId: cd.id, createdAt: { gte: since } },
        });

        const daily = await prisma.$queryRaw`
            SELECT DATE("createdAt") as date, COUNT(*)::int as count
            FROM "Impression"
            WHERE "countdownId" = ${cd.id}
              AND "createdAt" >= ${since}
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
        `;

        res.json({ total, days, daily });
    } catch (err) {
        console.error('Erreur analytics countdown :', err);
        res.status(500).json({ error: 'Erreur analytics' });
    }
});

module.exports = router;