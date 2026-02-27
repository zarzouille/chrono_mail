// ============================================================
// AUTH — gestion du token JWT en localStorage
// ============================================================
function getToken()  { return localStorage.getItem('cm_token'); }
function getUser()   { return JSON.parse(localStorage.getItem('cm_user') || 'null'); }
function isLoggedIn(){ return !!getToken(); }

function saveAuth(token, user) {
    localStorage.setItem('cm_token', token);
    localStorage.setItem('cm_user', JSON.stringify(user));
    updateNavAuth();
}

function logout() {
    localStorage.removeItem('cm_token');
    localStorage.removeItem('cm_user');
    updateNavAuth();
    showPage('landing');
    showToast('👋 Déconnecté');
}

function updateNavAuth() {
    const loggedIn = isLoggedIn();
    const user     = getUser();
    document.getElementById('nav-cta-guest').style.display = loggedIn ? 'none'  : 'flex';
    document.getElementById('nav-cta-user').style.display  = loggedIn ? 'flex'  : 'none';
    if (loggedIn && user) {
        document.getElementById('nav-user-name').textContent = user.name || user.email;
    }
}

function handleDashboardClick() {
    if (isLoggedIn()) showPage('dashboard');
    else showPage('login');
}

// ============================================================
// NAVIGATION
// ============================================================
function showPage(name) {
    // Protéger les pages qui nécessitent une connexion
    if (['dashboard','create'].includes(name) && !isLoggedIn()) {
        showPage('login');
        return;
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    window.scrollTo(0, 0);
    if (name === 'dashboard') loadDashboard();
}

// ============================================================
// AUTH — appels API
// ============================================================
async function login() {
    const btn      = document.getElementById('login-btn');
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');

    errEl.style.display = 'none';

    if (!email || !password) {
        errEl.textContent = 'Veuillez remplir tous les champs';
        errEl.style.display = 'block';
        return;
    }

    btn.textContent = '⏳ Connexion...';
    btn.disabled    = true;

    try {
        const res  = await fetch('/auth/login', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
            errEl.textContent   = data.error || 'Erreur de connexion';
            errEl.style.display = 'block';
            return;
        }

        saveAuth(data.token, data.user);
        showPage('dashboard');
        showToast('👋 Bienvenue ' + (data.user.name || data.user.email) + ' !');

    } catch (err) {
        errEl.textContent   = 'Erreur réseau, réessayez';
        errEl.style.display = 'block';
    } finally {
        btn.textContent = 'Se connecter';
        btn.disabled    = false;
    }
}

async function register() {
    const btn      = document.getElementById('register-btn');
    const name     = document.getElementById('register-name').value.trim();
    const email    = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const errEl    = document.getElementById('register-error');

    errEl.style.display = 'none';

    if (!email || !password) {
        errEl.textContent   = 'Email et mot de passe requis';
        errEl.style.display = 'block';
        return;
    }
    if (password.length < 8) {
        errEl.textContent   = 'Mot de passe trop court (8 caractères minimum)';
        errEl.style.display = 'block';
        return;
    }

    btn.textContent = '⏳ Création...';
    btn.disabled    = true;

    try {
        const res  = await fetch('/auth/register', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, password, name }),
        });
        const data = await res.json();

        if (!res.ok) {
            errEl.textContent   = data.error || 'Erreur lors de l\'inscription';
            errEl.style.display = 'block';
            return;
        }

        saveAuth(data.token, data.user);
        showPage('dashboard');
        showToast('🎉 Compte créé, bienvenue !');

    } catch (err) {
        errEl.textContent   = 'Erreur réseau, réessayez';
        errEl.style.display = 'block';
    } finally {
        btn.textContent = 'Créer mon compte →';
        btn.disabled    = false;
    }
}

// ============================================================
// FETCH AUTHENTIFIÉ
// ============================================================
async function authFetch(url, options = {}) {
    const token = getToken();
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
    });
}

