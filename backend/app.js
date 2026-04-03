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

// Fichiers statiques
app.use(express.static(path.join(__dirname, '../frontend/public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});