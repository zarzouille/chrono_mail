const { createCanvas } = require('@napi-rs/canvas');
const GIFEncoder = require('gif-encoder-2');

/**
 * Génère un GIF animé de countdown à partir d'une date cible.
 *
 * @param {string} endDate     - Date cible ISO 8601  ex: "2026-03-15T23:59:00"
 * @param {string} bgColor     - Couleur de fond hex  ex: "#ffffff"
 * @param {string} textColor   - Couleur texte hex    ex: "#2563eb"
 * @param {number} fontSize    - Taille de police     ex: 36
 * @param {number} width       - Largeur en px        ex: 400
 * @returns {Promise<Buffer>}  - Buffer du GIF animé
 */
async function generateCountdownGif(
    endDate,
    bgColor   = '#ffffff',
    textColor = '#2563eb',
    fontSize  = 36,
    width     = 400
) {
    // ── Dimensions ───────────────────────────────────────────────
    const W      = Math.max(200, Math.min(800, parseInt(width) || 400));
    const H      = Math.round(W * 0.28);
    const FRAMES = 10; // 10 secondes d'animation en boucle

    // ── Calcul du temps restant ──────────────────────────────────
    const target = new Date(endDate).getTime();

    function getTimeLeft(offsetSeconds = 0) {
        const diff = target - Date.now() - offsetSeconds * 1000;
        if (diff <= 0) {
            return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
        }
        return {
            days:    Math.floor(diff / 86400000),
            hours:   Math.floor((diff % 86400000) / 3600000),
            minutes: Math.floor((diff % 3600000)  / 60000),
            seconds: Math.floor((diff % 60000)    / 1000),
            expired: false,
        };
    }

    const pad = n => String(n).padStart(2, '0');

    // ── Canvas ───────────────────────────────────────────────────
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');

    const fSize   = Math.max(16, Math.min(60, parseInt(fontSize) || 36));
    const fSizeSm = Math.round(fSize * 0.32);

    // ── Encodeur GIF ─────────────────────────────────────────────
    const encoder = new GIFEncoder(W, H, 'neuquant', true);
    encoder.setDelay(1000);  // 1 frame par seconde
    encoder.setRepeat(0);    // boucle infinie
    encoder.setQuality(10);
    encoder.start();

    // ── Dessin d'une frame ───────────────────────────────────────
    function drawFrame(timeLeft) {
        const { days, hours, minutes, seconds, expired } = timeLeft;

        // Fond
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, W, H);

        if (expired) {
            ctx.fillStyle    = textColor;
            ctx.font         = `bold ${Math.round(fSize * 0.65)}px monospace`;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Offre terminee', W / 2, H / 2);
            return;
        }

        // ── 4 blocs ──────────────────────────────────────────────
        const units = [
            { value: pad(days),    label: 'JOURS'   },
            { value: pad(hours),   label: 'HEURES'  },
            { value: pad(minutes), label: 'MIN'     },
            { value: pad(seconds), label: 'SEC'     },
        ];

        const gap    = Math.round(W * 0.02);
        const blockW = Math.round((W - gap * 5) / 4);
        const blockH = Math.round(H * 0.74);
        const blockY = Math.round((H - blockH) / 2);
        const startX = gap;
        const r      = Math.round(blockW * 0.1);

        units.forEach(({ value, label }, i) => {
            const x = startX + i * (blockW + gap);

            // Fond du bloc
            ctx.fillStyle = '#f0f4ff';
            roundRect(ctx, x, blockY, blockW, blockH, r);
            ctx.fill();

            // Bordure
            ctx.strokeStyle = textColor + '33';
            ctx.lineWidth   = 1;
            roundRect(ctx, x, blockY, blockW, blockH, r);
            ctx.stroke();

            // Valeur numerique
            ctx.fillStyle    = textColor;
            ctx.font         = `bold ${fSize}px monospace`;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(value, x + blockW / 2, blockY + blockH * 0.44);

            // Label
            ctx.fillStyle    = textColor + '88';
            ctx.font         = `bold ${fSizeSm}px sans-serif`;
            ctx.textBaseline = 'top';
            ctx.fillText(label, x + blockW / 2, blockY + blockH * 0.70);

            // Separateur entre blocs
            if (i < units.length - 1) {
                ctx.fillStyle    = textColor + '66';
                ctx.font         = `bold ${Math.round(fSize * 0.7)}px monospace`;
                ctx.textBaseline = 'middle';
                ctx.textAlign    = 'center';
                ctx.fillText(':', x + blockW + gap / 2, blockY + blockH * 0.42);
            }
        });
    }

    // ── Générer les frames ───────────────────────────────────────
    for (let i = 0; i < FRAMES; i++) {
        drawFrame(getTimeLeft(i));
        encoder.addFrame(ctx.getImageData(0, 0, W, H).data);
    }

    encoder.finish();

    return encoder.out.getData();
}

// ── Utilitaire : rectangle arrondi ──────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x,     y + h, x,     y + h - r);
    ctx.lineTo(x,     y + r);
    ctx.quadraticCurveTo(x,     y,     x + r, y);
    ctx.closePath();
}

module.exports = { generateCountdownGif };