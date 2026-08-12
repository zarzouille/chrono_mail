/**
 * Tests d'intégration pour les routes de support (ticketing)
 */
const request = require('supertest');
const express = require('express');
const { generateToken } = require('../lib/auth');

// ── Mock Prisma ──────────────────────────────────────────────────
jest.mock('../lib/prisma', () => ({
    user: { findUnique: jest.fn() },
    supportTicket: {
        findUnique: jest.fn(),
        findFirst:  jest.fn(),
        findMany:   jest.fn(),
        create:     jest.fn(),
        update:     jest.fn(),
        groupBy:    jest.fn(),
    },
    supportMessage: { create: jest.fn() },
    $transaction: jest.fn(ops => Promise.all(ops)),
}));

jest.mock('../services/email-service', () => ({
    sendTicketReceived:   jest.fn().mockResolvedValue({}),
    sendTicketReply:      jest.fn().mockResolvedValue({}),
    sendAdminTicketAlert: jest.fn().mockResolvedValue({}),
}));

const prisma       = require('../lib/prisma');
const emailService = require('../services/email-service');
const supportRoutes = require('../routes/support-routes');

const app = express();
app.use(express.json());
app.use('/', supportRoutes);

const USER = { id: 'user_1', email: 'client@test.com', name: 'Sophie', plan: 'PRO' };

function authHeader(user = USER) {
    return { Authorization: `Bearer ${generateToken(user)}` };
}

// requireAuth et optionalAuth relisent le compte en base.
function mockLoggedIn(user = USER) {
    prisma.user.findUnique.mockResolvedValue(user);
}

const VALID = { category: 'TECHNICAL', subject: 'GIF invisible', message: 'Le GIF ne s\'affiche pas dans Outlook 2019.' };

beforeEach(() => {
    jest.clearAllMocks();
    prisma.supportTicket.findUnique.mockResolvedValue(null); // référence libre
    prisma.$transaction.mockImplementation(ops => Promise.all(ops));
});


