/**
 * script.js — Chronomail
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
// 0. THEME — Mode sombre / clair
// ============================================================
function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const theme  = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cm_theme', theme);
    document.getElementById('theme-toggle').textContent = theme === 'dark' ? '☾' : '☀';
}

(function initTheme() {
    // Le clair est la présentation par défaut du site : la préférence système
    // n'est plus consultée. Seul un choix explicite de l'utilisateur, mémorisé
    // dans cm_theme par le bouton de bascule, peut activer le sombre.
    const theme = localStorage.getItem('cm_theme') || 'light';
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☾' : '☀';
})();

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
    // Entrées « Console support » : simple confort d'affichage. Le contrôle
    // d'accès réel est fait par requireAdmin sur /support/admin, un compte
    // non administrateur qui forcerait #admin-support ne verrait rien.
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = (loggedIn && user?.isAdmin) ? '' : 'none';
    });
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
    if (['dashboard','create','analytics','settings','support','admin-support'].includes(name) && !isLoggedIn()) {
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
    if (name === 'settings')  loadSettings();
    if (name === 'pricing')   renderPricing();
    if (name === 'create')    { _resetCreateForm(); applyPlanGates(); updateExpiredUI(); goToStep(1); }
    if (name === 'contact')   prepareContactForm();
    if (name === 'support')   loadMySupport();
    if (name === 'admin-support') loadAdminSupport();
}


// ============================================================
// 3. API AUTH — Login / Register / Forgot / Reset
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
        showToast('🎉 Compte créé ! Vérifiez votre email.');
    } catch (err) { errEl.textContent = 'Erreur réseau, réessayez'; errEl.style.display = 'block'; }
    finally { btn.textContent = 'Créer mon compte →'; btn.disabled = false; }
}


async function forgotPassword() {
    const btn    = document.getElementById('forgot-btn');
    const email  = document.getElementById('forgot-email').value.trim();
    const errEl  = document.getElementById('forgot-error');
    const okEl   = document.getElementById('forgot-success');
    errEl.style.display = 'none'; okEl.style.display = 'none';
    if (!email) { errEl.textContent = 'Entrez votre email'; errEl.style.display = 'block'; return; }
    btn.textContent = '⏳ Envoi...'; btn.disabled = true;
    try {
        const res = await fetch('/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
        if (res.ok) {
            okEl.textContent = 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé. Vérifiez votre boîte de réception.';
            okEl.style.display = 'block';
        } else {
            const data = await res.json();
            errEl.textContent = data.error || 'Erreur'; errEl.style.display = 'block';
        }
    } catch { errEl.textContent = 'Erreur réseau'; errEl.style.display = 'block'; }
    finally { btn.textContent = 'Envoyer le lien'; btn.disabled = false; }
}

async function resetPassword() {
    const btn       = document.getElementById('reset-btn');
    const password  = document.getElementById('reset-password').value;
    const confirm   = document.getElementById('reset-password-confirm').value;
    const errEl     = document.getElementById('reset-error');
    const okEl      = document.getElementById('reset-success');
    errEl.style.display = 'none'; okEl.style.display = 'none';

    if (!password || !confirm) { errEl.textContent = 'Remplissez les deux champs'; errEl.style.display = 'block'; return; }
    if (password.length < 8) { errEl.textContent = 'Mot de passe trop court (8 caractères minimum)'; errEl.style.display = 'block'; return; }
    if (password !== confirm) { errEl.textContent = 'Les mots de passe ne correspondent pas'; errEl.style.display = 'block'; return; }

    // Extraire le token depuis le hash : #reset-password?token=xxx
    const hashParts = window.location.hash.split('?');
    const params    = new URLSearchParams(hashParts[1] || '');
    const token     = params.get('token');
    if (!token) { errEl.textContent = 'Lien invalide — refaites une demande'; errEl.style.display = 'block'; return; }

    btn.textContent = '⏳ Réinitialisation...'; btn.disabled = true;
    try {
        const res  = await fetch('/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
        const data = await res.json();
        if (res.ok) {
            okEl.textContent = 'Mot de passe réinitialisé ! Vous pouvez vous connecter.';
            okEl.style.display = 'block';
            setTimeout(() => showPage('login'), 2000);
        } else {
            errEl.textContent = data.error || 'Erreur'; errEl.style.display = 'block';
        }
    } catch { errEl.textContent = 'Erreur réseau'; errEl.style.display = 'block'; }
    finally { btn.textContent = 'Réinitialiser'; btn.disabled = false; }
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


/**
 * Rafraîchit le profil en cache depuis le serveur.
 *
 * Le plan affiché — et surtout les verrous d'applyPlanGates() — viennent
 * du localStorage, écrit à la connexion et jamais réactualisé. Or le plan
 * change hors de l'application : dans le portail Stripe, ou par webhook
 * (paiement échoué, fin d'abonnement). Sans ce rafraîchissement, un
 * client qui vient de payer Business garde l'interface Pro, timer
 * perpétuel verrouillé, jusqu'à sa prochaine reconnexion.
 *
 * Fusion et non remplacement : /auth/me ne renvoie pas le marqueur
 * `password`, dont dépend l'affichage du formulaire de mot de passe pour
 * les comptes Google.
 */
