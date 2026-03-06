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

function updateNavAuth() {
    const loggedIn = isLoggedIn();
    const user     = getUser();
    document.getElementById('nav-cta-guest').style.display = loggedIn ? 'none' : 'flex';
    document.getElementById('nav-cta-user').style.display  = loggedIn ? 'flex' : 'none';
    if (loggedIn && user) {
        document.getElementById('nav-user-name').textContent = user.name || user.email;
    }
}

function handleDashboardClick() {
    if (isLoggedIn()) showPage('dashboard');
    else showPage('login');
}


// ============================================================
// 2. NAVIGATION — Routage SPA
// ============================================================
function showPage(name) {
    if (['dashboard','create'].includes(name) && !isLoggedIn()) {
        showPage('login');
        return;
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    window.scrollTo(0, 0);
    if (name === 'dashboard') loadDashboard();
    if (name === 'pricing')   renderPricing();
    if (name === 'create')    { applyPlanGates(); updateExpiredUI(); goToStep(1); }
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
// ============================================================
// VARIABLES D'ÉTAT — Page Create
// ============================================================
let currentColor       = '#2563eb';
let currentBg          = '#f8f7f4';
let currentFont        = 'monospace';
let currentStyle       = 'rounded';
let currentOrientation = 'horizontal';
let currentFontSize    = 36;
let activeCodeTab      = 'minimal';
let currentGifUrl      = '';
let previewDebounce    = null;  // timer debounce 500ms

// Pré-remplit la date à J+7 à l'init
setTimeout(() => {
    const el = document.getElementById('cd-date');
    if (el && !el.value) el.value = new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16);
}, 0);


// ============================================================
// PREVIEW GIF LIVE — Debounce 500ms
// Construit l'URL /gif?... avec tous les paramètres actuels
// et l'affecte à l'<img> preview — aucun bouton nécessaire.
// ============================================================

/**
 * Planifie un rafraîchissement du GIF preview dans 500ms.
 * Tout appel supplémentaire repart de zéro (debounce).
 */
function schedulePreview() {
    clearTimeout(previewDebounce);
    previewDebounce = setTimeout(refreshPreview, 500);
}

/**
 * Construit l'URL /gif avec tous les paramètres et met à jour
 * l'<img> de preview. Affiche un spinner pendant le chargement.
 */
function refreshPreview() {
    const endDate = document.getElementById('cd-date')?.value;
    if (!endDate) return; // pas de date → on n'appelle pas le serveur

    const width    = document.getElementById('cd-width')?.value || 400;
    const showUnits = getShowUnits();
    if (!showUnits) return; // aucune unité cochée → rien à afficher

    const params = new URLSearchParams({
        endDate,
        bgColor:     currentBg,
        textColor:   currentColor,
        fontSize:    currentFontSize,
        width,
        fontFamily:  currentFont,
        style:       currentStyle,
        orientation: currentOrientation,
        showUnits,
        labelDays:    document.getElementById('cd-label-days')?.value    || 'JOURS',
        labelHours:   document.getElementById('cd-label-hours')?.value   || 'HEURES',
        labelMinutes: document.getElementById('cd-label-minutes')?.value || 'MIN',
        labelSeconds: document.getElementById('cd-label-seconds')?.value || 'SEC',
        _t: Date.now(), // cache-busting
    });

    const url        = '/gif?' + params.toString();
    const img        = document.getElementById('gif-preview-img');
    const loader     = document.getElementById('gif-preview-loader');
    const placeholder = document.getElementById('gif-preview-placeholder');
    const badge      = document.getElementById('preview-status-badge');

    // Affiche le spinner
    if (loader)     { loader.style.display     = 'flex'; }
    if (placeholder){ placeholder.style.display = 'none'; }
    if (badge)      { badge.innerHTML = '<div class="live-badge-dot" style="background:var(--orange)"></div>Chargement'; badge.style.color = 'var(--orange)'; badge.style.background = 'var(--orange-l)'; badge.style.border = '1px solid #fed7aa'; }

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

/**
 * Retourne la chaîne showUnits depuis les checkboxes,
 * ex: "hours,minutes,seconds" si Jours est décoché.
 * Retourne null si aucune unité n'est cochée.
 */
function getShowUnits() {
    const map = [
        { id: 'unit-days',    key: 'days'    },
        { id: 'unit-hours',   key: 'hours'   },
        { id: 'unit-minutes', key: 'minutes' },
        { id: 'unit-seconds', key: 'seconds' },
    ];
    const active = map.filter(u => document.getElementById(u.id)?.checked).map(u => u.key);
    return active.length ? active.join(',') : null;
}


// ============================================================
// ACCORDÉONS — Étapes de création + barre de progression
// ============================================================
let currentStep = 1;

function goToStep(step) {
    [1, 2, 3, 4].forEach(i => {
        document.getElementById('body-' + i)?.classList.remove('open');
        document.getElementById('accordion-' + i)?.classList.remove('active');
    });
    document.getElementById('body-' + step)?.classList.add('open');
    document.getElementById('accordion-' + step)?.classList.add('active');
    currentStep = step;
    updateProgressBar(step);
    document.getElementById('accordion-' + step)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function toggleAccordion(step) {
    const body   = document.getElementById('body-' + step);
    const isOpen = body?.classList.contains('open');
    if (isOpen) {
        body.classList.remove('open');
        document.getElementById('accordion-' + step)?.classList.remove('active');
    } else {
        goToStep(step);
    }
}

function updateProgressBar(activeStep) {
    [1, 2, 3, 4].forEach(i => {
        const el = document.getElementById('step-' + i);
        if (!el) return;
        el.classList.remove('active', 'done');
        if (i < activeStep)        el.classList.add('done');
        else if (i === activeStep) el.classList.add('active');
    });
    [1, 2, 3].forEach(i => {
        const line = document.getElementById('line-' + i + '-' + (i + 1));
        if (!line) return;
        line.classList.remove('done', 'active');
        if (i < activeStep)        line.classList.add('done');
        else if (i === activeStep) line.classList.add('active');
    });
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
// STYLE
// ============================================================
function pickStyle(el) {
    document.querySelectorAll('#style-picker .style-opt-b').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    currentStyle = el.dataset.style;
    schedulePreview();
}

/**
 * Clic sur un style Pro/Business verrouillé.
 * Si l'utilisateur a le bon plan, sélectionne le style.
 * Sinon, ouvre la modale upgrade.
 */
function pickStyleGated(el, style) {
    const user = getUser();
    const plan = user?.plan || 'FREE';
    const requiredPlan = el.dataset.plan;

    const hasAccess =
        (requiredPlan === 'pro'      && ['PRO','BUSINESS'].includes(plan)) ||
        (requiredPlan === 'business' && plan === 'BUSINESS');

    if (hasAccess) {
        document.querySelectorAll('.style-opt-b').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        currentStyle = style;
        schedulePreview();
    } else {
        openUpgradeModal(requiredPlan === 'business' ? 'business_style' : 'pro_style');
    }
}


// ============================================================
// POLICE
// ============================================================
function pickFont(el) {
    document.querySelectorAll('#font-picker .font-opt').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    currentFont = el.dataset.font;
    schedulePreview();
}


// ============================================================
// TAILLE
// ============================================================
function updateFontSize(val) {
    currentFontSize = Math.min(50, parseInt(val));
    document.getElementById('font-size-display').textContent = currentFontSize + 'px';
    // Force le slider à ne pas dépasser 50
    const slider = document.getElementById('cd-fontsize');
    if (slider && parseInt(slider.value) > 50) slider.value = 50;
    schedulePreview();
}


// ============================================================
// COULEUR PRINCIPALE — input natif pleine largeur
// Synchronise la prévisualisation hex + preview GIF live
// ============================================================
function pickColorMain(value) {
    currentColor = value;
    // Met à jour la pastille et le texte hex
    const preview = document.getElementById('color-main-preview');
    const hex     = document.getElementById('color-main-hex');
    if (preview) preview.style.background = value;
    if (hex)     hex.textContent = value;
    schedulePreview();
}

// Alias conservé pour compatibilité avec d'éventuels anciens appels
function pickColorCustom(value) { pickColorMain(value); }
function pickColor(el)          { pickColorMain(el?.dataset?.color || currentColor); }


// ============================================================
// COULEUR DE FOND — input natif pleine largeur
// ============================================================
function pickBgMain(value) {
    currentBg = value;
    const preview = document.getElementById('color-bg-preview');
    const hex     = document.getElementById('color-bg-hex');
    if (preview) { preview.style.background = value; preview.style.border = isLightColor(value) ? '1px solid var(--border2)' : 'none'; }
    if (hex)     hex.textContent = value;
    schedulePreview();
}

// Alias
function pickBgCustom(value) { pickBgMain(value); }
function pickBg(el)          { pickBgMain(el?.dataset?.color || currentBg); }

/** Détermine si une couleur hex est claire (pour ajouter une bordure sur fond blanc) */
function isLightColor(hex) {
    const h = hex.replace('#','');
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}


// ============================================================
// POST-EXPIRATION UI
// ============================================================
function updateExpiredUI() {
    const val         = document.getElementById('cd-expired')?.value;
    const textRow     = document.getElementById('expired-text-row');
    const redirectRow = document.getElementById('expired-redirect-row');
    if (textRow)     textRow.style.display     = val === 'SHOW_TEXT' ? 'block' : 'none';
    if (redirectRow) redirectRow.style.display = val === 'REDIRECT'  ? 'block' : 'none';
}


// ============================================================
// MODALE UPGRADE — Ouverture contextuelle selon la feature
// ============================================================

/** Contenu contextuel selon la feature verrouillée */
const UPGRADE_MODAL_CONTENT = {
    labels: {
        title:    'Labels personnalisés',
        subtitle: 'Disponible à partir du plan Pro',
        desc:     'Personnalisez les textes sous chaque chiffre : "JOURS", "HEURES", "MIN", "SEC" ou n\'importe quel libellé dans votre langue.',
    },
    redirect: {
        title:    'Redirection après expiration',
        subtitle: 'Disponible à partir du plan Pro',
        desc:     'Redirigez automatiquement vos lecteurs vers une nouvelle page (nouvelle offre, page d\'accueil…) dès que le countdown atteint zéro.',
    },
    pro_style: {
        title:    'Styles Pro',
        subtitle: 'Disponible à partir du plan Pro',
        desc:     'Déverrouillez les styles Verre (glassmorphism), Pill et Cercle pour des countdowns qui se démarquent vraiment dans vos emails.',
    },
    business_style: {
        title:    'Style Neon',
        subtitle: 'Exclusif au plan Business',
        desc:     'Le style Neon avec effets lumineux est réservé au plan Business pour des campagnes ultra-premium.',
    },
};

/**
 * Ouvre la modale upgrade avec le contenu contextuel de la feature.
 * @param {string} feature — 'labels' | 'redirect'
 */
function openUpgradeModal(feature) {
    const content = UPGRADE_MODAL_CONTENT[feature] || UPGRADE_MODAL_CONTENT.labels;
    document.getElementById('upgrade-modal-title').textContent    = content.title;
    document.getElementById('upgrade-modal-subtitle').textContent = content.subtitle;
    document.getElementById('upgrade-modal-desc').textContent     = content.desc;
    const overlay = document.getElementById('upgrade-modal-overlay');
    if (overlay) { overlay.style.display = 'flex'; setTimeout(() => overlay.classList.add('open'), 10); }
    document.body.style.overflow = 'hidden';
}

/** Ferme la modale (clic sur overlay ou bouton "Plus tard") */
function closeUpgradeModal(event) {
    // Si clic sur overlay, ferme seulement si clic en dehors de la modale
    if (event && event.target !== document.getElementById('upgrade-modal-overlay')) return;
    const overlay = document.getElementById('upgrade-modal-overlay');
    if (overlay) { overlay.classList.remove('open'); overlay.style.display = 'none'; }
    document.body.style.overflow = '';
}

/** Bouton "Passer à Pro" dans la modale */
function handleUpgradeFromModal() {
    closeUpgradeModal();
    if (isLoggedIn()) upgradePlan('pro_monthly');
    else showPage('register');
}


// ============================================================
// PLAN GATES
// ============================================================
function applyPlanGates() {
    const plan            = getUser()?.plan || 'FREE';
    const overlayLabels   = document.getElementById('overlay-labels');
    const overlayRedirect = document.getElementById('overlay-redirect');
    const optRedirect     = document.getElementById('opt-redirect');
    const isPro           = plan !== 'FREE';
    if (overlayLabels)   overlayLabels.style.display   = isPro ? 'none' : 'flex';
    if (overlayRedirect) overlayRedirect.style.display = isPro ? 'none' : 'flex';
    if (optRedirect)     optRedirect.disabled           = !isPro;
}


// ============================================================
// PUBLICATION
// ============================================================
async function publishCountdown() {
    const btn2    = document.getElementById('publish-btn-2');
    const endDate = document.getElementById('cd-date')?.value;
    if (!endDate) { showToast('⚠️ Veuillez choisir une date'); return; }

    const showUnits = getShowUnits();
    if (!showUnits) { showToast('⚠️ Cochez au moins une unité'); return; }

    if (btn2) { btn2.textContent = '⏳ Génération...'; btn2.disabled = true; }

    try {
        const res = await authFetch('/countdown', {
            method: 'POST',
            body: JSON.stringify({
                name:             document.getElementById('cd-name')?.value || 'Mon countdown',
                endDate,
                timezone:         document.getElementById('cd-timezone')?.value || 'Europe/Paris',
                bgColor:          currentBg,
                textColor:        currentColor,
                fontSize:         currentFontSize,
                width:            parseInt(document.getElementById('cd-width')?.value) || 400,
                fontFamily:       currentFont,
                style:            currentStyle,
                orientation:      currentOrientation,
                showUnits,
                labelDays:        document.getElementById('cd-label-days')?.value    || 'JOURS',
                labelHours:       document.getElementById('cd-label-hours')?.value   || 'HEURES',
                labelMinutes:     document.getElementById('cd-label-minutes')?.value || 'MIN',
                labelSeconds:     document.getElementById('cd-label-seconds')?.value || 'SEC',
                expiredBehavior:  document.getElementById('cd-expired')?.value       || 'SHOW_ZEROS',
                expiredText:      document.getElementById('cd-expired-text')?.value  || 'Offre terminée',
                expiredRedirect:  document.getElementById('cd-expired-redirect')?.value || undefined,
            }),
        });

        const data = await res.json();
        if (!res.ok) { showToast('❌ ' + (data.message || data.error || 'Erreur')); return; }

        currentGifUrl = data.gifUrl;
        displayCode(data.gifUrl);

        // Met à jour la preview avec le vrai GIF publié
        const img = document.getElementById('gif-preview-img');
        if (img) { img.src = data.gifUrl + '?_t=' + Date.now(); img.style.display = 'block'; }

        showToast('🚀 Countdown publié !');
        updateProgressBar(5);

    } catch (err) {
        showToast('❌ Erreur réseau');
    } finally {
        if (btn2) { btn2.textContent = '✓ Publier & obtenir le code'; btn2.disabled = false; }
    }
}


// ============================================================
// CODE SNIPPETS
// ============================================================
function displayCode(gifUrl) {
    const section    = document.getElementById('code-section');
    const urlDisplay = document.getElementById('gif-url-display');
    if (section)    section.style.display = 'block';
    if (urlDisplay) urlDisplay.textContent = gifUrl;

    const w = document.getElementById('cd-width')?.value || 400;
    window._codeSnippets = {
        minimal:   `<img src="${gifUrl}" alt="Offre expire dans..." width="${w}" border="0" style="display:block" />`,
        standard:  `<img src="${gifUrl}" border="0" style="display:block;max-width:100%" alt="Timer — chrono.mail" width="${w}" />`,
        klaviyo:   `<img src="${gifUrl}" border="0" style="display:block;max-width:100%" alt="{% if first_name %}{{ first_name }}, offre expire bientôt{% else %}Offre expire bientôt{% endif %}" width="${w}" />`,
        mailchimp: `<img src="${gifUrl}" border="0" style="display:block;max-width:100%" alt="*|FNAME|*, votre offre expire bientôt" width="${w}" />`,
    };

    document.getElementById('code-minimal-content').textContent   = window._codeSnippets.minimal;
    document.getElementById('code-standard-content').textContent  = window._codeSnippets.standard;
    document.getElementById('code-klaviyo-content').textContent   = window._codeSnippets.klaviyo;
    document.getElementById('code-mailchimp-content').textContent = window._codeSnippets.mailchimp;
}

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

// 15. DASHBOARD — Chargement et rendu des countdowns
// ============================================================
async function loadDashboard() {
    const grid = document.getElementById('cards-grid');
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">Chargement...</div>';
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
        data.forEach(cd => grid.appendChild(buildCard(cd)));
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
// 20. INIT
// ============================================================
updateNavAuth();

// Ferme la modale upgrade avec la touche Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeUpgradeModal();
});