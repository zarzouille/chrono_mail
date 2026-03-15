/**
 * load-fonts.js — Télécharge et enregistre les polices Google Fonts
 * Chemin : backend/services/load-fonts.js
 */

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const { execSync } = require('child_process');

const FONTS_DIR = path.join(__dirname, '..', 'fonts');

// Toutes les polices disponibles dans le formulaire
const FONT_LIST = [
    {
        family: 'JetBrains Mono',
        file: 'JetBrainsMono-Bold.ttf',
        url: 'https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Bold.ttf',
    },
    {
        family: 'Inter',
        file: 'Inter-Bold.ttf',
        url: 'https://github.com/digitalocean/hacktoberfest/raw/master/app/assets/fonts/Inter-Bold.ttf',
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
        // Doit être téléchargé manuellement via gwfh si absent (voir README)
        url: null,
    },
    {
        family: 'Bebas Neue',
        file: 'BebasNeue-Regular.ttf',
        url: 'https://github.com/dharmatype/Bebas-Neue/raw/master/fonts/BebasNeue(OFL)/ttf/BebasNeue-Regular.ttf',
        fallbackUrl: 'https://github.com/dharmatype/Bebas-Neue/raw/master/fonts/ttf/BebasNeue-Regular.ttf',
    },
    {
        family: 'Pacifico',
        file: 'Pacifico-Regular.ttf',
        url: 'https://github.com/googlefonts/Pacifico/raw/main/fonts/ttf/Pacifico-Regular.ttf',
    },
    {
        family: 'Montserrat',
        file: 'Montserrat-Bold.ttf',
        url: 'https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-Bold.ttf',
    },
    {
        family: 'Raleway',
        file: 'Raleway-Bold.ttf',
        url: 'https://github.com/impallari/Raleway/raw/master/fonts/ttf/Raleway-Bold.ttf',
        fallbackUrl: 'https://github.com/googlefonts/raleway/raw/main/fonts/ttf/Raleway-Bold.ttf',
    },
    {
        family: 'Lato',
        file: 'Lato-Bold.ttf',
        url: 'https://github.com/googlefonts/LatoGFVersion/raw/main/fonts/Lato-Bold.ttf',
    },
    {
        family: 'Nunito',
        file: 'Nunito-Bold.ttf',
        url: 'https://github.com/googlefonts/nunito/raw/main/fonts/variable/Nunito[wght].ttf',
        fallbackUrl: 'https://github.com/googlefonts/nunito/raw/main/fonts/ttf/Nunito-Bold.ttf',
    },
    {
        family: 'Abril Fatface',
        file: 'AbrilFatface-Regular.ttf',
        url: 'https://github.com/googlefonts/AbrilFatface/raw/main/fonts/ttf/AbrilFatface-Regular.ttf',
    },
    {
        family: 'Permanent Marker',
        file: 'PermanentMarker-Regular.ttf',
        url: 'https://github.com/googlefonts/permanent-marker/raw/main/fonts/ttf/PermanentMarker-Regular.ttf',
    },
    {
        family: 'Black Han Sans',
        file: 'BlackHanSans-Regular.ttf',
        url: 'https://github.com/googlefonts/blackhansans/raw/main/fonts/BlackHanSans-Regular.ttf',
        fallbackUrl: 'https://fonts.gstatic.com/s/blackhansans/v17/ea8Aad44WunzF9a-dL6toA8r8nqVIXSkH-Hc.ttf',
    },
];

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file   = fs.createWriteStream(destPath);
        const client = url.startsWith('https') ? https : http;
        const request = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                file.close();
                fs.unlink(destPath, () => {});
                downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        });
        request.on('error', err => { fs.unlink(destPath, () => {}); reject(err); });
    });
}

async function loadFonts() {
    if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });

    const canvas = require('@napi-rs/canvas');
    if (!canvas.GlobalFonts || typeof canvas.GlobalFonts.registerFromPath !== 'function') {
        console.warn('[fonts] GlobalFonts.registerFromPath non disponible');
        return;
    }

    const ok = [], skipped = [], errors = [];

    for (const font of FONT_LIST) {
        const destPath = path.join(FONTS_DIR, font.file);
        try {
            if (!fs.existsSync(destPath)) {
                // Pas d'URL = téléchargement manuel requis, on skip silencieusement
                if (!font.url) {
                    skipped.push(font.family);
                    continue;
                }
                process.stdout.write(`[fonts] Téléchargement ${font.family}...`);
                let downloaded = false;
                for (const url of [font.url, font.fallbackUrl].filter(Boolean)) {
                    try {
                        await downloadFile(url, destPath);
                        const stats = fs.statSync(destPath);
                        if (stats.size > 10000) { downloaded = true; break; }
                        fs.unlinkSync(destPath);
                    } catch(e) { /* essaie le fallback */ }
                }
                if (!downloaded) throw new Error('Toutes les URLs ont échoué');
                const size = Math.round(fs.statSync(destPath).size / 1024);
                process.stdout.write(` ${size}kb OK\n`);
            }

            canvas.GlobalFonts.registerFromPath(destPath, font.family);
            ok.push(font.family);
        } catch (err) {
            process.stdout.write('\n');
            console.warn(`[fonts] Échec "${font.family}": ${err.message}`);
            errors.push(font.family);
        }
    }

    console.log(`[fonts] Chargées (${ok.length}): ${ok.join(', ') || 'aucune'}`);
    if (skipped.length) console.log(`[fonts] À télécharger manuellement: ${skipped.join(', ')}`);
    if (errors.length)  console.warn(`[fonts] Échecs: ${errors.join(', ')}`);
}

module.exports = { loadFonts };