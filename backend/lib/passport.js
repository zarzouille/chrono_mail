const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('./prisma');
const { sendWelcome } = require('../services/email-service');
const { touchLastLogin } = require('./retention');
const { APP_URL } = require('./app-url');

// L'URL de callback doit correspondre au caractère près à l'une de celles
// déclarées dans la Google Cloud Console. Elle se déduit donc d'APP_URL
// plutôt que de retomber sur un « localhost » codé en dur : ce défaut ne
// se signalait pas en production, Google se contentait de renvoyer
// redirect_uri_mismatch au premier utilisateur qui tentait sa chance.
//
// GOOGLE_CALLBACK_URL reste accepté pour les montages où le callback
// n'est pas servi par l'hôte de l'application, mais toute divergence est
// signalée au démarrage : c'est le genre d'écart qui survit à une
// migration de domaine et ne se découvre qu'à l'usage.
const DERIVED_CALLBACK_URL = `${APP_URL}/auth/google/callback`;
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || DERIVED_CALLBACK_URL;

if (CALLBACK_URL !== DERIVED_CALLBACK_URL) {
    console.warn(
        `⚠️  [OAUTH] GOOGLE_CALLBACK_URL ("${CALLBACK_URL}") ne correspond pas à APP_URL ` +
        `("${DERIVED_CALLBACK_URL}"). Voulu ? Sinon la connexion Google échouera ` +
        'en redirect_uri_mismatch.',
    );
}

/**
 * Résout le compte correspondant à un profil Google.
 *
 * Extrait de la stratégie pour être testable : Passport n'expose pas son
 * callback de vérification, et la règle de rattachement ci-dessous mérite
 * des tests à elle seule.
 */
async function resolveGoogleUser(profile) {
    const email = profile.emails?.[0]?.value;
    const name  = profile.displayName;

    if (!email) throw new Error('Email Google introuvable');

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        user = await prisma.user.create({
            data: {
                email,
                name,
                password: 'google_oauth', // pas de mot de passe pour les comptes Google
                plan: 'FREE',
                emailVerified: true, // Google a déjà vérifié l'email
            },
        });
        sendWelcome(user.email, user.name).catch(() => {});
        touchLastLogin(user.id);
        return user;
    }

    // Compte préexistant créé par mot de passe, dont personne n'a jamais
    // prouvé qu'il possédait l'adresse : /auth/register ne vérifie que
    // l'unicité de l'email, pas sa propriété. N'importe qui pouvait donc
    // s'inscrire avec l'adresse d'un tiers, attendre que celui-ci se
    // connecte via Google, et conserver un accès permanent au compte —
    // avec tout ce que la victime y créerait ensuite.
    //
    // Google vient, lui, de prouver la possession de l'adresse. Le compte
    // revient donc à qui contrôle la boîte mail, et le mot de passe jamais
    // vérifié est invalidé. Un utilisateur légitime qui n'avait tout
    // simplement pas confirmé son email garde ses données et se reconnecte
    // par Google (ou repasse par « mot de passe oublié »).
    if (user.password !== 'google_oauth' && !user.emailVerified) {
        user = await prisma.user.update({
            where: { id: user.id },
            data: {
                password:         'google_oauth',
                emailVerified:    true,
                emailVerifyToken: null,
                // Un lien de réinitialisation encore valide rouvrirait la porte.
                resetToken:       null,
                resetTokenExpiry: null,
            },
        });
        console.warn(`⚠️  [OAUTH] ${email} — compte non vérifié repris via Google, mot de passe invalidé`);
    }

    // Signal d'activité + réarmement du cycle de rétention (non bloquant)
    touchLastLogin(user.id);
    return user;
}

passport.use(new GoogleStrategy({
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            return done(null, await resolveGoogleUser(profile));
        } catch (err) {
            return done(err, null);
        }
    }));

// Pas de session — on utilise JWT
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, { id }));

module.exports = passport;
module.exports.resolveGoogleUser = resolveGoogleUser;