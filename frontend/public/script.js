/**
 * script.js — chrono.mail
 * ============================================================
 * Frontend principal de l'application.
 *
 * Sections :
 *   1. AUTH          — Gestion du token JWT et de la session
 *   2. NAVIGATION    — Routage entre les pages SPA
 *   3. API AUTH      — Appels login / register vers le backend
 *   4. FETCH AUTH    — Wrapper fetch avec Authorization header
 *   5. HERO TIMER    — Timer animé sur la page d'accueil
 *   6. PREVIEW       — Timer en temps réel sur la page de création
 *   7. APPARENCE     — Couleur, police, style, taille
 *   8. POST-EXPIRATION — UI du comportement après expiration
 *   9. PLAN GATES    — Verrouillage des options selon le plan
 *  10. PUBLICATION   — Envoi du countdown à l'API + affichage du code
 *  11. CODE SNIPPETS — Génération et copie des snippets HTML / ESP
 *  12. DASHBOARD     — Chargement et rendu des countdowns
 *  13. PRICING       — Page tarifs dynamique selon le plan
 *  14. FAQ           — Questions fréquentes contextuelles par plan
 *  15. STRIPE        — Checkout, portail de facturation, retours
 *  16. CALLBACKS URL — Google OAuth et retour Stripe
 *  17. TOAST         — Notifications temporaires
 *  18. INIT          — Initialisation au chargement de la page
 */


// ============================================================
// 1. AUTH — Gestion du token JWT et de la session utilisateur
//    Le token et les infos user sont stockés en localStorage
//    sous les clés 'cm_token' et 'cm_user'.
// ============================================================

/** Récupère le token JWT depuis le localStorage */
function getToken()  { return localStorage.getItem('cm_token'); }

/** Récupère l'objet utilisateur depuis le localStorage */
function getUser()   { return JSON.parse(localStorage.getItem('cm_user') || 'null'); }

/** Retourne true si l'utilisateur est connecté */
function isLoggedIn(){ return !!getToken(); }

/**
 * Persiste le token et l'utilisateur en localStorage,
 * puis met à jour l'affichage de la navigation.
 */
function saveAuth(token, user) {
    localStorage.setItem('cm_token', token);
    localStorage.setItem('cm_user', JSON.stringify(user));
    updateNavAuth();
}

/**
 * Déconnecte l'utilisateur : supprime le token et le user,
 * redirige vers la landing page et affiche un toast.
 */
function logout() {
    localStorage.removeItem('cm_token');
    localStorage.removeItem('cm_user');
    updateNavAuth();
    showPage('landing');
    showToast('👋 Déconnecté');
}

/**
 * Met à jour la navbar selon l'état de connexion :
 * - Affiche les boutons guest ou user selon isLoggedIn()
 * - Affiche le nom/email de l'utilisateur connecté
 */
function updateNavAuth() {
    const loggedIn = isLoggedIn();
    const user     = getUser();
    document.getElementById('nav-cta-guest').style.display = loggedIn ? 'none' : 'flex';
    document.getElementById('nav-cta-user').style.display  = loggedIn ? 'flex' : 'none';
    if (loggedIn && user) {
        document.getElementById('nav-user-name').textContent = user.name || user.email;
    }
}

/**
 * Gère le clic sur "Dashboard" dans la nav :
 * redirige vers login si non connecté.
 */
function handleDashboardClick() {
    if (isLoggedIn()) showPage('dashboard');
    else showPage('login');
}


// ============================================================
// 2. NAVIGATION — Routage SPA entre les pages
//    Chaque "page" est un div avec class="page".
//    showPage() active la bonne page et déclenche
//    les initialisations nécessaires.
// ============================================================

/**
 * Affiche la page demandée et masque les autres.
 * Protège les pages authentifiées (dashboard, create).
 * Déclenche les initialisations spécifiques à chaque page.
 *
 * @param {string} name - Identifiant de la page (ex: 'dashboard', 'login')
 */
function showPage(name) {
    // Protection des pages nécessitant une connexion
    if (['dashboard','create'].includes(name) && !isLoggedIn()) {
        showPage('login');
        return;
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    window.scrollTo(0, 0);

    // Initialisations spécifiques à chaque page
    if (name === 'dashboard') loadDashboard();
    if (name === 'pricing')   renderPricing();
    if (name === 'create')    { applyPlanGates(); updateExpiredUI(); }
}


// ============================================================
// 3. API AUTH — Appels login / register vers le backend
//    Les erreurs sont affichées inline dans le formulaire.
// ============================================================

/** Connecte l'utilisateur via POST /auth/login */
async function login() {
    const btn      = document.getElementById('login-btn');
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');

    errEl.style.display = 'none';
    if (!email || !password) { errEl.textContent = 'Veuillez remplir tous les champs'; errEl.style.display = 'block'; return; }

    btn.textContent = '⏳ Connexion...'; btn.disabled = true;
    try {
        const res  = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || 'Erreur de connexion'; errEl.style.display = 'block'; return; }
        saveAuth(data.token, data.user);
        showPage('dashboard');
        showToast('👋 Bienvenue ' + (data.user.name || data.user.email) + ' !');
    } catch (err) {
        errEl.textContent = 'Erreur réseau, réessayez'; errEl.style.display = 'block';
    } finally {
        btn.textContent = 'Se connecter'; btn.disabled = false;
    }
}

