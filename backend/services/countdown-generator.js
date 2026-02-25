const { createCanvas } = require('canvas');

function generateCountdownImage(endDate, bgColor, textColor, fontSize) {
    try {
        const canvas = createCanvas(400, 100);
        const ctx = canvas.getContext('2d');

        // Utilisez des valeurs fixes pour tester
        ctx.fillStyle = '#FF0000'; // Rouge pour le fond
        ctx.fillRect(0, 0, 400, 100);
        ctx.fillStyle = '#00FF00'; // Vert pour le texte
        ctx.font = '30px Arial';
        ctx.fillText(`Test de texte`, 50, 50);

        return canvas.toBuffer();
    } catch (error) {
        console.error('Erreur lors de la génération de l\'image :', error);
        throw error;
    }
}

module.exports = { generateCountdownImage };