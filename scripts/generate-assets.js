/**
 * Génère og-image.png, favicon-32.png et apple-touch-icon.png
 * Usage: node scripts/generate-assets.js
 */
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'frontend', 'public');

// ─── OG Image 1200x630 ───
function generateOgImage() {
    const w = 1200, h = 630;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1d4ed8');
    grad.addColorStop(0.5, '#2563eb');
    grad.addColorStop(1, '#3b82f6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle grid pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Logo dot
    ctx.beginPath();
    ctx.arc(100, 200, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Logo text
    ctx.font = '800 42px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('chrono', 124, 214);
    ctx.font = '500 42px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('.mail', 290, 214);

    // Main headline
    ctx.font = '800 64px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('Des countdowns GIF', 100, 330);
    ctx.fillText('pour vos emails', 100, 405);

    // Subtext
    ctx.font = '400 24px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('11 styles \u00B7 Analytiques temps r\u00E9el \u00B7 Compatible tous les ESP', 100, 465);

    // Fake countdown blocks on the right
    const blocks = ['04', '18', '33', '12'];
    const labels = ['JOURS', 'HEURES', 'MIN', 'SEC'];
    const startX = 730;
    const blockY = 510;
    const bw = 90, bh = 80, gap = 16;

    blocks.forEach((val, i) => {
        const x = startX + i * (bw + gap);
        // Block background
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(x, blockY, bw, bh, 12);
        ctx.fill();

        // Number
        ctx.font = '700 36px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(val, x + bw / 2, blockY + 48);

        // Label
        ctx.font = '600 11px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(labels[i], x + bw / 2, blockY + 70);
    });

    // Separators
    ctx.font = '700 32px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
        const x = startX + (i + 1) * (bw + gap) - gap / 2;
        ctx.fillText(':', x, blockY + 44);
    }

    ctx.textAlign = 'left';

    // CTA badge
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.roundRect(100, 510, 320, 44, 22);
    ctx.fill();
    ctx.font = '600 16px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('Gratuit \u2014 Aucune carte requise', 260, 538);
    ctx.textAlign = 'left';

    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(OUT, 'og-image.png'), buf);
    console.log('✅ og-image.png (1200x630)');
}

// ─── Favicon 32x32 ───
function generateFavicon32() {
    const s = 32;
    const canvas = createCanvas(s, s);
    const ctx = canvas.getContext('2d');

    // Blue circle
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#2563eb';
    ctx.fill();

    // Letter C
    ctx.font = '700 18px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('C', 16, 17);

    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(OUT, 'favicon-32.png'), buf);
    console.log('✅ favicon-32.png (32x32)');
}

// ─── Apple Touch Icon 180x180 ───
function generateAppleTouchIcon() {
    const s = 180;
    const canvas = createCanvas(s, s);
    const ctx = canvas.getContext('2d');

    // Rounded rect background
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.roundRect(0, 0, s, s, 36);
    ctx.fill();

    // Letter C
    ctx.font = '700 100px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('C', 90, 95);

    // Small dot
    ctx.beginPath();
    ctx.arc(135, 60, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), buf);
    console.log('✅ apple-touch-icon.png (180x180)');
}

generateOgImage();
generateFavicon32();
generateAppleTouchIcon();
console.log('\nDone! Assets saved to frontend/public/');
