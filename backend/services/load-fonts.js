/**
 * load-fonts.js — Télécharge et enregistre les polices Google Fonts
 * pour @napi-rs/canvas au démarrage du serveur.
 *
 * Chemin : backend/services/load-fonts.js
 * Appelé une seule fois depuis app.js via : require('./services/load-fonts')
 */

const { GlobalFonts } = require('@napi-rs/canvas');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const FONTS_DIR = path.join(__dirname, '..', 'fonts');

// Polices disponibles dans le formulaire (value du select → fichier TTF)
const FONT_LIST = [
    // Famille                     Fichier local          URL Google Fonts (poids 700)
    { family: 'JetBrains Mono',   file: 'JetBrainsMono-Bold.ttf',      url: 'https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4xD-IQ.ttf' },
    { family: 'Inter',            file: 'Inter-Bold.ttf',               url: 'https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.ttf' },
    { family: 'Roboto',           file: 'Roboto-Bold.ttf',              url: 'https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1MmhF4lIjAjZA.ttf' },
    { family: 'Oswald',           file: 'Oswald-Bold.ttf',              url: 'https://fonts.gstatic.com/s/oswald/v53/TK3_WkUHHAIjg75cFRf3bXL8LICs1_Fv.ttf' },
    { family: 'Playfair Display', file: 'PlayfairDisplay-Bold.ttf',     url: 'https://fonts.gstatic.com/s/playfairdisplay/v38/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.ttf' },
    { family: 'Bebas Neue',       file: 'BebasNeue-Regular.ttf',        url: 'https://fonts.gstatic.com/s/bebasneue/v14/JTUSjIg69CK48gW7PXooxW5rygbi49c.ttf' },
    { family: 'Pacifico',         file: 'Pacifico-Regular.ttf',         url: 'https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6H6MmBp0u-.ttf' },
    { family: 'Courier New',      file: null,                            url: null }, // police système, pas besoin de DL
];

/**
 * Télécharge un fichier depuis une URL et le sauvegarde localement.
 */
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, res => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', err => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

/**
 * Charge toutes les polices — télécharge si absentes, enregistre dans canvas.
 * Appelée au démarrage, idempotente (ne re-télécharge pas si fichier présent).
 */
async function loadFonts() {
    // Crée le dossier fonts/ si inexistant
    if (!fs.existsSync(FONTS_DIR)) {
        fs.mkdirSync(FONTS_DIR, { recursive: true });
    }

    const results = { ok: [], skip: [], error: [] };

    for (const font of FONT_LIST) {
        if (!font.file || !font.url) {
            // Police système — pas besoin de DL, toujours disponible
            results.skip.push(font.family);
            continue;
        }

        const destPath = path.join(FONTS_DIR, font.file);

        try {
            // Télécharge seulement si le fichier n'existe pas encore
            if (!fs.existsSync(destPath)) {
                await downloadFile(font.url, destPath);
            }

            // Enregistre la police dans @napi-rs/canvas
            GlobalFonts.registerFont(destPath, font.family);
            results.ok.push(font.family);

        } catch (err) {
            // En cas d'échec, on continue — le generator tombera sur la police système
            console.warn(`[fonts] Impossible de charger "${font.family}": ${err.message}`);
            results.error.push(font.family);
        }
    }

    console.log(`[fonts] Chargées: ${results.ok.join(', ') || 'aucune'}`);
    if (results.error.length) console.warn(`[fonts] Échecs: ${results.error.join(', ')}`);
}

module.exports = { loadFonts };