// ============================================================
// HERO TIMER
// ============================================================
const heroTarget = new Date(Date.now() + 4 * 86400000 + 18 * 3600000 + 33 * 60000);
function updateHeroTimer() {
    const diff = heroTarget - Date.now();
    if (diff <= 0) return;
    const pad = n => String(n).padStart(2, '0');
    document.getElementById('hero-days').textContent  = pad(Math.floor(diff / 86400000));
    document.getElementById('hero-hours').textContent = pad(Math.floor((diff % 86400000) / 3600000));
    document.getElementById('hero-mins').textContent  = pad(Math.floor((diff % 3600000) / 60000));
    document.getElementById('hero-secs').textContent  = pad(Math.floor((diff % 60000) / 1000));
}
setInterval(updateHeroTimer, 1000);
updateHeroTimer();

// ============================================================
// PREVIEW TIMER
// ============================================================
let previewTarget = new Date(Date.now() + 4 * 86400000 + 18 * 3600000 + 33 * 60000);
let currentColor  = '#2563eb';
let currentBg     = '#ffffff';
let activeCodeTab = 'minimal';
let currentGifUrl = '';

setTimeout(() => {
    const el = document.getElementById('cd-date');
    if (el) el.value = new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16);
}, 0);

function updatePreview() {
    const el = document.getElementById('cd-date');
    if (el && el.value) previewTarget = new Date(el.value);
}

function updatePreviewTimer() {
    const diff = previewTarget - Date.now();
    const pad  = n => String(n).padStart(2, '0');
    const vals = diff > 0 ? [
        Math.floor(diff / 86400000),
        Math.floor((diff % 86400000) / 3600000),
        Math.floor((diff % 3600000) / 60000),
        Math.floor((diff % 60000) / 1000),
    ] : [0,0,0,0];
    ['days','hours','mins','secs'].forEach((k, i) => {
        const el = document.getElementById('prev-' + k);
        if (el) el.textContent = pad(vals[i]);
    });
}
setInterval(updatePreviewTimer, 1000);

// ============================================================
// COULEURS
// ============================================================
function pickColor(el) {
    document.querySelectorAll('#color-picker .swatch').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    currentColor = el.dataset.color;
    applyPreviewColors();
}

function pickBg(el) {
    document.querySelectorAll('#bg-picker .swatch').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    currentBg = el.dataset.color;
    const box = document.getElementById('gif-preview-box');
    if (box) box.style.background = currentBg;
    applyPreviewColors();
}

function applyPreviewColors() {
    const hex = currentColor.replace('#', '');
    const r   = parseInt(hex.slice(0,2), 16);
    const g   = parseInt(hex.slice(2,4), 16);
    const b   = parseInt(hex.slice(4,6), 16);
    document.querySelectorAll('.gif-num').forEach(el => {
        el.style.color       = currentColor;
        el.style.background  = `rgba(${r},${g},${b},0.1)`;
        el.style.borderColor = `rgba(${r},${g},${b},0.25)`;
    });
}

// ============================================================
// PUBLICATION
// ============================================================
async function publishCountdown() {
    const btn      = document.getElementById('publish-btn');
    const name     = document.getElementById('cd-name')?.value || 'Mon countdown';
    const endDate  = document.getElementById('cd-date')?.value;
    const width    = document.getElementById('cd-width')?.value || 400;
    const timezone = document.getElementById('cd-timezone')?.value || 'Europe/Paris';

    if (!endDate) { showToast('⚠️ Veuillez choisir une date'); return; }

    btn.textContent = '⏳ Génération...';
    btn.disabled    = true;

    try {
        const res = await authFetch('/countdown', {
            method: 'POST',
            body: JSON.stringify({ name, endDate, bgColor: currentBg, textColor: currentColor, fontSize: 36, width: parseInt(width), timezone }),
        });
        const data = await res.json();

        if (!res.ok) {
            showToast('❌ ' + (data.message || data.error || 'Erreur'));
            return;
        }

        currentGifUrl = data.gifUrl;
        displayCode(data.gifUrl);
        showToast('🚀 Countdown publié !');

    } catch (err) {
        showToast('❌ Erreur réseau');
    } finally {
        btn.textContent = '✓ Publier & obtenir le code';
        btn.disabled    = false;
    }
}

