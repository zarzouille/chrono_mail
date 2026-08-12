/**
 * support-labels.js — Libellés des thèmes et statuts de tickets
 * ============================================================
 * Source unique partagée par les routes (validation), les emails
 * (objet et corps) et la console d'assistance. Les clés doivent rester
 * alignées sur les enums TicketCategory / TicketStatus de schema.prisma.
 */

const CATEGORY_LABELS = {
    TECHNICAL: 'Support technique',
    BILLING:   'Facturation',
    PRIVACY:   'Données personnelles',
    BUG:       'Signalement de bug',
    FEATURE:   'Suggestion de fonctionnalité',
    OTHER:     'Autre',
};

const STATUS_LABELS = {
    OPEN:     'À traiter',
    PENDING:  'En attente du client',
    RESOLVED: 'Résolu',
    CLOSED:   'Clos',
};

const CATEGORIES = Object.keys(CATEGORY_LABELS);
const STATUSES   = Object.keys(STATUS_LABELS);

function categoryLabel(key) { return CATEGORY_LABELS[key] || CATEGORY_LABELS.OTHER; }
function statusLabel(key)   { return STATUS_LABELS[key]   || key; }

module.exports = { CATEGORY_LABELS, STATUS_LABELS, CATEGORIES, STATUSES, categoryLabel, statusLabel };
