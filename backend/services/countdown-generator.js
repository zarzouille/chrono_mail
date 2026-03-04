const { createCanvas, loadImage } = require('@napi-rs/canvas');
const GIFEncoder = require('gif-encoder-2');

/**
 * Génère un GIF animé de countdown.
 *
 * @param {string} endDate      - Date cible ISO 8601
 * @param {string} bgColor      - Couleur de fond hex
 * @param {string} textColor    - Couleur texte hex
 * @param {number} fontSize     - Taille de police
 * @param {number} width        - Largeur en px
 * @param {object} options      - Options avancées
 *   @param {string}  options.fontFamily       - monospace|serif|sans-serif|cursive
 *   @param {string}  options.style            - rounded|flat|bordered
 *   @param {string}  options.orientation      - horizontal|vertical
 *   @param {string}  options.showUnits        - ex: "days,hours,minutes,seconds"
 *   @param {string}  options.labelDays
 *   @param {string}  options.labelHours
 *   @param {string}  options.labelMinutes
 *   @param {string}  options.labelSeconds
 *   @param {string}  options.expiredBehavior  - SHOW_ZEROS|SHOW_TEXT|HIDE
 *   @param {string}  options.expiredText
 *   @param {string}  options.bgImageUrl
 *   @param {boolean} options.perpetual
 *   @param {number}  options.perpetualSeconds
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
        orientation      = 'horizontal',
        showUnits        = 'days,hours,minutes,seconds',
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

    // ── Paramètres normalisés ────────────────────────────────────
    const W        = Math.max(200, Math.min(800, parseInt(width) || 400));
    const fSize    = Math.max(16, Math.min(60, parseInt(fontSize) || 36));
    const fSizeSm  = Math.round(fSize * 0.32);
    const FRAMES   = 10;
    const isVert   = orientation === 'vertical';

    // Unités actives dans l'ordre
    const allUnits = ['days', 'hours', 'minutes', 'seconds'];
    const active   = new Set(showUnits.split(',').map(s => s.trim()));
    const unitDefs = [
        { key: 'days',    label: labelDays    },
        { key: 'hours',   label: labelHours   },
        { key: 'minutes', label: labelMinutes },
        { key: 'seconds', label: labelSeconds },
    ].filter(u => active.has(u.key));

    const unitCount = unitDefs.length || 1;

    // ── Dimensions selon orientation ────────────────────────────
    let canvasW, canvasH;
    if (isVert) {
        canvasW = W;
        canvasH = Math.round(W * 1.0 * unitCount / 4); // hauteur proportionnelle
    } else {
        canvasW = W;
        canvasH = Math.round(W * 0.28);
    }

    // ── Calcul du temps restant ──────────────────────────────────
    const target = perpetual
        ? Date.now() + perpetualSeconds * 1000
        : new Date(endDate).getTime();

    function getTimeLeft(offsetSeconds = 0) {
        const diff = target - Date.now() - offsetSeconds * 1000;
        if (diff <= 0) return { days:0, hours:0, minutes:0, seconds:0, expired:true };
        return {
            days:    Math.floor(diff / 86400000),
            hours:   Math.floor((diff % 86400000) / 3600000),
            minutes: Math.floor((diff % 3600000)  / 60000),
            seconds: Math.floor((diff % 60000)    / 1000),
            expired: false,
        };
    }

    const pad = n => String(n).padStart(2, '0');

    // ── Canvas + encodeur ────────────────────────────────────────
    const canvas  = createCanvas(canvasW, canvasH);
    const ctx     = canvas.getContext('2d');
    const encoder = new GIFEncoder(canvasW, canvasH, 'neuquant', true);
    encoder.setDelay(1000);
    encoder.setRepeat(0);
    encoder.setQuality(10);
    encoder.start();

    // ── Image de fond optionnelle (Pro) ─────────────────────────
    let bgImage = null;
    if (bgImageUrl) {
        try { bgImage = await loadImage(bgImageUrl); } catch(e) { /* ignore */ }
    }

    // ── Couleur RGBA helper ──────────────────────────────────────
    function hexToRgba(hex, alpha = 1) {
        const h = hex.replace('#', '');
        const r = parseInt(h.slice(0,2),16);
        const g = parseInt(h.slice(2,4),16);
        const b = parseInt(h.slice(4,6),16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    // ── Dessin d'une frame ───────────────────────────────────────
    function drawFrame(timeLeft) {
        const { expired } = timeLeft;

        // Fond
        if (bgImage) {
            ctx.drawImage(bgImage, 0, 0, canvasW, canvasH);
        } else {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvasW, canvasH);
        }

        // Texte expiré
        if (expired && expiredBehavior !== 'SHOW_ZEROS') {
            if (expiredBehavior === 'SHOW_TEXT') {
                ctx.fillStyle    = textColor;
                ctx.font         = `bold ${Math.round(fSize * 0.65)}px ${fontFamily}`;
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(expiredText || 'Offre terminée', canvasW / 2, canvasH / 2);
            }
            return;
        }

        // Valeurs à afficher
        const vals = {
            days:    pad(timeLeft.days),
            hours:   pad(timeLeft.hours),
            minutes: pad(timeLeft.minutes),
            seconds: pad(timeLeft.seconds),
        };

        if (isVert) {
            drawVertical(vals);
        } else {
            drawHorizontal(vals);
        }
    }

    // ── Layout HORIZONTAL ────────────────────────────────────────
    function drawHorizontal(vals) {
        const gap    = Math.round(canvasW * 0.025);
        const blockW = Math.round((canvasW - gap * (unitCount + 1)) / unitCount);
        const blockH = Math.round(canvasH * 0.74);
        const blockY = Math.round((canvasH - blockH) / 2);
        const r      = style === 'rounded' ? Math.round(blockW * 0.1) : style === 'bordered' ? 4 : 0;

        unitDefs.forEach(({ key, label }, i) => {
            const x = gap + i * (blockW + gap);
            drawBlock(x, blockY, blockW, blockH, r, vals[key], label);

            // Séparateur
            if (i < unitDefs.length - 1) {
                ctx.fillStyle    = hexToRgba(textColor, 0.5);
                ctx.font         = `bold ${Math.round(fSize * 0.7)}px ${fontFamily}`;
                ctx.textBaseline = 'middle';
                ctx.textAlign    = 'center';
                ctx.fillText(':', x + blockW + gap / 2, blockY + blockH * 0.42);
            }
        });
    }

    // ── Layout VERTICAL ──────────────────────────────────────────
    function drawVertical(vals) {
        const gap    = Math.round(canvasH * 0.025 / unitCount);
        const blockH = Math.round((canvasH - gap * (unitCount + 1)) / unitCount);
        const blockW = Math.round(canvasW * 0.82);
        const blockX = Math.round((canvasW - blockW) / 2);
        const r      = style === 'rounded' ? Math.round(blockH * 0.15) : style === 'bordered' ? 4 : 0;

        unitDefs.forEach(({ key, label }, i) => {
            const y = gap + i * (blockH + gap);
            drawBlock(blockX, y, blockW, blockH, r, vals[key], label);
        });
    }

    // ── Dessin d'un bloc (commun horizontal/vertical) ────────────
    function drawBlock(x, y, bW, bH, r, value, label) {
        if (style === 'bordered') {
            // Bordure seule, fond transparent
            ctx.strokeStyle = textColor;
            ctx.lineWidth   = 2;
            roundRect(ctx, x, y, bW, bH, r);
            ctx.stroke();
        } else {
            // Fond teinté
            ctx.fillStyle = hexToRgba(textColor, 0.1);
            roundRect(ctx, x, y, bW, bH, r);
            ctx.fill();
            ctx.strokeStyle = hexToRgba(textColor, 0.2);
            ctx.lineWidth   = 1;
            roundRect(ctx, x, y, bW, bH, r);
            ctx.stroke();
        }

        // Valeur numérique
        ctx.fillStyle    = textColor;
        ctx.font         = `bold ${fSize}px ${fontFamily}`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(value, x + bW / 2, y + bH * 0.42);

        // Label
        ctx.fillStyle    = hexToRgba(textColor, 0.6);
        ctx.font         = `bold ${fSizeSm}px sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(label, x + bW / 2, y + bH * 0.68);
    }

    // ── Génération des frames ────────────────────────────────────
    for (let i = 0; i < FRAMES; i++) {
        drawFrame(getTimeLeft(i));
        encoder.addFrame(ctx.getImageData(0, 0, canvasW, canvasH).data);
    }

    encoder.finish();
    return encoder.out.getData();
}

// ── Rectangle arrondi ────────────────────────────────────────────
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