/**
 * scheduler.js — Jobs planifiés Chronomail
 * ============================================================
 * Contrairement aux emails déclenchés par une route (bienvenue, quota,
 * countdown expiré), certains envois doivent partir *sans* action de
 * l'utilisateur : c'est le cas de la relance d'activation, qui vise
 * précisément les comptes qui ne reviennent pas.
 *
 * Le job tourne dans le process Express (Render garde un process
 * persistant, donc pas besoin d'un service externe).
 *
 * Idempotence : chaque envoi est « réservé » par un updateMany
 * conditionnel avant expédition. Deux exécutions concurrentes — deux
 * instances Render, ou un redémarrage pendant le job — ne peuvent pas
 * envoyer deux fois : une seule voit count === 1.
 *
 * Env :
 *   DISABLE_CRON=true      désactive tous les jobs
 *   CRON_TIMEZONE          défaut Europe/Paris
 *   CRON_ACTIVATION_NUDGE  expression cron, défaut tous les jours à 10h
 */
const cron   = require('node-cron');
const prisma = require('./prisma');
const { sendActivationNudge, sendWinback, sendReactivation } = require('../services/email-service');
const { unsubscribeUrlFor } = require('./retention');

const TIMEZONE           = process.env.CRON_TIMEZONE || 'Europe/Paris';
const ACTIVATION_CRON    = process.env.CRON_ACTIVATION_NUDGE || '0 10 * * *';
const WINBACK_CRON       = process.env.CRON_WINBACK || '15 10 * * *';
const REACTIVATION_CRON  = process.env.CRON_REACTIVATION || '30 10 * * *';
const ACTIVATION_DELAY_H = 48;
const WINBACK_DELAY_D      = 14;
const REACTIVATION_DELAY_D = 30;

/**
 * Filtre « inactif depuis N jours ».
 *
 * lastLoginAt est nul pour les comptes antérieurs à son introduction :
 * on retombe alors sur createdAt, sinon ces comptes seraient soit
 * ignorés à vie, soit relancés à tort dès le premier passage.
 */
function inactiveSince(days) {
    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
    return [
        { lastLoginAt: { lt: cutoff } },
        { AND: [{ lastLoginAt: null }, { createdAt: { lt: cutoff } }] },
    ];
}

/**
 * Relance les comptes créés il y a plus de 48h qui n'ont créé aucun
 * countdown. Les comptes non vérifiés sont exclus : leur adresse n'a
 * jamais été confirmée, leur écrire dégrade la délivrabilité.
 *
 * Le flag est posé AVANT l'envoi : en cas de panne du provider on perd
 * une relance plutôt que d'en envoyer deux (send() ne lève pas, il
 * logue et renvoie null — un échec n'est donc pas détectable ici).
 */
async function runActivationNudge() {
    const cutoff = new Date(Date.now() - ACTIVATION_DELAY_H * 3600 * 1000);

    const candidates = await prisma.user.findMany({
        where: {
            activationNudged: false,
            emailVerified:    true,
            createdAt:        { lt: cutoff },
            countdowns:       { none: {} },
        },
        select: { id: true, email: true, name: true },
    });

    let sent = 0;
    for (const user of candidates) {
        const claimed = await prisma.user.updateMany({
            where: { id: user.id, activationNudged: false },
            data:  { activationNudged: true },
        });
        if (claimed.count !== 1) continue; // réservé par une autre exécution

        await sendActivationNudge(user.email, user.name);
        sent++;
    }

    return { candidates: candidates.length, sent };
}

/**
 * Win-back — comptes silencieux depuis 14 jours.
 *
 * Réservé à ceux qui ont déjà créé au moins un countdown : un compte
 * sans countdown relève de la relance d'activation, lui écrire deux
 * fois le même « revenez » n'apporte rien.
 *
 * Email marketing : les désabonnés sont exclus et le lien de
 * désinscription est obligatoire.
 */
async function runWinback() {
    const candidates = await prisma.user.findMany({
        where: {
            winbackNotified: false,
            marketingOptOut: false,
            emailVerified:   true,
            countdowns:      { some: {} },
            OR:              inactiveSince(WINBACK_DELAY_D),
        },
        select: { id: true, email: true, name: true, unsubscribeToken: true },
    });

    let sent = 0;
    for (const user of candidates) {
        const claimed = await prisma.user.updateMany({
            where: { id: user.id, winbackNotified: false },
            data:  { winbackNotified: true },
        });
        if (claimed.count !== 1) continue;

        await sendWinback(user.email, user.name, await unsubscribeUrlFor(user));
        sent++;
    }

    return { candidates: candidates.length, sent };
}

/**
 * Offre de réactivation — toujours silencieux 30 jours après.
 *
 * Exige winbackNotified : c'est la seconde et dernière relance du
 * cycle, elle ne doit jamais arriver seule. Une reconnexion remet les
 * deux flags à zéro (cf. retention.js), le cycle peut donc reprendre.
 */
async function runReactivation() {
    const candidates = await prisma.user.findMany({
        where: {
            winbackNotified:      true,
            reactivationNotified: false,
            marketingOptOut:      false,
            emailVerified:        true,
            OR:                   inactiveSince(REACTIVATION_DELAY_D),
        },
        select: { id: true, email: true, name: true, unsubscribeToken: true },
    });

    let sent = 0;
    for (const user of candidates) {
        const claimed = await prisma.user.updateMany({
            where: { id: user.id, reactivationNotified: false },
            data:  { reactivationNotified: true },
        });
        if (claimed.count !== 1) continue;

        await sendReactivation(user.email, user.name, await unsubscribeUrlFor(user));
        sent++;
    }

    return { candidates: candidates.length, sent };
}

/**
 * Enregistre les jobs. Appelé une fois au démarrage du serveur.
 * Renvoie les tâches créées (utile en test / pour un arrêt propre).
 */
function start() {
    if (process.env.DISABLE_CRON === 'true') {
        console.log('⏱️  [CRON] Désactivé (DISABLE_CRON=true)');
        return [];
    }

    // Les trois jobs sont décalés de 15 min pour ne pas ouvrir trois
    // séries d'envois simultanées vers Resend.
    const jobs = [
        ['activation-nudge', ACTIVATION_CRON,   runActivationNudge, 'relance activation'],
        ['winback',          WINBACK_CRON,      runWinback,         'win-back'],
        ['reactivation',     REACTIVATION_CRON, runReactivation,    'réactivation'],
    ];

    const tasks = jobs.map(([name, expression, run, label]) => {
        const task = cron.schedule(expression, async () => {
            try {
                const { candidates, sent } = await run();
                console.log(`⏱️  [CRON] ${label} — ${candidates} candidat(s), ${sent} envoi(s)`);
            } catch (err) {
                console.error(`⏱️  [CRON] Erreur ${label} :`, err.message);
            }
        }, { timezone: TIMEZONE, name, noOverlap: true });

        console.log(`⏱️  [CRON] ${label} planifiée — "${expression}" (${TIMEZONE})`);
        return task;
    });

    return tasks;
}

module.exports = { start, runActivationNudge, runWinback, runReactivation };
