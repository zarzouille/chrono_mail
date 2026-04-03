require('dotenv').config();
const { loadFonts } = require('./services/load-fonts');
loadFonts().catch(err => console.error('[fonts] Erreur init:', err));
const express    = require('express');
const path       = require('path');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const passport   = require('./lib/passport');
const app        = express();

// ── Sécurité ──────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin: process.env.APP_URL || '*',
    credentials: true,
}));

// Rate limiters
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 20,                     // 20 tentatives par IP
    message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
});
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,    // 1 minute
    max: 60,                     // 60 requêtes par IP
    message: { error: 'Trop de requêtes, ralentissez' },
});

// ⚠️ Le webhook Stripe doit être enregistré AVANT express.json()
// car il a besoin du body brut pour vérifier la signature
const stripeRoutes = require('./routes/stripe-routes');
app.use('/stripe/webhook', express.raw({ type: 'application/json' }));

// Middleware JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Routes
const authRoutes = require('./routes/auth-routes');
const apiRouter  = require('./routes/api');
app.use('/auth', authLimiter);
app.use('/countdown', apiLimiter);
app.use('/analytics', apiLimiter);
app.use('/', authRoutes);
app.use('/', apiRouter);
app.use('/', stripeRoutes);

// ── Email preview (dev only) ─────────────────────────────────
const { previews } = require('./services/email-service');
app.get('/email-preview/:template?', (req, res) => {
    const name = req.params.template;
    if (!name || !previews[name]) {
        const list = Object.keys(previews).map(k =>
            `<li style="margin:6px 0"><a href="/email-preview/${k}" style="color:#2563eb;font-size:15px">${k}</a></li>`
        ).join('');
        return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Email Previews</title></head>
<body style="font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto">
<h1 style="font-size:24px">Email Previews</h1>
<p style="color:#666">Cliquez sur un template pour le visualiser :</p>
<ul>${list}</ul>
</body></html>`);
    }
    res.send(previews[name]());
});

// Fichiers statiques
app.use(express.static(path.join(__dirname, '../frontend/public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});