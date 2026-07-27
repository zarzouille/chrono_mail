/**
 * Tests du job planifié de relance d'activation.
 * Prisma et l'envoi d'email sont mockés — pas de base ni d'appel réseau.
 */
jest.mock('../lib/prisma', () => ({
    user: {
        findMany:   jest.fn(),
        updateMany: jest.fn(),
    },
    impression: {
        deleteMany: jest.fn(),
    },
}));

jest.mock('../services/email-service', () => ({
    sendActivationNudge: jest.fn().mockResolvedValue({}),
    sendWinback:         jest.fn().mockResolvedValue({}),
    sendReactivation:    jest.fn().mockResolvedValue({}),
}));

jest.mock('../lib/retention', () => ({
    unsubscribeUrlFor: jest.fn().mockResolvedValue('https://app/unsubscribe?token=tok'),
}));

const prisma = require('../lib/prisma');
const { sendActivationNudge, sendWinback, sendReactivation } = require('../services/email-service');
const { runActivationNudge, runWinback, runReactivation, runPurgeImpressions } = require('../lib/scheduler');

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

// ── Rétention ────────────────────────────────────────────────────
describe('runWinback', () => {
    test('exclut les désabonnés et exige au moins un countdown', async () => {
        prisma.user.findMany.mockResolvedValue([]);

        await runWinback();

        const where = prisma.user.findMany.mock.calls[0][0].where;
        expect(where.marketingOptOut).toBe(false);
        expect(where.emailVerified).toBe(true);
        expect(where.winbackNotified).toBe(false);
        expect(where.countdowns).toEqual({ some: {} });
    });

    test('retombe sur createdAt quand lastLoginAt est nul', async () => {
        prisma.user.findMany.mockResolvedValue([]);

        await runWinback();

        const or = prisma.user.findMany.mock.calls[0][0].where.OR;
        expect(or).toHaveLength(2);
        expect(or[0].lastLoginAt.lt).toBeInstanceOf(Date);
        expect(or[1].AND[0]).toEqual({ lastLoginAt: null });
        expect(or[1].AND[1].createdAt.lt).toBeInstanceOf(Date);
    });

    test('envoie avec un lien de désinscription', async () => {
        prisma.user.findMany.mockResolvedValue([USER]);

        const result = await runWinback();

        expect(sendWinback).toHaveBeenCalledWith(
            'sophie@exemple.fr', 'Sophie', 'https://app/unsubscribe?token=tok',
        );
        expect(result).toEqual({ candidates: 1, sent: 1 });
    });

    test('n\'envoie pas si le compte a déjà été réservé ailleurs', async () => {
        prisma.user.findMany.mockResolvedValue([USER]);
        prisma.user.updateMany.mockResolvedValue({ count: 0 });

        const result = await runWinback();

        expect(sendWinback).not.toHaveBeenCalled();
        expect(result).toEqual({ candidates: 1, sent: 0 });
    });
});

describe('runReactivation', () => {
    test('exige qu\'un win-back ait déjà été envoyé', async () => {
        prisma.user.findMany.mockResolvedValue([]);

        await runReactivation();

        const where = prisma.user.findMany.mock.calls[0][0].where;
        expect(where.winbackNotified).toBe(true);
        expect(where.reactivationNotified).toBe(false);
        expect(where.marketingOptOut).toBe(false);
    });

    test('applique un délai de 30 jours, plus long que le win-back', async () => {
        prisma.user.findMany.mockResolvedValue([]);

        await runWinback();
        const winbackCutoff = prisma.user.findMany.mock.calls[0][0].where.OR[0].lastLoginAt.lt;

        prisma.user.findMany.mockClear();
        await runReactivation();
        const reactivCutoff = prisma.user.findMany.mock.calls[0][0].where.OR[0].lastLoginAt.lt;

        expect(reactivCutoff.getTime()).toBeLessThan(winbackCutoff.getTime());
    });

    test('envoie avec un lien de désinscription', async () => {
        prisma.user.findMany.mockResolvedValue([USER]);

        const result = await runReactivation();

        expect(sendReactivation).toHaveBeenCalledWith(
            'sophie@exemple.fr', 'Sophie', 'https://app/unsubscribe?token=tok',
        );
        expect(result).toEqual({ candidates: 1, sent: 1 });
    });
});

describe('runPurgeImpressions', () => {
    test('supprime les impressions de plus de 12 mois', async () => {
        prisma.impression.deleteMany.mockResolvedValue({ count: 42 });

        const result = await runPurgeImpressions();

        const cutoff = prisma.impression.deleteMany.mock.calls[0][0].where.createdAt.lt;
        const ageJours = (Date.now() - cutoff.getTime()) / (24 * 3600 * 1000);
        expect(ageJours).toBeCloseTo(365, 0);
        expect(result).toEqual({ deleted: 42 });
    });

    test('ne supprime rien quand aucune impression n\'a expiré', async () => {
        prisma.impression.deleteMany.mockResolvedValue({ count: 0 });

        expect(await runPurgeImpressions()).toEqual({ deleted: 0 });
    });
});
