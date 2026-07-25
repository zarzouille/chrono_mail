/**
 * Tests du webhook Stripe — annulation volontaire.
 *
 * Le point sensible : cancel_at_period_end reste à true sur tous les
 * customer.subscription.updated qui suivent une annulation. Seule la
 * transition false → true doit déclencher l'email de confirmation.
 */
const request = require('supertest');
const express = require('express');

// Signature Stripe : on court-circuite la vérification et on renvoie
// l'événement fourni par le test dans le header de test.
jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        webhooks: {
            constructEvent: (body) => JSON.parse(body.toString()),
        },
    }));
});

jest.mock('../lib/prisma', () => ({
    user: {
        findUnique: jest.fn(),
        update:     jest.fn().mockResolvedValue({}),
    },
}));

jest.mock('../services/email-service', () => ({
    sendUpgradeConfirmed:      jest.fn().mockResolvedValue({}),
    sendPaymentFailed:         jest.fn().mockResolvedValue({}),
    sendCancellationConfirmed: jest.fn().mockResolvedValue({}),
    sendDowngraded:            jest.fn().mockResolvedValue({}),
}));

const prisma = require('../lib/prisma');
const { sendCancellationConfirmed } = require('../services/email-service');
const stripeRoutes = require('../routes/stripe-routes');

const app = express();
app.use('/', stripeRoutes);

const USER = { id: 'user_1', email: 'sophie@exemple.fr', name: 'Sophie', stripeCustomerId: 'cus_1' };
const PERIOD_END = 1789000000; // epoch secondes

/** Construit un événement subscription.updated. */
function updatedEvent({ cancelAtPeriodEnd, previous }) {
    return {
        type: 'customer.subscription.updated',
        data: {
            object: {
                id:       'sub_1',
                customer: 'cus_1',
                cancel_at_period_end: cancelAtPeriodEnd,
                current_period_end:   PERIOD_END,
                items: { data: [{ price: { id: 'price_pro_monthly' } }] },
            },
            ...(previous !== undefined ? { previous_attributes: previous } : {}),
        },
    };
}

function post(event) {
    // Chaîne brute, pas un Buffer : superagent sérialiserait le Buffer
    // en JSON ({"type":"Buffer","data":[...]}) et l'événement arriverait
    // méconnaissable côté route.
    return request(app)
        .post('/stripe/webhook')
        .set('stripe-signature', 'test')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(event));
}

beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(USER);
});

describe('Webhook — annulation volontaire', () => {
    test('envoie la confirmation sur la transition false → true', async () => {
        const res = await post(updatedEvent({
            cancelAtPeriodEnd: true,
            previous: { cancel_at_period_end: false },
        }));

        expect(res.status).toBe(200);
        expect(sendCancellationConfirmed).toHaveBeenCalledTimes(1);

        const [email, name, periodEnd] = sendCancellationConfirmed.mock.calls[0];
        expect(email).toBe('sophie@exemple.fr');
        expect(name).toBe('Sophie');
        expect(periodEnd).toEqual(new Date(PERIOD_END * 1000));
    });

    test('n\'envoie rien quand cancel_at_period_end était déjà true', async () => {
        // Cas réel : renouvellement ou changement de carte sur un
        // abonnement déjà résilié — previous_attributes ne contient
        // alors pas cancel_at_period_end.
        await post(updatedEvent({
            cancelAtPeriodEnd: true,
            previous: { default_payment_method: 'pm_ancien' },
        }));

        expect(sendCancellationConfirmed).not.toHaveBeenCalled();
    });

    test('n\'envoie rien sans previous_attributes', async () => {
        await post(updatedEvent({ cancelAtPeriodEnd: true }));

        expect(sendCancellationConfirmed).not.toHaveBeenCalled();
    });

    test('n\'envoie rien lors d\'un changement de plan classique', async () => {
        await post(updatedEvent({
            cancelAtPeriodEnd: false,
            previous: { items: {} },
        }));

        expect(sendCancellationConfirmed).not.toHaveBeenCalled();
    });

    test('ne tente rien si le customer est inconnu en base', async () => {
        prisma.user.findUnique.mockResolvedValue(null);

        const res = await post(updatedEvent({
            cancelAtPeriodEnd: true,
            previous: { cancel_at_period_end: false },
        }));

        expect(res.status).toBe(200);
        expect(sendCancellationConfirmed).not.toHaveBeenCalled();
    });

    test('réactivation puis nouvelle annulation → un second email', async () => {
        await post(updatedEvent({
            cancelAtPeriodEnd: true,
            previous: { cancel_at_period_end: false },
        }));
        // Réactivation : true → false, aucun email
        await post(updatedEvent({
            cancelAtPeriodEnd: false,
            previous: { cancel_at_period_end: true },
        }));
        // Nouvelle annulation : l'utilisateur doit être reconfirmé
        await post(updatedEvent({
            cancelAtPeriodEnd: true,
            previous: { cancel_at_period_end: false },
        }));

        expect(sendCancellationConfirmed).toHaveBeenCalledTimes(2);
    });
});
