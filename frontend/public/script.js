/**
 * script.js — chrono.mail
 * ============================================================
 * Sections :
 *   1.  AUTH          — Token JWT, session utilisateur
 *   2.  NAVIGATION    — Routage SPA
 *   3.  API AUTH      — Login / Register
 *   4.  FETCH AUTH    — Wrapper fetch authentifié
 *   5.  HERO TIMER    — Timer animé landing page
 //   6.  PREVIEW GIF LIVE — Debounce 500ms, orientation, unités
 //   7.  ACCORDÉONS — Étapes de création + progression
 //   8.  APPARENCE — Couleur, police, style, taille, orientation
 *   9.  COLOR PICKER  — Input natif + swatches
 *  10.  POST-EXPIRATION — UI comportement après expiration
 *  11.  PLAN GATES    — Verrouillage options par plan
 *  12.  APERÇU GIF    — Vrai GIF généré côté serveur
 *  13.  PUBLICATION   — Envoi countdown + affichage code
 *  14.  CODE SNIPPETS — Génération et copie HTML / ESP
 *  15.  DASHBOARD     — Chargement et rendu des countdowns
 *  16.  PRICING       — Page tarifs dynamique
 *  17.  FAQ           — Questions fréquentes par plan
 *  18.  STRIPE        — Checkout, portail, retours URL
 *  19.  TOAST         — Notifications temporaires
 *  20.  INIT
 */


// ============================================================
// 1. AUTH — Token JWT et session utilisateur
// ============================================================
function getToken()   { return localStorage.getItem('cm_token'); }
function getUser()    { return JSON.parse(localStorage.getItem('cm_user') || 'null'); }
function isLoggedIn() { return !!getToken(); }

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

// ── Suppression de compte (RGPD) ─────────────────────────────
function confirmDeleteAccount() {
    const overlay = document.getElementById('delete-account-overlay');
    const input   = document.getElementById('delete-account-confirm');
    if (overlay) overlay.classList.add('open');
    if (input) input.value = '';
}
function closeDeleteAccountModal(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('delete-account-overlay')?.classList.remove('open');
}
async function executeDeleteAccount() {
    const input = document.getElementById('delete-account-confirm');
    if (input?.value !== 'SUPPRIMER') {
        showToast('⚠️ Tapez SUPPRIMER pour confirmer');
        return;
    }
    const btn = document.getElementById('delete-account-btn');
    if (btn) { btn.textContent = 'Suppression...'; btn.disabled = true; }
    try {
        const res = await authFetch('/auth/account', { method: 'DELETE' });
        if (res.ok) {
            localStorage.removeItem('cm_token');
            localStorage.removeItem('cm_user');
            updateNavAuth();
            showPage('landing');
            closeDeleteAccountModal();
            showToast('Votre compte a été supprimé.');
        } else {
            const data = await res.json();
            showToast('❌ ' + (data.error || 'Erreur'));
        }
    } catch {
        showToast('❌ Erreur réseau');
    } finally {
        if (btn) { btn.textContent = 'Supprimer mon compte'; btn.disabled = false; }
    }
}

function updateNavAuth() {
    const loggedIn = isLoggedIn();
    const user     = getUser();
    document.getElementById('nav-cta-guest').style.display = loggedIn ? 'none' : 'flex';
    document.getElementById('nav-cta-user').style.display  = loggedIn ? 'flex' : 'none';
    // Mobile nav
    const mGuest = document.getElementById('mobile-nav-guest');
    const mUser  = document.getElementById('mobile-nav-user');
    if (mGuest) mGuest.style.display = loggedIn ? 'none' : 'flex';
    if (mUser)  mUser.style.display  = loggedIn ? 'flex' : 'none';
    if (loggedIn && user) {
        document.getElementById('nav-user-name').textContent = user.name || user.email;
    }
}

function handleDashboardClick() {
    if (isLoggedIn()) showPage('dashboard');
    else showPage('login');
}

// ── Mobile nav ───────────────────────────────────────────────
function toggleMobileNav() {
    const nav = document.getElementById('mobile-nav');
    const overlay = document.getElementById('mobile-nav-overlay');
    const burger = document.getElementById('nav-burger');
    const isOpen = nav.classList.contains('open');
    nav.classList.toggle('open', !isOpen);
    overlay.classList.toggle('open', !isOpen);
    burger.classList.toggle('open', !isOpen);
}
function closeMobileNav() {
    document.getElementById('mobile-nav')?.classList.remove('open');
    document.getElementById('mobile-nav-overlay')?.classList.remove('open');
    document.getElementById('nav-burger')?.classList.remove('open');
}


// ============================================================
// 2. NAVIGATION — Routage SPA
// ============================================================
function showPage(name) {
    if (['dashboard','create','analytics'].includes(name) && !isLoggedIn()) {
        showPage('login');
        return;
    }
    const target = document.getElementById('page-' + name);
    if (!target) { showPage('404'); return; }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    target.classList.add('active');
    window.location.hash = name;
    window.scrollTo(0, 0);
    if (name === 'dashboard') loadDashboard();
    if (name === 'analytics') loadAnalytics();
    if (name === 'pricing')   renderPricing();
    if (name === 'create')    { _resetCreateForm(); applyPlanGates(); updateExpiredUI(); goToStep(1); }
}


// ============================================================
// 3. API AUTH — Login / Register
// ============================================================
async function login() {
    const btn      = document.getElementById('login-btn');
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    errEl.style.display = 'none';
    if (!email || !password) { errEl.textContent = 'Veuillez remplir tous les champs'; errEl.style.display = 'block'; return; }
    btn.textContent = '⏳ Connexion...'; btn.disabled = true;
    try {
        const res  = await fetch('/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email, password }) });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || 'Erreur de connexion'; errEl.style.display = 'block'; return; }
        saveAuth(data.token, data.user);
        showPage('dashboard');
        showToast('👋 Bienvenue ' + (data.user.name || data.user.email) + ' !');
    } catch (err) { errEl.textContent = 'Erreur réseau, réessayez'; errEl.style.display = 'block'; }
    finally { btn.textContent = 'Se connecter'; btn.disabled = false; }
}

async function register() {
    const btn      = document.getElementById('register-btn');
    const name     = document.getElementById('register-name').value.trim();
    const email    = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const errEl    = document.getElementById('register-error');
    errEl.style.display = 'none';
    if (!email || !password) { errEl.textContent = 'Email et mot de passe requis'; errEl.style.display = 'block'; return; }
    if (password.length < 8) { errEl.textContent = 'Mot de passe trop court (8 caractères minimum)'; errEl.style.display = 'block'; return; }
    btn.textContent = '⏳ Création...'; btn.disabled = true;
    try {
        const res  = await fetch('/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email, password, name }) });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || "Erreur lors de l'inscription"; errEl.style.display = 'block'; return; }
        saveAuth(data.token, data.user);
        showPage('dashboard');
        showToast('🎉 Compte créé, bienvenue !');
    } catch (err) { errEl.textContent = 'Erreur réseau, réessayez'; errEl.style.display = 'block'; }
    finally { btn.textContent = 'Créer mon compte →'; btn.disabled = false; }
}


// ============================================================
// 4. FETCH AUTHENTIFIÉ
// ============================================================
async function authFetch(url, options = {}) {
    const token = getToken();
    return fetch(url, {
        ...options,
        headers: { 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}), ...(options.headers || {}) },
    });
}


// ============================================================
// 5. HERO TIMER — Timer animé landing page (fictif)
// ============================================================
const heroTarget = new Date(Date.now() + 4*86400000 + 18*3600000 + 33*60000);
function updateHeroTimer() {
    const diff = heroTarget - Date.now();
    if (diff <= 0) return;
    const pad = n => String(n).padStart(2,'0');
    document.getElementById('hero-days').textContent  = pad(Math.floor(diff/86400000));
    document.getElementById('hero-hours').textContent = pad(Math.floor((diff%86400000)/3600000));
    document.getElementById('hero-mins').textContent  = pad(Math.floor((diff%3600000)/60000));
    document.getElementById('hero-secs').textContent  = pad(Math.floor((diff%60000)/1000));
}
setInterval(updateHeroTimer, 1000);
updateHeroTimer();


// ============================================================
// VARIABLES D'ÉTAT — Page Create v6
// ============================================================
let currentColor       = '#2563eb';
let currentBg          = '#f8f7f4';
let currentBlockBg     = null;     // null = auto (teinté depuis textColor)
let currentSepColor    = null;     // null = auto
let showSeparators     = true;
let currentFontDigits  = "'JetBrains Mono',monospace";
let currentFontLabels  = "'Inter',sans-serif";
let currentStyle       = 'rounded';
let currentOrientation = 'horizontal';
let currentFontSize    = 36;
let currentWidth       = 400;
let activeCodeTab      = 'minimal';
let currentGifUrl      = '';
let previewDebounce    = null;
let currentEditId      = null;    // ID du countdown en cours d'édition (null = création)

