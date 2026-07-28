/**
 * email-service.js — Emails transactionnels Chronomail
 * ============================================================
 * Provider : Resend (https://resend.com)
 * Env var  : RESEND_API_KEY
 * From     : MAIL_FROM (default: "Chronomail <noreply@chrono-mail.app>")
 */
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const FROM = process.env.MAIL_FROM || 'Chronomail <noreply@chrono-mail.app>';
const APP  = process.env.APP_URL   || 'http://localhost:3000';

// ── Helper : base HTML layout ────────────────────────────────────
// opts.unsubscribeUrl : ajoute le lien de désinscription. Obligatoire
// pour les emails marketing (relances de rétention), à omettre pour les
// transactionnels — un utilisateur ne peut pas se désabonner d'un reçu.
function layout(content, opts = {}) {
    const unsubscribe = opts.unsubscribeUrl
        ? `<br><a href="${opts.unsubscribeUrl}" style="color:#8a877f;text-decoration:underline">Ne plus recevoir ces relances</a>`
        : '';
    return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7f4;padding:40px 20px">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e0db;overflow:hidden">
    <!-- Header -->
    <tr><td style="background:linear-gradient(135deg,#1d4ed8,#3b82f6);padding:28px 32px;text-align:center">
        <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.5px">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#fff;margin-right:6px;vertical-align:middle"></span>chrono<span style="font-weight:400;opacity:0.6">mail</span>
        </span>
    </td></tr>
    <!-- Body -->
    <tr><td style="padding:32px 32px 24px">${content}</td></tr>
    <!-- Footer -->
    <tr><td style="padding:16px 32px 28px;border-top:1px solid #e2e0db;text-align:center">
        <p style="margin:0;font-size:12px;color:#8a877f;line-height:1.6">
            Chronomail — Des countdowns GIF pour vos emails marketing.<br>
            <a href="${APP}" style="color:#2563eb;text-decoration:none">Chronomail</a> ·
            <a href="${APP}/#legal-privacy" style="color:#8a877f;text-decoration:none">Confidentialité</a> ·
            <a href="${APP}/#legal-cgu" style="color:#8a877f;text-decoration:none">CGU</a>${unsubscribe}
        </p>
    </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// ── Helper : bouton CTA ──────────────────────────────────────────
function btn(text, url) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0">
<tr><td style="background:#2563eb;border-radius:10px;padding:12px 28px;text-align:center">
<a href="${url}" style="color:#fff;text-decoration:none;font-size:15px;font-weight:600;display:inline-block">${text}</a>
</td></tr></table>`;
}

// ── Helper : salutation ──────────────────────────────────────────
// Pas de repli sur le préfixe de l'adresse : « Bonjour xavier.dupont+test2 »
// ou « Bonjour contact » se lisent plus mal qu'une salutation sans nom.
// Un nom vide ou fait d'espaces est traité comme absent.
function prenom(name) {
    return (name || '').trim() || null;
}
function bonjour(name) {
    const p = prenom(name);
    return p ? `Bonjour ${p}` : 'Bonjour';
}

// ── Envoi sécurisé (non bloquant, log en cas d'erreur) ───────────
async function send(to, subject, html) {
    if (!resend) {
        console.warn(`📧 [EMAIL SKIP] RESEND_API_KEY non configurée — "${subject}" pour ${to}`);
        return null;
    }
    try {
        const result = await resend.emails.send({ from: FROM, to, subject, html });
        console.log(`📧 [EMAIL OK] "${subject}" → ${to}`);
        return result;
    } catch (err) {
        console.error(`📧 [EMAIL ERR] "${subject}" → ${to} :`, err.message, err.statusCode || '', JSON.stringify(err.body || err.response || ''));
        return null;
    }
}


// ================================================================
//  TEMPLATES
// ================================================================

/**
 * 0. Vérification email — après inscription
 */
function buildVerifyEmailHtml(name, email, verifyUrl) {
    const salut = bonjour(name);
    return layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Vérifiez votre email
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            ${salut}, cliquez sur le bouton ci-dessous pour confirmer votre adresse email et activer votre compte Chronomail.
        </p>
        ${btn('Vérifier mon email →', verifyUrl)}
        <p style="margin:0;font-size:13px;color:#8a877f;line-height:1.7">
            Si vous n'avez pas créé de compte, ignorez simplement cet email.
        </p>
    `);
}
async function sendVerifyEmail(email, name, token) {
    const verifyUrl = `${APP}/auth/verify-email?token=${token}`;
    return send(email, 'Confirmez votre adresse email — Chronomail', buildVerifyEmailHtml(name, email, verifyUrl));
}