/** Inscrit un nouvel utilisateur via POST /auth/register */
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
        const res  = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
        });
        const data = await res.json();
        if (!res.ok) { errEl.textContent = data.error || 'Erreur lors de l\'inscription'; errEl.style.display = 'block'; return; }
        saveAuth(data.token, data.user);
        showPage('dashboard');
        showToast('🎉 Compte créé, bienvenue !');
    } catch (err) {
        errEl.textContent = 'Erreur réseau, réessayez'; errEl.style.display = 'block';
    } finally {
        btn.textContent = 'Créer mon compte →'; btn.disabled = false;
    }
}


// ============================================================
// 4. FETCH AUTHENTIFIÉ
//    Wrapper autour de fetch() qui injecte automatiquement
//    le token JWT dans le header Authorization.
// ============================================================

/**
 * Effectue une requête HTTP avec le token JWT en header.
 * Utilisé pour tous les appels API protégés.
 *
 * @param {string} url     - URL de l'endpoint
 * @param {object} options - Options fetch (method, body, etc.)
 */
async function authFetch(url, options = {}) {
    const token = getToken();
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        },
    });
}


// ============================================================
// 5. HERO TIMER — Timer animé sur la page d'accueil
//    Timer fictif à des fins de démonstration visuelle.
//    Se met à jour chaque seconde via setInterval.
// ============================================================

/** Date cible fictive du timer hero (J+4h18m33) */
const heroTarget = new Date(Date.now() + 4 * 86400000 + 18 * 3600000 + 33 * 60000);

/** Met à jour les chiffres du timer hero */
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
// 6. PREVIEW TIMER — Timer CSS en temps réel sur la page create
//    Variables d'état partagées avec les fonctions d'apparence.
//    Se synchronise avec la date choisie dans le formulaire.
// ============================================================

let previewTarget  = new Date(Date.now() + 4 * 86400000 + 18 * 3600000 + 33 * 60000);
let currentColor   = '#2563eb'; // Couleur texte/blocs active
let currentBg      = '#ffffff'; // Couleur de fond active
let currentFont    = 'monospace'; // Police active
let currentStyle   = 'rounded'; // Style de template actif
let currentFontSize = 36;       // Taille de police active
let activeCodeTab  = 'minimal'; // Onglet code actif
let currentGifUrl  = '';        // URL du GIF publié

// Pré-remplit la date avec J+7 au chargement de la page
setTimeout(() => {
    const el = document.getElementById('cd-date');
    if (el) el.value = new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16);
}, 0);

/**
 * Synchronise previewTarget avec la date saisie dans le formulaire.
 * Met aussi à jour les labels de la preview si le plan le permet.
 */
function updatePreview() {
    const el = document.getElementById('cd-date');
    if (el && el.value) previewTarget = new Date(el.value);

    // Sync labels personnalisés (Pro uniquement)
    const plan = getUser()?.plan || 'FREE';
    if (plan !== 'FREE') {
        const days  = document.getElementById('cd-label-days');
        const hours = document.getElementById('cd-label-hours');
        const mins  = document.getElementById('cd-label-minutes');
        const secs  = document.getElementById('cd-label-seconds');
        if(days)  document.getElementById('prev-label-days').textContent  = days.value  || 'JOURS';
        if(hours) document.getElementById('prev-label-hours').textContent = hours.value || 'HEURES';
        if(mins)  document.getElementById('prev-label-mins').textContent  = mins.value  || 'MIN';
        if(secs)  document.getElementById('prev-label-secs').textContent  = secs.value  || 'SEC';
    }
}

/** Met à jour les chiffres du timer preview chaque seconde */
function updatePreviewTimer() {
    const diff = previewTarget - Date.now();
    const pad  = n => String(n).padStart(2, '0');
    const vals = diff > 0
        ? [Math.floor(diff/86400000), Math.floor((diff%86400000)/3600000), Math.floor((diff%3600000)/60000), Math.floor((diff%60000)/1000)]
        : [0, 0, 0, 0];
    ['days','hours','mins','secs'].forEach((k, i) => {
        const el = document.getElementById('prev-' + k);
        if(el) el.textContent = pad(vals[i]);
    });
}
setInterval(updatePreviewTimer, 1000);


// ============================================================
// 7. APPARENCE — Couleur, police, style de template, taille
//    Chaque sélection met à jour la variable d'état globale
//    et applique le changement visuellement dans la preview.
// ============================================================