// Map id → countdown, peuplée à chaque loadDashboard pour editCountdown()
const cdMap = {};

// Labels visibilité (true = affiché dans le GIF)
let labelVisible = { days: true, hours: true, minutes: true, seconds: true };

// Pré-remplit la date à J+7
setTimeout(() => {
    const el = document.getElementById('cd-date');
    if (el && !el.value) el.value = new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16);
    goToStep(1);
}, 0);


// ============================================================
// NAVIGATION ENTRE ÉTAPES
// ============================================================
let currentStep = 1;

function goToStep(step) {
    [1,2,3,4].forEach(i => {
        const s = document.getElementById('create-step-' + i);
        if (s) s.classList.toggle('hidden', i !== step);
    });
    currentStep = step;
    updateProgressBar(step);
    document.getElementById('create-form-body')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProgressBar(activeStep) {
    [1,2,3,4].forEach(i => {
        const el = document.getElementById('step-' + i);
        if (!el) return;
        el.classList.remove('active', 'done');
        if (i < activeStep)        el.classList.add('done');
        else if (i === activeStep) el.classList.add('active');
    });
    [1,2,3].forEach(i => {
        const line = document.getElementById('line-' + i + '-' + (i+1));
        if (!line) return;
        line.classList.remove('done', 'active');
        if (i < activeStep)        line.classList.add('done');
        else if (i === activeStep) line.classList.add('active');
    });
}


// ============================================================
// PREVIEW GIF LIVE — Debounce 500ms
// ============================================================
function schedulePreview() {
    clearTimeout(previewDebounce);
    previewDebounce = setTimeout(refreshPreview, 500);
}

function refreshPreview() {
    const endDate = document.getElementById('cd-date')?.value;
    if (!endDate) return;

    const showUnits = getShowUnits();
    if (!showUnits) return;

    const params = new URLSearchParams({
        endDate,
        bgColor:      currentBg,
        textColor:    currentColor,
        blockBgColor:   currentBlockBg  || '',
        sepColor:       currentSepColor || '',
        showSeparators: showSeparators ? '1' : '0',
        fontSize:     currentFontSize,
        width:        currentWidth,
        fontFamily:   currentFontDigits,
        fontLabels:   currentFontLabels,
        style:        currentStyle,
        orientation:  currentOrientation,
        showUnits,
        labelDays:    labelVisible.days    ? (document.getElementById('cd-label-days')?.value    || 'JOURS')  : '',
        labelHours:   labelVisible.hours   ? (document.getElementById('cd-label-hours')?.value   || 'HEURES') : '',
        labelMinutes: labelVisible.minutes ? (document.getElementById('cd-label-minutes')?.value || 'MIN')    : '',
        labelSeconds: labelVisible.seconds ? (document.getElementById('cd-label-seconds')?.value || 'SEC')    : '',
        _t: Date.now(),
    });

    const url     = '/gif?' + params.toString();
    const img     = document.getElementById('gif-preview-img');
    const loader  = document.getElementById('gif-preview-loader');
    const ph      = document.getElementById('gif-preview-placeholder');
    const badge   = document.getElementById('preview-status-badge');

    if (loader) loader.style.display = 'flex';
    if (ph)     ph.style.display     = 'none';
    if (badge)  { badge.innerHTML = '<div class="live-badge-dot" style="background:var(--orange)"></div>Chargement'; badge.style.color = 'var(--orange)'; badge.style.background = 'var(--orange-l)'; badge.style.border = '1px solid #fed7aa'; }

    const newImg = new Image();
    newImg.onload = () => {
        if (img) { img.src = url; img.style.display = 'block'; }
        if (loader) loader.style.display = 'none';
        if (badge)  { badge.innerHTML = '<div class="live-badge-dot"></div>Live'; badge.style.color = ''; badge.style.background = ''; badge.style.border = ''; }
    };
    newImg.onerror = () => {
        if (loader) loader.style.display = 'none';
        if (badge)  { badge.innerHTML = '⚠ Erreur'; badge.style.color = 'var(--red)'; }
    };
    newImg.src = url;
}

function getShowUnits() {
    const units = Object.entries(labelVisible)
        .filter(([, v]) => v)
        .map(([k]) => k);
    return units.length ? units.join(',') : null;
}


// ============================================================
// STYLE DROPDOWN
// ============================================================
const STYLE_CTX = {
    rounded:  '<div class="ctx-slider-label"><span>Rayon des coins</span><span id="radius-val" style="font-weight:700;color:var(--accent)">8px</span></div><input type="range" min="0" max="20" value="8" oninput="updateStyleParam(\'borderRadius\',this.value+\'px\');document.getElementById(\'radius-val\').textContent=this.value+\'px\'">',
    flat:     '<div class="ctx-slider-label"><span>Intensité du fond</span><span id="alpha-val" style="font-weight:700;color:var(--accent)">10%</span></div><input type="range" min="5" max="40" value="10" oninput="updateStyleParam(\'bgAlpha\',this.value/100);document.getElementById(\'alpha-val\').textContent=this.value+\'%\'">',
    bordered: '<div class="ctx-slider-label"><span>Épaisseur bordure</span><span id="bw-val" style="font-weight:700;color:var(--accent)">2px</span></div><input type="range" min="1" max="5" value="2" oninput="updateStyleParam(\'borderWidth\',this.value+\'px\');document.getElementById(\'bw-val\').textContent=this.value+\'px\'">',
    glass:    '<div class="ctx-slider-label"><span>Opacité verre</span><span id="glass-val" style="font-weight:700;color:var(--accent)">22%</span></div><input type="range" min="10" max="60" value="22" oninput="updateStyleParam(\'glassOpacity\',this.value/100);document.getElementById(\'glass-val\').textContent=this.value+\'%\'">',
    pill:     '<div class="ctx-lbl">Couleur texte capsule</div><div class="color-row"><input type="color" class="color-inp" value="#ffffff" oninput="updateStyleParam(\'pillTextColor\',this.value)"><div class="color-preview" style="background:#ffffff;border:1px solid var(--border2)"></div><span class="color-hex">#ffffff</span></div>',
    circle:   '<div class="ctx-slider-label"><span>Épaisseur anneau</span><span id="ring-val" style="font-weight:700;color:var(--accent)">2px</span></div><input type="range" min="1" max="5" value="2" oninput="updateStyleParam(\'ringWidth\',this.value+\'px\');document.getElementById(\'ring-val\').textContent=this.value+\'px\'">',
    neon:     '<div class="ctx-lbl">Couleur du glow</div><div class="color-row"><input type="color" class="color-inp" value="#a855f7" oninput="pickGlowColor(this.value)"><div class="color-preview" style="background:#a855f7"></div><span class="color-hex">#a855f7</span></div>',
};

function toggleStyleDD() {
    const opts = document.getElementById('style-dd-opts');
    const chev = document.getElementById('style-dd-chev');
    const sel  = document.getElementById('style-dd-sel');
    const open = opts.classList.contains('open');
    opts.classList.toggle('open', !open);
    chev.classList.toggle('open', !open);
    sel.classList.toggle('open', !open);
}

function pickStyleDD(el, key, name, desc) {
    _applyStyleDD(el, key, name, desc);
}

function pickStyleDDGated(el, key, name, desc, requiredPlan) {
    const user = getUser();
    const plan = user?.plan || 'FREE';
    const hasAccess =
        (requiredPlan === 'pro'      && ['PRO','BUSINESS'].includes(plan)) ||
        (requiredPlan === 'business' && plan === 'BUSINESS');

    if (hasAccess) {
        _applyStyleDD(el, key, name, desc);
    } else {
        toggleStyleDD(); // ferme le dropdown
        openUpgradeModal(requiredPlan === 'business' ? 'business_style' : 'pro_style');
    }
}

function _applyStyleDD(el, key, name, desc) {
    // Met à jour le sélecteur
    const ico = document.getElementById('style-dd-ico');
    if (ico) ico.innerHTML = `<div class="sdi ${key}">42</div>`;
    document.getElementById('style-dd-name').textContent = name;
    document.getElementById('style-dd-desc').textContent = desc;
    document.getElementById('ctx-title').textContent = 'Options — ' + name;
    document.getElementById('ctx-extra').innerHTML = STYLE_CTX[key] || '';

    // Gestion fond spécial pour Neon (fond sombre)
    if (key === 'neon') {
        document.getElementById('color-bg').value = '#0f0f1a';
        pickBgMain('#0f0f1a');
    }

    // Met à jour les lignes sélectionnées dans le dropdown
    document.querySelectorAll('.style-dd-row').forEach(r => {
        r.classList.remove('sel');
        const chk = r.querySelector('.sdc');
        if (chk) chk.remove();
    });
    el.classList.add('sel');
    const chk = document.createElement('span');
    chk.className = 'sdc sel-chk'; chk.textContent = '✓';
    el.appendChild(chk);

    currentStyle = key;
    toggleStyleDD();
    schedulePreview();
}

// Paramètres de style avancés (pour usage futur dans le generator)
let styleParams = {};
function updateStyleParam(key, val) { styleParams[key] = val; schedulePreview(); }
function pickGlowColor(val) { styleParams.glowColor = val; schedulePreview(); }


// ============================================================
// COULEURS
// ============================================================
function pickColorMain(value) {
    currentColor = value;
    const p = document.getElementById('color-main-preview');
    const h = document.getElementById('color-main-hex');
    if (p) p.style.background = value;
    if (h) h.textContent = value;
    schedulePreview();
}

function pickBgMain(value) {
    currentBg = value;
    const p = document.getElementById('color-bg-preview');
    const h = document.getElementById('color-bg-hex');
    if (p) { p.style.background = value; p.style.border = isLightColor(value) ? '1px solid var(--border2)' : 'none'; }
    if (h) h.textContent = value;
    schedulePreview();
}

function pickBlockBg(value) {
    currentBlockBg = value;
    const p = document.getElementById('color-block-preview');
    const h = document.getElementById('color-block-hex');
    if (p) p.style.background = value;
    if (h) h.textContent = value;
    schedulePreview();
}

function isLightColor(hex) {
    const h = hex.replace('#','');
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}

// == Separateurs =========================================
function toggleSeparators(el) {
    showSeparators = !showSeparators;
    el.classList.toggle('on',  showSeparators);
    el.classList.toggle('off', !showSeparators);
    const icon = document.getElementById('sep-toggle-icon');
    if (icon) icon.textContent = showSeparators ? '✓' : '';
    const inp = document.getElementById('color-sep');
    if (inp) inp.style.opacity = showSeparators ? '1' : '0.35';
    schedulePreview();
}

function pickSepColor(value) {
    currentSepColor = value;
    const p = document.getElementById('color-sep-preview');
    const h = document.getElementById('color-sep-hex');
    if (p) p.style.background = value;
    if (h) h.textContent = value;
    schedulePreview();
}

// Alias compatibilite
function pickColorCustom(v) { pickColorMain(v); }
function pickBgCustom(v)    { pickBgMain(v); }


// ============================================================
// LABELS — toggle show/hide + sync avec étape 3
// ============================================================
function toggleLabelRow(el, unit) {
    const on  = el.classList.contains('on');
    const inp = document.getElementById('cd-label-' + unit);
    el.classList.toggle('on',  !on);
    el.classList.toggle('off',  on);
    el.textContent = on ? '' : '✓';
    if (inp) { inp.classList.toggle('disabled', on); inp.disabled = on; }
    labelVisible[unit] = !on;
    schedulePreview();
}

// Sync les labels entre étape 2 (toggle) et étape 3 (labels Pro)
function syncLabel(unit, value) {
    const target = document.getElementById('cd-label-' + unit);
    const exp    = document.getElementById('cd-label-' + unit + '-exp');
    if (target && target !== document.activeElement) target.value = value;
    if (exp    && exp    !== document.activeElement) exp.value    = value;
    schedulePreview();
}


// ============================================================
// POLICES
// ============================================================
function pickFontDigits(value) {
    currentFontDigits = value;
    schedulePreview();
}

function pickFontLabels(value) {
    currentFontLabels = value;
    schedulePreview();
}

// Alias pour ancien code
function pickFont(el) {
    currentFontDigits = el.dataset.font || 'monospace';
    schedulePreview();
}


// ============================================================
// TAILLE
// ============================================================
function updateFontSize(val) {
    currentFontSize = Math.min(50, parseInt(val));
    const disp = document.getElementById('font-size-display');
    if (disp) disp.textContent = currentFontSize + 'px';
    const slider = document.getElementById('cd-fontsize');
    if (slider && parseInt(slider.value) > 50) slider.value = 50;
    schedulePreview();
}


// ============================================================
// ORIENTATION
// ============================================================
function pickOrientation(el) {
    document.querySelectorAll('.orient-opt').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    currentOrientation = el.dataset.orient;
    schedulePreview();
}


// ============================================================
// LARGEUR DROPDOWN
// ============================================================
function toggleWdDD() {
    const opts = document.getElementById('wd-opts');
    const chev = document.getElementById('wd-chev');
    const sel  = document.getElementById('wd-sel');
    const open = opts.classList.contains('open');
    opts.classList.toggle('open', !open);
    chev.classList.toggle('open', !open);
    sel.classList.toggle('open', !open);
}

function pickWidth(el, name, px) {
    currentWidth = px;
    document.getElementById('wd-sel-name').textContent = name + ' — ' + px + 'px';
    document.getElementById('dim-badge').textContent   = px + ' × ' + Math.round(px * 0.28) + ' px';
    document.querySelectorAll('.wd-row').forEach(r => r.classList.remove('sel'));
    el.classList.add('sel');
    toggleWdDD();
    schedulePreview();
}


// ============================================================
// POST-EXPIRATION UI
// ============================================================
function updateExpiredUI() {
    const val = document.getElementById('cd-expired')?.value;
    const tr  = document.getElementById('expired-text-row');
    const rr  = document.getElementById('expired-redirect-row');
    if (tr) tr.style.display = val === 'SHOW_TEXT' ? 'block' : 'none';
    if (rr) rr.style.display = val === 'REDIRECT'  ? 'block' : 'none';
}


// ============================================================
// PLAN GATES
// ============================================================
function applyPlanGates() {
    const plan     = getUser()?.plan || 'FREE';
    const isPro    = plan !== 'FREE';
    const olabels  = document.getElementById('overlay-labels');
    const oredirect= document.getElementById('overlay-redirect');
    const obgimage    = document.getElementById('overlay-bgimage');
    const optRedir    = document.getElementById('opt-redirect');
    const operpetual  = document.getElementById('overlay-perpetual');
    const isBusiness  = plan === 'BUSINESS';
    if (olabels)    olabels.style.display    = isPro ? 'none' : 'flex';
    if (oredirect)  oredirect.style.display  = isPro ? 'none' : 'flex';
    if (obgimage)   obgimage.style.display   = isPro ? 'none' : 'flex';
    if (optRedir)   optRedir.disabled        = !isPro;
    if (operpetual) operpetual.style.display = isBusiness ? 'none' : 'flex';
}


// ============================================================
// MODALE UPGRADE
// ============================================================
const UPGRADE_MODAL_CONTENT = {
    labels: {
        title: 'Labels personnalisés', subtitle: 'Disponible à partir du plan Pro',
        desc: 'Personnalisez les textes sous chaque chiffre : "JOURS", "HEURES", "MIN", "SEC" ou n\'importe quel libellé dans votre langue.',
    },
    redirect: {
        title: 'Redirection après expiration', subtitle: 'Disponible à partir du plan Pro',
        desc: 'Redirigez automatiquement vos lecteurs vers une nouvelle page dès que le countdown atteint zéro.',
    },
    pro_style: {
        title: 'Styles Pro', subtitle: 'Disponible à partir du plan Pro',
        desc: 'Déverrouillez les styles Verre (glassmorphism), Pill et Cercle pour des countdowns qui se démarquent dans vos emails.',
    },
    business_style: {
        title: 'Style Neon', subtitle: 'Exclusif au plan Business',
        desc: 'Le style Neon avec effets lumineux est réservé au plan Business pour des campagnes ultra-premium.',
    },
    bgimage: {
        title: 'Image de fond', subtitle: 'Disponible à partir du plan Pro',
        desc: 'Ajoutez une image de fond personnalisée à vos countdowns pour un rendu professionnel qui matche votre charte graphique.',
    },
    perpetual: {
        title: 'Timer perpétuel', subtitle: 'Exclusif au plan Business',
        desc: 'Le countdown redémarre automatiquement à la fin de chaque cycle — idéal pour les offres récurrentes et les promotions continues.',
    },
};

function openUpgradeModal(feature) {
    const content = UPGRADE_MODAL_CONTENT[feature] || UPGRADE_MODAL_CONTENT.labels;
    document.getElementById('upgrade-modal-title').textContent    = content.title;
    document.getElementById('upgrade-modal-subtitle').textContent = content.subtitle;
    document.getElementById('upgrade-modal-desc').textContent     = content.desc;
    const overlay = document.getElementById('upgrade-modal-overlay');
    if (overlay) { overlay.style.display = 'flex'; setTimeout(() => overlay.classList.add('open'), 10); }
    document.body.style.overflow = 'hidden';
}

function closeUpgradeModal(event) {
    if (event && event.target !== document.getElementById('upgrade-modal-overlay')) return;
    const overlay = document.getElementById('upgrade-modal-overlay');
    if (overlay) { overlay.classList.remove('open'); overlay.style.display = 'none'; }
    document.body.style.overflow = '';
}

function handleUpgradeFromModal() {
    closeUpgradeModal();
    if (isLoggedIn()) upgradePlan('pro_monthly');
    else showPage('register');
}


// ============================================================
// IMAGE DE FOND
// ============================================================
function previewBgImage(url) {
    const preview = document.getElementById('bg-image-preview');
    const img     = document.getElementById('bg-image-preview-img');
    if (!preview || !img) return;
    if (!url || !url.trim()) { preview.style.display = 'none'; return; }
    img.src = url;
    img.onload  = () => { preview.style.display = 'block'; };
    img.onerror = () => { preview.style.display = 'none'; };
}

function clearBgImage() {
    const input = document.getElementById('cd-bg-image-url');
    if (input) input.value = '';
    previewBgImage('');
}

// ============================================================
// TIMER PERPÉTUEL (Business)
// ============================================================
function togglePerpetual() {
    const el = document.getElementById('cd-perpetual');
    if (!el) return;
    el.classList.toggle('active');
    updatePerpetualUI();
}
function updatePerpetualUI() {
    const el  = document.getElementById('cd-perpetual');
    const row = document.getElementById('perpetual-duration-row');
    if (row) row.style.display = el?.classList.contains('active') ? 'block' : 'none';
}

// ============================================================
// PUBLICATION
// ============================================================
async function publishCountdown() {
    const btns   = [document.getElementById('publish-btn-1'), document.getElementById('publish-btn-2')];
    const endDate = document.getElementById('cd-date')?.value;
    if (!endDate) { showToast('⚠️ Veuillez choisir une date'); return; }

    const showUnits = getShowUnits();
    if (!showUnits) { showToast('⚠️ Activez au moins une unité'); return; }

    btns.forEach(b => { if (b) { b.textContent = '⏳ Génération...'; b.disabled = true; } });

    try {
        const url    = currentEditId ? `/countdown/${currentEditId}` : '/countdown';
        const method = currentEditId ? 'PUT' : 'POST';
        const res = await authFetch(url, {
            method,
            body: JSON.stringify({
                name:            document.getElementById('cd-name')?.value || 'Mon countdown',
                endDate,
                timezone:        document.getElementById('cd-timezone')?.value || 'Europe/Paris',
                bgColor:         currentBg,
                textColor:       currentColor,
                blockBgColor:    currentBlockBg || undefined,
                fontSize:        currentFontSize,
                width:           currentWidth,
                fontFamily:      currentFontDigits,
                fontLabels:      currentFontLabels,
                style:           currentStyle,
                orientation:     currentOrientation,
                showUnits,
                labelDays:    labelVisible.days    ? (document.getElementById('cd-label-days')?.value    || 'JOURS')  : '',
                labelHours:   labelVisible.hours   ? (document.getElementById('cd-label-hours')?.value   || 'HEURES') : '',
                labelMinutes: labelVisible.minutes ? (document.getElementById('cd-label-minutes')?.value || 'MIN')    : '',
                labelSeconds: labelVisible.seconds ? (document.getElementById('cd-label-seconds')?.value || 'SEC')    : '',
                expiredBehavior: document.getElementById('cd-expired')?.value       || 'SHOW_ZEROS',
                expiredText:     document.getElementById('cd-expired-text')?.value  || 'Offre terminée',
                expiredRedirect: document.getElementById('cd-expired-redirect')?.value || undefined,
                sepColor:        currentSepColor || undefined,
                bgImageUrl:      document.getElementById('cd-bg-image-url')?.value || undefined,
                perpetual:       document.getElementById('cd-perpetual')?.classList.contains('active') || false,
                perpetualSeconds: (parseInt(document.getElementById('cd-perpetual-hours')?.value) || 24) * 3600,
            }),
        });

        const data = await res.json();
        if (!res.ok) { showToast('❌ ' + (data.message || data.error || 'Erreur')); return; }

        currentGifUrl = data.gifUrl;
        displayCode(data.gifUrl);
        const img = document.getElementById('gif-preview-img');
        if (img) { img.src = data.gifUrl + '?_t=' + Date.now(); img.style.display = 'block'; }
        showToast(currentEditId ? '✅ Countdown mis à jour !' : '🚀 Countdown publié !');
        updateProgressBar(5);

    } catch (err) {
        showToast('❌ Erreur réseau');
    } finally {
        const btnLabel = currentEditId ? '✦ Mettre à jour' : '✦ Publier & obtenir le code';
        btns.forEach(b => { if (b) { b.textContent = btnLabel; b.disabled = false; } });
    }
}


// ============================================================
// CODE SNIPPETS
// ============================================================
/**
 * Coloration syntaxique HTML — affichage uniquement.
 * Le texte copié vient de window._currentSnippet (brut, sans spans).
 */
function highlightHtml(code) {
    // Échappe le texte brut pour affichage sécurisé dans le DOM
    const e = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    // Applique la coloration sur le texte échappé
    return e
        .replace(/(&lt;\/?img)/g, '<span class="hl-tag">$1</span>')
        .replace(/(\/&gt;)/g, '<span class="hl-tag">$1</span>')
        .replace(/\s(src|alt|width|border|style)=/g, ' <span class="hl-attr">$1</span>=')
        .replace(/=(&quot;[^&]*&quot;)/g, '=<span class="hl-string">$1</span>');
}

function displayCode(gifUrl) {
    const section = document.getElementById('code-section');
    const urlDisp = document.getElementById('gif-url-display');
    if (section) section.style.display = 'block';
    if (urlDisp) urlDisp.textContent   = gifUrl;

    // Un seul snippet — balise <img> simple et propre
    window._currentSnippet = `<img src="${gifUrl}" alt="Offre expire dans..." width="${currentWidth}" border="0" style="display:block" />`;

    const el = document.getElementById('code-snippet-content');
    if (el) el.innerHTML = highlightHtml(window._currentSnippet);
}

function switchCodeTab(name, btn) {
    activeCodeTab = name;
    document.querySelectorAll('.code-tab-btn').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.code-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('code-' + name).classList.add('active');
}

function copyCurrentCode() {
    if (!window._currentSnippet) { showToast('⚠️ Publiez d\'abord le countdown'); return; }
    navigator.clipboard.writeText(window._currentSnippet).then(() => showToast('📋 Code HTML copié !'));
}

function copyUrl() {
    if (!currentGifUrl) { showToast('⚠️ Publiez d\'abord le countdown'); return; }
    navigator.clipboard.writeText(currentGifUrl).then(() => showToast('🔗 URL copiée !'));
}


// ============================================================
// FERMETURE DROPDOWNS AU CLIC EXTÉRIEUR
// ============================================================
document.addEventListener('click', e => {
    if (!e.target.closest('#style-dd-wrap')) {
        document.getElementById('style-dd-opts')?.classList.remove('open');
        document.getElementById('style-dd-chev')?.classList.remove('open');
        document.getElementById('style-dd-sel')?.classList.remove('open');
    }
    if (!e.target.closest('#wd-wrap')) {
        document.getElementById('wd-opts')?.classList.remove('open');
        document.getElementById('wd-chev')?.classList.remove('open');
        document.getElementById('wd-sel')?.classList.remove('open');
    }
});


// ============================================================
// RESET FORMULAIRE — remet le formulaire create à l'état initial
// ============================================================
function _resetCreateForm() {
    currentEditId      = null;
    currentColor       = '#2563eb';
    currentBg          = '#f8f7f4';
    currentBlockBg     = null;
    currentSepColor    = null;
    showSeparators     = true;
    currentFontDigits  = "'JetBrains Mono',monospace";
    currentFontLabels  = "'Inter',sans-serif";
    currentStyle       = 'rounded';
    currentOrientation = 'horizontal';
    currentFontSize    = 36;
    currentWidth       = 400;
    currentGifUrl      = '';
    labelVisible       = { days: true, hours: true, minutes: true, seconds: true };

    const nameEl = document.getElementById('cd-name');
    if (nameEl) nameEl.value = '';
    const dateEl = document.getElementById('cd-date');
    if (dateEl) dateEl.value = new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16);
    const tzEl = document.getElementById('cd-timezone');
    if (tzEl) tzEl.value = 'Europe/Paris';

    const colorMainEl = document.getElementById('color-main');
    if (colorMainEl) colorMainEl.value = '#2563eb';
    pickColorMain('#2563eb');
    const colorBgEl = document.getElementById('color-bg');
    if (colorBgEl) colorBgEl.value = '#f8f7f4';
    pickBgMain('#f8f7f4');

    const fsSlider = document.getElementById('cd-fontsize');
    if (fsSlider) fsSlider.value = 36;
    const fsDisp = document.getElementById('font-size-display');
    if (fsDisp) fsDisp.textContent = '36px';

    const wdSel = document.getElementById('wd-sel-name');
    const dimBadge = document.getElementById('dim-badge');
    if (wdSel) wdSel.textContent = 'Medium — 400px';
    if (dimBadge) dimBadge.textContent = '400 × 112 px';
    document.querySelectorAll('.wd-row').forEach(r => r.classList.remove('sel'));
    const defaultWd = document.querySelector('.wd-row[onclick*=",400)"]');
    if (defaultWd) defaultWd.classList.add('sel');

    document.querySelectorAll('.orient-opt').forEach(e =>
        e.classList.toggle('selected', e.dataset.orient === 'horizontal'));

    const ico = document.getElementById('style-dd-ico');
    if (ico) ico.innerHTML = '<div class="sdi rounded">42</div>';
    const sdName  = document.getElementById('style-dd-name');
    const sdDesc  = document.getElementById('style-dd-desc');
    const ctxTitl = document.getElementById('ctx-title');
    const ctxExt  = document.getElementById('ctx-extra');
    if (sdName)  sdName.textContent  = 'Arrondi';
    if (sdDesc)  sdDesc.textContent  = 'Coins arrondis, fond teinté';
    if (ctxTitl) ctxTitl.textContent = 'Options — Arrondi';
    if (ctxExt)  ctxExt.innerHTML    = STYLE_CTX['rounded'] || '';
    document.querySelectorAll('.style-dd-row').forEach(r => {
        r.classList.remove('sel');
        r.querySelector('.sdc')?.remove();
    });
    const defaultStyleRow = document.querySelector(".style-dd-row[onclick*=\"'rounded'\"]");
    if (defaultStyleRow) {
        defaultStyleRow.classList.add('sel');
        const chk = document.createElement('span');
        chk.className = 'sdc sel-chk'; chk.textContent = '✓';
        defaultStyleRow.appendChild(chk);
    }

    const fdEl = document.getElementById('cd-font-digits');
    if (fdEl) fdEl.value = currentFontDigits;
    const flEl = document.getElementById('cd-font-labels');
    if (flEl) flEl.value = currentFontLabels;

    const defaultLabels = { days: 'JOURS', hours: 'HEURES', minutes: 'MIN', seconds: 'SEC' };
    ['days', 'hours', 'minutes', 'seconds'].forEach(unit => {
        const tog    = document.getElementById('ltog-' + unit);
        const inp    = document.getElementById('cd-label-' + unit);
        const expInp = document.getElementById('cd-label-' + unit + '-exp');
        if (tog)    { tog.classList.add('on'); tog.classList.remove('off'); tog.textContent = '✓'; }
        if (inp)    { inp.classList.remove('disabled'); inp.disabled = false; inp.value = defaultLabels[unit]; }
        if (expInp) expInp.value = defaultLabels[unit];
    });

    const expEl = document.getElementById('cd-expired');
    if (expEl) expEl.value = 'SHOW_ZEROS';
    const expTxtEl = document.getElementById('cd-expired-text');
    if (expTxtEl) expTxtEl.value = 'Offre terminée';
    const expRedEl = document.getElementById('cd-expired-redirect');
    if (expRedEl) expRedEl.value = '';

    const titleEl = document.querySelector('.create-form-title');
    if (titleEl) titleEl.textContent = 'Créer un countdown';
    ['publish-btn-1', 'publish-btn-2'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.textContent = '✦ Publier & obtenir le code';
    });

    const codeSection = document.getElementById('code-section');
    if (codeSection) codeSection.style.display = 'none';
    const previewImg = document.getElementById('gif-preview-img');
    if (previewImg) { previewImg.src = ''; previewImg.style.display = 'none'; }
}


