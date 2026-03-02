const { createCanvas, loadImage } = require('@napi-rs/canvas');
const GIFEncoder = require('gif-encoder-2');

/**
 * Génère un GIF animé de countdown.
 *
 * @param {string} endDate          - Date cible ISO 8601
 * @param {string} bgColor          - Couleur de fond hex
 * @param {string} textColor        - Couleur texte hex
 * @param {number} fontSize         - Taille de police
 * @param {number} width            - Largeur en px
 * @param {object} options          - Options avancées
 * @param {string} options.fontFamily    - 'monospace' | 'serif' | 'sans-serif' | 'cursive'
 * @param {string} options.style         - 'flat' | 'rounded' | 'bordered'
 * @param {string} options.labelDays     - Label jours personnalisé
 * @param {string} options.labelHours    - Label heures personnalisé
 * @param {string} options.labelMinutes  - Label minutes personnalisé
 * @param {string} options.labelSeconds  - Label secondes personnalisé
 * @param {string} options.expiredBehavior - 'SHOW_ZEROS' | 'SHOW_TEXT' | 'SHOW_IMAGE' | 'REDIRECT'
 * @param {string} options.expiredText   - Texte affiché à l'expiration
 * @param {string} options.bgImageUrl    - URL image de fond (Pro)
 * @param {boolean} options.perpetual    - Timer perpétuel/evergreen (Business)
 * @param {number}  options.perpetualSeconds - Durée en secondes pour timer perpétuel
 */
async function generateCountdownGif(
    endDate,
    bgColor   = '#ffffff',
    textColor = '#2563eb',
    fontSize  = 36,
    width     = 400,
    options   = {}
) {
    const {
        fontFamily       = 'monospace',
        style            = 'rounded',
        labelDays        = 'JOURS',
        labelHours       = 'HEURES',
        labelMinutes     = 'MIN',
        labelSeconds     = 'SEC',
        expiredBehavior  = 'SHOW_ZEROS',
        expiredText      = 'Offre terminée',
        bgImageUrl       = null,
        perpetual        = false,
        perpetualSeconds = 86400,
    } = options;

    // ── Dimensions ───────────────────────────────────────────────
    const W      = Math.max(200, Math.min(800, parseInt(width) || 400));
    const H      = Math.round(W * 0.28);
    const FRAMES = 10;

    // ── Image de fond (Pro) ──────────────────────────────────────
    let bgImage = null;
    if (bgImageUrl) {
        try { bgImage = await loadImage(bgImageUrl); } catch (e) { /* ignore */ }
    }

    // ── Calcul du temps restant ──────────────────────────────────
    const target = perpetual ? null : new Date(endDate).getTime();

    function getTimeLeft(offsetSeconds = 0) {
        let diff;
        if (perpetual) {
            // Timer perpétuel : repart de perpetualSeconds à chaque ouverture
            diff = (perpetualSeconds - offsetSeconds) * 1000;
        } else {
            diff = target - Date.now() - offsetSeconds * 1000;
        }

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
    encoder.setDelay(1000);
    encoder.setRepeat(0);
    encoder.setQuality(10);
    encoder.start();

    // ── Dessin d'une frame ───────────────────────────────────────
    function drawFrame(timeLeft) {
        const { days, hours, minutes, seconds, expired } = timeLeft;

        // Fond
        if (bgImage) {
            ctx.drawImage(bgImage, 0, 0, W, H);
        } else {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, W, H);
        }

        if (expired) {
            if (expiredBehavior === 'SHOW_TEXT') {
                ctx.fillStyle    = textColor;
                ctx.font         = `bold ${Math.round(fSize * 0.65)}px ${fontFamily}`;
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(expiredText, W / 2, H / 2);
            } else {
                // SHOW_ZEROS — afficher 00:00:00:00
                drawUnits([
                    { value: '00', label: labelDays },
                    { value: '00', label: labelHours },
                    { value: '00', label: labelMinutes },
                    { value: '00', label: labelSeconds },
                ]);
            }
            return;
        }

        drawUnits([
            { value: pad(days),    label: labelDays },
            { value: pad(hours),   label: labelHours },
            { value: pad(minutes), label: labelMinutes },
            { value: pad(seconds), label: labelSeconds },
        ]);
    }

    function drawUnits(units) {
        const gap    = Math.round(W * 0.02);
        const blockW = Math.round((W - gap * 5) / 4);
        const blockH = Math.round(H * 0.74);
        const blockY = Math.round((H - blockH) / 2);
        const startX = gap;
        const r      = style === 'flat' ? 0 : style === 'bordered' ? 4 : Math.round(blockW * 0.1);

        units.forEach(({ value, label }, i) => {
            const x = startX + i * (blockW + gap);

            // Fond du bloc selon le style
            if (style === 'bordered') {
                ctx.fillStyle = 'transparent';
            } else {
                ctx.fillStyle = hexToRgba(textColor, 0.08);
                roundRect(ctx, x, blockY, blockW, blockH, r);
                ctx.fill();
            }

            // Bordure
            if (style === 'bordered') {
                ctx.strokeStyle = textColor;
                ctx.lineWidth   = 2;
            } else {
                ctx.strokeStyle = hexToRgba(textColor, 0.2);
                ctx.lineWidth   = 1;
            }
            roundRect(ctx, x, blockY, blockW, blockH, r);
            ctx.stroke();

            // Valeur numérique
            ctx.fillStyle    = textColor;
            ctx.font         = `bold ${fSize}px ${fontFamily}`;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(value, x + blockW / 2, blockY + blockH * 0.44);

            // Label
            ctx.fillStyle    = hexToRgba(textColor, 0.6);
            ctx.font         = `bold ${fSizeSm}px sans-serif`;
            ctx.textBaseline = 'top';
            ctx.fillText(label, x + blockW / 2, blockY + blockH * 0.70);

            // Séparateur
            if (i < units.length - 1) {
                ctx.fillStyle    = hexToRgba(textColor, 0.5);
                ctx.font         = `bold ${Math.round(fSize * 0.7)}px ${fontFamily}`;
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

// ── Utilitaires ──────────────────────────────────────────────────
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

function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

module.exports = { generateCountdownGif };