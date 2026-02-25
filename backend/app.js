const express = require('express');
const app = express();
const apiRouter = require('./routes/api');

// Middleware pour servir les fichiers statiques
app.use(express.static('frontend/public'));

// Routes API
app.use('/', apiRouter);

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});