/**
 * 0b. Réinitialisation mot de passe
 */
function buildResetPasswordHtml(name, email, resetUrl) {
    const salut = bonjour(name);
    return layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Réinitialiser votre mot de passe
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            ${salut}, vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
        </p>
        ${btn('Réinitialiser mon mot de passe →', resetUrl)}
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px;margin:16px 0">
            <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.6">
                Ce lien expire dans <strong>1 heure</strong>. Si vous n'avez pas fait cette demande, ignorez cet email.
            </p>
        </div>
    `);
}
async function sendResetPassword(email, name, token) {
    const resetUrl = `${APP}/#reset-password?token=${token}`;
    return send(email, 'Réinitialisation de mot de passe — Chronomail', buildResetPasswordHtml(name, email, resetUrl));
}

/**
 * 1. Bienvenue — après inscription
 */
function buildWelcomeHtml(name, email) {
    const p = prenom(name);
    return layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Bienvenue${p ? `, ${p}` : ''} !
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            Votre compte Chronomail est prêt. Vous pouvez dès maintenant créer votre premier countdown GIF et l'intégrer dans vos emails marketing.
        </p>
        <p style="margin:0 0 4px;font-size:14px;color:#8a877f">Votre plan actuel : <strong style="color:#1a1916">Free</strong> (3 countdowns)</p>
        ${btn('Créer mon premier countdown →', APP + '/#create')}
        <p style="margin:0;font-size:14px;color:#8a877f;line-height:1.7">
            <strong>En 30 secondes :</strong> choisissez une date, un style, et copiez le tag HTML. C'est tout.
        </p>
    `);
}
async function sendWelcome(email, name) {
    return send(email, 'Bienvenue sur Chronomail !', buildWelcomeHtml(name, email));
}

/**
 * 1a. Relance d'activation — compte créé mais aucun countdown après 48h
 */
function buildActivationNudgeHtml(name, email) {
    const salut = bonjour(name);
    return layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Votre premier countdown vous attend
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            ${salut}, votre compte Chronomail est prêt mais aucun countdown n'a encore été créé. Il n'y a que trois choses à choisir.
        </p>
        <div style="background:#f3f2ef;border:1px solid #e2e0db;border-radius:10px;padding:16px;margin:16px 0">
            <p style="margin:0;font-size:13px;color:#3d3b37;line-height:1.9">
                <strong>1.</strong> Une date de fin<br>
                <strong>2.</strong> Un style parmi ceux disponibles<br>
                <strong>3.</strong> Copier le tag HTML dans votre email
            </p>
        </div>
        ${btn('Créer mon premier countdown →', APP + '/#create')}
        <p style="margin:0;font-size:13px;color:#8a877f;line-height:1.7">
            Le GIF se met à jour tout seul à chaque ouverture de votre email, sans rien à réinstaller.
        </p>
    `);
}
async function sendActivationNudge(email, name) {
    return send(email, 'Votre premier countdown vous attend', buildActivationNudgeHtml(name, email));
}

/**
 * 1b. Quota Free atteint — au refus de création d'un 4e countdown
 */