/** Sélectionne une couleur principale et rafraîchit la preview */
function pickColor(el) {
    document.querySelectorAll('#color-picker .swatch').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    currentColor = el.dataset.color;
    applyPreviewColors();
}

/** Sélectionne une couleur de fond et rafraîchit la preview */
function pickBg(el) {
    document.querySelectorAll('#bg-picker .swatch').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    currentBg = el.dataset.color;
    const box = document.getElementById('gif-preview-box');
    if(box) box.style.background = currentBg;
    applyPreviewColors();
}

/** Sélectionne une police et l'applique dans la preview */
function pickFont(el) {
    document.querySelectorAll('#font-picker .font-opt').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    currentFont = el.dataset.font;
    document.querySelectorAll('.gif-num').forEach(e => e.style.fontFamily = currentFont);
}

/** Sélectionne un style de template (rounded / flat / bordered) */
function pickStyle(el) {
    document.querySelectorAll('#style-picker .style-opt').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    currentStyle = el.dataset.style;
    applyPreviewStyle();
}

/** Met à jour la taille de police depuis le slider */
function updateFontSize(val) {
    currentFontSize = parseInt(val);
    document.getElementById('font-size-display').textContent = val + 'px';
    document.querySelectorAll('.gif-num').forEach(e => e.style.fontSize = val + 'px');
}

/**
 * Applique le style visuel des blocs selon currentStyle :
 * - flat     : angles droits, sans bordure
 * - bordered : bordure pleine, fond transparent
 * - rounded  : coins arrondis avec fond teinté (défaut)
 */
function applyPreviewStyle() {
    document.querySelectorAll('.gif-num').forEach(el => {
        if(currentStyle === 'flat') {
            el.style.borderRadius = '0';
            el.style.border       = 'none';
        } else if(currentStyle === 'bordered') {
            el.style.borderRadius = '4px';
            el.style.border       = `2px solid ${currentColor}`;
            el.style.background   = 'transparent';
        } else {
            el.style.borderRadius = '10px';
        }
    });
}

/**
 * Applique la couleur principale sur les blocs et les séparateurs.
 * Calcule une teinte de fond à 10% d'opacité à partir de la couleur.
 */
function applyPreviewColors() {
    const hex = currentColor.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    document.querySelectorAll('.gif-num').forEach(el => {
        el.style.color = currentColor;
        if(currentStyle !== 'bordered') {
            el.style.background   = `rgba(${r},${g},${b},0.1)`;
            el.style.borderColor  = `rgba(${r},${g},${b},0.25)`;
        }
    });
    document.querySelectorAll('.gif-sep').forEach(el => el.style.color = currentColor);
}


// ============================================================
// 8. POST-EXPIRATION UI
//    Affiche ou masque les champs supplémentaires selon le
//    comportement sélectionné après expiration du countdown.
// ============================================================

/**
 * Affiche/masque les champs texte et redirect selon le select.
 * Appelé au changement du select et à l'ouverture de la page create.
 */
function updateExpiredUI() {
    const val         = document.getElementById('cd-expired')?.value;
    const textRow     = document.getElementById('expired-text-row');
    const redirectRow = document.getElementById('expired-redirect-row');
    if(textRow)     textRow.style.display     = val === 'SHOW_TEXT' ? 'block' : 'none';
    if(redirectRow) redirectRow.style.display = val === 'REDIRECT'  ? 'block' : 'none';
}


// ============================================================
// 9. PLAN GATES — Verrouillage des options selon le plan
//    Les options Pro sont masquées par un overlay semi-transparent
//    qui redirige vers la page tarifs au clic.
//    Appelé à chaque ouverture de la page create.
// ============================================================

/**
 * Active ou désactive les overlays de verrouillage selon le plan.
 * Plan FREE  → labels et redirect verrouillés
 * Plan PRO+  → toutes les options accessibles
 */
function applyPlanGates() {
    const plan          = getUser()?.plan || 'FREE';
    const overlayLabels = document.getElementById('overlay-labels');
    const overlayRedirect = document.getElementById('overlay-redirect');
    const optRedirect   = document.getElementById('opt-redirect');

    if(plan === 'FREE') {
        if(overlayLabels)   overlayLabels.style.display   = 'flex';
        if(overlayRedirect) overlayRedirect.style.display = 'flex';
        if(optRedirect)     optRedirect.disabled = true;
    } else {
        if(overlayLabels)   overlayLabels.style.display   = 'none';
        if(overlayRedirect) overlayRedirect.style.display = 'none';
        if(optRedirect)     optRedirect.disabled = false;
    }
}


// ============================================================
// 10. PUBLICATION — Envoi du countdown à l'API
//     Collecte tous les champs du formulaire, envoie via POST /countdown,
//     puis affiche le code à intégrer si succès.
// ============================================================

/**
 * Publie le countdown en base de données et génère le GIF.
 * Respecte les restrictions de plan côté backend.
 * Affiche le code HTML à intégrer en cas de succès.
 */