// ============================================================
// ÉDITION — Ouvre le formulaire pré-rempli avec un countdown existant
// ============================================================
function editCountdown(id) {
    const cd = cdMap[id];
    if (!cd) { showToast('❌ Countdown introuvable'); return; }

    showPage('create');       // reset complet via _resetCreateForm()
    currentEditId = cd.id;   // re-positionne en mode édition

    const nameEl = document.getElementById('cd-name');
    if (nameEl) nameEl.value = cd.name;

    const dateEl = document.getElementById('cd-date');
    if (dateEl) {
        const dt  = new Date(cd.endDate);
        const pad = n => String(n).padStart(2, '0');
        dateEl.value = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    }

    const tzEl = document.getElementById('cd-timezone');
    if (tzEl) tzEl.value = cd.timezone || 'Europe/Paris';

    const colorMainEl = document.getElementById('color-main');
    if (colorMainEl) colorMainEl.value = cd.textColor;
    pickColorMain(cd.textColor);
    const colorBgEl = document.getElementById('color-bg');
    if (colorBgEl) colorBgEl.value = cd.bgColor;
    pickBgMain(cd.bgColor);

    currentFontSize = cd.fontSize || 36;
    const fsSlider = document.getElementById('cd-fontsize');
    if (fsSlider) fsSlider.value = currentFontSize;
    const fsDisp = document.getElementById('font-size-display');
    if (fsDisp) fsDisp.textContent = currentFontSize + 'px';

    const widthMap = { 200:'X-Small', 300:'Small', 400:'Medium', 600:'Large', 800:'X-Large' };
    currentWidth = cd.width || 400;
    const wdSel   = document.getElementById('wd-sel-name');
    const dimBadge = document.getElementById('dim-badge');
    if (wdSel)   wdSel.textContent   = (widthMap[currentWidth] || currentWidth + 'px') + ' — ' + currentWidth + 'px';
    if (dimBadge) dimBadge.textContent = currentWidth + ' × ' + Math.round(currentWidth * 0.28) + ' px';
    document.querySelectorAll('.wd-row').forEach(r =>
        r.classList.toggle('sel', r.getAttribute('onclick')?.includes(',' + currentWidth + ')')));

    currentOrientation = cd.orientation || 'horizontal';
    document.querySelectorAll('.orient-opt').forEach(e =>
        e.classList.toggle('selected', e.dataset.orient === currentOrientation));

    const styleKey   = cd.style || 'rounded';
    const styleNames = { rounded:'Arrondi', flat:'Flat', bordered:'Bordure', glass:'Verre', pill:'Pill', circle:'Cercle', neon:'Neon' };
    const styleDescs = { rounded:'Coins arrondis, fond teinté', flat:'Coins droits, fond teinté', bordered:'Contour coloré, fond vide', glass:'Glassmorphism sur dégradé', pill:'Capsule pleine couleur', circle:'Anneau circulaire', neon:'Effets lumineux sur fond sombre' };
    currentStyle = styleKey;
    const ico = document.getElementById('style-dd-ico');
    if (ico) ico.innerHTML = `<div class="sdi ${styleKey}">42</div>`;
    const sdName  = document.getElementById('style-dd-name');
    const sdDesc  = document.getElementById('style-dd-desc');
    const ctxTitl = document.getElementById('ctx-title');
    const ctxExt  = document.getElementById('ctx-extra');
    if (sdName)  sdName.textContent  = styleNames[styleKey] || styleKey;
    if (sdDesc)  sdDesc.textContent  = styleDescs[styleKey] || '';
    if (ctxTitl) ctxTitl.textContent = 'Options — ' + (styleNames[styleKey] || styleKey);
    if (ctxExt)  ctxExt.innerHTML    = STYLE_CTX[styleKey] || '';
    document.querySelectorAll('.style-dd-row').forEach(r => {
        r.classList.remove('sel');
        r.querySelector('.sdc')?.remove();
    });
    const selStyleRow = document.querySelector(`.style-dd-row[onclick*="'${styleKey}'"]`);
    if (selStyleRow) {
        selStyleRow.classList.add('sel');
        const chk = document.createElement('span');
        chk.className = 'sdc sel-chk'; chk.textContent = '✓';
        selStyleRow.appendChild(chk);
    }

    const fdEl = document.getElementById('cd-font-digits');
    if (fdEl) { fdEl.value = cd.fontFamily; currentFontDigits = cd.fontFamily; }
    currentBlockBg  = cd.blockBgColor || null;
    currentSepColor = cd.sepColor || null;
    currentFontLabels = cd.fontLabels || null;

    const activeUnits = (cd.showUnits || 'days,hours,minutes,seconds').split(',');
    ['days', 'hours', 'minutes', 'seconds'].forEach(unit => {
        const visible  = activeUnits.includes(unit);
        labelVisible[unit] = visible;
        const tog    = document.getElementById('ltog-' + unit);
        const inp    = document.getElementById('cd-label-' + unit);
        const expInp = document.getElementById('cd-label-' + unit + '-exp');
        if (tog) { tog.classList.toggle('on', visible); tog.classList.toggle('off', !visible); tog.textContent = visible ? '✓' : ''; }
        if (inp) { inp.classList.toggle('disabled', !visible); inp.disabled = !visible; }
        const labelKey = 'label' + unit.charAt(0).toUpperCase() + unit.slice(1);
        const labelVal = cd[labelKey] || '';
        if (inp)    inp.value    = labelVal;
        if (expInp) expInp.value = labelVal;
    });

    const expEl    = document.getElementById('cd-expired');
    if (expEl) expEl.value = cd.expiredBehavior || 'SHOW_ZEROS';
    const expTxtEl = document.getElementById('cd-expired-text');
    if (expTxtEl) expTxtEl.value = cd.expiredText || '';
    const expRedEl = document.getElementById('cd-expired-redirect');
    if (expRedEl) expRedEl.value = cd.expiredRedirect || '';
    const bgImgEl = document.getElementById('cd-bg-image-url');
    if (bgImgEl) { bgImgEl.value = cd.bgImageUrl || ''; previewBgImage(cd.bgImageUrl || ''); }
    const perpEl = document.getElementById('cd-perpetual');
    if (perpEl) { if (cd.perpetual) perpEl.classList.add('active'); else perpEl.classList.remove('active'); }
    const perpHoursEl = document.getElementById('cd-perpetual-hours');
    if (perpHoursEl) perpHoursEl.value = Math.round((cd.perpetualSeconds || 86400) / 3600);
    updatePerpetualUI();
    updateExpiredUI();

    const titleEl = document.querySelector('.create-form-title');
    if (titleEl) titleEl.textContent = 'Modifier le countdown';
    ['publish-btn-1', 'publish-btn-2'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.textContent = '✦ Mettre à jour';
    });

    schedulePreview();
}