function buildQuotaReachedHtml(name, email) {
    const salut = bonjour(name);
    return layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Vous avez atteint la limite du plan Free
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            ${salut}, vos <strong>3 countdowns</strong> sont utilisés. Bonne nouvelle : c'est le signe que vos campagnes tournent.
        </p>
        <div style="background:#eff4ff;border:1px solid rgba(37,99,235,0.15);border-radius:10px;padding:16px;margin:16px 0">
            <p style="margin:0;font-size:13px;color:#1d4ed8;font-weight:600">En passant à Pro :</p>
            <p style="margin:6px 0 0;font-size:13px;color:#3d3b37;line-height:1.7">
                Countdowns illimités, 10 styles, image de fond, analytics avancées
            </p>
        </div>
        ${btn('Voir les offres →', APP + '/#pricing')}
        <p style="margin:0;font-size:13px;color:#8a877f;line-height:1.7">
            Vos countdowns actuels restent actifs. Vous pouvez aussi en supprimer un pour libérer une place.
        </p>
    `);
}
async function sendQuotaReached(email, name) {
    return send(email, 'Vous avez atteint la limite du plan Free', buildQuotaReachedHtml(name, email));
}

/**
 * 2. Upgrade confirmé — après checkout.session.completed
 */
function buildUpgradeHtml(name, email, plan) {
    const p = prenom(name);
    const planLabel = plan === 'BUSINESS' ? 'Business' : 'Pro';
    const features = plan === 'BUSINESS'
        ? 'Countdowns illimités, 11 styles, timer perpétuel, analytics, support dédié'
        : 'Countdowns illimités, 10 styles, image de fond, analytics avancées';
    return layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Merci${p ? `, ${p}` : ''} !
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            Votre abonnement <strong style="color:#2563eb">${planLabel}</strong> est maintenant actif. Vous avez accès à toutes les fonctionnalités incluses.
        </p>
        <div style="background:#eff4ff;border:1px solid rgba(37,99,235,0.15);border-radius:10px;padding:16px;margin:16px 0">
            <p style="margin:0;font-size:13px;color:#1d4ed8;font-weight:600">Inclus dans votre plan :</p>
            <p style="margin:6px 0 0;font-size:13px;color:#3d3b37;line-height:1.7">${features}</p>
        </div>
        ${btn('Accéder au dashboard →', APP + '/#dashboard')}
        <p style="margin:0;font-size:13px;color:#8a877f;line-height:1.7">
            Gérez votre abonnement et vos factures depuis le <a href="${APP}/#dashboard" style="color:#2563eb;text-decoration:none">portail de facturation</a>.
        </p>
    `);
}
async function sendUpgradeConfirmed(email, name, plan) {
    const planLabel = plan === 'BUSINESS' ? 'Business' : 'Pro';
    return send(email, `Votre plan ${planLabel} est activé !`, buildUpgradeHtml(name, email, plan));
}

/**
 * 3. Échec de paiement — après invoice.payment_failed
 */
function buildPaymentFailedHtml(name, email, attempt) {
    const salut = bonjour(name);
    const urgency = attempt >= 3
        ? '⚠️ C\'est la dernière tentative. Sans action de votre part, votre abonnement sera annulé.'
        : 'Pas de panique, Stripe réessaiera automatiquement dans quelques jours.';
    return layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Paiement échoué
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            ${salut}, nous n'avons pas pu traiter votre dernier paiement (tentative ${attempt}).
        </p>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px;margin:16px 0">
            <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.7">${urgency}</p>
        </div>
        ${btn('Mettre à jour mon moyen de paiement →', APP + '/#dashboard')}
        <p style="margin:0;font-size:13px;color:#8a877f;line-height:1.7">
            Besoin d'aide ? Contactez-nous à <a href="mailto:contact@chrono-mail.app" style="color:#2563eb;text-decoration:none">contact@chrono-mail.app</a>.
        </p>
    `);
}
async function sendPaymentFailed(email, name, attempt) {
    return send(email, 'Problème de paiement sur votre compte', buildPaymentFailedHtml(name, email, attempt));
}

/**
 * 3b. Annulation volontaire confirmée — cancel_at_period_end passé à true
 *     L'abonnement reste actif jusqu'à la fin de la période payée ;
 *     le downgrade effectif fera l'objet d'un second email.
 */
function buildCancellationHtml(name, email, periodEnd) {
    const salut = bonjour(name);
    const dateLabel = periodEnd
        ? new Date(periodEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;
    return layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Votre annulation est confirmée
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            ${salut}, votre abonnement ne sera pas renouvelé. ${
                dateLabel
                    ? `Vous gardez l'accès à toutes vos fonctionnalités jusqu'au <strong>${dateLabel}</strong>.`
                    : `Vous gardez l'accès à toutes vos fonctionnalités jusqu'à la fin de votre période en cours.`
            }
        </p>
        <div style="background:#f3f2ef;border:1px solid #e2e0db;border-radius:10px;padding:16px;margin:16px 0">
            <p style="margin:0;font-size:13px;color:#3d3b37;line-height:1.7">
                <strong>Ensuite :</strong> votre compte repassera au plan Free. Vous conserverez vos 3 countdowns les plus récents ; les autres seront désactivés, jamais supprimés.
            </p>
        </div>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            Vous avez changé d'avis ? Réactiver avant cette date annule la résiliation, sans nouveau paiement.
        </p>
        ${btn('Gérer mon abonnement →', APP + '/#dashboard')}
    `);
}
async function sendCancellationConfirmed(email, name, periodEnd) {
    return send(email, 'Votre annulation est confirmée', buildCancellationHtml(name, email, periodEnd));
}