async function publishCountdown() {
    const btn = document.getElementById('publish-btn');

    // Collecte des valeurs du formulaire
    const name            = document.getElementById('cd-name')?.value || 'Mon countdown';
    const endDate         = document.getElementById('cd-date')?.value;
    const width           = document.getElementById('cd-width')?.value || 400;
    const timezone        = document.getElementById('cd-timezone')?.value || 'Europe/Paris';
    const expiredBehavior = document.getElementById('cd-expired')?.value || 'SHOW_ZEROS';
    const expiredText     = document.getElementById('cd-expired-text')?.value || 'Offre terminée';
    const expiredRedirect = document.getElementById('cd-expired-redirect')?.value || null;
    const labelDays       = document.getElementById('cd-label-days')?.value || 'JOURS';
    const labelHours      = document.getElementById('cd-label-hours')?.value || 'HEURES';
    const labelMinutes    = document.getElementById('cd-label-minutes')?.value || 'MIN';
    const labelSeconds    = document.getElementById('cd-label-seconds')?.value || 'SEC';

    if (!endDate) { showToast('⚠️ Veuillez choisir une date'); return; }

    btn.textContent = '⏳ Génération...'; btn.disabled = true;
    try {
        const res = await authFetch('/countdown', {
            method: 'POST',
            body: JSON.stringify({
                name, endDate, timezone,
                bgColor:    currentBg,
                textColor:  currentColor,
                fontSize:   currentFontSize,
                width:      parseInt(width),
                fontFamily: currentFont,
                style:      currentStyle,
                labelDays, labelHours, labelMinutes, labelSeconds,
                expiredBehavior, expiredText,
                expiredRedirect: expiredRedirect || undefined,
            })
        });
        const data = await res.json();
        if (!res.ok) { showToast('❌ ' + (data.message || data.error || 'Erreur')); return; }
        currentGifUrl = data.gifUrl;
        displayCode(data.gifUrl);
        showToast('🚀 Countdown publié !');
    } catch(err) {
        showToast('❌ Erreur réseau');
    } finally {
        btn.textContent = '✓ Publier & obtenir le code'; btn.disabled = false;
    }
}


// ============================================================
// 11. CODE SNIPPETS — Génération et copie des snippets HTML
//     4 onglets : Minimal, Standard, Klaviyo, Mailchimp
//     Les snippets Klaviyo/Mailchimp intègrent les merge tags
//     natifs de chaque ESP pour personnaliser l'alt text.
// ============================================================

/**
 * Génère les 4 snippets HTML et les affiche dans la section code.
 * @param {string} gifUrl - URL publique du GIF généré
 */
function displayCode(gifUrl) {
    const section    = document.getElementById('code-section');
    const urlDisplay = document.getElementById('gif-url-display');
    if(section)    section.style.display = 'block';
    if(urlDisplay) urlDisplay.textContent = gifUrl;

    const w = document.getElementById('cd-width')?.value || 400;

    // Stockage global pour la fonction de copie
    window._codeSnippets = {
        // Snippet minimal — usage basique
        minimal:   `<img src="${gifUrl}" alt="Offre expire dans..." width="${w}" border="0" style="display:block" />`,
        // Snippet standard — bonnes pratiques email
        standard:  `<img src="${gifUrl}" border="0" style="display:block;max-width:100%" alt="Timer — chrono.mail" title="Timer — chrono.mail" width="${w}" />`,
        // Snippet Klaviyo — avec merge tag prénom Klaviyo
        klaviyo:   `<img src="${gifUrl}" border="0" style="display:block;max-width:100%" alt="{% if first_name %}{{ first_name }}, votre offre expire dans...{% else %}Offre expire dans...{% endif %}" width="${w}" />`,
        // Snippet Mailchimp — avec merge tag prénom Mailchimp
        mailchimp: `<img src="${gifUrl}" border="0" style="display:block;max-width:100%" alt="*|FNAME|*, votre offre expire dans..." width="${w}" />`,
    };

    document.getElementById('code-minimal-content').textContent   = window._codeSnippets.minimal;
    document.getElementById('code-standard-content').textContent  = window._codeSnippets.standard;
    document.getElementById('code-klaviyo-content').textContent   = window._codeSnippets.klaviyo;
    document.getElementById('code-mailchimp-content').textContent = window._codeSnippets.mailchimp;
}

/** Bascule entre les onglets de code (minimal / standard / klaviyo / mailchimp) */
function switchCodeTab(name, btn) {
    activeCodeTab = name;
    document.querySelectorAll('.code-tab-btn').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.code-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('code-' + name).classList.add('active');
}

/** Copie le snippet de l'onglet actif dans le presse-papiers */
function copyCurrentCode() {
    const s = window._codeSnippets;
    if(!s) { showToast('⚠️ Publiez d\'abord le countdown'); return; }
    navigator.clipboard.writeText(s[activeCodeTab]).then(() => showToast('📋 Code HTML copié !'));
}

