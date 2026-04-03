const express = require('express');
const router  = express.Router();
const Stripe  = require('stripe');
const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY);
const prisma  = require('../lib/prisma');
const { requireAuth } = require('../lib/auth');
const { sendUpgradeConfirmed, sendPaymentFailed, sendDowngraded } = require('../services/email-service');

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

                    const user = await prisma.user.findUnique({ where: { stripeCustomerId: session.customer } });
                    if (!user) { console.warn(`⚠️ checkout.session.completed — customer ${session.customer} inconnu en DB`); break; }

                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    const priceId      = subscription.items.data[0].price.id;
                    const plan         = PLAN_BY_PRICE[priceId] || 'PRO';

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

                    // Email de confirmation d'upgrade (non bloquant)
                    const upgraded = await prisma.user.findUnique({ where: { stripeCustomerId: session.customer } });
                    if (upgraded) sendUpgradeConfirmed(upgraded.email, upgraded.name, plan).catch(() => {});

                    break;
                }

                case 'invoice.paid': {
                    const invoice = event.data.object;
                    const subscriptionId = invoice.subscription;
                    if (!subscriptionId) break;

                    const user = await prisma.user.findUnique({ where: { stripeCustomerId: invoice.customer } });
                    if (!user) { console.warn(`⚠️ invoice.paid — customer ${invoice.customer} inconnu en DB`); break; }

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
                    const invoice = event.data.object;
                    const attempt = invoice.attempt_count || 1;
                    console.warn(`⚠️ Paiement échoué (tentative ${attempt}) pour customer ${invoice.customer}`);

                    // Après 3 tentatives échouées, Stripe annulera l'abonnement
                    // automatiquement (si configuré). On log pour suivi.
                    if (attempt >= 3) {
                        console.warn(`🚨 3+ échecs de paiement pour customer ${invoice.customer} — abonnement en danger`);
                    }

                    // Email d'alerte paiement échoué (non bloquant)
                    const failedUser = await prisma.user.findUnique({ where: { stripeCustomerId: invoice.customer } });
                    if (failedUser) sendPaymentFailed(failedUser.email, failedUser.name, attempt).catch(() => {});

                    break;
                }

                case 'customer.subscription.updated': {
                    const sub = event.data.object;
                    const user = await prisma.user.findUnique({ where: { stripeCustomerId: sub.customer } });
                    if (!user) { console.warn(`⚠️ subscription.updated — customer ${sub.customer} inconnu en DB`); break; }

                    const priceId  = sub.items.data[0].price.id;
                    const newPlan  = PLAN_BY_PRICE[priceId] || 'PRO';
                    const periodEnd = sub.current_period_end
                        ? new Date(sub.current_period_end * 1000)
                        : null;

                    if (sub.cancel_at_period_end) {
                        // L'utilisateur a demandé l'annulation — l'abonnement reste actif
                        // jusqu'à la fin de la période, puis Stripe enverra subscription.deleted
                        console.log(`⏳ Annulation programmée pour customer ${sub.customer} (fin : ${periodEnd?.toISOString()})`);
                    } else {
                        // Changement de plan (upgrade/downgrade) ou réactivation après annulation
                        await prisma.user.update({
                            where: { stripeCustomerId: sub.customer },
                            data: {
                                plan: newPlan,
                                stripeSubscriptionId:   sub.id,
                                stripePriceId:          priceId,
                                ...(periodEnd ? { stripeCurrentPeriodEnd: periodEnd } : {}),
                            },
                        });
                        console.log(`🔀 Abonnement mis à jour : ${newPlan} pour customer ${sub.customer}`);
                    }
                    break;
                }

                case 'customer.subscription.deleted': {
                    const sub = event.data.object;
                    const user = await prisma.user.findUnique({ where: { stripeCustomerId: sub.customer } });
                    if (!user) { console.warn(`⚠️ subscription.deleted — customer ${sub.customer} inconnu en DB`); break; }

                    await prisma.user.update({
                        where: { stripeCustomerId: sub.customer },
                        data: {
                            plan:                   'FREE',
                            stripeSubscriptionId:   null,
                            stripePriceId:          null,
                            stripeCurrentPeriodEnd: null,
                        },
                    });
                    console.log(`🔄 Abonnement supprimé → FREE pour customer ${sub.customer}`);

                    // Email de downgrade (non bloquant)
                    const downgraded = await prisma.user.findUnique({ where: { stripeCustomerId: sub.customer } });
                    if (downgraded) sendDowngraded(downgraded.email, downgraded.name).catch(() => {});

                    break;
                }
            }
        } catch (err) {
            // Toujours renvoyer 200 à Stripe pour éviter les retries en boucle
            console.error('Erreur traitement webhook :', err);
        }

        res.json({ received: true });
    }
);

module.exports = router;