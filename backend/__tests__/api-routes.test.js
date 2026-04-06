/**
 * Tests d'intégration pour les routes API (countdown CRUD + health)
 * Prisma est mocké — pas besoin de base de données.
 */
const request = require('supertest');
const express = require('express');
const { generateToken } = require('../lib/auth');

// ── Mock Prisma ──────────────────────────────────────────────────
jest.mock('../lib/prisma', () => ({
    countdown: {
        create:     jest.fn(),
        findMany:   jest.fn(),
        findUnique: jest.fn(),
        update:     jest.fn(),
        delete:     jest.fn(),
        count:      jest.fn(),
    },
    impression: {
        create: jest.fn().mockResolvedValue({}),
    },
    user: {
        findUnique: jest.fn(),
    },
}));

// Mock le générateur de GIF (lourd, pas besoin dans les tests CRUD)
jest.mock('../services/countdown-generator', () => ({
    generateCountdownGif: jest.fn().mockResolvedValue(Buffer.from('GIF89a_fake')),
}));

// Mock email service
jest.mock('../services/email-service', () => ({
    sendCountdownExpired: jest.fn(),
}));

const prisma = require('../lib/prisma');
const apiRouter = require('../routes/api');

// ── App de test ──────────────────────────────────────────────────
function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/', apiRouter);
    return app;
}

const app = createApp();

// Helper : token JWT pour un user
function authHeader(overrides = {}) {
    const user = { id: 'user_1', email: 'test@test.com', plan: 'FREE', ...overrides };
    return { Authorization: `Bearer ${generateToken(user)}` };
}

// ── Health ────────────────────────────────────────────────────────
describe('GET /health', () => {
    test('retourne status ok', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.timestamp).toBeDefined();
    });
});

// ── Créer un countdown ───────────────────────────────────────────
describe('POST /countdown', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();

    beforeEach(() => jest.clearAllMocks());

    test('sans auth → 401', async () => {
        const res = await request(app).post('/countdown').send({ endDate: futureDate });
        expect(res.status).toBe(401);
    });

    test('sans endDate → 400', async () => {
        const res = await request(app)
            .post('/countdown')
            .set(authHeader())
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/endDate/);
    });

    test('endDate dans le passé → 400', async () => {
        const res = await request(app)
            .post('/countdown')
            .set(authHeader())
            .send({ endDate: '2020-01-01T00:00:00Z' });
        expect(res.status).toBe(400);
    });

    test('FREE limité à 3 countdowns', async () => {
        prisma.countdown.count.mockResolvedValue(3);
        const res = await request(app)
            .post('/countdown')
            .set(authHeader({ plan: 'FREE' }))
            .send({ endDate: futureDate });
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/Limite/);
    });

    test('PRO peut dépasser 3 countdowns', async () => {
        prisma.countdown.count.mockResolvedValue(10);
        prisma.countdown.create.mockResolvedValue({
            id: 'cd_1', name: 'Test', endDate: futureDate, userId: 'user_1',
        });
        const res = await request(app)
            .post('/countdown')
            .set(authHeader({ plan: 'PRO' }))
            .send({ endDate: futureDate, name: 'Test' });
        expect(res.status).toBe(200);
        expect(res.body.id).toBe('cd_1');
    });

    test('création réussie avec valeurs par défaut', async () => {
        prisma.countdown.count.mockResolvedValue(0);
        prisma.countdown.create.mockResolvedValue({
            id: 'cd_2', name: 'Mon countdown', endDate: futureDate, userId: 'user_1',
        });
        const res = await request(app)
            .post('/countdown')
            .set(authHeader())
            .send({ endDate: futureDate });
        expect(res.status).toBe(200);
        expect(res.body.gifUrl).toContain('/gif/cd_2');
    });

    test('FREE ne peut pas utiliser le style glass', async () => {
        prisma.countdown.count.mockResolvedValue(0);
        prisma.countdown.create.mockImplementation(({ data }) => {
            return Promise.resolve({ id: 'cd_3', ...data });
        });
        const res = await request(app)
            .post('/countdown')
            .set(authHeader({ plan: 'FREE' }))
            .send({ endDate: futureDate, style: 'glass' });
        expect(res.status).toBe(200);
        // Le style doit être forcé à 'rounded' pour FREE
        expect(prisma.countdown.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ style: 'rounded' }),
            })
        );
    });
});

// ── Lister les countdowns ────────────────────────────────────────
describe('GET /countdowns', () => {
    test('sans auth → 401', async () => {
        const res = await request(app).get('/countdowns');
        expect(res.status).toBe(401);
    });

    test('retourne la liste', async () => {
        prisma.countdown.findMany.mockResolvedValue([
            { id: 'cd_1', name: 'A', _count: { impressions: 5 } },
            { id: 'cd_2', name: 'B', _count: { impressions: 0 } },
        ]);
        const res = await request(app).get('/countdowns').set(authHeader());
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
    });
});

// ── Supprimer un countdown ───────────────────────────────────────
describe('DELETE /countdown/:id', () => {
    beforeEach(() => jest.clearAllMocks());

    test('countdown inexistant → 404', async () => {
        prisma.countdown.findUnique.mockResolvedValue(null);
        const res = await request(app).delete('/countdown/fake_id').set(authHeader());
        expect(res.status).toBe(404);
    });

    test('countdown d\'un autre user → 403', async () => {
        prisma.countdown.findUnique.mockResolvedValue({ id: 'cd_1', userId: 'other_user' });
        const res = await request(app).delete('/countdown/cd_1').set(authHeader());
        expect(res.status).toBe(403);
    });

    test('suppression réussie', async () => {
        prisma.countdown.findUnique.mockResolvedValue({ id: 'cd_1', userId: 'user_1' });
        prisma.countdown.delete.mockResolvedValue({});
        const res = await request(app).delete('/countdown/cd_1').set(authHeader());
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

// ── Modifier un countdown ────────────────────────────────────────
describe('PUT /countdown/:id', () => {
    beforeEach(() => jest.clearAllMocks());

    test('countdown inexistant → 404', async () => {
        prisma.countdown.findUnique.mockResolvedValue(null);
        const res = await request(app)
            .put('/countdown/fake_id')
            .set(authHeader())
            .send({ name: 'New name' });
        expect(res.status).toBe(404);
    });

    test('countdown d\'un autre user → 403', async () => {
        prisma.countdown.findUnique.mockResolvedValue({ id: 'cd_1', userId: 'other_user' });
        const res = await request(app)
            .put('/countdown/cd_1')
            .set(authHeader())
            .send({ name: 'Hack' });
        expect(res.status).toBe(403);
    });

    test('mise à jour réussie', async () => {
        prisma.countdown.findUnique.mockResolvedValue({
            id: 'cd_1', userId: 'user_1', style: 'rounded', expiredBehavior: 'SHOW_ZEROS',
        });
        prisma.countdown.update.mockResolvedValue({
            id: 'cd_1', name: 'Updated', userId: 'user_1',
        });
        const res = await request(app)
            .put('/countdown/cd_1')
            .set(authHeader())
            .send({ name: 'Updated' });
        expect(res.status).toBe(200);
        expect(res.body.countdown.name).toBe('Updated');
    });
});