/** Copie l'URL du GIF dans le presse-papiers */
function copyUrl() {
    if(!currentGifUrl) { showToast('⚠️ Publiez d\'abord le countdown'); return; }
    navigator.clipboard.writeText(currentGifUrl).then(() => showToast('🔗 URL copiée !'));
}


// ============================================================
// 12. DASHBOARD — Chargement et rendu des countdowns
//     Récupère les countdowns de l'utilisateur via GET /countdowns,
//     met à jour le quota, les stats et affiche les cartes.
// ============================================================

/** Charge et affiche tous les countdowns de l'utilisateur connecté */
async function loadDashboard() {
    const grid = document.getElementById('cards-grid');
    if(!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">Chargement...</div>';

    try {
        const res = await authFetch('/countdowns');
        if(res.status === 401) { logout(); return; } // Token expiré

        const data    = await res.json();
        const user    = getUser();
        const plan    = user?.plan || 'FREE';
        const total   = data.length;
        const active  = data.filter(c => new Date(c.endDate) > new Date()).length;
        const expired = data.filter(c => new Date(c.endDate) <= new Date()).length;

        // Calcul du quota (uniquement pertinent pour le plan Free)
        const maxCountdowns = plan === 'FREE' ? 3 : '∞';
        const pct = plan === 'FREE' ? Math.min(100, Math.round((total / 3) * 100)) : 0;

        // Mise à jour des éléments de la sidebar
        const fill       = document.getElementById('quota-fill');
        const text       = document.getElementById('quota-text');
        const sub        = document.getElementById('dash-subtitle');
        const chip       = document.getElementById('sidebar-plan-chip');
        const upgradeBtn = document.getElementById('upgrade-btn');

        if(fill) fill.style.width = pct + '%';
        if(text) text.textContent = `${total} / ${maxCountdowns} countdowns`;
        if(sub)  sub.textContent  = `${active} actif${active !== 1 ? 's' : ''} · ${expired} expiré${expired !== 1 ? 's' : ''}`;
        if(chip) { chip.textContent = plan; chip.className = 'plan-chip plan-chip-' + plan.toLowerCase(); }

        // Bouton d'action selon le plan
        if(upgradeBtn) {
            if(plan === 'FREE') {
                upgradeBtn.textContent = 'Passer à Pro ↗';
                upgradeBtn.onclick     = () => upgradePlan('pro_monthly');
                upgradeBtn.style.display = 'block';
            } else if(plan === 'PRO') {
                upgradeBtn.textContent = 'Gérer mon abonnement';
                upgradeBtn.onclick     = openBillingPortal;
                upgradeBtn.style.display = 'block';
            } else {
                upgradeBtn.style.display = 'none'; // Business : pas de bouton
            }
        }

        // Rendu des cartes
        grid.innerHTML = '';
        data.forEach(cd => grid.appendChild(buildCard(cd)));

        // Carte "Nouveau countdown"
        if(plan === 'FREE' && total < 3) {
            const add = document.createElement('div');
            add.className = 'cd-card cd-card-add';
            add.onclick   = () => showPage('create');
            add.innerHTML = `
        <div class="cd-card-add-icon">+</div>
        <div style="font-size:14px;font-weight:600">Nouveau countdown</div>
        <div style="font-size:12.5px">${3 - total} emplacement${3 - total > 1 ? 's' : ''} restant${3 - total > 1 ? 's' : ''}</div>`;
            grid.appendChild(add);
        } else if(plan !== 'FREE') {
            const add = document.createElement('div');
            add.className = 'cd-card cd-card-add';
            add.onclick   = () => showPage('create');
            add.innerHTML = `<div class="cd-card-add-icon">+</div><div style="font-size:14px;font-weight:600">Nouveau countdown</div>`;
            grid.appendChild(add);
        }

    } catch(err) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--red)">Erreur de chargement</div>';
    }
}

/**
 * Construit et retourne une carte DOM pour un countdown.
 * @param {object} cd - Objet countdown depuis l'API
 * @returns {HTMLElement}
 */
