const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('./prisma');

passport.use(new GoogleStrategy({
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            const name  = profile.displayName;

            if (!email) return done(new Error('Email Google introuvable'), null);

            // Chercher l'utilisateur existant ou le créer
            let user = await prisma.user.findUnique({ where: { email } });

            if (!user) {
                user = await prisma.user.create({
                    data: {
                        email,
                        name,
                        password: 'google_oauth', // pas de mot de passe pour les comptes Google
                        plan: 'FREE',
                    },
                });
            }

            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));

// Pas de session — on utilise JWT
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, { id }));

module.exports = passport;