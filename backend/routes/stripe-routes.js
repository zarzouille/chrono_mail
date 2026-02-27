const express = require('express');
const router  = express.Router();
const Stripe  = require('stripe');
const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY);
const prisma  = require('../lib/prisma');
const { requireAuth } = require('../lib/auth');

const PRICES = {
    pro_monthly:      process.env.STRIPE_PRO_PRICE_MONTHLY,
    pro_yearly:       process.env.STRIPE_PRO_PRICE_YEARLY,
    business_monthly: process.env.STRIPE_BUSINESS_PRICE_MONTHLY,
    business_yearly:  process.env.STRIPE_BUSINESS_PRICE_YEARLY,
};

const PLAN_BY_PRICE = {
    [process.env.STRIPE_PRO_PRICE_MONTHLY]:      'PRO',
    [process.env.STRIPE_PRO_PRICE_YEARLY]:       'PRO',
    [process.env.STRIPE_BUSINESS_PRICE_MONTHLY]: 'BUSINESS',
    [process.env.STRIPE_BUSINESS_PRICE_YEARLY]:  'BUSINESS',
};

// ── Créer une session Checkout ────────────────────────────────────
router.post('/stripe/checkout', requireAuth, async (req, res) => {
    try {
        const { priceKey } = req.body;
        const priceId = PRICES[priceKey];
        if (!priceId) return res.status(400).json({ error: 'Plan invalide' });

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });

        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name:  user.name || undefined,
                metadata: { userId: user.id },
            });
            customerId = customer.id;
            await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
        }

        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        const session = await stripe.checkout.sessions.create({
            customer:              customerId,
            payment_method_types:  ['card'],
            line_items:            [{ price: priceId, quantity: 1 }],
            mode:                  'subscription',
            success_url:           `${appUrl}/?checkout=success`,
            cancel_url:            `${appUrl}/?checkout=cancelled`,
            allow_promotion_codes: true,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('Erreur checkout :', err);
        res.status(500).json({ error: 'Erreur lors de la création du paiement' });
    }
});

// ── Portail client ────────────────────────────────────────────────
router.post('/stripe/portal', requireAuth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user.stripeCustomerId) return res.status(400).json({ error: 'Aucun abonnement actif' });

        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        const session = await stripe.billingPortal.sessions.create({
            customer:   user.stripeCustomerId,
            return_url: appUrl,
        });
        res.json({ url: session.url });
    } catch (err) {
        console.error('Erreur portail :', err);
        res.status(500).json({ error: 'Erreur portail de facturation' });
    }
});

// ── Webhook ───────────────────────────────────────────────────────
router.post('/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
        console.log('🔔 Webhook reçu !', req.headers['stripe-signature'] ? 'signature présente' : 'PAS DE SIGNATURE');

        const sig    = req.headers['stripe-signature'];
        const secret = process.env.STRIPE_WEBHOOK_SECRET;

        let event;
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, secret);
        } catch (err) {
            console.error('Webhook signature invalide :', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        try {
            switch (event.type) {

                case 'checkout.session.completed': {
                    const session = event.data.object;
                    if (session.mode !== 'subscription') break;

                    const subscriptionId = session.subscription;
                    if (!subscriptionId) { console.warn('Pas de subscription id dans session'); break; }

                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    const priceId      = subscription.items.data[0].price.id;
                    const plan         = PLAN_BY_PRICE[priceId] || 'PRO';

                    // current_period_end est un timestamp Unix (secondes)
                    const periodEnd = subscription.current_period_end
                        ? new Date(subscription.current_period_end * 1000)
                        : null;

                    await prisma.user.update({
                        where: { stripeCustomerId: session.customer },
                        data: {
                            plan,
                            stripeSubscriptionId:   subscription.id,
                            stripePriceId:          priceId,
                            ...(periodEnd ? { stripeCurrentPeriodEnd: periodEnd } : {}),
                        },
                    });
                    console.log(`✅ Plan activé : ${plan} pour customer ${session.customer}`);
                    break;
                }

                case 'invoice.paid': {
                    const invoice = event.data.object;
                    const subscriptionId = invoice.subscription;
                    if (!subscriptionId) break;

                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    const priceId      = subscription.items.data[0].price.id;
                    const periodEnd    = subscription.current_period_end
                        ? new Date(subscription.current_period_end * 1000)
                        : null;

                    await prisma.user.update({
                        where: { stripeCustomerId: invoice.customer },
                        data: {
                            stripePriceId: priceId,
                            ...(periodEnd ? { stripeCurrentPeriodEnd: periodEnd } : {}),
                        },
                    });
                    break;
                }

                case 'invoice.payment_failed': {
                    console.warn(`⚠️ Paiement échoué pour customer ${event.data.object.customer}`);
                    break;
                }

                case 'customer.subscription.deleted': {
                    const sub = event.data.object;
                    await prisma.user.update({
                        where: { stripeCustomerId: sub.customer },
                        data: {
                            plan:                   'FREE',
                            stripeSubscriptionId:   null,
                            stripePriceId:          null,
                            stripeCurrentPeriodEnd: null,
                        },
                    });
                    console.log(`🔄 Abonnement annulé pour customer ${sub.customer}`);
                    break;
                }
            }
        } catch (err) {
            console.error('Erreur traitement webhook :', err);
            return res.status(500).send('Erreur traitement webhook');
        }

        res.json({ received: true });
    }
);

module.exports = router;