function buildCard(cd) {
    const isActive = new Date(cd.endDate) > new Date();
    const diff     = new Date(cd.endDate) - new Date();
    const pad      = n => String(n).padStart(2, '0');
    const days     = pad(Math.max(0, Math.floor(diff / 86400000)));
    const hours    = pad(Math.max(0, Math.floor((diff % 86400000) / 3600000)));
    const mins     = pad(Math.max(0, Math.floor((diff % 3600000) / 60000)));
    const secs     = pad(Math.max(0, Math.floor((diff % 60000) / 1000)));
    const dateStr  = new Date(cd.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    const imps     = cd._count?.impressions ?? 0;

    const card = document.createElement('div');
    card.className = 'cd-card';
    if(!isActive) card.style.opacity = '0.65';
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
      <div class="cd-mini-unit" style="${!isActive ? 'color:var(--muted2)' : ''}">${days}</div><div class="cd-mini-sep">:</div>
      <div class="cd-mini-unit" style="${!isActive ? 'color:var(--muted2)' : ''}">${hours}</div><div class="cd-mini-sep">:</div>
      <div class="cd-mini-unit" style="${!isActive ? 'color:var(--muted2)' : ''}">${mins}</div><div class="cd-mini-sep">:</div>
      <div class="cd-mini-unit" style="${!isActive ? 'color:var(--muted2)' : ''}">${secs}</div>
    </div>
    <div class="cd-card-stats">
      <div class="cd-stat"><strong>${imps}</strong>impressions</div>
      <div class="cd-stat"><strong>${cd.width}px</strong>largeur</div>
      <div class="cd-stat"><strong><a href="/gif/${cd.id}" target="_blank" style="color:var(--accent);text-decoration:none">Voir GIF →</a></strong></div>
    </div>`;
    return card;
}


// ============================================================
// 13. PRICING — Page tarifs dynamique
//     Les prix, boutons et FAQ s'adaptent selon :
//     - L'état de connexion de l'utilisateur
//     - Son plan actuel (FREE / PRO / BUSINESS)
//     - La fréquence de facturation (mensuel / annuel)
// ============================================================

let billingYearly = false; // Toggle mensuel/annuel

/** Données de prix par plan et fréquence */
const PRICING_DATA = {
    free: {
        monthly: { price: '0€',     period: '/mois' },
        yearly:  { price: '0€',     period: '/mois' },
    },
    pro: {
        monthly: { price: '9€',     period: '/mois' },
        yearly:  { price: '6.58€',  period: '/mois (facturé 79€/an)' },
    },
    business: {
        monthly: { price: '29€',    period: '/mois' },
        yearly:  { price: '20.75€', period: '/mois (facturé 249€/an)' },
    },
};

/** Déclenche le rendu complet de la page tarifs */
function renderPricing() {
    const user = getUser();
    const plan = user?.plan || null;
    renderPricingCards(plan);
    renderFaq(plan);
}

/**
 * Met à jour les prix et les boutons selon le plan actuel et la fréquence.
 * Les boutons affichent "✓ Votre plan actuel" pour le plan en cours,
 * "Rétrograder" pour les plans inférieurs, et le CTA d'upgrade sinon.
 *
 * @param {string|null} plan - Plan actuel de l'utilisateur (null si non connecté)
 */
function renderPricingCards(plan) {
    const billing = billingYearly ? 'yearly' : 'monthly';

    // Mise à jour des prix
    ['pro', 'business'].forEach(p => {
        const priceEl  = document.getElementById(p + '-price');
        const periodEl = document.getElementById(p + '-period');
        if(priceEl)  priceEl.textContent  = PRICING_DATA[p][billing].price;
        if(periodEl) periodEl.textContent = PRICING_DATA[p][billing].period;
    });

    const freeCta     = document.getElementById('cta-free');
    const proCta      = document.getElementById('cta-pro');
    const businessCta = document.getElementById('cta-business');

    if(!plan) {
        // Utilisateur non connecté — tous les boutons mènent à l'inscription
        if(freeCta)     { freeCta.textContent = 'Commencer gratuitement'; freeCta.onclick = () => showPage('register'); freeCta.className = 'btn btn-ghost pricing-btn'; }
        if(proCta)      { proCta.textContent  = 'Commencer avec Pro →';   proCta.onclick  = () => showPage('register'); proCta.className  = 'btn btn-primary pricing-btn'; }
        if(businessCta) { businessCta.textContent = 'Commencer avec Business →'; businessCta.onclick = () => showPage('register'); businessCta.className = 'btn btn-ghost pricing-btn'; }

    } else if(plan === 'FREE') {
        if(freeCta)     { freeCta.textContent = '✓ Votre plan actuel'; freeCta.onclick = null; freeCta.className = 'btn btn-surface pricing-btn'; freeCta.style.cursor = 'default'; }
        if(proCta)      { proCta.textContent  = 'Passer à Pro →'; proCta.onclick = () => handlePricingCta('pro'); proCta.className = 'btn btn-primary pricing-btn'; }
        if(businessCta) { businessCta.textContent = 'Passer à Business →'; businessCta.onclick = () => handlePricingCta('business'); businessCta.className = 'btn btn-ghost pricing-btn'; }

    } else if(plan === 'PRO') {
        if(freeCta)     { freeCta.textContent = 'Rétrograder'; freeCta.onclick = openBillingPortal; freeCta.className = 'btn btn-ghost pricing-btn'; }
        if(proCta)      { proCta.textContent  = '✓ Votre plan actuel'; proCta.onclick = null; proCta.className = 'btn btn-surface pricing-btn'; proCta.style.cursor = 'default'; }
        if(businessCta) { businessCta.textContent = 'Passer à Business →'; businessCta.onclick = () => handlePricingCta('business'); businessCta.className = 'btn btn-ghost pricing-btn'; }

    } else if(plan === 'BUSINESS') {
        if(freeCta)     { freeCta.textContent = 'Rétrograder'; freeCta.onclick = openBillingPortal; freeCta.className = 'btn btn-ghost pricing-btn'; }
        if(proCta)      { proCta.textContent  = 'Rétrograder'; proCta.onclick  = openBillingPortal; proCta.className  = 'btn btn-ghost pricing-btn'; }
        if(businessCta) { businessCta.textContent = '✓ Votre plan actuel'; businessCta.onclick = null; businessCta.className = 'btn btn-surface pricing-btn'; businessCta.style.cursor = 'default'; }
    }
}

/** Bascule entre facturation mensuelle et annuelle */
function toggleBilling() {
    billingYearly = !billingYearly;
    const toggle = document.getElementById('billing-toggle');
    const labelM = document.getElementById('toggle-label-monthly');
    const labelY = document.getElementById('toggle-label-yearly');
    toggle.classList.toggle('active', billingYearly);
    labelM.style.fontWeight = billingYearly ? '400' : '700';
    labelM.style.color      = billingYearly ? 'var(--muted)' : 'var(--text)';
    labelY.style.fontWeight = billingYearly ? '700' : '400';
    labelY.style.color      = billingYearly ? 'var(--text)' : 'var(--muted)';
    renderPricingCards(getUser()?.plan || null);
}

/**
 * Gère le clic sur un bouton CTA de la page tarifs.
 * Redirige vers l'inscription si non connecté,
 * sinon lance le checkout Stripe avec la bonne clé de prix.
 *
 * @param {string} plan - 'pro' ou 'business'
 */
function handlePricingCta(plan) {
    if(!isLoggedIn()) { showPage('register'); return; }
    const key = billingYearly ? `${plan}_yearly` : `${plan}_monthly`;
    upgradePlan(key);
}


// ============================================================
// 14. FAQ — Questions fréquentes contextuelles
//     4 sets de FAQ selon le contexte :
//     - GUEST  : utilisateur non connecté
//     - FREE   : utilisateur Free connecté
//     - PRO    : abonné Pro
//     - BUSINESS : abonné Business
// ============================================================

const FAQ_GUEST = [
    { q: 'Puis-je essayer gratuitement ?',                         a: 'Oui — le plan Free vous permet de créer jusqu\'à 3 countdowns sans carte bancaire.' },
    { q: 'Les GIFs fonctionnent-ils dans tous les clients email ?', a: 'Gmail, Apple Mail, Yahoo, Outlook 2013+, iOS Mail et tous les grands ESP. Outlook 2007-2010 affiche la première frame statique.' },
    { q: 'Que se passe-t-il quand un countdown expire ?',          a: 'Par défaut, le GIF affiche 00:00:00:00. Vous pouvez configurer un texte personnalisé ou masquer l\'image.' },
    { q: 'Y a-t-il un engagement de durée ?',                      a: 'Non, tous les plans sont sans engagement. Vous pouvez annuler à tout moment depuis votre espace de facturation.' },
];

const FAQ_FREE = [
    { q: 'Comment passer au plan Pro ?',                  a: 'Cliquez sur "Passer à Pro" depuis votre dashboard ou depuis cette page. Le paiement est sécurisé via Stripe.' },
    { q: 'Mes countdowns actuels seront-ils conservés ?', a: 'Oui, tous vos countdowns existants sont conservés lors d\'un changement de plan.' },
    { q: 'Les GIFs fonctionnent-ils dans tous les clients email ?', a: 'Gmail, Apple Mail, Yahoo, Outlook 2013+, iOS Mail et tous les grands ESP. Outlook 2007-2010 affiche la première frame statique.' },
    { q: 'Y a-t-il un engagement de durée ?',             a: 'Non, vous pouvez annuler à tout moment. Le remboursement est au prorata si vous annulez en cours de mois.' },
];

const FAQ_PRO = [
    { q: 'Comment gérer ma facturation ?',    a: 'Cliquez sur "Gérer mon abonnement" pour accéder au portail Stripe — vous y trouverez vos factures et pouvez modifier votre moyen de paiement.' },
    { q: 'Comment passer au plan Business ?', a: 'Cliquez sur "Passer à Business" ci-dessus. Le changement est immédiat et le montant est ajusté au prorata.' },
    { q: 'Comment annuler mon abonnement ?',  a: 'Depuis le portail de facturation Stripe, cliquez sur "Annuler l\'abonnement". Vous conservez l\'accès Pro jusqu\'à la fin de la période payée.' },
    { q: 'Que se passe-t-il à l\'expiration d\'un countdown ?', a: 'Vous pouvez configurer un texte personnalisé, masquer l\'image ou rediriger vers une URL.' },
];

const FAQ_BUSINESS = [
    { q: 'Comment gérer ma facturation ?',          a: 'Accédez au portail Stripe via "Gérer mon abonnement" pour consulter vos factures et gérer votre moyen de paiement.' },
    { q: 'Comment accéder à l\'API ?',              a: 'La documentation de l\'API est disponible dans votre dashboard sous "Paramètres → API". Votre clé API est générée automatiquement.' },
    { q: 'Comment ajouter des membres à mon équipe ?', a: 'Depuis "Paramètres → Équipe", invitez vos collaborateurs par email. Chaque membre dispose de ses propres accès.' },
    { q: 'Puis-je obtenir une facturation entreprise ?', a: 'Oui — contactez-nous à billing@chrono.mail pour recevoir des factures avec numéro de TVA et coordonnées entreprise.' },
];

/**
 * Retourne le set de FAQ approprié selon le plan.
 * @param {string|null} plan - Plan de l'utilisateur
 */
function getFaqByPlan(plan) {
    if (!isLoggedIn()) return FAQ_GUEST;
    if (plan === 'PRO')      return FAQ_PRO;
    if (plan === 'BUSINESS') return FAQ_BUSINESS;
    return FAQ_FREE;
}

/**
 * Génère et injecte le HTML des FAQ dans le conteneur #faq-grid.
 * @param {string|null} plan - Plan de l'utilisateur
 */
function renderFaq(plan) {
    const container = document.getElementById('faq-grid');
    if(!container) return;
    const faqs = getFaqByPlan(plan);
    container.innerHTML = faqs.map(f => `
    <div class="faq-item">
      <div class="faq-q">${f.q}</div>
      <div class="faq-a">${f.a}</div>
    </div>
  `).join('');
}


// ============================================================
// 15. STRIPE — Checkout, portail de facturation, retours
//     upgradePlan() crée une session Checkout Stripe et redirige.
//     openBillingPortal() ouvre le portail client Stripe.
// ============================================================

/**
 * Lance le flow de paiement Stripe Checkout pour un plan donné.
 * @param {string} priceKey - Clé du prix (ex: 'pro_monthly', 'business_yearly')
 */
async function upgradePlan(priceKey) {
    try {
        showToast('⏳ Redirection vers le paiement...');
        const res  = await authFetch('/stripe/checkout', {
            method: 'POST',
            body: JSON.stringify({ priceKey })
        });
        const data = await res.json();
        if(data.url) window.location.href = data.url;
        else showToast('❌ ' + (data.error || 'Erreur'));
    } catch(err) { showToast('❌ Erreur réseau'); }
}

/**
 * Ouvre le portail de facturation Stripe (gestion abonnement, factures,
 * moyen de paiement, annulation).
 */
async function openBillingPortal() {
    try {
        const res  = await authFetch('/stripe/portal', { method: 'POST' });
        const data = await res.json();
        if(data.url) window.location.href = data.url;
        else showToast('❌ ' + (data.error || 'Erreur'));
    } catch(err) { showToast('❌ Erreur réseau'); }
}


// ============================================================
// 16. CALLBACKS URL — Google OAuth et retour Stripe
//     Exécutés immédiatement au chargement de la page.
//     Lisent les query params de l'URL pour détecter les retours.
// ============================================================

/**
 * Gère le retour depuis Stripe Checkout.
 * ?checkout=success → toast succès + redirect dashboard
 * ?checkout=cancelled → toast annulation
 */
(function handleCheckoutReturn() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('checkout');
    if(status === 'success') {
        window.history.replaceState({}, document.title, '/');
        showToast('🎉 Abonnement activé !');
        if(isLoggedIn()) showPage('dashboard');
    } else if(status === 'cancelled') {
        window.history.replaceState({}, document.title, '/');
        showToast('Paiement annulé');
    }
})();

/**
 * Gère le retour depuis Google OAuth.
 * Le backend redirige vers /?token=...&user=... après authentification.
 * Ce handler récupère ces params, les persiste et redirige vers le dashboard.
 */
(function handleGoogleCallback() {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token');
    const user   = params.get('user');
    if(token && user) {
        try {
            saveAuth(token, JSON.parse(decodeURIComponent(user)));
            window.history.replaceState({}, document.title, '/');
            showPage('dashboard');
            showToast('🎉 Connecté avec Google !');
        } catch(e) { console.error('Erreur parsing user Google', e); }
    }
})();


// ============================================================
// 17. TOAST — Notifications temporaires
//     Affiche un message pendant 3 secondes en bas de l'écran.
// ============================================================

/**
 * Affiche un toast de notification.
 * @param {string} msg - Message à afficher (supporte les emojis)
 */
function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}


// ============================================================
// 18. INIT — Initialisation au chargement de la page
//     Met à jour la navbar selon l'état de connexion actuel.
// ============================================================
updateNavAuth();