/**
 * 4. Downgrade vers Free — après customer.subscription.deleted
 */
function buildDowngradedHtml(name, email) {
    const salut = bonjour(name);
    return layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Abonnement terminé
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            ${salut}, votre abonnement est arrivé à son terme. Votre compte est maintenant sur le plan <strong>Free</strong>.
        </p>
        <div style="background:#f3f2ef;border:1px solid #e2e0db;border-radius:10px;padding:16px;margin:16px 0">
            <p style="margin:0;font-size:13px;color:#3d3b37;line-height:1.7">
                <strong>Ce qui change :</strong> vous conservez vos 3 countdowns les plus récents. Les countdowns au-delà sont désactivés (non supprimés).
            </p>
        </div>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            Vos données restent en sécurité. Vous pouvez vous réabonner à tout moment pour retrouver toutes vos fonctionnalités.
        </p>
        ${btn('Voir les offres →', APP + '/#pricing')}
    `);
}
async function sendDowngraded(email, name) {
    return send(email, 'Votre abonnement a pris fin', buildDowngradedHtml(name, email));
}

/**
 * 5. Countdown expiré — quand un countdown atteint sa date de fin
 */
function buildCountdownExpiredHtml(name, email, countdownName) {
    const salut = bonjour(name);
    return layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Countdown expiré
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            ${salut}, votre countdown <strong>"${countdownName}"</strong> a atteint sa date de fin.
        </p>
        <div style="background:#f3f2ef;border:1px solid #e2e0db;border-radius:10px;padding:16px;margin:16px 0">
            <p style="margin:0;font-size:13px;color:#3d3b37;line-height:1.7">
                Le GIF affiche désormais le comportement d'expiration que vous avez configuré (zéros, texte personnalisé ou redirection).
            </p>
        </div>
        ${btn('Voir le countdown →', APP + '/#dashboard')}
        <p style="margin:0;font-size:13px;color:#8a877f;line-height:1.7">
            Vous pouvez modifier la date de fin ou créer un nouveau countdown depuis votre dashboard.
        </p>
    `);
}
async function sendCountdownExpired(email, name, countdownName, countdownId) {
    return send(email, `Votre countdown "${countdownName}" a expiré`, buildCountdownExpiredHtml(name, email, countdownName));
}


/**
 * 6. Win-back — compte silencieux depuis 14 jours
 *    ⚠️ Email marketing : lien de désinscription obligatoire.
 */