async function refreshUser() {
    if (!isLoggedIn()) return null;
    try {
        const res = await authFetch('/auth/me');
        if (!res.ok) return null;
        const fresh  = await res.json();
        const merged = { ...(getUser() || {}), ...fresh };
        localStorage.setItem('cm_user', JSON.stringify(merged));
        updateNavAuth();
        return merged;
    } catch { return null; }
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
        timezone:     document.getElementById('cd-timezone')?.value || 'Europe/Paris',
        bgColor:      currentBg,
        textColor:    currentColor,
        blockBgColor:   currentBlockBg  || '',
        sepColor:       currentSepColor || '',
        showSeparators: showSeparators ? '1' : '0',
        fontSize:     currentFontSize,
        width:        currentWidth,
        fontFamily:   currentFontDigits,
        fontLabels:   currentFontLabels || '',   // null → '' : sans ça URLSearchParams enverrait "null"
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

// ============================================================
// FUSEAUX HORAIRES
// ============================================================
// Le HTML n'en proposait que cinq, avec des décalages écrits en dur
// (« Europe/Paris (UTC+1) ») donc faux la moitié de l'année. Le backend
// accepte n'importe quel identifiant IANA — il passe par Intl, qui gère
// l'heure d'été — la liste peut donc s'élargir sans rien changer côté
// serveur, et les décalages sont recalculés à chaque affichage.
const TIMEZONES = {
    'Europe': [
        'Europe/Paris', 'Europe/London', 'Europe/Lisbon', 'Europe/Madrid',
        'Europe/Berlin', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Brussels',
        'Europe/Zurich', 'Europe/Stockholm', 'Europe/Athens', 'Europe/Moscow',
    ],
    'Amériques': [
        'America/New_York', 'America/Toronto', 'America/Chicago', 'America/Denver',
        'America/Los_Angeles', 'America/Mexico_City', 'America/Bogota',
        'America/Sao_Paulo', 'America/Buenos_Aires',
    ],
    'Afrique et Moyen-Orient': [
        'Africa/Casablanca', 'Africa/Algiers', 'Africa/Tunis', 'Africa/Lagos',
        'Africa/Cairo', 'Africa/Johannesburg', 'Asia/Jerusalem', 'Asia/Dubai',
    ],
    'Asie et Pacifique': [
        'Asia/Karachi', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore',
        'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
        'Australia/Sydney', 'Pacific/Auckland',
    ],
    'Autre': ['UTC'],
};

function tzOffsetLabel(tz) {
    try {
        const part = new Intl.DateTimeFormat('fr-FR', { timeZone: tz, timeZoneName: 'longOffset' })
            .formatToParts(new Date())
            .find(p => p.type === 'timeZoneName');
        return part ? part.value : '';
    } catch { return ''; }
}

function buildTimezoneOptions() {
    const sel = document.getElementById('cd-timezone');
    if (!sel) return;
    const selected = sel.value || 'Europe/Paris';
    sel.innerHTML = Object.entries(TIMEZONES).map(([region, zones]) =>
        `<optgroup label="${region}">` + zones.map(tz => {
            const ville  = tz.split('/').pop().replace(/_/g, ' ');
            const offset = tzOffsetLabel(tz);
            const label  = (!offset || ville === 'UTC') ? ville : `${ville} — ${offset}`;
            return `<option value="${tz}">${label}</option>`;
        }).join('') + '</optgroup>'
    ).join('');
    setTimezone(selected);
}

/**
 * Sélectionne un fuseau, en l'ajoutant à la liste s'il n'y figure pas —
 * cas d'un countdown créé avec une valeur retirée depuis.
 */
function setTimezone(tz) {
    const sel = document.getElementById('cd-timezone');
    if (!sel || !tz) return;
    sel.value = tz;
    if (sel.value !== tz) {
        const opt = new Option(`${tz}${tzOffsetLabel(tz) ? ' — ' + tzOffsetLabel(tz) : ''}`, tz, true, true);
        sel.insertBefore(opt, sel.firstChild);
    }
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
/** Applique l'état des séparateurs à l'interface, sans le basculer. */
function renderSeparatorsToggle() {
    const el = document.getElementById('sep-toggle');
    if (el) { el.classList.toggle('on', showSeparators); el.classList.toggle('off', !showSeparators); }
    const icon = document.getElementById('sep-toggle-icon');
    if (icon) icon.textContent = showSeparators ? '✓' : '';
    const inp = document.getElementById('color-sep');
    if (inp) inp.style.opacity = showSeparators ? '1' : '0.35';
}

function toggleSeparators() {
    showSeparators = !showSeparators;
    renderSeparatorsToggle();
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
    applyLabelTextGate(isPro);
    applyProAppearanceGates(isPro);
}

const DEFAULT_LABELS = { days: 'JOURS', hours: 'HEURES', minutes: 'MIN', seconds: 'SEC' };

/**
 * Le texte des libellés est réservé au plan Pro : pour un compte Free, le
 * serveur réécrit labelDays/Hours/Minutes/Seconds avec les valeurs par défaut
 * (api.js, POST et PUT). Sans ce garde-fou l'utilisateur tape « DAYS », voit
 * « DAYS » dans l'aperçu, et récupère « JOURS » dans le GIF publié.
 *
 * Les toggles restent actifs quel que soit le plan : masquer une unité passe
 * par showUnits, que le serveur n'a jamais restreint.
 */
function applyLabelTextGate(isPro) {
    const badge = document.getElementById('labels-gate-badge');
    if (badge) badge.style.display = isPro ? 'none' : 'inline-block';

    Object.entries(DEFAULT_LABELS).forEach(([unit, value]) => {
        const inp    = document.getElementById('cd-label-' + unit);
        const expInp = document.getElementById('cd-label-' + unit + '-exp');
        if (!inp) return;
        inp.readOnly = !isPro;
        inp.classList.toggle('plan-locked', !isPro);
        inp.title    = isPro ? '' : 'Libellés personnalisés — disponible à partir du plan Pro';
        inp.onclick  = isPro ? null : () => openUpgradeModal('labels');
        // Remet l'affichage en phase avec ce qui sera publié — cas d'un compte
        // rétrogradé dont les countdowns portent encore d'anciens libellés.
        if (!isPro) {
            inp.value = value;
            if (expInp) expInp.value = value;
        }
    });
}

/**
 * Même principe pour les trois réglages d'apparence avancée — fond des blocs,
 * couleur des séparateurs, police des labels : le serveur les force à null
 * pour un compte Free (api.js, POST et PUT). On les verrouille et on rétablit
 * l'état « auto », qui est exactement ce que le GIF publié rendra.
 *
 * Le toggle d'affichage des séparateurs, lui, reste ouvert à tous : il ne
 * touche à aucun champ restreint par plan.
 */
function applyProAppearanceGates(isPro) {
    ['block-gate-badge', 'sep-gate-badge', 'fontlabels-gate-badge'].forEach(id => {
        const badge = document.getElementById(id);
        if (badge) badge.style.display = isPro ? 'none' : 'inline-block';
    });

    // <input type="color"> : preventDefault() sur le clic suffit à empêcher
    // l'ouverture du sélecteur natif, l'événement continue vers la modale.
    ['color-block', 'color-sep'].forEach(id => {
        const inp = document.getElementById(id);
        if (!inp) return;
        inp.classList.toggle('plan-locked', !isPro);
        inp.tabIndex = isPro ? 0 : -1;
        inp.title    = isPro ? '' : 'Couleurs avancées — disponible à partir du plan Pro';
        inp.onclick  = isPro ? null : (e) => { e.preventDefault(); openUpgradeModal('colors'); };
    });

    // <select> : preventDefault() ne ferme pas la liste déroulante. On coupe
    // donc les pointeurs sur le select et on récupère le clic sur sa cellule.
    const fontSel  = document.getElementById('cd-font-labels');
    const fontCell = document.getElementById('ctx-cell-fontlabels');
    if (fontSel) {
        fontSel.classList.toggle('plan-locked', !isPro);
        fontSel.style.pointerEvents = isPro ? '' : 'none';
        fontSel.tabIndex = isPro ? 0 : -1;
    }
    if (fontCell) {
        fontCell.style.cursor = isPro ? '' : 'pointer';
        fontCell.onclick      = isPro ? null : () => openUpgradeModal('fontlabels');
    }

    if (isPro) return;

    currentBlockBg    = null;
    currentSepColor   = null;
    currentFontLabels = null;
    if (fontSel) fontSel.value = '';
    renderAdvancedColorsUI();
}

/**
 * Reporte currentBlockBg / currentSepColor sur les trois éléments qui les
 * affichent : le sélecteur natif, la pastille et le texte hexadécimal. Ni
 * pickBlockBg() ni pickSepColor() ne le font entièrement — ils partent du clic
 * utilisateur, où l'input porte déjà la bonne valeur.
 *
 * null = « Auto » : la teinte est calculée par le générateur à partir de la
 * couleur principale (cf. countdown-generator.js).
 */
function renderAdvancedColorsUI() {
    const blockInp     = document.getElementById('color-block');
    const blockPreview = document.getElementById('color-block-preview');
    const blockHex     = document.getElementById('color-block-hex');
    const sepInp       = document.getElementById('color-sep');
    const sepPreview   = document.getElementById('color-sep-preview');
    const sepHex       = document.getElementById('color-sep-hex');

    if (blockInp)     blockInp.value = currentBlockBg || '#dbeafe';
    if (blockPreview) blockPreview.style.background = currentBlockBg || '#dbeafe';
    if (blockHex)     blockHex.textContent = currentBlockBg || 'Auto';

    if (sepInp)       sepInp.value = currentSepColor || currentColor;
    if (sepPreview)   sepPreview.style.background = currentSepColor || currentColor;
    if (sepHex)       sepHex.textContent = currentSepColor || 'Auto';
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
        desc: 'Le décompte démarre au moment où chaque destinataire ouvre votre email, et non à une date fixe. Deux lecteurs qui ouvrent à trois jours d\'intervalle voient le même temps restant — idéal pour les séquences automatisées.',
    },
    colors: {
        title: 'Couleurs avancées', subtitle: 'Disponible à partir du plan Pro',
        desc: 'Choisissez la couleur de fond des blocs et celle des séparateurs, au lieu des teintes calculées automatiquement depuis votre couleur principale.',
    },
    fontlabels: {
        title: 'Police des labels', subtitle: 'Disponible à partir du plan Pro',
        desc: 'Donnez aux libellés une police différente de celle des chiffres, pour coller précisément à votre charte typographique.',
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
                showSeparators,
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
    renderSeparatorsToggle();
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
    if (tzEl) setTimezone('Europe/Paris');

    const colorMainEl = document.getElementById('color-main');
    if (colorMainEl) colorMainEl.value = '#2563eb';
    pickColorMain('#2563eb');
    const colorBgEl = document.getElementById('color-bg');
    if (colorBgEl) colorBgEl.value = '#f8f7f4';
    pickBgMain('#f8f7f4');
    // Sinon les pastilles gardent les couleurs du countdown précédent alors
    // que currentBlockBg / currentSepColor viennent de repasser à « Auto ».
    renderAdvancedColorsUI();

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
    if (tzEl) setTimezone(cd.timezone || 'Europe/Paris');

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
    const flEl = document.getElementById('cd-font-labels');
    if (flEl) flEl.value = cd.fontLabels || '';   // '' → option « Par défaut »
    currentBlockBg  = cd.blockBgColor || null;
    currentSepColor = cd.sepColor || null;
    showSeparators  = cd.showSeparators !== false;
    renderSeparatorsToggle();
    currentFontLabels = cd.fontLabels || null;
    renderAdvancedColorsUI();

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

    // Le countdown est déjà publié : son code d'intégration est connu, on
    // l'affiche sans attendre une republication.
    currentGifUrl = `${window.location.origin}/gif/${cd.id}`;
    displayCode(currentGifUrl);

    // Après hydratation : un countdown créé du temps où le compte était Pro
    // porte encore ses libellés personnalisés, que le serveur refusera.
    applyPlanGates();
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


async function duplicateCountdown(id) {
    const cd = cdMap[id];
    if (!cd) return;
    try {
        const res = await authFetch(`/countdown/${id}/duplicate`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            showToast('Countdown dupliqué !');
            loadDashboard();
        } else {
            showToast('❌ ' + (data.error || data.message || 'Erreur'));
        }
    } catch { showToast('❌ Erreur réseau'); }
}

// 15. DASHBOARD — Chargement et rendu des countdowns
// ============================================================
async function loadDashboard() {
    updateVerifyBanner();
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
        if (fill) fill.style.width = pct + '%';
        if (text) text.textContent = `${total} / ${maxCountdowns} countdowns`;
        if (sub)  sub.textContent  = `${active} actif${active!==1?'s':''} · ${expired} expiré${expired!==1?'s':''}`;
        renderPlanBox('', plan);
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

/**
 * Construit la balise d'intégration d'un countdown déjà publié.
 *
 * Même format que celui proposé après publication : une balise <img>
 * autonome, sans dépendance à l'état du formulaire de création.
 */
function embedSnippetFor(cd) {
    const url = `${window.location.origin}/gif/${cd.id}`;
    return `<img src="${url}" alt="Offre expire dans..." width="${cd.width}" border="0" style="display:block" />`;
}

/**
 * Copie la balise d'un countdown depuis le dashboard.
 *
 * Sans ça, récupérer le code d'un countdown existant obligeait à ouvrir
 * « Modifier » puis à le republier — editCountdown() n'affiche pas la
 * section code, qui n'apparaît qu'après une publication.
 */
function copyEmbedCode(id) {
    const cd = cdMap[id];
    if (!cd) { showToast('❌ Countdown introuvable'); return; }
    navigator.clipboard.writeText(embedSnippetFor(cd))
        .then(() => showToast('📋 Code HTML copié !'))
        .catch(() => showToast('❌ Copie impossible'));
}

/**
 * Échappe une chaîne avant injection en innerHTML.
 *
 * Les noms de countdown sont saisis librement par l'utilisateur : sans
 * échappement, un nom contenant `<img src=x onerror=...>` s'exécute au
 * rendu de la carte. La portée est limitée — on ne s'attaque que
 * soi-même — mais le jeton JWT est dans le localStorage du même domaine.
 */
function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
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
      <div><div class="cd-card-name">${escapeHtml(cd.name)}</div><div class="cd-card-date">${isActive?'Expire le':'Expiré le'} ${dateStr}</div></div>
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
      <button class="cd-action-btn" onclick="copyEmbedCode('${cd.id}')">Copier le code</button>
      <button class="cd-action-btn" onclick="editCountdown('${cd.id}')">Modifier</button>
      <button class="cd-action-btn" onclick="duplicateCountdown('${cd.id}')">Dupliquer</button>
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
        // Portail Stripe, pas un nouveau Checkout : `mode: 'subscription'` créerait
        // un second abonnement facturé en parallèle du Pro déjà actif.
        if (businessCta) { businessCta.textContent = 'Passer à Business ↗'; businessCta.onclick = openBillingPortal; businessCta.className = 'btn btn-ghost pricing-btn'; }
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
    { q:"Que se passe-t-il quand un countdown expire ?",           a:"Par défaut, le GIF affiche 00:00:00:00. Vous pouvez aussi afficher un texte de votre choix, ou — à partir du plan Pro — rediriger vers une autre page." },
    { q:"Y a-t-il un engagement de durée ?",                       a:"Non, tous les plans sont sans engagement. Vous pouvez annuler à tout moment depuis le portail de facturation Stripe." },
];
const FAQ_FREE = [
    { q:'Comment passer au plan Pro ?',                  a:'Cliquez sur "Passer à Pro" depuis votre dashboard ou depuis cette page. Le paiement est sécurisé via Stripe.' },
    { q:'Mes countdowns actuels seront-ils conservés ?', a:'Oui, tous vos countdowns existants sont conservés lors d\'un changement de plan.' },
    { q:'Les GIFs fonctionnent-ils dans tous les clients email ?', a:'Gmail, Apple Mail, Yahoo, Outlook 2013+, iOS Mail et tous les grands ESP. Outlook 2007-2010 affiche la première frame statique.' },
    { q:"Y a-t-il un engagement de durée ?",             a:"Non, vous pouvez annuler à tout moment : votre accès est maintenu jusqu'à la fin de la période déjà payée, qui n'est pas remboursée. Une garantie satisfait ou remboursé de 14 jours s'applique à votre première souscription." },
];
const FAQ_PRO = [
    { q:'Comment gérer ma facturation ?',    a:'Cliquez sur "Gérer mon abonnement" pour accéder au portail Stripe — vous y trouverez vos factures et pouvez modifier votre moyen de paiement.' },
    { q:'Comment passer au plan Business ?', a:'Depuis "Gérer mon abonnement", changez de formule dans le portail Stripe : votre abonnement Pro est remplacé et le montant déjà payé est déduit au prorata.' },
    { q:"Comment annuler mon abonnement ?",  a:'Depuis le portail de facturation Stripe, cliquez sur "Annuler l\'abonnement". Vous conservez l\'accès Pro jusqu\'à la fin de la période payée.' },
    { q:"Que se passe-t-il à l'expiration d'un countdown ?", a:"Vous pouvez afficher 00:00:00:00, un texte personnalisé, ou rediriger automatiquement vers l'URL de votre choix." },
];
const FAQ_BUSINESS = [
    { q:'Comment gérer ma facturation ?',      a:'Accédez au portail Stripe via "Gérer mon abonnement" pour consulter vos factures et gérer votre moyen de paiement.' },
    { q:'Comment fonctionne le timer perpétuel ?', a:"Activez-le à l'étape Expiration et choisissez une durée (de 1 heure à 1 an). Le décompte démarre alors au moment où chaque destinataire ouvre votre email : quelqu'un qui l'ouvre trois jours après l'envoi voit le même temps restant que le premier lecteur. La date cible n'est plus utilisée dans ce mode." },
    { q:"À quoi sert le style Neon ?",         a:"C'est le style exclusif au plan Business : chiffres lumineux sur fond sombre, pour les campagnes qui doivent ressortir dans la boîte de réception." },
    { q:"Comment annuler mon abonnement ?",    a:'Depuis le portail de facturation Stripe, cliquez sur "Annuler l\'abonnement". Vous conservez l\'accès Business jusqu\'à la fin de la période payée.' },
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


// ── Settings / Profil ────────────────────────────────────────────
/**
 * Synchronise l'encart de plan d'une barre latérale. Les trois pages de
 * l'espace connecté en ont un, avec des identifiants suffixés ('' pour le
 * dashboard, '-a' pour les analytiques, '-s' pour les paramètres).
 *
 * Un abonné Pro ou Business est renvoyé vers le portail Stripe : lui
 * proposer « Passer à Pro » ouvrirait un second abonnement, facturé en
 * parallèle du premier.
 */
function renderPlanBox(suffix, plan) {
    const name = document.getElementById('sidebar-plan-name' + suffix);
    const chip = document.getElementById('sidebar-plan-chip' + suffix);
    const btn  = document.getElementById('upgrade-btn' + suffix);

    if (name && name.firstChild) {
        name.firstChild.nodeValue = 'Plan ' + plan.charAt(0) + plan.slice(1).toLowerCase() + ' ';
    }
    if (chip) { chip.textContent = plan; chip.className = 'plan-chip plan-chip-' + plan.toLowerCase(); }
    if (btn) {
        btn.style.display = 'block';
        if (plan === 'FREE') {
            btn.textContent = 'Passer à Pro ↗';
            btn.onclick = () => upgradePlan('pro_monthly');
        } else {
            btn.textContent = 'Gérer mon abonnement';
            btn.onclick = openBillingPortal;
        }
    }
}

function loadSettings() {
    const user = getUser();
    if (!user) return;
    document.getElementById('settings-name').value = user.name || '';
    document.getElementById('settings-email').value = user.email || '';
    // Masquer le form mot de passe si Google OAuth
    const isGoogle = user.password === 'google_oauth';
    const pwForm   = document.getElementById('settings-password-form');
    const notice   = document.getElementById('settings-google-notice');
    if (pwForm) pwForm.style.display = isGoogle ? 'none' : 'flex';
    if (notice) notice.style.display = isGoogle ? 'block' : 'none';
    const plan = user.plan || 'FREE';
    renderPlanBox('-s', plan);

    // Bloc facturation — les CGV article 5 désignent cet écran comme le
    // chemin pour consulter ses factures et résilier.
    const chip = document.getElementById('settings-plan-chip');
    const desc = document.getElementById('settings-billing-desc');
    const btn  = document.getElementById('settings-billing-btn');
    if (chip) { chip.textContent = plan; chip.className = 'plan-chip plan-chip-' + plan.toLowerCase(); }
    if (plan === 'FREE') {
        if (desc) desc.textContent = 'Le plan Free est limité à 3 countdowns actifs. Aucun moyen de paiement n\'est enregistré.';
        if (btn)  { btn.textContent = 'Passer à Pro ↗'; btn.onclick = () => upgradePlan('pro_monthly'); }
    } else {
        if (desc) desc.textContent = 'Vos factures, votre moyen de paiement et la résiliation se gèrent depuis le portail sécurisé de Stripe. La résiliation prend effet à la fin de la période déjà payée.';
        if (btn)  { btn.textContent = 'Gérer mon abonnement ↗'; btn.onclick = openBillingPortal; }
    }
}

async function saveProfile(btn) {
    const name   = document.getElementById('settings-name').value.trim();
    const errEl  = document.getElementById('settings-error');
    const okEl   = document.getElementById('settings-success');
    errEl.style.display = 'none'; okEl.style.display = 'none';
    btn.textContent = '⏳ ...'; btn.disabled = true;
    try {
        const res  = await authFetch('/auth/profile', { method: 'PUT', body: JSON.stringify({ name }) });
        const data = await res.json();
        if (res.ok) {
            const user = getUser();
            user.name = data.name;
            localStorage.setItem('cm_user', JSON.stringify(user));
            updateNavAuth();
            okEl.textContent = 'Profil mis à jour !'; okEl.style.display = 'block';
        } else { errEl.textContent = data.error || 'Erreur'; errEl.style.display = 'block'; }
    } catch { errEl.textContent = 'Erreur réseau'; errEl.style.display = 'block'; }
    finally { btn.textContent = 'Enregistrer'; btn.disabled = false; }
}

async function changePassword(btn) {
    const current = document.getElementById('settings-current-password').value;
    const newPwd  = document.getElementById('settings-new-password').value;
    const errEl   = document.getElementById('password-error');
    const okEl    = document.getElementById('password-success');
    errEl.style.display = 'none'; okEl.style.display = 'none';
    if (!current || !newPwd) { errEl.textContent = 'Remplissez les deux champs'; errEl.style.display = 'block'; return; }
    if (newPwd.length < 8) { errEl.textContent = '8 caractères minimum'; errEl.style.display = 'block'; return; }
    btn.textContent = '⏳ ...'; btn.disabled = true;
    try {
        const res  = await authFetch('/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword: current, newPassword: newPwd }) });
        const data = await res.json();
        if (res.ok) {
            okEl.textContent = 'Mot de passe changé !'; okEl.style.display = 'block';
            document.getElementById('settings-current-password').value = '';
            document.getElementById('settings-new-password').value = '';
        } else { errEl.textContent = data.error || 'Erreur'; errEl.style.display = 'block'; }
    } catch { errEl.textContent = 'Erreur réseau'; errEl.style.display = 'block'; }
    finally { btn.textContent = 'Changer le mot de passe'; btn.disabled = false; }
}

// Retour vérification email
(function handleVerifyReturn() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === '1') {
        window.history.replaceState({}, document.title, '/');
        // Mettre à jour le user local
        const user = getUser();
        if (user) { user.emailVerified = true; localStorage.setItem('cm_user', JSON.stringify(user)); }
        showToast('✅ Email vérifié avec succès !');
        if (isLoggedIn()) showPage('dashboard');
    }
})();

// ── Bannière vérification email ──────────────────────────────
function updateVerifyBanner() {
    const banner = document.getElementById('email-verify-banner');
    if (!banner) return;
    const user = getUser();
    banner.style.display = (user && !user.emailVerified) ? 'flex' : 'none';
}

async function resendVerification(btn) {
    btn.textContent = '⏳ Envoi...'; btn.disabled = true;
    try {
        const res = await authFetch('/auth/resend-verification', { method: 'POST' });
        const data = await res.json();
        if (res.ok) showToast('📧 Email de vérification renvoyé !');
        else showToast('❌ ' + (data.error || 'Erreur'));
    } catch { showToast('❌ Erreur réseau'); }
    finally { btn.textContent = 'Renvoyer'; btn.disabled = false; }
}

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

    renderPlanBox('-a', plan);

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
            <td style="font-weight:600">${escapeHtml(cd.name)}</td>
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
// 20b. SUPPORT — Demandes client et console d'assistance
// ============================================================

/**
 * Libellés des thèmes et statuts, chargés depuis le serveur.
 *
 * Les mêmes chaînes servent à valider côté backend : les recopier ici
 * garantirait qu'un thème ajouté un jour n'apparaisse pas dans le
 * formulaire, ou pire, y apparaisse sous un autre nom.
 */
let supportMeta = null;
async function loadSupportMeta() {
    if (supportMeta) return supportMeta;
    try {
        const res = await fetch('/support/meta');
        if (res.ok) supportMeta = await res.json();
    } catch { /* le rendu retombe sur la clé brute */ }
    return supportMeta;
}
function catLabel(key) { return supportMeta?.categories?.[key] || key; }
function statLabel(key) { return supportMeta?.statuses?.[key] || key; }

function fmtTicketDate(value) {
    const d = new Date(value);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ── Formulaire de contact ────────────────────────────────────
function updateTicketCounter() {
    const el = document.getElementById('contact-message');
    const counter = document.getElementById('contact-counter');
    if (el && counter) counter.textContent = `${el.value.length} / 5000`;
}

/**
 * Prépare le formulaire à l'affichage de la page Contact.
 *
 * Connecté, l'email n'est pas redemandé : le backend ignore de toute
 * façon celui du corps de requête au profit de celui du compte, pour
 * qu'on ne puisse pas ouvrir un ticket au nom d'un tiers.
 */
async function prepareContactForm() {
    loadSupportMeta();
    const user     = getUser();
    const identity = document.getElementById('contact-identity');
    const logged   = document.getElementById('contact-logged');
    if (isLoggedIn() && user) {
        identity.style.display = 'none';
        logged.style.display   = 'block';
        document.getElementById('contact-logged-email').textContent = user.email;
    } else {
        identity.style.display = '';
        logged.style.display   = 'none';
    }
    document.getElementById('contact-success-track').style.display = isLoggedIn() ? '' : 'none';
}

function resetTicketForm() {
    ['contact-subject', 'contact-message', 'contact-name'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('contact-error').style.display   = 'none';
    document.getElementById('contact-success').style.display = 'none';
    document.getElementById('contact-form-box').style.display = '';
    updateTicketCounter();
    prepareContactForm();
}

async function submitTicket() {
    const btn   = document.getElementById('contact-submit');
    const errEl = document.getElementById('contact-error');
    errEl.style.display = 'none';

    const payload = {
        category: document.getElementById('contact-category').value,
        subject:  document.getElementById('contact-subject').value.trim(),
        message:  document.getElementById('contact-message').value.trim(),
        website:  document.getElementById('contact-website').value,
    };
    if (!isLoggedIn()) {
        payload.email = document.getElementById('contact-email').value.trim();
        payload.name  = document.getElementById('contact-name').value.trim();
        if (!payload.email) { errEl.textContent = 'Indiquez une adresse email pour qu\'on puisse vous répondre'; errEl.style.display = 'block'; return; }
    }
    if (payload.subject.length < 3)   { errEl.textContent = 'Précisez un objet'; errEl.style.display = 'block'; return; }
    if (payload.message.length < 10)  { errEl.textContent = 'Décrivez votre demande en quelques mots de plus'; errEl.style.display = 'block'; return; }

    btn.textContent = '⏳ Envoi...'; btn.disabled = true;
    try {
        const res  = await authFetch('/support/tickets', { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || 'Erreur lors de l\'envoi'; errEl.style.display = 'block'; return; }
        document.getElementById('contact-success-ref').textContent = data.ref || '—';
        document.getElementById('contact-form-box').style.display  = 'none';
        document.getElementById('contact-success').style.display   = 'block';
        window.scrollTo(0, 0);
    } catch {
        errEl.textContent = 'Erreur réseau, réessayez'; errEl.style.display = 'block';
    } finally {
        btn.textContent = 'Envoyer ma demande'; btn.disabled = false;
    }
}

// ── Mes demandes (client) ────────────────────────────────────
function ticketStatusPill(status) {
    const cls = { OPEN: 'open', PENDING: 'pending', RESOLVED: 'resolved', CLOSED: 'closed' }[status] || 'open';
    return `<span class="ticket-pill ticket-pill-${cls}">${escapeHtml(statLabel(status))}</span>`;
}

async function loadMySupport() {
    await loadSupportMeta();
    const list = document.getElementById('support-list');
    const sub  = document.getElementById('support-subtitle');
    list.innerHTML = '<div class="ticket-empty">Chargement...</div>';
    try {
        const res = await authFetch('/support/tickets');
        if (res.status === 401) { logout(); return; }
        const tickets = await res.json();
        const ouverts = tickets.filter(t => t.status === 'OPEN' || t.status === 'PENDING').length;
        sub.textContent = tickets.length
            ? `${tickets.length} demande${tickets.length > 1 ? 's' : ''} · ${ouverts} en cours`
            : 'Aucune demande pour le moment';

        if (!tickets.length) {
            list.innerHTML = `<div class="ticket-empty">
                <p>Vous n'avez encore envoyé aucune demande.</p>
                <button class="btn btn-primary" onclick="showPage('contact')">Écrire au support</button>
            </div>`;
            return;
        }
        list.innerHTML = tickets.map(t => `
            <div class="ticket-row" id="ticket-row-${t.id}">
                <div class="ticket-row-head" onclick="toggleMyTicket('${t.id}')">
                    <div class="ticket-row-main">
                        <div class="ticket-row-title">${escapeHtml(t.subject)}</div>
                        <div class="ticket-row-meta">
                            <span class="ticket-ref">${escapeHtml(t.ref)}</span>
                            <span class="ticket-cat">${escapeHtml(catLabel(t.category))}</span>
                            <span>${escapeHtml(fmtTicketDate(t.lastMessageAt))}</span>
                        </div>
                    </div>
                    ${ticketStatusPill(t.status)}
                </div>
                <div class="ticket-thread" id="ticket-thread-${t.id}" style="display:none"></div>
            </div>`).join('');
    } catch {
        list.innerHTML = '<div class="ticket-empty" style="color:var(--red)">Erreur de chargement</div>';
    }
}

async function toggleMyTicket(id) {
    const box = document.getElementById('ticket-thread-' + id);
    if (!box) return;
    if (box.style.display !== 'none') { box.style.display = 'none'; return; }
    box.style.display = 'block';
    box.innerHTML = '<div class="ticket-empty">Chargement...</div>';
    try {
        const res = await authFetch('/support/tickets/' + id);
        if (!res.ok) { box.innerHTML = '<div class="ticket-empty">Demande introuvable</div>'; return; }
        const t = await res.json();
        const closed = t.status === 'CLOSED';
        box.innerHTML = renderThread(t.messages) + (closed
            ? `<p class="ticket-closed-note">Cette demande est close. Ouvrez-en une nouvelle si le sujet revient.</p>`
            : `<div class="ticket-reply">
                   <textarea class="ticket-input ticket-textarea" id="reply-${t.id}" rows="4" maxlength="5000" placeholder="Votre réponse..."></textarea>
                   <button class="btn btn-primary btn-sm" onclick="replyToTicket('${t.id}', this)">Envoyer</button>
               </div>`);
    } catch {
        box.innerHTML = '<div class="ticket-empty" style="color:var(--red)">Erreur de chargement</div>';
    }
}

/**
 * Rend un fil de discussion.
 *
 * `who` nomme l'auteur côté client : dans la console d'assistance, « Vous »
 * désigne le support, pas le client — le même fil se lit donc dans les
 * deux sens selon qui le regarde.
 */
function renderThread(messages, who = null) {
    const asAdmin = who !== null;
    return `<div class="ticket-messages">` + messages.map(m => {
        const isSupport = m.author === 'SUPPORT';
        const author = isSupport
            ? (asAdmin ? 'Vous (support)' : 'Support Chronomail')
            : (asAdmin ? who : 'Vous');
        return `
        <div class="ticket-msg ticket-msg-${isSupport ? 'support' : 'customer'}">
            <div class="ticket-msg-head">${escapeHtml(author)} · ${escapeHtml(fmtTicketDate(m.createdAt))}</div>
            <div class="ticket-msg-body">${escapeHtml(m.body).replace(/\n/g, '<br>')}</div>
        </div>`;
    }).join('') + `</div>`;
}

async function replyToTicket(id, btn) {
    const el   = document.getElementById('reply-' + id);
    const body = el.value.trim();
    if (!body) { showToast('❌ Message vide'); return; }
    btn.textContent = '⏳'; btn.disabled = true;
    try {
        const res = await authFetch(`/support/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ message: body }) });
        const data = await res.json();
        if (!res.ok) { showToast('❌ ' + (data.error || 'Erreur')); return; }
        showToast('✓ Réponse envoyée');
        await loadMySupport();
        toggleMyTicket(id);
    } catch { showToast('❌ Erreur réseau'); }
    finally { btn.textContent = 'Envoyer'; btn.disabled = false; }
}

// ── Console d'assistance (admin) ─────────────────────────────
const adminFilters = { status: 'OPEN', category: '', q: '' };

function setAdminStatus(status) { adminFilters.status = status; loadAdminSupport(); }
function setAdminCategory(cat)  { adminFilters.category = adminFilters.category === cat ? '' : cat; loadAdminSupport(); }

async function loadAdminSupport() {
    await loadSupportMeta();
    const list = document.getElementById('admin-ticket-list');
    const sub  = document.getElementById('admin-support-subtitle');
    adminFilters.q = document.getElementById('admin-search')?.value.trim() || '';

    list.innerHTML = '<div class="ticket-empty">Chargement...</div>';
    const params = new URLSearchParams();
    if (adminFilters.status)   params.set('status', adminFilters.status);
    if (adminFilters.category) params.set('category', adminFilters.category);
    if (adminFilters.q)        params.set('q', adminFilters.q);

    try {
        const res = await authFetch('/support/admin/tickets?' + params.toString());
        if (res.status === 401) { logout(); return; }
        if (res.status === 403) {
            list.innerHTML = '<div class="ticket-empty">Cette console est réservée aux administrateurs.</div>';
            sub.textContent = 'Accès refusé';
            return;
        }
        const { tickets, counts } = await res.json();
        renderAdminFilters(counts);

        const enCours = (counts.status.OPEN || 0) + (counts.status.PENDING || 0);
        sub.textContent = `${enCours} demande${enCours > 1 ? 's' : ''} en cours · ${tickets.length} affichée${tickets.length > 1 ? 's' : ''}`;

        if (!tickets.length) {
            list.innerHTML = '<div class="ticket-empty">Aucune demande ne correspond à ce filtre.</div>';
            return;
        }
        list.innerHTML = tickets.map(t => `
            <div class="ticket-row" id="admin-row-${t.id}">
                <div class="ticket-row-head" onclick="toggleAdminTicket('${t.id}')">
                    <div class="ticket-row-main">
                        <div class="ticket-row-title">${escapeHtml(t.subject)}</div>
                        <div class="ticket-row-meta">
                            <span class="ticket-ref">${escapeHtml(t.ref)}</span>
                            <span class="ticket-cat">${escapeHtml(catLabel(t.category))}</span>
                            <span>${escapeHtml(t.email)}</span>
                            ${t.planAtCreation ? `<span class="plan-chip">${escapeHtml(t.planAtCreation)}</span>` : ''}
                            <span>${escapeHtml(fmtTicketDate(t.lastMessageAt))}</span>
                        </div>
                    </div>
                    ${ticketStatusPill(t.status)}
                </div>
                <div class="ticket-thread" id="admin-thread-${t.id}" style="display:none"></div>
            </div>`).join('');
    } catch {
        list.innerHTML = '<div class="ticket-empty" style="color:var(--red)">Erreur de chargement</div>';
    }
}

/**
 * Onglets de statut et filtres par thème.
 *
 * Les compteurs de thèmes ne portent que sur les demandes en cours :
 * c'est la charge de travail restante, pas l'historique, qui doit
 * sauter aux yeux en ouvrant la console.
 */
function renderAdminFilters(counts) {
    const tabs = [
        ['OPEN',     'À traiter'],
        ['PENDING',  'En attente'],
        ['RESOLVED', 'Résolues'],
        ['CLOSED',   'Closes'],
        ['',         'Toutes'],
    ];
    document.getElementById('admin-status-tabs').innerHTML = tabs.map(([key, label]) => {
        const n = key ? (counts.status[key] || 0) : Object.values(counts.status).reduce((a, b) => a + b, 0);
        return `<button class="admin-tab ${adminFilters.status === key ? 'active' : ''}" onclick="setAdminStatus('${key}')">
            ${label}<span class="admin-tab-count">${n}</span>
        </button>`;
    }).join('');

    const cats = supportMeta?.categories || {};
    document.getElementById('admin-category-filters').innerHTML = Object.entries(cats).map(([key, label]) => {
        const n = counts.category[key] || 0;
        return `<div class="sidebar-item ${adminFilters.category === key ? 'active' : ''}" onclick="setAdminCategory('${key}')">
            <span>${escapeHtml(label)}</span><span class="admin-cat-count">${n}</span>
        </div>`;
    }).join('');
}

async function toggleAdminTicket(id) {
    const box = document.getElementById('admin-thread-' + id);
    if (!box) return;
    if (box.style.display !== 'none') { box.style.display = 'none'; return; }
    box.style.display = 'block';
    box.innerHTML = '<div class="ticket-empty">Chargement...</div>';
    try {
        const res = await authFetch('/support/admin/tickets/' + id);
        if (!res.ok) { box.innerHTML = '<div class="ticket-empty">Ticket introuvable</div>'; return; }
        const t    = await res.json();
        const cats = supportMeta?.categories || {};
        const opts = Object.entries(cats).map(([k, l]) =>
            `<option value="${k}" ${k === t.category ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('');

        box.innerHTML = `
            <div class="admin-ticket-toolbar">
                <label class="ticket-label" for="admin-cat-${t.id}">Thème</label>
                <select class="ticket-input admin-inline-select" id="admin-cat-${t.id}" onchange="adminSetCategory('${t.id}', this.value)">${opts}</select>
                <a class="btn btn-ghost btn-sm" href="mailto:${encodeURIComponent(t.email)}?subject=${encodeURIComponent('[' + t.ref + '] ' + t.subject)}">Répondre par email</a>
                ${t.status !== 'CLOSED' ? `<button class="btn btn-ghost btn-sm" onclick="adminSetStatus('${t.id}','CLOSED')">Clore sans réponse</button>` : ''}
                ${t.status !== 'OPEN'   ? `<button class="btn btn-ghost btn-sm" onclick="adminSetStatus('${t.id}','OPEN')">Rouvrir</button>` : ''}
            </div>
            ${renderThread(t.messages, t.name ? `${t.name} (${t.email})` : t.email)}
            <div class="ticket-reply">
                <textarea class="ticket-input ticket-textarea" id="admin-reply-${t.id}" rows="5" maxlength="5000" placeholder="Votre réponse au client — elle lui est envoyée par email."></textarea>
                <div class="ticket-reply-actions">
                    <button class="btn btn-primary btn-sm" onclick="adminReply('${t.id}', true, this)">Répondre et marquer résolu</button>
                    <button class="btn btn-ghost btn-sm" onclick="adminReply('${t.id}', false, this)">Répondre seulement</button>
                </div>
            </div>`;
    } catch {
        box.innerHTML = '<div class="ticket-empty" style="color:var(--red)">Erreur de chargement</div>';
    }
}

async function adminReply(id, resolve, btn) {
    const el   = document.getElementById('admin-reply-' + id);
    const body = el.value.trim();
    if (!body) { showToast('❌ Message vide'); return; }
    const label = btn.textContent;
    btn.textContent = '⏳'; btn.disabled = true;
    try {
        const res  = await authFetch(`/support/admin/tickets/${id}/messages`, {
            method: 'POST', body: JSON.stringify({ message: body, resolve }),
        });
        const data = await res.json();
        if (!res.ok) { showToast('❌ ' + (data.error || 'Erreur')); return; }
        showToast(resolve ? '✓ Réponse envoyée, ticket résolu' : '✓ Réponse envoyée');
        loadAdminSupport();
    } catch { showToast('❌ Erreur réseau'); }
    finally { btn.textContent = label; btn.disabled = false; }
}

async function adminSetStatus(id, status) {
    try {
        const res = await authFetch('/support/admin/tickets/' + id, { method: 'PATCH', body: JSON.stringify({ status }) });
        if (!res.ok) { showToast('❌ Erreur'); return; }
        showToast('✓ Statut mis à jour');
        loadAdminSupport();
    } catch { showToast('❌ Erreur réseau'); }
}

async function adminSetCategory(id, category) {
    try {
        const res = await authFetch('/support/admin/tickets/' + id, { method: 'PATCH', body: JSON.stringify({ category }) });
        if (!res.ok) { showToast('❌ Erreur'); return; }
        showToast('✓ Thème mis à jour');
        loadAdminSupport();
    } catch { showToast('❌ Erreur réseau'); }
}


// ============================================================
// 21. INIT
// ============================================================
updateNavAuth();

// Restaure la page depuis le hash ou les query params
buildTimezoneOptions();

/**
 * Au chargement, on redemande le profil au serveur : c'est le seul moment
 * où l'application peut apprendre un changement de plan survenu ailleurs —
 * retour du portail Stripe, fin d'abonnement, échec de paiement.
 *
 * Si le plan a bougé, la page courante est re-rendue pour que les verrous
 * et l'encart d'abonnement suivent, sans imposer une reconnexion.
 */
(async function refreshUserOnLoad() {
    const avant = getUser()?.plan;
    const user  = await refreshUser();
    if (!user || user.plan === avant) return;

    const active = document.querySelector('.page.active')?.id?.replace('page-', '');
    if (active) showPage(active);
    showToast(`Votre plan est maintenant ${user.plan}`);
})();

(function initRoute() {
    const params = new URLSearchParams(window.location.search);
    // Gestion retour OAuth / Stripe
    if (params.get('token')) return; // géré ailleurs
    if (params.get('checkout')) { if (isLoggedIn()) { showPage('dashboard'); return; } }

    const rawHash = window.location.hash.replace('#', '');
    const hash = rawHash.split('?')[0]; // strip query params (ex: reset-password?token=xxx)
    const validPages = ['landing','login','register','forgot-password','reset-password','dashboard','create','analytics','settings','pricing',
                        'legal-mentions','legal-privacy','legal-cgu','legal-cgv','legal-cookies','contact','support','admin-support','404'];
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
    const hash = window.location.hash.replace('#', '').split('?')[0];
    if (hash) showPage(hash);
});

// Ferme la modale upgrade avec la touche Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeUpgradeModal(); _closeConfirmModal(); }
});