require('dotenv').config();
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function setup() {
    console.log('🔧 Création des produits Stripe...\n');

    // ── Plan PRO ──────────────────────────────────────────────────
    const pro = await stripe.products.create({
        name:        'Chronomail Pro',
        description: 'Countdowns illimités, 10 styles, labels personnalisés, image de fond, analytiques',
    });

    const proPriceMonthly = await stripe.prices.create({
        product:     pro.id,
        unit_amount: 900, // 9,00€
        currency:    'eur',
        recurring:   { interval: 'month' },
        nickname:    'Pro Mensuel',
    });

    const proPriceYearly = await stripe.prices.create({
        product:     pro.id,
        unit_amount: 7900, // 79,00€/an (~6,58€/mois)
        currency:    'eur',
        recurring:   { interval: 'year' },
        nickname:    'Pro Annuel',
    });

    // ── Plan BUSINESS ─────────────────────────────────────────────
    const business = await stripe.products.create({
        name:        'Chronomail Business',
        description: 'Tout Pro + timer perpétuel et style Neon',
    });

    const businessPriceMonthly = await stripe.prices.create({
        product:     business.id,
        unit_amount: 2900, // 29,00€
        currency:    'eur',
        recurring:   { interval: 'month' },
        nickname:    'Business Mensuel',
    });

    const businessPriceYearly = await stripe.prices.create({
        product:     business.id,
        unit_amount: 24900, // 249,00€/an (~20,75€/mois)
        currency:    'eur',
        recurring:   { interval: 'year' },
        nickname:    'Business Annuel',
    });

    console.log('✅ Produits créés !\n');
    console.log('Ajoutez ces variables dans votre .env :\n');
    console.log(`STRIPE_PRO_PRICE_MONTHLY="${proPriceMonthly.id}"`);
    console.log(`STRIPE_PRO_PRICE_YEARLY="${proPriceYearly.id}"`);
    console.log(`STRIPE_BUSINESS_PRICE_MONTHLY="${businessPriceMonthly.id}"`);
    console.log(`STRIPE_BUSINESS_PRICE_YEARLY="${businessPriceYearly.id}"`);
}

setup().catch(console.error);