/**
 * app-url.js — URL publique de l'application
 * ============================================================
 * Une seule source de vérité pour APP_URL, qui sert à trois choses
 * dont aucune ne tolère une valeur fausse :
 *   - l'origine autorisée par CORS ;
 *   - les URL de retour Stripe (succès, annulation, portail) ;
 *   - tous les liens des emails (vérification, reset, désinscription).
 *
 * Pas de valeur par défaut : le fallback `http://localhost:3000` qui
 * traînait dans quatre fichiers ne produisait aucune erreur, juste des
 * clients renvoyés vers localhost après paiement et des liens de
 * désinscription morts — invisible côté serveur. Et côté CORS, le
 * fallback était `'*'`. Mieux vaut refuser de démarrer.
 */
require('dotenv').config();

const APP_URL = (process.env.APP_URL || '').trim().replace(/\/+$/, '');

if (!APP_URL) {
    throw new Error(
        'APP_URL manquant — définis-la dans .env (ex. http://localhost:3000) ' +
        'ou dans les variables d\'environnement de l\'hébergeur.'
    );
}

// Une URL sans protocole (« chrono-mail.app ») passerait inaperçue et
// casserait silencieusement tous les liens générés.
let parsed;
try {
    parsed = new URL(APP_URL);
} catch {
    throw new Error(`APP_URL invalide ("${APP_URL}") — attendu une URL absolue, ex. https://chrono-mail.app`);
}
if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`APP_URL doit utiliser http ou https (reçu "${parsed.protocol}")`);
}

module.exports = { APP_URL };
