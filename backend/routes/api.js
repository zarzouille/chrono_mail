const express = require('express');
const router = express.Router();
const { generateCountdownImage } = require('../services/countdown-generator');

// Route pour générer l'image du countdown
router.get('/generate-countdown', (req, res) => {
    try {
        const { endDate, bgColor, textColor, fontSize } = req.query;
        console.log('Paramètres reçus :', { endDate, bgColor, textColor, fontSize });

        const image = generateCountdownImage(endDate, bgColor, textColor, fontSize);
        res.set('Content-Type', 'image/png');
        res.send(image);
    } catch (error) {
        console.error('Erreur lors de la génération de l\'image :', error);
        res.status(500).send('Erreur lors de la génération de l\'image');
    }
});

module.exports = router;