// ============================================================
// SUPPRESSION — Modale de confirmation custom
// ============================================================
let _pendingDeleteId = null;

function deleteCountdown(id) {
    const cd = cdMap[id];
    _pendingDeleteId = id;
    const nameEl = document.getElementById('confirm-modal-name');
    if (nameEl) nameEl.textContent = cd?.name || '';
    const overlay = document.getElementById('confirm-delete-overlay');
    if (overlay) { overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeConfirmModal(event) {
    if (event && event.target !== document.getElementById('confirm-delete-overlay')) return;
    _closeConfirmModal();
}

function _closeConfirmModal() {
    const overlay = document.getElementById('confirm-delete-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    _pendingDeleteId = null;
}

async function confirmDelete() {
    if (!_pendingDeleteId) return;
    const id  = _pendingDeleteId;
    const btn = document.getElementById('confirm-delete-btn');
    if (btn) { btn.textContent = '⏳ Suppression...'; btn.disabled = true; }
    try {
        const res = await authFetch(`/countdown/${id}`, { method: 'DELETE' });
        if (res.ok) {
            _closeConfirmModal();
            showToast('🗑 Countdown supprimé');
            loadDashboard();
        } else {
            showToast('❌ Erreur lors de la suppression');
        }
    } catch(err) {
        showToast('❌ Erreur réseau');
    } finally {
        if (btn) { btn.textContent = 'Supprimer définitivement'; btn.disabled = false; }
    }
}


// 15. DASHBOARD — Chargement et rendu des countdowns
// ============================================================
async function loadDashboard() {
    const grid = document.getElementById('cards-grid');
    if (!grid) return;
    grid.innerHTML = Array(3).fill(`<div class="skeleton-card">
        <div class="skeleton skeleton-line w60"></div>
        <div class="skeleton skeleton-line w40"></div>
        <div class="skeleton skeleton-block"></div>
        <div class="skeleton skeleton-line w80"></div>
    </div>`).join('');
    try {
        const res = await authFetch('/countdowns');
        if (res.status === 401) { logout(); return; }
        const data    = await res.json();
        const user    = getUser();
        const plan    = user?.plan || 'FREE';
        const total   = data.length;
        const active  = data.filter(c => new Date(c.endDate) > new Date()).length;
        const expired = data.filter(c => new Date(c.endDate) <= new Date()).length;
        const maxCountdowns = plan === 'FREE' ? 3 : '∞';
        const pct = plan === 'FREE' ? Math.min(100, Math.round((total/3)*100)) : 0;
        const fill       = document.getElementById('quota-fill');
        const text       = document.getElementById('quota-text');
        const sub        = document.getElementById('dash-subtitle');
        const chip       = document.getElementById('sidebar-plan-chip');
        const upgradeBtn = document.getElementById('upgrade-btn');
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = `${total} / ${maxCountdowns} countdowns`;
        if (sub)  sub.textContent  = `${active} actif${active!==1?'s':''} · ${expired} expiré${expired!==1?'s':''}`;
        if (chip) { chip.textContent = plan; chip.className = 'plan-chip plan-chip-' + plan.toLowerCase(); }
        if (upgradeBtn) {
            if (plan === 'FREE')      { upgradeBtn.textContent = 'Passer à Pro ↗'; upgradeBtn.onclick = () => upgradePlan('pro_monthly'); upgradeBtn.style.display = 'block'; }
            else if (plan === 'PRO') { upgradeBtn.textContent = 'Gérer mon abonnement'; upgradeBtn.onclick = openBillingPortal; upgradeBtn.style.display = 'block'; }
            else                      { upgradeBtn.style.display = 'none'; }
        }
        grid.innerHTML = '';
        data.forEach(cd => { cdMap[cd.id] = cd; grid.appendChild(buildCard(cd)); });
        if (plan === 'FREE' && total < 3) {
            const add = document.createElement('div');
            add.className = 'cd-card cd-card-add'; add.onclick = () => showPage('create');
            add.innerHTML = `<div class="cd-card-add-icon">+</div><div style="font-size:14px;font-weight:600">Nouveau countdown</div><div style="font-size:12.5px">${3-total} emplacement${3-total>1?'s':''} restant${3-total>1?'s':''}</div>`;
            grid.appendChild(add);
        } else if (plan !== 'FREE') {
            const add = document.createElement('div');
            add.className = 'cd-card cd-card-add'; add.onclick = () => showPage('create');
            add.innerHTML = `<div class="cd-card-add-icon">+</div><div style="font-size:14px;font-weight:600">Nouveau countdown</div>`;
            grid.appendChild(add);
        }
    } catch(err) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--red)">Erreur de chargement</div>';
    }
}

function buildCard(cd) {
    const isActive = new Date(cd.endDate) > new Date();
    const diff     = new Date(cd.endDate) - new Date();
    const pad      = n => String(n).padStart(2,'0');
    const days  = pad(Math.max(0,Math.floor(diff/86400000)));
    const hours = pad(Math.max(0,Math.floor((diff%86400000)/3600000)));
    const mins  = pad(Math.max(0,Math.floor((diff%3600000)/60000)));
    const secs  = pad(Math.max(0,Math.floor((diff%60000)/1000)));
    const dateStr = new Date(cd.endDate).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
    const imps    = cd._count?.impressions ?? 0;
    const card = document.createElement('div');
    card.className = 'cd-card';
    if (!isActive) card.style.opacity = '0.65';
    card.innerHTML = `
    <div class="cd-card-header">
      <div><div class="cd-card-name">${cd.name}</div><div class="cd-card-date">${isActive?'Expire le':'Expiré le'} ${dateStr}</div></div>
      <div class="status-pill ${isActive?'active':'expired'}"><div class="status-pill-dot"></div>${isActive?'Actif':'Expiré'}</div>
    </div>
    <div class="cd-mini">
      <div class="cd-mini-unit" style="${!isActive?'color:var(--muted2)':''}">${days}</div><div class="cd-mini-sep">:</div>
      <div class="cd-mini-unit" style="${!isActive?'color:var(--muted2)':''}">${hours}</div><div class="cd-mini-sep">:</div>
      <div class="cd-mini-unit" style="${!isActive?'color:var(--muted2)':''}">${mins}</div><div class="cd-mini-sep">:</div>
      <div class="cd-mini-unit" style="${!isActive?'color:var(--muted2)':''}">${secs}</div>
    </div>
    <div class="cd-card-stats">
      <div class="cd-stat"><strong>${imps}</strong>impressions</div>
      <div class="cd-stat"><strong>${cd.width}px</strong>largeur</div>
      <div class="cd-stat"><strong><a href="/gif/${cd.id}" target="_blank" style="color:var(--accent);text-decoration:none">Voir GIF →</a></strong></div>
    </div>
    <div class="cd-card-actions">
      <button class="cd-action-btn" onclick="editCountdown('${cd.id}')">Modifier</button>
      <button class="cd-action-btn cd-action-delete" onclick="deleteCountdown('${cd.id}')">Supprimer</button>
    </div>`;
    return card;
}


// ============================================================
// 16. PRICING — Page tarifs dynamique
// ============================================================
let billingYearly = false;

const PRICING_DATA = {
    free:     { monthly:{ price:'0€', period:'/mois' }, yearly:{ price:'0€', period:'/mois' } },
    pro:      { monthly:{ price:'9€', period:'/mois' }, yearly:{ price:'6.58€', period:'/mois (facturé 79€/an)' } },
    business: { monthly:{ price:'29€', period:'/mois' }, yearly:{ price:'20.75€', period:'/mois (facturé 249€/an)' } },
};

function renderPricing() {
    const user = getUser();
    const plan = user?.plan || null;
    renderPricingCards(plan);
    renderFaq(plan);
}

function renderPricingCards(plan) {
    const billing = billingYearly ? 'yearly' : 'monthly';
    ['pro','business'].forEach(p => {
        const priceEl  = document.getElementById(p+'-price');
        const periodEl = document.getElementById(p+'-period');
        if (priceEl)  priceEl.textContent  = PRICING_DATA[p][billing].price;
        if (periodEl) periodEl.textContent = PRICING_DATA[p][billing].period;
    });
    const freeCta     = document.getElementById('cta-free');
    const proCta      = document.getElementById('cta-pro');
    const businessCta = document.getElementById('cta-business');
    if (!plan) {
        if (freeCta)     { freeCta.textContent = 'Commencer gratuitement'; freeCta.onclick = () => showPage('register'); freeCta.className = 'btn btn-ghost pricing-btn'; }
        if (proCta)      { proCta.textContent  = 'Commencer avec Pro →';  proCta.onclick  = () => showPage('register'); proCta.className  = 'btn btn-primary pricing-btn'; }
        if (businessCta) { businessCta.textContent = 'Commencer avec Business →'; businessCta.onclick = () => showPage('register'); businessCta.className = 'btn btn-ghost pricing-btn'; }
    } else if (plan === 'FREE') {
        if (freeCta)     { freeCta.textContent = '✓ Votre plan actuel'; freeCta.onclick = null; freeCta.className = 'btn btn-surface pricing-btn'; freeCta.style.cursor='default'; }
        if (proCta)      { proCta.textContent  = 'Passer à Pro →'; proCta.onclick = () => handlePricingCta('pro'); proCta.className = 'btn btn-primary pricing-btn'; }
        if (businessCta) { businessCta.textContent = 'Passer à Business →'; businessCta.onclick = () => handlePricingCta('business'); businessCta.className = 'btn btn-ghost pricing-btn'; }
    } else if (plan === 'PRO') {
        if (freeCta)     { freeCta.textContent = 'Rétrograder'; freeCta.onclick = openBillingPortal; freeCta.className = 'btn btn-ghost pricing-btn'; }
        if (proCta)      { proCta.textContent  = '✓ Votre plan actuel'; proCta.onclick = null; proCta.className = 'btn btn-surface pricing-btn'; proCta.style.cursor='default'; }
        if (businessCta) { businessCta.textContent = 'Passer à Business →'; businessCta.onclick = () => handlePricingCta('business'); businessCta.className = 'btn btn-ghost pricing-btn'; }
    } else if (plan === 'BUSINESS') {
        if (freeCta)     { freeCta.textContent = 'Rétrograder'; freeCta.onclick = openBillingPortal; freeCta.className = 'btn btn-ghost pricing-btn'; }
        if (proCta)      { proCta.textContent  = 'Rétrograder'; proCta.onclick  = openBillingPortal; proCta.className  = 'btn btn-ghost pricing-btn'; }
        if (businessCta) { businessCta.textContent = '✓ Votre plan actuel'; businessCta.onclick = null; businessCta.className = 'btn btn-surface pricing-btn'; businessCta.style.cursor='default'; }
    }
}

function toggleBilling() {
    billingYearly = !billingYearly;
    const toggle = document.getElementById('billing-toggle');
    const labelM = document.getElementById('toggle-label-monthly');
    const labelY = document.getElementById('toggle-label-yearly');
    toggle.classList.toggle('active', billingYearly);
    labelM.style.fontWeight = billingYearly ? '400' : '700'; labelM.style.color = billingYearly ? 'var(--muted)' : 'var(--text)';
    labelY.style.fontWeight = billingYearly ? '700' : '400'; labelY.style.color = billingYearly ? 'var(--text)' : 'var(--muted)';
    renderPricingCards(getUser()?.plan || null);
}

function handlePricingCta(plan) {
    if (!isLoggedIn()) { showPage('register'); return; }
    const key = billingYearly ? `${plan}_yearly` : `${plan}_monthly`;
    upgradePlan(key);
}


// ============================================================
// 17. FAQ — Questions fréquentes contextuelles par plan
// ============================================================
const FAQ_GUEST = [
    { q:'Puis-je essayer gratuitement ?',                          a:"Oui — le plan Free vous permet de créer jusqu'à 3 countdowns sans carte bancaire." },
    { q:'Les GIFs fonctionnent-ils dans tous les clients email ?', a:'Gmail, Apple Mail, Yahoo, Outlook 2013+, iOS Mail et tous les grands ESP. Outlook 2007-2010 affiche la première frame statique.' },
    { q:"Que se passe-t-il quand un countdown expire ?",           a:"Par défaut, le GIF affiche 00:00:00:00. Vous pouvez configurer un texte personnalisé ou masquer l'image." },
    { q:"Y a-t-il un engagement de durée ?",                       a:"Non, tous les plans sont sans engagement. Vous pouvez annuler à tout moment depuis votre espace de facturation." },
];
const FAQ_FREE = [
    { q:'Comment passer au plan Pro ?',                  a:'Cliquez sur "Passer à Pro" depuis votre dashboard ou depuis cette page. Le paiement est sécurisé via Stripe.' },
    { q:'Mes countdowns actuels seront-ils conservés ?', a:'Oui, tous vos countdowns existants sont conservés lors d\'un changement de plan.' },
    { q:'Les GIFs fonctionnent-ils dans tous les clients email ?', a:'Gmail, Apple Mail, Yahoo, Outlook 2013+, iOS Mail et tous les grands ESP. Outlook 2007-2010 affiche la première frame statique.' },
    { q:"Y a-t-il un engagement de durée ?",             a:"Non, vous pouvez annuler à tout moment. Le remboursement est au prorata si vous annulez en cours de mois." },
];
const FAQ_PRO = [
    { q:'Comment gérer ma facturation ?',    a:'Cliquez sur "Gérer mon abonnement" pour accéder au portail Stripe — vous y trouverez vos factures et pouvez modifier votre moyen de paiement.' },
    { q:'Comment passer au plan Business ?', a:'Cliquez sur "Passer à Business" ci-dessus. Le changement est immédiat et le montant est ajusté au prorata.' },
    { q:"Comment annuler mon abonnement ?",  a:'Depuis le portail de facturation Stripe, cliquez sur "Annuler l\'abonnement". Vous conservez l\'accès Pro jusqu\'à la fin de la période payée.' },
    { q:"Que se passe-t-il à l'expiration d'un countdown ?", a:"Vous pouvez configurer un texte personnalisé, masquer l'image ou rediriger vers une URL." },
];
const FAQ_BUSINESS = [
    { q:'Comment gérer ma facturation ?',            a:'Accédez au portail Stripe via "Gérer mon abonnement" pour consulter vos factures et gérer votre moyen de paiement.' },
    { q:"Comment accéder à l'API ?",                 a:'La documentation de l\'API est disponible dans votre dashboard sous "Paramètres → API". Votre clé API est générée automatiquement.' },
    { q:'Comment ajouter des membres à mon équipe ?',a:'Depuis "Paramètres → Équipe", invitez vos collaborateurs par email. Chaque membre dispose de ses propres accès.' },
    { q:'Puis-je obtenir une facturation entreprise ?', a:'Oui — contactez-nous à billing@chrono.mail pour recevoir des factures avec numéro de TVA et coordonnées entreprise.' },
];

function getFaqByPlan(plan) {
    if (!isLoggedIn()) return FAQ_GUEST;
    if (plan === 'PRO')      return FAQ_PRO;
    if (plan === 'BUSINESS') return FAQ_BUSINESS;
    return FAQ_FREE;
}

function renderFaq(plan) {
    const container = document.getElementById('faq-grid');
    if (!container) return;
    container.innerHTML = getFaqByPlan(plan).map(f => `
    <div class="faq-item"><div class="faq-q">${f.q}</div><div class="faq-a">${f.a}</div></div>
  `).join('');
}


// ============================================================
// 18. STRIPE — Checkout, portail, retours URL
// ============================================================
async function upgradePlan(priceKey) {
    try {
        showToast('⏳ Redirection vers le paiement...');
        const res  = await authFetch('/stripe/checkout', { method:'POST', body:JSON.stringify({ priceKey }) });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
        else showToast('❌ ' + (data.error || 'Erreur'));
    } catch(err) { showToast('❌ Erreur réseau'); }
}

async function openBillingPortal() {
    try {
        const res  = await authFetch('/stripe/portal', { method:'POST' });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
        else showToast('❌ ' + (data.error || 'Erreur'));
    } catch(err) { showToast('❌ Erreur réseau'); }
}

// Retour Stripe Checkout
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

// Retour Google OAuth
(function handleGoogleCallback() {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token');
    const user   = params.get('user');
    if (token && user) {
        try {
            saveAuth(token, JSON.parse(decodeURIComponent(user)));
            window.history.replaceState({}, document.title, '/');
            showPage('dashboard');
            showToast('🎉 Connecté avec Google !');
        } catch(e) { console.error('Erreur parsing user Google', e); }
    }
})();


// ============================================================
// 19. TOAST
// ============================================================
function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}


