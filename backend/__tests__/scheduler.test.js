/**
 * Tests du job planifié de relance d'activation.
 * Prisma et l'envoi d'email sont mockés — pas de base ni d'appel réseau.
 */
jest.mock('../lib/prisma', () => ({
    user: {
        findMany:   jest.fn(),
        updateMany: jest.fn(),
    },
}));

jest.mock('../services/email-service', () => ({
    sendActivationNudge: jest.fn().mockResolvedValue({}),
}));

const prisma = require('../lib/prisma');
const { sendActivationNudge } = require('../services/email-service');
const { runActivationNudge } = require('../lib/scheduler');

const USER = { id: 'user_1', email: 'sophie@exemple.fr', name: 'Sophie' };

beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
});

describe('runActivationNudge — sélection', () => {
    test('ne cible que les comptes vérifiés, sans countdown, non déjà relancés', async () => {
        prisma.user.findMany.mockResolvedValue([]);

        await runActivationNudge();

        const where = prisma.user.findMany.mock.calls[0][0].where;
        expect(where.activationNudged).toBe(false);
        expect(where.emailVerified).toBe(true);
        expect(where.countdowns).toEqual({ none: {} });
    });

    test('applique un délai de 48h sur createdAt', async () => {
        prisma.user.findMany.mockResolvedValue([]);

        const before = Date.now();
        await runActivationNudge();
        const after = Date.now();

        const cutoff = prisma.user.findMany.mock.calls[0][0].where.createdAt.lt.getTime();
        expect(cutoff).toBeGreaterThanOrEqual(before - 48 * 3600 * 1000);
        expect(cutoff).toBeLessThanOrEqual(after - 48 * 3600 * 1000);
    });
});

describe('runActivationNudge — envoi', () => {
    test('envoie la relance et marque le compte', async () => {
        prisma.user.findMany.mockResolvedValue([USER]);

        const result = await runActivationNudge();

        expect(sendActivationNudge).toHaveBeenCalledWith('sophie@exemple.fr', 'Sophie');
        expect(prisma.user.updateMany).toHaveBeenCalledWith({
            where: { id: 'user_1', activationNudged: false },
            data:  { activationNudged: true },
        });
        expect(result).toEqual({ candidates: 1, sent: 1 });
    });

    test('marque le compte avant d\'envoyer', async () => {
        prisma.user.findMany.mockResolvedValue([USER]);
        const order = [];
        prisma.user.updateMany.mockImplementation(async () => {
            order.push('claim');
            return { count: 1 };
        });
        sendActivationNudge.mockImplementation(async () => { order.push('send'); });

        await runActivationNudge();

        expect(order).toEqual(['claim', 'send']);
    });

    test('n\'envoie pas si le compte a déjà été réservé ailleurs', async () => {
        prisma.user.findMany.mockResolvedValue([USER]);
        prisma.user.updateMany.mockResolvedValue({ count: 0 });

        const result = await runActivationNudge();

        expect(sendActivationNudge).not.toHaveBeenCalled();
        expect(result).toEqual({ candidates: 1, sent: 0 });
    });

    test('ne fait rien quand aucun compte ne correspond', async () => {
        prisma.user.findMany.mockResolvedValue([]);

        const result = await runActivationNudge();

        expect(sendActivationNudge).not.toHaveBeenCalled();
        expect(result).toEqual({ candidates: 0, sent: 0 });
    });
});
