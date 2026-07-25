/**
 * scheduler.js — Jobs planifiés chrono.mail
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
const { sendActivationNudge } = require('../services/email-service');

const TIMEZONE           = process.env.CRON_TIMEZONE || 'Europe/Paris';
const ACTIVATION_CRON    = process.env.CRON_ACTIVATION_NUDGE || '0 10 * * *';
const ACTIVATION_DELAY_H = 48;

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
 * Enregistre les jobs. Appelé une fois au démarrage du serveur.
 * Renvoie les tâches créées (utile en test / pour un arrêt propre).
 */
function start() {
    if (process.env.DISABLE_CRON === 'true') {
        console.log('⏱️  [CRON] Désactivé (DISABLE_CRON=true)');
        return [];
    }

    const activationTask = cron.schedule(ACTIVATION_CRON, async () => {
        try {
            const { candidates, sent } = await runActivationNudge();
            console.log(`⏱️  [CRON] relance activation — ${candidates} candidat(s), ${sent} envoi(s)`);
        } catch (err) {
            console.error('⏱️  [CRON] Erreur relance activation :', err.message);
        }
    }, { timezone: TIMEZONE, name: 'activation-nudge', noOverlap: true });

    console.log(`⏱️  [CRON] relance activation planifiée — "${ACTIVATION_CRON}" (${TIMEZONE})`);
    return [activationTask];
}

module.exports = { start, runActivationNudge };