// ============================================================
// 20. ANALYTICS
// ============================================================
let _analyticsDays = 30;

async function loadAnalytics() {
    const user = getUser();
    const plan = user?.plan || 'FREE';
    const gate    = document.getElementById('analytics-gate');
    const content = document.getElementById('analytics-content');

    // Sync sidebar plan box (analytics page)
    const chipA = document.getElementById('sidebar-plan-chip-a');
    const upgradeA = document.getElementById('upgrade-btn-a');
    if (chipA) { chipA.textContent = plan; chipA.className = 'plan-chip plan-chip-' + plan.toLowerCase(); }
    if (upgradeA) {
        if (plan === 'FREE')      { upgradeA.textContent = 'Passer à Pro ↗'; upgradeA.onclick = () => upgradePlan('pro_monthly'); upgradeA.style.display = 'block'; }
        else if (plan === 'PRO') { upgradeA.textContent = 'Gérer mon abonnement'; upgradeA.onclick = openBillingPortal; upgradeA.style.display = 'block'; }
        else                      { upgradeA.style.display = 'none'; }
    }

    if (plan === 'FREE') {
        gate.style.display = 'block';
        content.style.display = 'none';
        return;
    }
    gate.style.display = 'none';
    content.style.display = 'block';

    // Period buttons
    document.querySelectorAll('.analytics-period').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.days) === _analyticsDays);
        btn.onclick = () => { _analyticsDays = parseInt(btn.dataset.days); loadAnalytics(); };
    });

    try {
        const res = await authFetch('/analytics/summary');
        if (res.status === 401) { logout(); return; }
        if (res.status === 403) { gate.style.display = 'block'; content.style.display = 'none'; return; }
        const data = await res.json();

        // Summary cards
        document.getElementById('analytics-total').textContent = data.total.toLocaleString('fr-FR');
        const avg = _analyticsDays > 0 ? Math.round(data.total / _analyticsDays * 10) / 10 : 0;
        document.getElementById('analytics-avg').textContent = avg.toLocaleString('fr-FR');

        const top = data.countdowns.sort((a, b) => b.count - a.count)[0];
        document.getElementById('analytics-top').textContent = top ? top.name : '—';

        document.getElementById('analytics-subtitle').textContent =
            `${data.total} impressions · ${data.countdowns.length} countdown${data.countdowns.length !== 1 ? 's' : ''}`;

        // Chart
        renderAnalyticsChart(data.daily, _analyticsDays);

        // Table
        renderAnalyticsTable(data.countdowns, data.total);
    } catch (err) {
        document.getElementById('analytics-subtitle').textContent = 'Erreur de chargement';
    }
}

