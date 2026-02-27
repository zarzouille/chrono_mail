require('dotenv').config();
const express  = require('express');
const path     = require('path');
const passport = require('./lib/passport');
const app      = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Routes API
const authRoutes = require('./routes/auth-routes');
const apiRouter  = require('./routes/api');
app.use('/', authRoutes);
app.use('/', apiRouter);

// Fichiers statiques — chemin absolu pour la production
app.use(express.static(path.join(__dirname, '../frontend/public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});