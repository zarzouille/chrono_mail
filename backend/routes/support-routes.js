/**
 * support-routes.js — Ticketing client Chronomail
 * ============================================================
 * Deux surfaces :
 *   /support/…        → côté client (dépôt d'une demande, suivi, réponses)
 *   /support/admin/…  → console d'assistance, réservée à ADMIN_EMAILS
 *
 * Le dépôt d'une demande est volontairement ouvert aux visiteurs non
 * connectés : un client qui n'arrive plus à se connecter reste un client
 * à qui il faut répondre.
 */
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const prisma  = require('../lib/prisma');
const { requireAuth, optionalAuth, requireAdmin } = require('../lib/auth');
const { CATEGORIES, STATUSES, CATEGORY_LABELS, STATUS_LABELS } = require('../lib/support-labels');
const { sendTicketReceived, sendTicketReply, sendAdminTicketAlert } = require('../services/email-service');

const SUBJECT_MAX = 150;
const MESSAGE_MAX = 5000;
const MESSAGE_MIN = 10;

// Alphabet sans caractères ambigus (ni 0/O, ni 1/I) : la référence est
// destinée à être relue et recopiée à la main dans un email.
const REF_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Génère une référence courte et unique (CM-XXXXXX).
 * Collision improbable (32^6 ≈ 1e9) mais possible : on retente plutôt
 * que de laisser remonter une erreur de contrainte unique au client.
 */
