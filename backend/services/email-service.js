/**
 * email-service.js — Emails transactionnels chrono.mail
 * ============================================================
 * Provider : Resend (https://resend.com)
 * Env var  : RESEND_API_KEY
 * From     : MAIL_FROM (default: "chrono.mail <noreply@chrono.mail>")
 */
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const FROM = process.env.MAIL_FROM || 'chrono.mail <noreply@chrono.mail>';
const APP  = process.env.APP_URL   || 'http://localhost:3000';

// ── Helper : base HTML layout ────────────────────────────────────
function layout(content) {
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
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#fff;margin-right:6px;vertical-align:middle"></span>chrono<span style="font-weight:400;opacity:0.6">.mail</span>
        </span>
    </td></tr>
    <!-- Body -->
    <tr><td style="padding:32px 32px 24px">${content}</td></tr>
    <!-- Footer -->
    <tr><td style="padding:16px 32px 28px;border-top:1px solid #e2e0db;text-align:center">
        <p style="margin:0;font-size:12px;color:#8a877f;line-height:1.6">
            chrono.mail — Des countdowns GIF pour vos emails marketing.<br>
            <a href="${APP}" style="color:#2563eb;text-decoration:none">chrono.mail</a> ·
            <a href="${APP}/#legal-privacy" style="color:#8a877f;text-decoration:none">Confidentialité</a> ·
            <a href="${APP}/#legal-cgu" style="color:#8a877f;text-decoration:none">CGU</a>
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
        console.error(`📧 [EMAIL ERR] "${subject}" → ${to} :`, err.message);
        return null;
    }
}


// ================================================================
//  TEMPLATES
// ================================================================

/**
 * 1. Bienvenue — après inscription
 */
async function sendWelcome(email, name) {
    const displayName = name || email.split('@')[0];
    return send(email, 'Bienvenue sur chrono.mail !', layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Bienvenue, ${displayName} !
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            Votre compte chrono.mail est prêt. Vous pouvez dès maintenant créer votre premier countdown GIF et l'intégrer dans vos emails marketing.
        </p>
        <p style="margin:0 0 4px;font-size:14px;color:#8a877f">Votre plan actuel : <strong style="color:#1a1916">Free</strong> (3 countdowns)</p>
        ${btn('Créer mon premier countdown →', APP + '/#create')}
        <p style="margin:0;font-size:14px;color:#8a877f;line-height:1.7">
            <strong>En 30 secondes :</strong> choisissez une date, un style, et copiez le tag HTML. C'est tout.
        </p>
    `));
}

/**
 * 2. Upgrade confirmé — après checkout.session.completed
 */
async function sendUpgradeConfirmed(email, name, plan) {
    const displayName = name || email.split('@')[0];
    const planLabel = plan === 'BUSINESS' ? 'Business' : 'Pro';
    const features = plan === 'BUSINESS'
        ? 'Countdowns illimités, 11 styles, timer perpétuel, analytics, support dédié'
        : 'Countdowns illimités, 10 styles, image de fond, analytics avancées';
    return send(email, `Votre plan ${planLabel} est activé !`, layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Merci, ${displayName} !
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
    `));
}

/**
 * 3. Échec de paiement — après invoice.payment_failed
 */
async function sendPaymentFailed(email, name, attempt) {
    const displayName = name || email.split('@')[0];
    const urgency = attempt >= 3
        ? '⚠️ C\'est la dernière tentative. Sans action de votre part, votre abonnement sera annulé.'
        : 'Pas de panique, Stripe réessaiera automatiquement dans quelques jours.';
    return send(email, 'Problème de paiement sur votre compte', layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Paiement échoué
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            Bonjour ${displayName}, nous n'avons pas pu traiter votre dernier paiement (tentative ${attempt}).
        </p>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px;margin:16px 0">
            <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.7">${urgency}</p>
        </div>
        ${btn('Mettre à jour mon moyen de paiement →', APP + '/#dashboard')}
        <p style="margin:0;font-size:13px;color:#8a877f;line-height:1.7">
            Besoin d'aide ? Contactez-nous à <a href="mailto:billing@chrono.mail" style="color:#2563eb;text-decoration:none">billing@chrono.mail</a>.
        </p>
    `));
}

/**
 * 4. Downgrade vers Free — après customer.subscription.deleted
 */
async function sendDowngraded(email, name) {
    const displayName = name || email.split('@')[0];
    return send(email, 'Votre abonnement a pris fin', layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Abonnement terminé
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            Bonjour ${displayName}, votre abonnement est arrivé à son terme. Votre compte est maintenant sur le plan <strong>Free</strong>.
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
    `));
}

/**
 * 5. Countdown expiré — quand un countdown atteint sa date de fin
 */
async function sendCountdownExpired(email, name, countdownName, countdownId) {
    const displayName = name || email.split('@')[0];
    return send(email, `Votre countdown "${countdownName}" a expiré`, layout(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1916;letter-spacing:-0.5px">
            Countdown expiré
        </h1>
        <p style="margin:0 0 16px;font-size:15px;color:#3d3b37;line-height:1.7">
            Bonjour ${displayName}, votre countdown <strong>"${countdownName}"</strong> a atteint sa date de fin.
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
    `));
}


module.exports = {
    sendWelcome,
    sendUpgradeConfirmed,
    sendPaymentFailed,
    sendDowngraded,
    sendCountdownExpired,
};
