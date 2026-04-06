const { hashPassword, verifyPassword, generateToken, verifyToken, requireAuth, requirePlan } = require('../lib/auth');

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

    test('pas de header → 401', () => {
        const req = { headers: {} };
        const res = mockRes();
        const next = jest.fn();
        requireAuth(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('token valide → next() avec req.user', () => {
        const user  = { id: 'u1', email: 'a@b.com', plan: 'FREE' };
        const token = generateToken(user);
        const req   = { headers: { authorization: `Bearer ${token}` } };
        const res   = mockRes();
        const next  = jest.fn();
        requireAuth(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.user.id).toBe('u1');
    });

    test('token expiré/invalide → 401', () => {
        const req  = { headers: { authorization: 'Bearer token_invalide' } };
        const res  = mockRes();
        const next = jest.fn();
        requireAuth(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
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