function displayCode(gifUrl) {
    const section = document.getElementById('code-section');
    if (section) section.style.display = 'block';
    const urlDisplay = document.getElementById('gif-url-display');
    if (urlDisplay) urlDisplay.textContent = gifUrl;

    window._codeSnippets = {
        minimal:  `<img\n  src="${gifUrl}"\n  alt="Offre expire dans..."\n  width="400"\n/>`,
        standard: `<img\n  src="${gifUrl}"\n  border="0"\n  style="display:block"\n  alt="Timer from chrono.mail"\n  title="Timer from chrono.mail"\n  width="400"\n/>`,
        esp:      `<a href="https://votresite.com/offre" target="_blank">\n  <img\n    src="${gifUrl}"\n    border="0"\n    style="display:block"\n    alt="Timer from chrono.mail"\n    width="400"\n  />\n</a>`,
    };

    document.getElementById('code-minimal-content').textContent  = window._codeSnippets.minimal;
    document.getElementById('code-standard-content').textContent = window._codeSnippets.standard;
    document.getElementById('code-esp-content').textContent      = window._codeSnippets.esp;
}

// ============================================================
// CODE TABS
// ============================================================
function switchCodeTab(name, btn) {
    activeCodeTab = name;
    document.querySelectorAll('.code-tab-btn').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.code-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('code-' + name).classList.add('active');
}

function copyCurrentCode() {
    const s = window._codeSnippets;
    if (!s) { showToast('⚠️ Publiez d\'abord le countdown'); return; }
    navigator.clipboard.writeText(s[activeCodeTab]).then(() => showToast('📋 Code HTML copié !'));
}

function copyUrl() {
    if (!currentGifUrl) { showToast('⚠️ Publiez d\'abord le countdown'); return; }
    navigator.clipboard.writeText(currentGifUrl).then(() => showToast('🔗 URL copiée !'));
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
    const grid = document.getElementById('cards-grid');
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">Chargement...</div>';

    try {
        const res  = await authFetch('/countdowns');
        if (res.status === 401) { logout(); return; }
        const data = await res.json();

        const total   = data.length;
        const active  = data.filter(c => new Date(c.endDate) > new Date()).length;
        const expired = data.filter(c => new Date(c.endDate) <= new Date()).length;
        const pct     = Math.min(100, Math.round((total / 3) * 100));

        const fill = document.getElementById('quota-fill');
        const text = document.getElementById('quota-text');
        const sub  = document.getElementById('dash-subtitle');
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = `${total} / 3 countdowns`;
        if (sub)  sub.textContent  = `${active} actif${active !== 1 ? 's' : ''} · ${expired} expiré${expired !== 1 ? 's' : ''}`;

        grid.innerHTML = '';
        data.forEach(cd => grid.appendChild(buildCard(cd)));

        if (total < 3) {
            const add = document.createElement('div');
            add.className = 'cd-card cd-card-add';
            add.onclick   = () => showPage('create');
            add.innerHTML = `<div class="cd-card-add-icon">+</div><div style="font-size:14px;font-weight:600">Nouveau countdown</div><div style="font-size:12.5px">${3 - total} emplacement${3 - total > 1 ? 's' : ''} restant${3 - total > 1 ? 's' : ''}</div>`;
            grid.appendChild(add);
        }

    } catch (err) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--red)">Erreur de chargement</div>';
    }
}