async function generateRef() {
    for (let attempt = 0; attempt < 5; attempt++) {
        const bytes = crypto.randomBytes(6);
        const code  = Array.from(bytes, b => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
        const ref   = `CM-${code}`;
        const taken = await prisma.supportTicket.findUnique({ where: { ref }, select: { id: true } });
        if (!taken) return ref;
    }
    throw new Error('Impossible de générer une référence de ticket unique');
}

function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Vue renvoyée au client : ni notes internes, ni identité du répondant.
const TICKET_SELECT = {
    id: true, ref: true, category: true, subject: true, status: true,
    email: true, name: true, createdAt: true, lastMessageAt: true, resolvedAt: true,
};

// ── Métadonnées (thèmes et statuts) ───────────────────────────────
// Le formulaire de contact est public : il doit pouvoir peupler sa liste
// de thèmes sans être connecté.
router.get('/support/meta', (req, res) => {
    res.json({ categories: CATEGORY_LABELS, statuses: STATUS_LABELS });
});


// ── Déposer une demande ───────────────────────────────────────────
router.post('/support/tickets', optionalAuth, async (req, res) => {
    try {
        const { category, subject, message, website } = req.body;

        // Champ piège invisible pour les humains : seul un robot le remplit.
        if (website) return res.status(201).json({ ok: true });

        const email = (req.user?.email || req.body.email || '').trim();
        const name  = (req.body.name || req.user?.name || '').trim() || null;

        if (!isValidEmail(email))     return res.status(400).json({ error: 'Adresse email invalide' });
        if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Thème de demande invalide' });

        const cleanSubject = (subject || '').trim();
        const cleanMessage = (message || '').trim();
        if (cleanSubject.length < 3)             return res.status(400).json({ error: 'Objet trop court' });
        if (cleanSubject.length > SUBJECT_MAX)   return res.status(400).json({ error: `Objet trop long (${SUBJECT_MAX} caractères maximum)` });
        if (cleanMessage.length < MESSAGE_MIN)   return res.status(400).json({ error: `Message trop court (${MESSAGE_MIN} caractères minimum)` });
        if (cleanMessage.length > MESSAGE_MAX)   return res.status(400).json({ error: `Message trop long (${MESSAGE_MAX} caractères maximum)` });

        const ref    = await generateRef();
        const ticket = await prisma.supportTicket.create({
            data: {
                ref,
                userId:         req.user?.id || null,
                email,
                name,
                category,
                subject:        cleanSubject,
                planAtCreation: req.user?.plan || null,
                messages: { create: { author: 'CUSTOMER', body: cleanMessage } },
            },
            select: TICKET_SELECT,
        });

        res.status(201).json({ ref: ticket.ref, id: ticket.id });

        // Emails non bloquants : une demande enregistrée ne doit pas être
        // perdue parce que Resend est indisponible.
        sendTicketReceived(email, name, ticket.ref, category, cleanSubject, cleanMessage).catch(() => {});
        sendAdminTicketAlert({ ...ticket, planAtCreation: req.user?.plan || null, userId: req.user?.id || null }, cleanMessage, true).catch(() => {});

    } catch (err) {
        console.error('Erreur création ticket :', err);
        res.status(500).json({ error: 'Erreur lors de l\'envoi de votre demande' });
    }
});


// ── Mes demandes ──────────────────────────────────────────────────
router.get('/support/tickets', requireAuth, async (req, res) => {
    try {
        const tickets = await prisma.supportTicket.findMany({
            where:   { userId: req.user.id },
            orderBy: { lastMessageAt: 'desc' },
            select:  { ...TICKET_SELECT, _count: { select: { messages: true } } },
        });
        res.json(tickets);
    } catch (err) {
        console.error('Erreur liste tickets :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ── Détail d'une de mes demandes ──────────────────────────────────
router.get('/support/tickets/:id', requireAuth, async (req, res) => {
    try {
        const ticket = await prisma.supportTicket.findFirst({
            where:  { id: req.params.id, userId: req.user.id },
            select: {
                ...TICKET_SELECT,
                messages: { orderBy: { createdAt: 'asc' }, select: { id: true, author: true, body: true, createdAt: true } },
            },
        });
        if (!ticket) return res.status(404).json({ error: 'Demande introuvable' });
        res.json(ticket);
    } catch (err) {
        console.error('Erreur détail ticket :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ── Répondre à une de mes demandes ────────────────────────────────
router.post('/support/tickets/:id/messages', requireAuth, async (req, res) => {
    try {
        const body = (req.body.message || '').trim();
        if (body.length < 1)           return res.status(400).json({ error: 'Message vide' });
        if (body.length > MESSAGE_MAX) return res.status(400).json({ error: `Message trop long (${MESSAGE_MAX} caractères maximum)` });

        const ticket = await prisma.supportTicket.findFirst({
            where:  { id: req.params.id, userId: req.user.id },
            select: TICKET_SELECT,
        });
        if (!ticket) return res.status(404).json({ error: 'Demande introuvable' });
        if (ticket.status === 'CLOSED') {
            return res.status(409).json({ error: 'Cette demande est close — ouvrez-en une nouvelle' });
        }

        const now = new Date();
        await prisma.$transaction([
            prisma.supportMessage.create({ data: { ticketId: ticket.id, author: 'CUSTOMER', body } }),
            // Toute relance client repasse le ticket à traiter, y compris
            // sur un ticket marqué résolu : c'est le signal qu'il ne l'était pas.
            prisma.supportTicket.update({
                where: { id: ticket.id },
                data:  { status: 'OPEN', lastMessageAt: now, resolvedAt: null },
            }),
        ]);

        res.status(201).json({ ok: true });
        sendAdminTicketAlert(ticket, body, false).catch(() => {});

    } catch (err) {
        console.error('Erreur réponse ticket :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});


// ================================================================
//  CONSOLE D'ASSISTANCE (ADMIN_EMAILS uniquement)
// ================================================================

// ── File d'attente, filtrable par thème et par statut ─────────────
router.get('/support/admin/tickets', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { status, category, q } = req.query;
        const where = {};
        if (STATUSES.includes(status))      where.status   = status;
        if (CATEGORIES.includes(category))  where.category = category;
        if (q && q.trim()) {
            const term = q.trim();
            where.OR = [
                { ref:     { contains: term, mode: 'insensitive' } },
                { subject: { contains: term, mode: 'insensitive' } },
                { email:   { contains: term, mode: 'insensitive' } },
            ];
        }

        const [tickets, byCategory, byStatus] = await Promise.all([
            prisma.supportTicket.findMany({
                where,
                orderBy: { lastMessageAt: 'desc' },
                take:    200,
                select:  { ...TICKET_SELECT, planAtCreation: true, userId: true, _count: { select: { messages: true } } },
            }),
            // Compteurs pour les filtres : calculés sur les demandes encore
            // en cours, seules celles qui appellent une action.
            prisma.supportTicket.groupBy({
                by: ['category'], _count: { _all: true },
                where: { status: { in: ['OPEN', 'PENDING'] } },
            }),
            prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
        ]);

        res.json({
            tickets,
            counts: {
                category: Object.fromEntries(byCategory.map(r => [r.category, r._count._all])),
                status:   Object.fromEntries(byStatus.map(r   => [r.status,   r._count._all])),
            },
        });
    } catch (err) {
        console.error('Erreur file support :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ── Détail admin ──────────────────────────────────────────────────
router.get('/support/admin/tickets/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const ticket = await prisma.supportTicket.findUnique({
            where:  { id: req.params.id },
            select: {
                ...TICKET_SELECT, planAtCreation: true, userId: true,
                messages: { orderBy: { createdAt: 'asc' }, select: { id: true, author: true, body: true, createdAt: true } },
            },
        });
        if (!ticket) return res.status(404).json({ error: 'Ticket introuvable' });
        res.json(ticket);
    } catch (err) {
        console.error('Erreur détail ticket admin :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ── Répondre à un client ──────────────────────────────────────────
router.post('/support/admin/tickets/:id/messages', requireAuth, requireAdmin, async (req, res) => {
    try {
        const body = (req.body.message || '').trim();
        if (body.length < 1)           return res.status(400).json({ error: 'Message vide' });
        if (body.length > MESSAGE_MAX) return res.status(400).json({ error: `Message trop long (${MESSAGE_MAX} caractères maximum)` });

        const ticket = await prisma.supportTicket.findUnique({
            where:  { id: req.params.id },
            select: TICKET_SELECT,
        });
        if (!ticket) return res.status(404).json({ error: 'Ticket introuvable' });

        // `resolve: true` permet de répondre et clore en une seule action,
        // le cas de loin le plus fréquent.
        const resolve = req.body.resolve === true;
        const now     = new Date();

        await prisma.$transaction([
            prisma.supportMessage.create({ data: { ticketId: ticket.id, author: 'SUPPORT', body } }),
            prisma.supportTicket.update({
                where: { id: ticket.id },
                data: {
                    status:        resolve ? 'RESOLVED' : 'PENDING',
                    lastMessageAt: now,
                    resolvedAt:    resolve ? now : null,
                },
            }),
        ]);

        res.status(201).json({ ok: true, status: resolve ? 'RESOLVED' : 'PENDING' });
        sendTicketReply(ticket.email, ticket.name, ticket.ref, ticket.subject, body).catch(() => {});

    } catch (err) {
        console.error('Erreur réponse admin :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ── Reclasser / changer le statut ─────────────────────────────────
router.patch('/support/admin/tickets/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { status, category } = req.body;
        const data = {};
        if (status !== undefined) {
            if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Statut invalide' });
            data.status     = status;
            data.resolvedAt = status === 'RESOLVED' || status === 'CLOSED' ? new Date() : null;
        }
        if (category !== undefined) {
            if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Thème invalide' });
            data.category = category;
        }
        if (!Object.keys(data).length) return res.status(400).json({ error: 'Rien à modifier' });

        const ticket = await prisma.supportTicket.update({
            where:  { id: req.params.id },
            data,
            select: TICKET_SELECT,
        });
        res.json(ticket);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Ticket introuvable' });
        console.error('Erreur mise à jour ticket :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