function buildWinbackHtml(name, email, unsubscribeUrl) {
    const salut = bonjour(name);
    return layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Vos countdowns vous attendent
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            ${salut}, on ne vous a pas vu depuis deux semaines. Vos countdowns et vos statistiques sont toujours là, exactement comme vous les avez laissés.
        </p>
        <div style="background:#f3f2ef;border:1px solid #e2e0db;border-radius:10px;padding:16px;margin:16px 0">
            <p style="margin:0;font-size:13px;color:#3d3b37;line-height:1.7">
                Une prochaine campagne en tête ? Dupliquer un countdown existant prend quelques secondes : la date change, le reste est déjà réglé.
            </p>
        </div>
        ${btn('Revenir au dashboard →', APP + '/#dashboard')}
    `, { unsubscribeUrl });
}
async function sendWinback(email, name, unsubscribeUrl) {
    return send(email, 'Vos countdowns vous attendent', buildWinbackHtml(name, email, unsubscribeUrl));
}

/**
 * 7. Offre de réactivation — toujours silencieux 30 jours après le win-back
 *    ⚠️ Email marketing : lien de désinscription obligatoire.
 */
function buildReactivationHtml(name, email, unsubscribeUrl) {
    const salut = bonjour(name);
    return layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            On vous garde une place
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            ${salut}, cela fait un mois. Si Chronomail n'a pas trouvé sa place dans vos campagnes, c'est utile à savoir — répondez à cet email, on lit tout.
        </p>
        <div style="background:#eff4ff;border:1px solid rgba(37,99,235,0.15);border-radius:10px;padding:16px;margin:16px 0">
            <p style="margin:0;font-size:13px;color:#3d3b37;line-height:1.7">
                Votre compte et vos countdowns restent intacts. Rien n'est supprimé, vous pouvez reprendre quand vous voulez.
            </p>
        </div>
        ${btn('Reprendre où j\'en étais →', APP + '/#dashboard')}
        <p style="margin:0;font-size:13px;color:#8a877f;line-height:1.7">
            C'est la dernière relance que nous vous envoyons.
        </p>
    `, { unsubscribeUrl });
}
async function sendReactivation(email, name, unsubscribeUrl) {
    return send(email, 'On vous garde une place', buildReactivationHtml(name, email, unsubscribeUrl));
}


// ── Previews HTML (pour la route /email-preview) ────────────────
const previews = {
    verify_email: () => buildVerifyEmailHtml('Sophie', 'sophie@exemple.fr', APP + '/auth/verify-email?token=demo_token_123'),
    reset_password: () => buildResetPasswordHtml('Sophie', 'sophie@exemple.fr', APP + '/#reset-password?token=demo_token_123'),
    welcome:     () => buildWelcomeHtml('Sophie', 'sophie@exemple.fr'),
    activation_nudge: () => buildActivationNudgeHtml('Sophie', 'sophie@exemple.fr'),
    quota_reached: () => buildQuotaReachedHtml('Sophie', 'sophie@exemple.fr'),
    upgrade_pro: () => buildUpgradeHtml('Sophie', 'sophie@exemple.fr', 'PRO'),
    upgrade_biz: () => buildUpgradeHtml('Sophie', 'sophie@exemple.fr', 'BUSINESS'),
    cancellation:      () => buildCancellationHtml('Sophie', 'sophie@exemple.fr', new Date(Date.now() + 18 * 86400000)),
    cancellation_nodate: () => buildCancellationHtml('Sophie', 'sophie@exemple.fr', null),
    payment_failed:    () => buildPaymentFailedHtml('Sophie', 'sophie@exemple.fr', 1),
    payment_failed_3:  () => buildPaymentFailedHtml('Sophie', 'sophie@exemple.fr', 3),
    downgraded:  () => buildDowngradedHtml('Sophie', 'sophie@exemple.fr'),
    expired:     () => buildCountdownExpiredHtml('Sophie', 'sophie@exemple.fr', 'Vente Flash — Été 2026'),
    winback:      () => buildWinbackHtml('Sophie', 'sophie@exemple.fr', APP + '/unsubscribe?token=demo_token_123'),
    reactivation: () => buildReactivationHtml('Sophie', 'sophie@exemple.fr', APP + '/unsubscribe?token=demo_token_123'),
};

module.exports = {
    sendVerifyEmail,
    sendResetPassword,
    sendWelcome,
    sendActivationNudge,
    sendQuotaReached,
    sendUpgradeConfirmed,
    sendPaymentFailed,
    sendCancellationConfirmed,
    sendDowngraded,
    sendCountdownExpired,
    sendWinback,
    sendReactivation,
    previews,
};