// ── Dépôt d'une demande ──────────────────────────────────────────
describe('POST /support/tickets', () => {
    test('sans email et sans compte → 400', async () => {
        const res = await request(app).post('/support/tickets').send(VALID);
        expect(res.status).toBe(400);
        expect(prisma.supportTicket.create).not.toHaveBeenCalled();
    });

    test('thème inconnu → 400', async () => {
        const res = await request(app).post('/support/tickets')
            .send({ ...VALID, category: 'URGENT_HACK', email: 'a@b.com' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Thème/);
    });

    test('message trop court → 400', async () => {
        const res = await request(app).post('/support/tickets')
            .send({ ...VALID, message: 'coucou', email: 'a@b.com' });
        expect(res.status).toBe(400);
    });

    test('champ piège rempli → 201 silencieux, aucun ticket créé', async () => {
        const res = await request(app).post('/support/tickets')
            .send({ ...VALID, email: 'bot@spam.com', website: 'http://spam' });
        expect(res.status).toBe(201);
        expect(prisma.supportTicket.create).not.toHaveBeenCalled();
        expect(emailService.sendTicketReceived).not.toHaveBeenCalled();
    });

    test('visiteur non connecté → ticket créé et référence renvoyée', async () => {
        prisma.supportTicket.create.mockResolvedValue({
            id: 't1', ref: 'CM-ABC234', ...VALID, email: 'a@b.com', name: null, status: 'OPEN',
        });
        const res = await request(app).post('/support/tickets')
            .send({ ...VALID, email: 'a@b.com' });

        expect(res.status).toBe(201);
        expect(res.body.ref).toMatch(/^CM-[A-Z2-9]{6}$/);
        const data = prisma.supportTicket.create.mock.calls[0][0].data;
        expect(data.userId).toBeNull();
        expect(data.email).toBe('a@b.com');
        expect(data.messages.create).toEqual({ author: 'CUSTOMER', body: VALID.message });
    });

    test('client connecté → l\'email du compte prime sur celui du formulaire', async () => {
        mockLoggedIn();
        prisma.supportTicket.create.mockResolvedValue({ id: 't1', ref: 'CM-ABC234', ...VALID, email: USER.email });

        const res = await request(app).post('/support/tickets')
            .set(authHeader()).send({ ...VALID, email: 'victime@autre.com' });

        expect(res.status).toBe(201);
        const data = prisma.supportTicket.create.mock.calls[0][0].data;
        expect(data.email).toBe(USER.email);
        expect(data.userId).toBe(USER.id);
        expect(data.planAtCreation).toBe('PRO');
    });
});


// ── Suivi côté client ────────────────────────────────────────────
describe('GET /support/tickets/:id', () => {
    test('sans authentification → 401', async () => {
        const res = await request(app).get('/support/tickets/t1');
        expect(res.status).toBe(401);
    });

    test('ticket d\'un autre compte → 404', async () => {
        mockLoggedIn();
        prisma.supportTicket.findFirst.mockResolvedValue(null);
        const res = await request(app).get('/support/tickets/t1').set(authHeader());
        expect(res.status).toBe(404);
        // Le filtre porte bien sur le propriétaire, pas seulement sur l'id
        expect(prisma.supportTicket.findFirst.mock.calls[0][0].where.userId).toBe(USER.id);
    });
});

describe('POST /support/tickets/:id/messages', () => {
    test('relance client → statut repassé à OPEN', async () => {
        mockLoggedIn();
        prisma.supportTicket.findFirst.mockResolvedValue({
            id: 't1', ref: 'CM-ABC234', email: USER.email, name: 'Sophie', subject: 'GIF', status: 'PENDING',
        });
        const res = await request(app).post('/support/tickets/t1/messages')
            .set(authHeader()).send({ message: 'Toujours pas résolu' });

        expect(res.status).toBe(201);
        const update = prisma.supportTicket.update.mock.calls[0][0];
        expect(update.data.status).toBe('OPEN');
        expect(update.data.resolvedAt).toBeNull();
    });

    test('ticket clos → 409', async () => {
        mockLoggedIn();
        prisma.supportTicket.findFirst.mockResolvedValue({ id: 't1', status: 'CLOSED' });
        const res = await request(app).post('/support/tickets/t1/messages')
            .set(authHeader()).send({ message: 'Rebonjour' });
        expect(res.status).toBe(409);
    });
});


// ── Console d'assistance ─────────────────────────────────────────
describe('/support/admin', () => {
    const OLD_ENV = process.env.ADMIN_EMAILS;
    afterAll(() => { process.env.ADMIN_EMAILS = OLD_ENV; });

    test('ADMIN_EMAILS non défini → 403 même pour un compte valide', async () => {
        delete process.env.ADMIN_EMAILS;
        mockLoggedIn();
        const res = await request(app).get('/support/admin/tickets').set(authHeader());
        expect(res.status).toBe(403);
    });

    test('compte hors liste blanche → 403', async () => {
        process.env.ADMIN_EMAILS = 'patron@chrono-mail.app';
        mockLoggedIn();
        const res = await request(app).get('/support/admin/tickets').set(authHeader());
        expect(res.status).toBe(403);
    });

    test('administrateur → file d\'attente et compteurs par thème', async () => {
        process.env.ADMIN_EMAILS = ' Patron@Chrono-Mail.app , autre@x.fr ';
        const admin = { ...USER, email: 'patron@chrono-mail.app' };
        mockLoggedIn(admin);
        prisma.supportTicket.findMany.mockResolvedValue([{ id: 't1', ref: 'CM-ABC234' }]);
        prisma.supportTicket.groupBy
            .mockResolvedValueOnce([{ category: 'BILLING', _count: { _all: 2 } }])
            .mockResolvedValueOnce([{ status: 'OPEN', _count: { _all: 3 } }]);

        const res = await request(app).get('/support/admin/tickets?status=OPEN&category=BILLING')
            .set(authHeader(admin));

        expect(res.status).toBe(200);
        expect(res.body.counts.category.BILLING).toBe(2);
        expect(prisma.supportTicket.findMany.mock.calls[0][0].where)
            .toMatchObject({ status: 'OPEN', category: 'BILLING' });
    });

    test('filtre de statut inconnu → ignoré plutôt que remonté en erreur', async () => {
        process.env.ADMIN_EMAILS = 'patron@chrono-mail.app';
        const admin = { ...USER, email: 'patron@chrono-mail.app' };
        mockLoggedIn(admin);
        prisma.supportTicket.findMany.mockResolvedValue([]);
        prisma.supportTicket.groupBy.mockResolvedValue([]);

        const res = await request(app).get('/support/admin/tickets?status=NIMPORTEQUOI').set(authHeader(admin));
        expect(res.status).toBe(200);
        expect(prisma.supportTicket.findMany.mock.calls[0][0].where.status).toBeUndefined();
    });

    test('réponse admin avec resolve → ticket résolu et email au client', async () => {
        process.env.ADMIN_EMAILS = 'patron@chrono-mail.app';
        const admin = { ...USER, email: 'patron@chrono-mail.app' };
        mockLoggedIn(admin);
        prisma.supportTicket.findUnique.mockResolvedValue({
            id: 't1', ref: 'CM-ABC234', email: 'client@test.com', name: 'Sophie', subject: 'GIF', status: 'OPEN',
        });

        const res = await request(app).post('/support/admin/tickets/t1/messages')
            .set(authHeader(admin)).send({ message: 'Voici la solution.', resolve: true });

        expect(res.status).toBe(201);
        expect(prisma.supportTicket.update.mock.calls[0][0].data.status).toBe('RESOLVED');
        expect(emailService.sendTicketReply).toHaveBeenCalledWith(
            'client@test.com', 'Sophie', 'CM-ABC234', 'GIF', 'Voici la solution.');
    });

    test('PATCH avec un thème invalide → 400', async () => {
        process.env.ADMIN_EMAILS = 'patron@chrono-mail.app';
        const admin = { ...USER, email: 'patron@chrono-mail.app' };
        mockLoggedIn(admin);
        const res = await request(app).patch('/support/admin/tickets/t1')
            .set(authHeader(admin)).send({ category: 'FACTURATION' });
        expect(res.status).toBe(400);
        expect(prisma.supportTicket.update).not.toHaveBeenCalled();
    });
});
