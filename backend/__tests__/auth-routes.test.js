/**
 * Tests d'intégration pour les routes d'authentification
 */
const request = require('supertest');
const express = require('express');
const { generateToken } = require('../lib/auth');

// ── Mock Prisma ──────────────────────────────────────────────────
jest.mock('../lib/prisma', () => ({
    user: {
        findUnique: jest.fn(),
        create:     jest.fn(),
        delete:     jest.fn(),
    },
}));

// Mock email service
jest.mock('../services/email-service', () => ({
    sendWelcome: jest.fn().mockResolvedValue({}),
}));

// Mock passport (évite la config Google OAuth)
jest.mock('../lib/passport', () => {
    const passport = require('passport');
    return passport;
});

const prisma = require('../lib/prisma');
const bcrypt = require('bcrypt');
const authRoutes = require('../routes/auth-routes');

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/', authRoutes);
    return app;
}

const app = createApp();

function authHeader(overrides = {}) {
    const user = { id: 'user_1', email: 'test@test.com', plan: 'FREE', ...overrides };
    return { Authorization: `Bearer ${generateToken(user)}` };
}

// ── Register ─────────────────────────────────────────────────────
describe('POST /auth/register', () => {
    beforeEach(() => jest.clearAllMocks());

    test('sans email → 400', async () => {
        const res = await request(app).post('/auth/register').send({ password: '12345678' });
        expect(res.status).toBe(400);
    });

    test('sans mot de passe → 400', async () => {
        const res = await request(app).post('/auth/register').send({ email: 'a@b.com' });
        expect(res.status).toBe(400);
    });

    test('mot de passe trop court → 400', async () => {
        const res = await request(app).post('/auth/register').send({ email: 'a@b.com', password: '1234' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/8 caractères/);
    });

    test('email déjà utilisé → 409', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'a@b.com' });
        const res = await request(app).post('/auth/register').send({ email: 'a@b.com', password: '12345678' });
        expect(res.status).toBe(409);
    });

    test('inscription réussie → 201 + token', async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockResolvedValue({
            id: 'new_user', email: 'new@test.com', name: null, plan: 'FREE',
        });
        const res = await request(app)
            .post('/auth/register')
            .send({ email: 'new@test.com', password: '12345678' });
        expect(res.status).toBe(201);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.email).toBe('new@test.com');
        expect(res.body.user.plan).toBe('FREE');
    });
});

// ── Login ────────────────────────────────────────────────────────
describe('POST /auth/login', () => {
    beforeEach(() => jest.clearAllMocks());

    test('sans email → 400', async () => {
        const res = await request(app).post('/auth/login').send({ password: '12345678' });
        expect(res.status).toBe(400);
    });

    test('utilisateur inexistant → 401', async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        const res = await request(app).post('/auth/login').send({ email: 'nope@test.com', password: '12345678' });
        expect(res.status).toBe(401);
    });

    test('utilisateur Google OAuth → 401', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'g@test.com', password: 'google_oauth' });
        const res = await request(app).post('/auth/login').send({ email: 'g@test.com', password: '12345678' });
        expect(res.status).toBe(401);
    });

    test('mauvais mot de passe → 401', async () => {
        const hash = await bcrypt.hash('correct_password', 10);
        prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', password: hash, plan: 'FREE' });
        const res = await request(app).post('/auth/login').send({ email: 'a@b.com', password: 'wrong_password' });
        expect(res.status).toBe(401);
    });

    test('connexion réussie → 200 + token', async () => {
        const hash = await bcrypt.hash('monMotDePasse', 10);
        prisma.user.findUnique.mockResolvedValue({
            id: 'u1', email: 'a@b.com', name: 'Test', password: hash, plan: 'PRO',
        });
        const res = await request(app).post('/auth/login').send({ email: 'a@b.com', password: 'monMotDePasse' });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.plan).toBe('PRO');
    });
});

// ── Me ───────────────────────────────────────────────────────────
describe('GET /auth/me', () => {
    test('sans auth → 401', async () => {
        const res = await request(app).get('/auth/me');
        expect(res.status).toBe(401);
    });

    test('utilisateur trouvé → 200', async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: 'user_1', email: 'test@test.com', name: 'Test', plan: 'FREE', createdAt: new Date(),
        });
        const res = await request(app).get('/auth/me').set(authHeader());
        expect(res.status).toBe(200);
        expect(res.body.email).toBe('test@test.com');
    });
});

// ── Delete account ───────────────────────────────────────────────
describe('DELETE /auth/account', () => {
    beforeEach(() => jest.clearAllMocks());

    test('sans auth → 401', async () => {
        const res = await request(app).delete('/auth/account');
        expect(res.status).toBe(401);
    });

    test('suppression réussie (sans Stripe)', async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: 'user_1', email: 'test@test.com', stripeSubscriptionId: null,
        });
        prisma.user.delete.mockResolvedValue({});
        const res = await request(app).delete('/auth/account').set(authHeader());
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
