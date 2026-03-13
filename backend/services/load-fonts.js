/**
 * load-fonts.js — Télécharge et enregistre les polices Google Fonts
 * Chemin : backend/services/load-fonts.js
 */

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const FONTS_DIR = path.join(__dirname, '..', 'fonts');

const FONT_LIST = [
    { family: 'JetBrains Mono',   file: 'JetBrainsMono-Bold.ttf',    url: 'https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4xD-IQ.ttf' },
    { family: 'Inter',            file: 'Inter-Bold.ttf',             url: 'https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.ttf' },
    { family: 'Roboto',           file: 'Roboto-Bold.ttf',            url: 'https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1MmhF4lIjAjZA.ttf' },
    { family: 'Oswald',           file: 'Oswald-Bold.ttf',            url: 'https://fonts.gstatic.com/s/oswald/v53/TK3_WkUHHAIjg75cFRf3bXL8LICs1_Fv.ttf' },
    { family: 'Playfair Display', file: 'PlayfairDisplay-Bold.ttf',   url: 'https://fonts.gstatic.com/s/playfairdisplay/v38/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.ttf' },
    { family: 'Bebas Neue',       file: 'BebasNeue-Regular.ttf',      url: 'https://fonts.gstatic.com/s/bebasneue/v14/JTUSjIg69CK48gW7PXooxW5rygbi49c.ttf' },
    { family: 'Pacifico',         file: 'Pacifico-Regular.ttf',       url: 'https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6H6MmBp0u-.ttf' },
];

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, res => {
            if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', err => { fs.unlink(destPath, () => {}); reject(err); });
    });
}

async function loadFonts() {
    if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });

    // Détecte la bonne API selon la version de @napi-rs/canvas
    const canvas = require('@napi-rs/canvas');

    // Essaie les différentes APIs selon la version
    let registerFn = null;

    // API correcte : GlobalFonts.registerFromPath(filePath, family)
    if (!canvas.GlobalFonts || typeof canvas.GlobalFonts.registerFromPath !== 'function') {
        console.warn('[fonts] GlobalFonts.registerFromPath non disponible');
        return;
    }
    registerFn = (filePath, family) => canvas.GlobalFonts.registerFromPath(filePath, family);
    console.log('[fonts] API: GlobalFonts.registerFromPath');

    const ok = [], errors = [];

    for (const font of FONT_LIST) {
        const destPath = path.join(FONTS_DIR, font.file);
        try {
            if (!fs.existsSync(destPath)) {
                await downloadFile(font.url, destPath);
            }
            registerFn(destPath, font.family);
            ok.push(font.family);
        } catch (err) {
            console.warn(`[fonts] Echec "${font.family}": ${err.message}`);
            errors.push(font.family);
        }
    }

    console.log(`[fonts] Chargees: ${ok.join(', ') || 'aucune'}`);
    if (errors.length) console.warn(`[fonts] Echecs: ${errors.join(', ')}`);
}

module.exports = { loadFonts };