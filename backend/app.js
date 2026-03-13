require('dotenv').config();
const { loadFonts } = require('./services/load-fonts');
loadFonts().catch(err => console.error('[fonts] Erreur init:', err));
const express  = require('express');
const path     = require('path');
const passport = require('./lib/passport');
const app      = express();

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
app.use('/', authRoutes);
app.use('/', apiRouter);
app.use('/', stripeRoutes);

// Fichiers statiques
app.use(express.static(path.join(__dirname, '../frontend/public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});