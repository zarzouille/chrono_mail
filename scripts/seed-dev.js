/**
 * seed-dev.js — Peuple une base de développement
 * ============================================================
 * Crée de quoi travailler sans toucher aux données réelles :
 * un compte de test, quelques countdowns et une demande de support.
 *
 *   npm run seed:dev
 *
 * Le script est volontairement destructeur (il vide les tables avant
 * d'écrire) — d'où le garde-fou ci-dessous, qui est la seule chose
 * réellement importante dans ce fichier.
 */
require('dotenv').config();
const prisma = require('../backend/lib/prisma');
const { hashPassword } = require('../backend/lib/auth');

// Identifiant du projet Supabase de production. Un `npm run seed:dev`
// lancé par réflexe alors que le .env pointe encore sur la production
// effacerait les comptes et les countdowns de vrais clients : on refuse
// de démarrer plutôt que de faire confiance à l'attention de qui tape.
const PROD_PROJECT = 'ubvkxfdzbfbkhdhwhqtd';

const DEV_EMAIL    = 'dev@chronomail.local';
const DEV_PASSWORD = 'devdev123';

function assertNotProduction() {
    const url = process.env.DATABASE_URL || '';
    if (!url) {
        throw new Error('DATABASE_URL absente — rien à peupler.');
    }
    if (url.includes(PROD_PROJECT)) {
        throw new Error(
            'DATABASE_URL pointe sur la base de PRODUCTION. Seed annulé.\n' +
            '   Fais pointer ton .env sur la base de développement avant de relancer.'
        );
    }
    const { hostname } = new URL(url);
    console.log(`Base ciblée : ${hostname}`);
}

async function main() {
    assertNotProduction();

    // Ordre imposé par les clés étrangères
    await prisma.supportMessage.deleteMany();
    await prisma.supportTicket.deleteMany();
    await prisma.impression.deleteMany();
    await prisma.countdown.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
        data: {
            email:         DEV_EMAIL,
            password:      await hashPassword(DEV_PASSWORD),
            name:          'Compte de dev',
            plan:          'BUSINESS', // toutes les options déverrouillées
            emailVerified: true,
        },
    });

    const jours = n => new Date(Date.now() + n * 86400000);
    await prisma.countdown.createMany({
        data: [
            { userId: user.id, name: 'Vente flash — actif',   endDate: jours(3) },
            { userId: user.id, name: 'Black Friday — lointain', endDate: jours(90), style: 'flat' },
            { userId: user.id, name: 'Soldes — expiré',       endDate: jours(-2), expiredBehavior: 'SHOW_TEXT', expiredText: 'Terminé !' },
        ],
    });

    await prisma.supportTicket.create({
        data: {
            ref:      'CM-DEV001',
            userId:   user.id,
            email:    DEV_EMAIL,
            name:     'Compte de dev',
            category: 'BILLING',
            subject:  'Exemple de demande pour la console',
            planAtCreation: 'BUSINESS',
            messages: { create: { author: 'CUSTOMER', body: 'Ticket d\'exemple créé par le seed, pour avoir quelque chose à afficher dans la console d\'assistance.' } },
        },
    });

    console.log('\nBase de dev prête.');
    console.log(`  Connexion : ${DEV_EMAIL} / ${DEV_PASSWORD}`);
    console.log('  3 countdowns (actif, lointain, expiré) et 1 ticket de support.');
    console.log('\n  Pour voir la console d\'assistance en local, ajoute cette adresse');
    console.log('  à ADMIN_EMAILS dans ton .env.');
}

main()
    .catch(err => { console.error('\n✖ ' + err.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
