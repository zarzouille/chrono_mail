/**
 * retention.js — Signal d'activité utilisateur
 * ============================================================
 * Les relances de rétention (win-back, réactivation) ont besoin de
 * savoir quand un compte s'est manifesté pour la dernière fois.
 *
 * `updatedAt` ne peut pas servir : il bouge à chaque écriture sur la
 * ligne, y compris celles déclenchées par les webhooks Stripe ou par
 * nos propres flags de notification. D'où ce champ dédié.
 *
 * Se connecter réarme aussi le cycle : un utilisateur revenu puis
 * reparti pourra être relancé de nouveau, au lieu de ne l'être qu'une
 * fois dans sa vie.
 */
const prisma = require('./prisma');
const crypto = require('crypto');
const { APP_URL } = require('./app-url');

const APP = APP_URL;

/**
 * Enregistre une connexion. Non bloquant : un échec ne doit jamais
 * empêcher l'utilisateur de se connecter, la réponse est déjà partie.
 */
function touchLastLogin(userId) {
    // try/catch en plus du .catch() : appelé APRÈS res.json(), la moindre
    // exception synchrone remonterait dans le catch de la route, qui
    // tenterait une seconde réponse ("Cannot set headers after they are sent").
    try {
        prisma.user.update({
            where: { id: userId },
            data:  {
                lastLoginAt:          new Date(),
                winbackNotified:      false,
                reactivationNotified: false,
            },
        }).catch(err => console.error('Erreur touchLastLogin :', err.message));
    } catch (err) {
        console.error('Erreur touchLastLogin :', err.message);
    }
}

/**
 * Renvoie l'URL de désinscription d'un utilisateur, en créant son
 * token au premier envoi marketing. Le token est stable ensuite : un
 * lien reçu il y a six mois doit encore fonctionner.
 */
async function unsubscribeUrlFor(user) {
    let token = user.unsubscribeToken;
    if (!token) {
        token = crypto.randomBytes(32).toString('hex');
        await prisma.user.update({
            where: { id: user.id },
            data:  { unsubscribeToken: token },
        });
    }
    return `${APP}/unsubscribe?token=${token}`;
}

module.exports = { touchLastLogin, unsubscribeUrlFor };
