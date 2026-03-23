const { createCanvas, loadImage } = require('@napi-rs/canvas');
const GIFEncoder = require('gif-encoder-2');

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
        blockBgColor     = null,
        fontLabels       = null,
        sepColor         = null,
        showSeparators   = true,
        previewMode      = false,  // 3 frames au lieu de 10 pour la preview live
        perpetual        = false,
        perpetualSeconds = 86400,
    } = options;

    const W       = Math.max(200, Math.min(800, parseInt(width) || 400));
    const fSize   = Math.max(16, Math.min(50, parseInt(fontSize) || 36));
    const fSizeSm = Math.round(fSize * 0.30);
    const FRAMES  = previewMode ? 3 : 10;

    /**
     * Extrait le premier nom de famille d'une valeur CSS font-family.
     * Ex: "'JetBrains Mono',monospace" → "JetBrains Mono"
     *     "monospace" → "monospace"
     */
    function parseFontFamily(cssValue) {
        if (!cssValue) return 'sans-serif';
        const first = cssValue.split(',')[0].trim().replace(/['"]/g, '');
        return first || 'sans-serif';
    }

    const resolvedFont       = parseFontFamily(fontFamily);
    const resolvedFontLabels = parseFontFamily(fontLabels || 'sans-serif');
    const isVert  = orientation === 'vertical';

    const active   = new Set(showUnits.split(',').map(s => s.trim()));
    const unitDefs = [
        { key: 'days',    label: labelDays    },
        { key: 'hours',   label: labelHours   },
        { key: 'minutes', label: labelMinutes },
        { key: 'seconds', label: labelSeconds },
    ].filter(u => active.has(u.key));
    const unitCount = unitDefs.length || 1;

    const canvasW = W;
    const canvasH = isVert
        ? Math.round(W * 0.95 * unitCount / 4)
        : style === 'circle'
            ? Math.round(W * 0.34)
            : (style === 'inline' || style === 'sentence')
                ? Math.round(W * 0.18)
                : Math.round(W * 0.28);

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

    const canvas  = createCanvas(canvasW, canvasH);
    const ctx     = canvas.getContext('2d');
    const encoder = new GIFEncoder(canvasW, canvasH, 'neuquant', true);
    encoder.setDelay(1000);
    encoder.setRepeat(0);
    encoder.setQuality(10);
    encoder.start();

    let bgImage = null;
    if (bgImageUrl) {
        try { bgImage = await loadImage(bgImageUrl); } catch(e) {}
    }

    function hexToRgb(hex) {
        const h = hex.replace('#', '');
        return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
    }
    function rgba(hex, alpha) {
        const { r, g, b } = hexToRgb(hex);
        return `rgba(${r},${g},${b},${alpha})`;
    }
    function darkenHex(hex, amount = 0.3) {
        const { r, g, b } = hexToRgb(hex);
        return `rgb(${Math.round(r*(1-amount))},${Math.round(g*(1-amount))},${Math.round(b*(1-amount))})`;
    }

    function drawFrame(timeLeft) {
        const { expired } = timeLeft;

        if (style === 'neon') {
            ctx.fillStyle = '#0f0f1a';
            ctx.fillRect(0, 0, canvasW, canvasH);
        } else if (style === 'glass') {
            const grad = ctx.createLinearGradient(0, 0, canvasW, canvasH);
            grad.addColorStop(0, rgba(textColor, 0.85));
            grad.addColorStop(1, darkenHex(textColor, 0.35));
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvasW, canvasH);
        } else if (bgImage) {
            ctx.drawImage(bgImage, 0, 0, canvasW, canvasH);
        } else {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvasW, canvasH);
        }

        if (expired && expiredBehavior !== 'SHOW_ZEROS') {
            if (expiredBehavior === 'SHOW_TEXT') {
                ctx.fillStyle    = style === 'neon' ? textColor : textColor;
                ctx.font         = `bold ${Math.round(fSize * 0.65)}px ${resolvedFont}`;
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(expiredText || 'Offre terminée', canvasW / 2, canvasH / 2);
            }
            return;
        }

        const vals = {
            days:    pad(timeLeft.days),
            hours:   pad(timeLeft.hours),
            minutes: pad(timeLeft.minutes),
            seconds: pad(timeLeft.seconds),
        };

        if (isVert)                drawVertical(vals);
        else if (style === 'inline')   drawInline(vals);
        else if (style === 'sentence') drawSentence(vals);
        else                           drawHorizontal(vals);
    }

    function drawHorizontal(vals) {
        const hasSep    = !['pill','circle'].includes(style);
        const sepCount  = hasSep ? unitCount - 1 : 0;
        // Séparateur : largeur fixe = ~1.8× la taille de police, espace latéraux fixes
        const sepW      = hasSep ? Math.round(fSize * 1.1) : 0;
        const outerGap  = Math.round(canvasW * 0.025);
        // blockW = espace restant après outer gaps + séparateurs, divisé par nb blocs
        const totalSep  = sepCount * sepW;
        const blockW    = Math.round((canvasW - outerGap * 2 - totalSep) / unitCount);
        const blockH    = Math.round(canvasH * 0.74);
        const blockY    = Math.round((canvasH - blockH) / 2);

        let curX = outerGap;
        unitDefs.forEach(({ key, label }, i) => {
            drawBlock(curX, blockY, blockW, blockH, vals[key], label);
            curX += blockW;

            if (i < unitDefs.length - 1 && hasSep) {
                if (showSeparators !== false && showSeparators !== 'false' && showSeparators !== '0') {
                    const sColor = sepColor
                        ? sepColor
                        : style === 'neon'  ? rgba(textColor, 0.7)
                            : style === 'glass' ? 'rgba(255,255,255,0.6)'
                                :                     rgba(textColor, 0.35);
                    ctx.fillStyle    = sColor;
                    ctx.font         = `bold ${Math.round(fSize * 0.6)}px ${resolvedFont}`;
                    ctx.textBaseline = 'middle';
                    ctx.textAlign    = 'center';
                    if (style === 'neon') { ctx.shadowColor = sepColor || textColor; ctx.shadowBlur = 8; }
                    ctx.fillText(':', curX + sepW / 2, blockY + blockH * 0.40);
                    ctx.shadowBlur = 0;
                }
                curX += sepW;
            }
        });
    }

    function drawVertical(vals) {
        const gap    = Math.round(canvasH * 0.03);
        const blockH = Math.round((canvasH - gap * (unitCount + 1)) / unitCount);
        const blockW = Math.round(canvasW * 0.80);
        const blockX = Math.round((canvasW - blockW) / 2);

        unitDefs.forEach(({ key, label }, i) => {
            const y = gap + i * (blockH + gap);
            drawBlock(blockX, y, blockW, blockH, vals[key], label);
        });
    }

    function drawBlock(x, y, bW, bH, value, label) {
        switch (style) {
            case 'flat':     drawBlockFlat(x, y, bW, bH, value, label);     break;
            case 'bordered': drawBlockBordered(x, y, bW, bH, value, label); break;
            case 'glass':    drawBlockGlass(x, y, bW, bH, value, label);    break;
            case 'pill':     drawBlockPill(x, y, bW, bH, value, label);     break;
            case 'circle':   drawBlockCircle(x, y, bW, bH, value, label);   break;
            case 'neon':     drawBlockNeon(x, y, bW, bH, value, label);     break;
            case 'plain':
            case 'inline':
            case 'sentence': drawBlockPlain(x, y, bW, bH, value, label);    break;
            case 'minimal':  drawBlockMinimal(x, y, bW, bH, value, label);  break;
            default:         drawBlockRounded(x, y, bW, bH, value, label);  break;
        }
    }

    function drawBlockRounded(x, y, bW, bH, value, label) {
        const r = Math.round(Math.min(bW, bH) * 0.12);
        ctx.fillStyle = blockBgColor || rgba(textColor, 0.1);
        roundRect(ctx, x, y, bW, bH, r); ctx.fill();
        ctx.strokeStyle = rgba(textColor, 0.2); ctx.lineWidth = 1;
        roundRect(ctx, x, y, bW, bH, r); ctx.stroke();
        drawValue(x, y, bW, bH, value, textColor, !!label);
        drawLabel(x, y, bW, bH, label, rgba(textColor, 0.55));
    }

    function drawBlockFlat(x, y, bW, bH, value, label) {
        ctx.fillStyle = blockBgColor || rgba(textColor, 0.1);
        ctx.fillRect(x, y, bW, bH);
        ctx.strokeStyle = rgba(textColor, 0.2); ctx.lineWidth = 1;
        ctx.strokeRect(x, y, bW, bH);
        drawValue(x, y, bW, bH, value, textColor, !!label);
        drawLabel(x, y, bW, bH, label, rgba(textColor, 0.55));
    }

    function drawBlockBordered(x, y, bW, bH, value, label) {
        ctx.strokeStyle = textColor; ctx.lineWidth = 2;
        roundRect(ctx, x, y, bW, bH, 4); ctx.stroke();
        drawValue(x, y, bW, bH, value, textColor, !!label);
        drawLabel(x, y, bW, bH, label, rgba(textColor, 0.55));
    }

    function drawBlockGlass(x, y, bW, bH, value, label) {
        const r = Math.round(Math.min(bW, bH) * 0.14);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        roundRect(ctx, x, y, bW, bH, r); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
        roundRect(ctx, x, y, bW, bH, r); ctx.stroke();
        const gradReflect = ctx.createLinearGradient(x, y, x, y + bH * 0.4);
        gradReflect.addColorStop(0, 'rgba(255,255,255,0.18)');
        gradReflect.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradReflect;
        roundRect(ctx, x, y, bW, bH * 0.4, r); ctx.fill();
        drawValue(x, y, bW, bH, value, '#ffffff');
        drawLabel(x, y, bW, bH, label, 'rgba(255,255,255,0.75)');
    }

    function drawBlockPill(x, y, bW, bH, value, label) {
        const r = bH / 2;
        ctx.fillStyle = textColor;
        roundRect(ctx, x, y, bW, bH, r); ctx.fill();
        const gradReflet = ctx.createLinearGradient(x, y, x, y + bH * 0.5);
        gradReflet.addColorStop(0, 'rgba(255,255,255,0.2)');
        gradReflet.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradReflet;
        roundRect(ctx, x, y, bW, bH * 0.5, r); ctx.fill();
        drawValue(x, y, bW, bH, value, '#ffffff');
        drawLabel(x, y, bW, bH, label, 'rgba(255,255,255,0.7)');
    }

    function drawBlockCircle(x, y, bW, bH, value, label) {
        const cx     = x + bW / 2;
        const radius = Math.min(bW, bH * 0.78) / 2;
        // Centre le cercle en laissant de la place pour le label en dessous
        const cy     = y + radius + Math.round(bH * 0.04);
        // Fond du cercle = couleur de fond configurée
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = bgColor; ctx.fill();
        // Anneau
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = textColor; ctx.lineWidth = 2; ctx.stroke();
        // Valeur
        ctx.fillStyle = textColor;
        ctx.font = `bold ${fSize}px ${resolvedFont}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(value, cx, cy);
        // Label espacé sous le cercle
        const labelY = cy + radius + Math.round(fSizeSm * 0.9);
        ctx.fillStyle = rgba(textColor, 0.55);
        ctx.font = `bold ${fSizeSm}px sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, labelY);
    }

    function drawBlockNeon(x, y, bW, bH, value, label) {
        const r = Math.round(Math.min(bW, bH) * 0.1);
        ctx.fillStyle = 'rgba(15,15,26,0.9)';
        roundRect(ctx, x, y, bW, bH, r); ctx.fill();
        ctx.strokeStyle = textColor; ctx.lineWidth = 1.5;
        ctx.shadowColor = textColor; ctx.shadowBlur = 8;
        roundRect(ctx, x, y, bW, bH, r); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = textColor;
        ctx.font = `bold ${fSize}px ${resolvedFont}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = textColor; ctx.shadowBlur = 12;
        ctx.fillText(value, x + bW / 2, y + bH * 0.42);
        ctx.shadowBlur = 0;
        ctx.fillStyle = rgba(textColor, 0.55);
        ctx.font = `bold ${fSizeSm}px sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(label, x + bW / 2, y + bH * 0.70);
    }

    function drawBlockPlain(x, y, bW, bH, value, label) {
        drawValue(x, y, bW, bH, value, textColor, !!label);
        drawLabel(x, y, bW, bH, label, rgba(textColor, 0.50));
    }

    function drawBlockMinimal(x, y, bW, bH, value, label) {
        ctx.fillStyle = textColor;
        ctx.font = `bold ${fSize}px ${resolvedFont}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(value, x + bW / 2, y + bH * 0.43);
        if (label) {
            ctx.fillStyle = rgba(textColor, 0.38);
            ctx.font = `${Math.round(fSizeSm * 0.85)}px ${resolvedFontLabels}`;
            ctx.textBaseline = 'top';
            ctx.fillText(label, x + bW / 2, y + bH * 0.75);
        }
    }

    function drawInline(vals) {
        const parts = unitDefs.map(u => vals[u.key]);
        const text  = parts.join(' : ');
        ctx.fillStyle    = textColor;
        ctx.font         = `bold ${fSize}px ${resolvedFont}`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvasW / 2, canvasH / 2);
    }

    function drawSentence(vals) {
        const parts = unitDefs.map(u => `${parseInt(vals[u.key])} ${u.label}`);
        const text  = parts.join('  ·  ');
        ctx.fillStyle    = textColor;
        ctx.font         = `${Math.round(fSize * 0.62)}px ${resolvedFont}`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvasW / 2, canvasH / 2);
    }

    function drawValue(x, y, bW, bH, value, color, hasLabel = true) {
        ctx.fillStyle = color;
        ctx.font = `bold ${fSize}px ${resolvedFont}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        // Si pas de label, centre la valeur verticalement dans le bloc
        const vY = hasLabel ? y + bH * 0.42 : y + bH * 0.5;
        ctx.fillText(value, x + bW / 2, vY);
    }

    function drawLabel(x, y, bW, bH, label, color) {
        if (!label) return; // label vide = on ne dessine rien
        ctx.fillStyle = color;
        ctx.font = `bold ${fSizeSm}px ${resolvedFontLabels}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(label, x + bW / 2, y + bH * 0.70);
    }

    for (let i = 0; i < FRAMES; i++) {
        drawFrame(getTimeLeft(i));
        encoder.addFrame(ctx.getImageData(0, 0, canvasW, canvasH).data);
    }

    encoder.finish();
    return encoder.out.getData();
}

function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
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