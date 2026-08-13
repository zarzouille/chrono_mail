/**
 * Valeurs d'environnement pour la suite de tests.
 * ============================================================
 * Plusieurs modules refusent délibérément de se charger sans leur
 * variable (JWT_SECRET, APP_URL) : c'est le comportement voulu en
 * production, mais il rendait `npm test` dépendant d'un `.env` local —
 * absent d'un poste fraîchement cloné comme du runner CI, où la suite
 * échouait donc au chargement des modules.
 *
 * Ces valeurs ne servent qu'aux tests et n'écrasent jamais un `.env`
 * existant : elles ne comblent que ce qui manque. Exécuté par
 * `setupFiles`, donc avant l'import des modules de chaque fichier de test.
 */
function defaultTo(key, value) {
    // Une chaîne vide compte comme absente : c'est ainsi que les modules
    // de configuration la traitent.
    if (!process.env[key]) process.env[key] = value;
}

defaultTo('JWT_SECRET', 'jwt-secret-de-test-jamais-utilise-en-production');
defaultTo('APP_URL', 'http://localhost:3000');
defaultTo('GOOGLE_CLIENT_ID', 'test-client-id');
defaultTo('GOOGLE_CLIENT_SECRET', 'test-client-secret');

// Aucun test ne doit joindre une vraie base : les accès Prisma sont
// mockés. La valeur sert uniquement à instancier le client sans erreur.
defaultTo('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');

// Filet de sécurité : si un test chargeait app.js, les tâches planifiées
// ne doivent surtout pas démarrer.
defaultTo('DISABLE_CRON', 'true');
