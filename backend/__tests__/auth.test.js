// ── Mock Prisma ──────────────────────────────────────────────────
jest.mock('../lib/prisma', () => ({
    user: {
        findUnique: jest.fn(),
    },
}));

const prisma = require('../lib/prisma');
const {
    hashPassword, verifyPassword, generateToken, verifyToken,
    requireAuth, requirePlan, isTokenRevoked,
} = require('../lib/auth');

// ── hashPassword / verifyPassword ────────────────────────────────
describe('hashPassword & verifyPassword', () => {
    test('hash puis verify → true', async () => {
        const hash = await hashPassword('monMotDePasse');
        expect(hash).not.toBe('monMotDePasse');
        expect(await verifyPassword('monMotDePasse', hash)).toBe(true);
    });

    test('mauvais mot de passe → false', async () => {
        const hash = await hashPassword('correct');
        expect(await verifyPassword('incorrect', hash)).toBe(false);
    });
});

// ── generateToken / verifyToken ──────────────────────────────────
describe('generateToken & verifyToken', () => {
    const fakeUser = { id: 'usr_1', email: 'test@test.com', plan: 'PRO' };

    test('génère un JWT valide', () => {
        const token   = generateToken(fakeUser);
        const payload = verifyToken(token);
        expect(payload.id).toBe('usr_1');
        expect(payload.email).toBe('test@test.com');
        expect(payload.plan).toBe('PRO');
    });

    test('token invalide → erreur', () => {
        expect(() => verifyToken('token_bidon')).toThrow();
    });
});

// ── requireAuth middleware ────────────────────────────────────────
describe('requireAuth', () => {
    const mockRes = () => {
        const res = { statusCode: 200 };
        res.status = (code) => { res.statusCode = code; return res; };
        res.json   = (data) => { res.body = data; return res; };
        return res;
    };

    beforeEach(() => jest.clearAllMocks());

    test('pas de header → 401', async () => {
        const req = { headers: {} };
        const res = mockRes();
        const next = jest.fn();
        await requireAuth(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('token valide + utilisateur existant → next() avec req.user à jour', async () => {
        const user  = { id: 'u1', email: 'a@b.com', plan: 'FREE' };
        const token = generateToken(user);
        const req   = { headers: { authorization: `Bearer ${token}` } };
        const res   = mockRes();
        const next  = jest.fn();
        // Le plan a changé en base depuis l'émission du token (ex. upgrade Stripe) :
        // requireAuth doit relire la valeur actuelle, pas celle du JWT.
        prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', plan: 'PRO' });
        await requireAuth(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.user.id).toBe('u1');
        expect(req.user.plan).toBe('PRO');
    });

    test('token valide mais utilisateur supprimé en base → 401', async () => {
        const user  = { id: 'u_deleted', email: 'gone@b.com', plan: 'FREE' };
        const token = generateToken(user);
        const req   = { headers: { authorization: `Bearer ${token}` } };
        const res   = mockRes();
        const next  = jest.fn();
        prisma.user.findUnique.mockResolvedValue(null);
        await requireAuth(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('token expiré/invalide → 401', async () => {
        const req  = { headers: { authorization: 'Bearer token_invalide' } };
        const res  = mockRes();
        const next = jest.fn();
        await requireAuth(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('token émis avant une révocation → 401 malgré un compte valide', async () => {
        const token = generateToken({ id: 'u1', email: 'a@b.com', plan: 'FREE' });
        const req   = { headers: { authorization: `Bearer ${token}` } };
        const res   = mockRes();
        const next  = jest.fn();
        // Le compte existe toujours — c'est bien le jeton qui est périmé,
        // scénario de la reprise de compte via Google.
        prisma.user.findUnique.mockResolvedValue({
            id: 'u1', email: 'a@b.com', plan: 'FREE',
            sessionsValidFrom: new Date(Date.now() + 60_000),
        });
        await requireAuth(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('token émis après la révocation → accepté', async () => {
        const token = generateToken({ id: 'u1', email: 'a@b.com', plan: 'FREE' });
        const req   = { headers: { authorization: `Bearer ${token}` } };
        const res   = mockRes();
        const next  = jest.fn();
        prisma.user.findUnique.mockResolvedValue({
            id: 'u1', email: 'a@b.com', plan: 'FREE',
            sessionsValidFrom: new Date(Date.now() - 3600_000),
        });
        await requireAuth(req, res, next);
        expect(next).toHaveBeenCalled();
        // Le champ interne ne doit pas fuiter dans req.user.
        expect(req.user).not.toHaveProperty('sessionsValidFrom');
    });
});

// ── Révocation des jetons ─────────────────────────────────────────
describe('isTokenRevoked', () => {
    const iatDe = date => Math.floor(date.getTime() / 1000);

    test('aucune révocation → jeton valable', () => {
        expect(isTokenRevoked({ iat: iatDe(new Date()) }, null)).toBe(false);
    });

    test('jeton antérieur à la révocation → révoqué', () => {
        const revocation = new Date();
        const avant      = iatDe(new Date(revocation.getTime() - 10_000));
        expect(isTokenRevoked({ iat: avant }, revocation)).toBe(true);
    });

    test('jeton postérieur à la révocation → valable', () => {
        const revocation = new Date();
        const apres      = iatDe(new Date(revocation.getTime() + 10_000));
        expect(isTokenRevoked({ iat: apres }, revocation)).toBe(false);
    });

    test('jeton sans iat → révoqué par précaution', () => {
        expect(isTokenRevoked({}, new Date())).toBe(true);
    });

    test('reconnexion dans la même seconde que la révocation → valable', () => {
        // Parcours courant : on réinitialise son mot de passe puis on se
        // reconnecte aussitôt. Comparer plus finement que la seconde
        // rejetterait ce jeton tout neuf.
        const revocation = new Date(1_700_000_000_750); // .750 ms
        const juste_apres = Math.floor(1_700_000_000_900 / 1000);
        expect(isTokenRevoked({ iat: juste_apres }, revocation)).toBe(false);
    });

    test('jeton de la seconde précédente → révoqué', () => {
        const revocation = new Date(1_700_000_000_750);
        const seconde_avant = Math.floor(1_700_000_000_750 / 1000) - 1;
        expect(isTokenRevoked({ iat: seconde_avant }, revocation)).toBe(true);
    });
});

// ── requirePlan middleware ────────────────────────────────────────
describe('requirePlan', () => {
    const mockRes = () => {
        const res = { statusCode: 200 };
        res.status = (code) => { res.statusCode = code; return res; };
        res.json   = (data) => { res.body = data; return res; };
        return res;
    };

    test('PRO accède à PRO → OK', () => {
        const middleware = requirePlan('PRO');
        const req  = { user: { plan: 'PRO' } };
        const res  = mockRes();
        const next = jest.fn();
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    test('BUSINESS accède à PRO → OK', () => {
        const middleware = requirePlan('PRO');
        const req  = { user: { plan: 'BUSINESS' } };
        const res  = mockRes();
        const next = jest.fn();
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    test('FREE accède à PRO → 403', () => {
        const middleware = requirePlan('PRO');
        const req  = { user: { plan: 'FREE' } };
        const res  = mockRes();
        const next = jest.fn();
        middleware(req, res, next);
        expect(res.statusCode).toBe(403);
        expect(next).not.toHaveBeenCalled();
    });
});
