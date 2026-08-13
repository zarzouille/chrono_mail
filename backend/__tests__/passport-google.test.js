/**
 * Rattachement d'un profil Google à un compte existant.
 *
 * L'enjeu n'est pas la connexion Google elle-même mais la règle de
 * rattachement par email : /auth/register ne vérifie pas la propriété de
 * l'adresse, un compte homonyme peut donc avoir été créé par un tiers.
 */

// La stratégie Google est instanciée au chargement du module et refuse de
// démarrer sans identifiants ; APP_URL est exigée par lib/app-url, dont
// dérive désormais l'URL de callback.
process.env.GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-client-secret';
process.env.APP_URL              = process.env.APP_URL              || 'http://localhost:3000';

jest.mock('../lib/prisma', () => ({
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
}));
jest.mock('../services/email-service', () => ({
    sendWelcome: jest.fn().mockResolvedValue({}),
}));
jest.mock('../lib/retention', () => ({
    touchLastLogin:    jest.fn(),
    unsubscribeUrlFor: jest.fn(),
}));

const prisma = require('../lib/prisma');
const { sendWelcome } = require('../services/email-service');
const { resolveGoogleUser } = require('../lib/passport');

const profile = { emails: [{ value: 'victime@example.com' }], displayName: 'Victime' };

describe('resolveGoogleUser', () => {
    beforeEach(() => jest.clearAllMocks());

    test('aucun compte existant → création vérifiée, sans mot de passe', async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockImplementation(({ data }) => Promise.resolve({ id: 'u_new', ...data }));

        const user = await resolveGoogleUser(profile);

        expect(user.id).toBe('u_new');
        expect(prisma.user.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ password: 'google_oauth', emailVerified: true }),
            }),
        );
        expect(sendWelcome).toHaveBeenCalled();
    });

    test('compte Google existant → connecté tel quel, aucune écriture', async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: 'u1', email: 'victime@example.com', password: 'google_oauth', emailVerified: true,
        });

        const user = await resolveGoogleUser(profile);

        expect(user.id).toBe('u1');
        expect(prisma.user.update).not.toHaveBeenCalled();
        expect(sendWelcome).not.toHaveBeenCalled(); // pas un nouveau compte
    });

    test('compte mot de passe NON vérifié → repris, mot de passe et jetons invalidés', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        // Compte qu'un tiers a pu créer avec l'email de la victime.
        prisma.user.findUnique.mockResolvedValue({
            id: 'u_squat', email: 'victime@example.com',
            password: '$2b$10$hash_de_l_attaquant', emailVerified: false,
        });
        prisma.user.update.mockImplementation(({ data }) => Promise.resolve({ id: 'u_squat', ...data }));

        const user = await resolveGoogleUser(profile);

        // Le mot de passe de l'attaquant ne doit plus ouvrir le compte…
        expect(prisma.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'u_squat' },
                data: expect.objectContaining({
                    password:         'google_oauth',
                    emailVerified:    true,
                    // …ni un lien de réinitialisation encore en vol.
                    resetToken:       null,
                    resetTokenExpiry: null,
                    emailVerifyToken: null,
                }),
            }),
        );
        expect(user.password).toBe('google_oauth');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('victime@example.com'));
        warn.mockRestore();
    });

    test('compte mot de passe VÉRIFIÉ → rattaché sans toucher au mot de passe', async () => {
        // Ici la propriété de l'adresse a été prouvée (lien de vérification
        // cliqué) : c'est la même personne, on ne lui retire pas son mot de passe.
        prisma.user.findUnique.mockResolvedValue({
            id: 'u_ok', email: 'victime@example.com',
            password: '$2b$10$hash_legitime', emailVerified: true,
        });

        const user = await resolveGoogleUser(profile);

        expect(user.id).toBe('u_ok');
        expect(user.password).toBe('$2b$10$hash_legitime');
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    test('profil sans email → erreur, aucun compte touché', async () => {
        await expect(resolveGoogleUser({ emails: [], displayName: 'X' })).rejects.toThrow(/Email Google/);
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
        expect(prisma.user.create).not.toHaveBeenCalled();
    });
});
