/**
 * load-fonts.js — Télécharge et enregistre les polices Google Fonts
 * Chemin : backend/services/load-fonts.js
 */

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');

const FONTS_DIR = path.join(__dirname, '..', 'fonts');

// URLs directes vers les fichiers TTF (testées et vérifiées)
const FONT_LIST = [
    {
        family: 'JetBrains Mono',
        file: 'JetBrainsMono-Bold.ttf',
        url: 'https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Bold.ttf',
    },
    {
        family: 'Inter',
        file: 'Inter-Bold.ttf',
        url: 'https://github.com/rsms/inter/raw/master/fonts/Inter-Bold.ttf',
    },
    {
        family: 'Roboto',
        file: 'Roboto-Bold.ttf',
        url: 'https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf',
    },
    {
        family: 'Oswald',
        file: 'Oswald-Bold.ttf',
        url: 'https://github.com/googlefonts/OswaldFont/raw/main/fonts/ttf/Oswald-Bold.ttf',
    },
    {
        family: 'Playfair Display',
        file: 'PlayfairDisplay-Bold.ttf',
        url: 'https://github.com/googlefonts/playfair/raw/main/fonts/ttf/PlayfairDisplay-Bold.ttf',
    },
    {
        family: 'Bebas Neue',
        file: 'BebasNeue-Regular.ttf',
        url: 'https://github.com/dharmatype/Bebas-Neue/raw/master/fonts/ttf/BebasNeue-Regular.ttf',
    },
    {
        family: 'Pacifico',
        file: 'Pacifico-Regular.ttf',
        url: 'https://github.com/googlefonts/Pacifico/raw/main/fonts/ttf/Pacifico-Regular.ttf',
    },
];

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file    = fs.createWriteStream(destPath);
        const client  = url.startsWith('https') ? https : http;

        const request = client.get(url, res => {
            // Suit les redirections (GitHub renvoie des 302)
            if (res.statusCode === 301 || res.statusCode === 302) {
                file.close();
                fs.unlink(destPath, () => {});
                downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} pour ${url}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        });

        request.on('error', err => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

async function loadFonts() {
    if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });

    const canvas = require('@napi-rs/canvas');

    if (!canvas.GlobalFonts || typeof canvas.GlobalFonts.registerFromPath !== 'function') {
        console.warn('[fonts] GlobalFonts.registerFromPath non disponible');
        return;
    }

    const ok = [], errors = [];

    for (const font of FONT_LIST) {
        const destPath = path.join(FONTS_DIR, font.file);
        try {
            if (!fs.existsSync(destPath)) {
                process.stdout.write(`[fonts] Téléchargement ${font.family}...`);
                await downloadFile(font.url, destPath);
                // Vérifie que le fichier est bien un TTF valide (>10kb)
                const stats = fs.statSync(destPath);
                if (stats.size < 10000) {
                    fs.unlinkSync(destPath);
                    throw new Error(`Fichier trop petit (${stats.size} bytes) — URL incorrecte`);
                }
                process.stdout.write(` ${Math.round(stats.size/1024)}kb OK\n`);
            }
            canvas.GlobalFonts.registerFromPath(destPath, font.family);
            ok.push(font.family);
        } catch (err) {
            process.stdout.write('\n');
            console.warn(`[fonts] Échec "${font.family}": ${err.message}`);
            errors.push(font.family);
        }
    }

    // Vérifie quelles familles sont bien disponibles dans le canvas
    const registered = canvas.GlobalFonts.getFamilies
        ? canvas.GlobalFonts.getFamilies().map(f => f.family || f)
        : [];

    console.log(`[fonts] Chargées (${ok.length}): ${ok.join(', ') || 'aucune'}`);
    if (registered.length) console.log(`[fonts] Disponibles canvas: ${registered.slice(0,10).join(', ')}`);
    if (errors.length) console.warn(`[fonts] Échecs: ${errors.join(', ')}`);
}

module.exports = { loadFonts };