function renderAnalyticsChart(daily, days) {
    const container = document.getElementById('analytics-chart');
    const W = 700, H = 220, PX = 56, PY = 24, PB = 30;
    const chartW = W - PX - 20, chartH = H - PY - PB;

    // Build full date range
    const dateMap = {};
    daily.forEach(d => { dateMap[d.date.slice(0, 10)] = d.count; });
    const points = [];
    for (let i = days - 1; i >= 0; i--) {
        const dt = new Date(); dt.setDate(dt.getDate() - i);
        const key = dt.toISOString().slice(0, 10);
        points.push({ date: key, count: dateMap[key] || 0 });
    }

    const maxVal = Math.max(1, ...points.map(p => p.count));
    const xStep = points.length > 1 ? chartW / (points.length - 1) : 0;

    const coords = points.map((p, i) => ({
        x: PX + i * xStep,
        y: PY + chartH - (p.count / maxVal) * chartH,
        ...p,
    }));

    // Build SVG
    const polyline = coords.map(c => `${c.x},${c.y}`).join(' ');
    const areaPath = `M${coords[0].x},${PY + chartH} ${coords.map(c => `L${c.x},${c.y}`).join(' ')} L${coords[coords.length - 1].x},${PY + chartH} Z`;

    // Y-axis labels
    const ySteps = 4;
    let yLabels = '';
    for (let i = 0; i <= ySteps; i++) {
        const val = Math.round(maxVal * (1 - i / ySteps));
        const y = PY + (i / ySteps) * chartH;
        yLabels += `<text x="${PX - 8}" y="${y + 4}" text-anchor="end" fill="var(--muted)" font-size="10" font-family="JetBrains Mono,monospace">${val}</text>`;
        yLabels += `<line x1="${PX}" x2="${PX + chartW}" y1="${y}" y2="${y}" stroke="var(--border)" stroke-dasharray="3,3"/>`;
    }

    // X-axis labels (show ~6 labels max)
    let xLabels = '';
    const labelEvery = Math.max(1, Math.floor(points.length / 6));
    coords.forEach((c, i) => {
        if (i % labelEvery === 0 || i === coords.length - 1) {
            const d = new Date(c.date);
            const label = `${d.getDate()}/${d.getMonth() + 1}`;
            xLabels += `<text x="${c.x}" y="${H - 4}" text-anchor="middle" fill="var(--muted)" font-size="10" font-family="JetBrains Mono,monospace">${label}</text>`;
        }
    });

    // Dots + hover
    let dots = '';
    coords.forEach(c => {
        dots += `<circle cx="${c.x}" cy="${c.y}" r="3" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
    });

    // Tooltip rects (invisible hover zones)
    let hovers = '';
    coords.forEach((c, i) => {
        const w = i === 0 || i === coords.length - 1 ? xStep / 2 : xStep;
        const xStart = i === 0 ? c.x : c.x - xStep / 2;
        hovers += `<rect x="${xStart}" y="${PY}" width="${w || chartW}" height="${chartH}" fill="transparent" class="analytics-hover">
            <title>${c.date} — ${c.count} impression${c.count !== 1 ? 's' : ''}</title>
        </rect>`;
    });

    container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        ${yLabels}
        ${xLabels}
        <path d="${areaPath}" fill="var(--accent)" opacity="0.08"/>
        <polyline points="${polyline}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
        ${hovers}
    </svg>`;
}

function renderAnalyticsTable(countdowns, total) {
    const tbody = document.querySelector('#analytics-table tbody');
    if (!tbody) return;
    const sorted = [...countdowns].sort((a, b) => b.count - a.count);
    const maxCount = sorted[0]?.count || 1;
    tbody.innerHTML = sorted.map(cd => {
        const pct = total > 0 ? Math.round(cd.count / total * 100) : 0;
        const barW = Math.round(cd.count / maxCount * 100);
        return `<tr>
            <td style="font-weight:600">${cd.name}</td>
            <td style="font-family:'JetBrains Mono',monospace;font-size:13px">${cd.count.toLocaleString('fr-FR')}</td>
            <td style="min-width:120px">
                <div style="display:flex;align-items:center;gap:8px">
                    <div class="at-bar" style="flex:1"><div class="at-bar-fill" style="width:${barW}%"></div></div>
                    <span style="font-size:12px;color:var(--muted);min-width:32px">${pct}%</span>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ============================================================
// 21. INIT
// ============================================================
updateNavAuth();

// Restaure la page depuis le hash ou les query params
(function initRoute() {
    const params = new URLSearchParams(window.location.search);
    // Gestion retour OAuth / Stripe
    if (params.get('token')) return; // géré ailleurs
    if (params.get('checkout')) { if (isLoggedIn()) { showPage('dashboard'); return; } }

    const hash = window.location.hash.replace('#', '');
    const validPages = ['landing','login','register','dashboard','create','analytics','pricing',
                        'legal-mentions','legal-privacy','legal-cgu','legal-cgv','legal-cookies','contact','404'];
    if (hash && validPages.includes(hash)) {
        showPage(hash);
    } else if (hash) {
        // Hash invalide → 404
        showPage('404');
    } else if (isLoggedIn()) {
        showPage('dashboard');
    }
})();

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash) showPage(hash);
});

// Ferme la modale upgrade avec la touche Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeUpgradeModal(); _closeConfirmModal(); }
});