function buildCard(cd) {
    const isActive = new Date(cd.endDate) > new Date();
    const diff     = new Date(cd.endDate) - new Date();
    const pad      = n => String(n).padStart(2, '0');
    const days     = pad(Math.max(0, Math.floor(diff / 86400000)));
    const hours    = pad(Math.max(0, Math.floor((diff % 86400000) / 3600000)));
    const mins     = pad(Math.max(0, Math.floor((diff % 3600000) / 60000)));
    const secs     = pad(Math.max(0, Math.floor((diff % 60000) / 1000)));
    const dateStr  = new Date(cd.endDate).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' });
    const imps     = cd._count?.impressions ?? 0;
    const dimStyle = isActive ? '' : 'opacity:.65';

    const card = document.createElement('div');
    card.className = 'cd-card';
    card.style = dimStyle;
    card.innerHTML = `
    <div class="cd-card-header">
      <div>
        <div class="cd-card-name">${cd.name}</div>
        <div class="cd-card-date">${isActive ? 'Expire le' : 'Expiré le'} ${dateStr}</div>
      </div>
      <div class="status-pill ${isActive ? 'active' : 'expired'}">
        <div class="status-pill-dot"></div>${isActive ? 'Actif' : 'Expiré'}
      </div>
    </div>
    <div class="cd-mini">
      <div class="cd-mini-unit" style="${!isActive ? 'color:var(--muted2)' : ''}">${days}</div>
      <div class="cd-mini-sep">:</div>
      <div class="cd-mini-unit" style="${!isActive ? 'color:var(--muted2)' : ''}">${hours}</div>
      <div class="cd-mini-sep">:</div>
      <div class="cd-mini-unit" style="${!isActive ? 'color:var(--muted2)' : ''}">${mins}</div>
      <div class="cd-mini-sep">:</div>
      <div class="cd-mini-unit" style="${!isActive ? 'color:var(--muted2)' : ''}">${secs}</div>
    </div>
    <div class="cd-card-stats">
      <div class="cd-stat"><strong>${imps}</strong>impressions</div>
      <div class="cd-stat"><strong>${cd.width}px</strong>largeur</div>
      <div class="cd-stat"><strong><a href="/gif/${cd.id}" target="_blank" style="color:var(--accent);text-decoration:none">Voir GIF →</a></strong></div>
    </div>
  `;
    return card;
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ============================================================
// INIT
// ============================================================
updateNavAuth();

// ============================================================
// GOOGLE OAUTH — récupération du token depuis l'URL
// ============================================================
(function handleGoogleCallback() {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token');
    const user   = params.get('user');

    if (token && user) {
        try {
            saveAuth(token, JSON.parse(decodeURIComponent(user)));
            // Nettoyer l'URL
            window.history.replaceState({}, document.title, '/');
            showPage('dashboard');
            showToast('🎉 Connecté avec Google !');
        } catch (e) {
            console.error('Erreur parsing user Google', e);
        }
    }
})();

// ============================================================
// STRIPE — checkout
// ============================================================
async function upgradePlan(priceKey) {
    try {
        showToast('⏳ Redirection vers le paiement...');
        const res  = await authFetch('/stripe/checkout', {
            method: 'POST',
            body:   JSON.stringify({ priceKey }),
        });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
        else showToast('❌ ' + (data.error || 'Erreur'));
    } catch (err) {
        showToast('❌ Erreur réseau');
    }
}

async function openBillingPortal() {
    try {
        const res  = await authFetch('/stripe/portal', { method: 'POST' });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
        else showToast('❌ ' + (data.error || 'Erreur'));
    } catch (err) {
        showToast('❌ Erreur réseau');
    }
}

// Gérer le retour depuis Stripe Checkout
(function handleCheckoutReturn() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('checkout');
    if (status === 'success') {
        window.history.replaceState({}, document.title, '/');
        showToast('🎉 Abonnement activé !');
        if (isLoggedIn()) showPage('dashboard');
    } else if (status === 'cancelled') {
        window.history.replaceState({}, document.title, '/');
        showToast('Paiement annulé');
    }
})();