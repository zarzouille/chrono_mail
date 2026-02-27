const jwt    = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const JWT_SECRET  = process.env.JWT_SECRET || 'dev_secret_change_in_production';
const JWT_EXPIRES = '7d';
const SALT_ROUNDS = 10;

// ── Hash mot de passe ─────────────────────────────────────────────
async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

// ── Vérifier mot de passe ─────────────────────────────────────────
async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// ── Générer un token JWT ──────────────────────────────────────────
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, plan: user.plan },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
    );
}

// ── Vérifier un token JWT ─────────────────────────────────────────
function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

// ── Middleware Express : protège les routes ───────────────────────
function requireAuth(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    const token = header.slice(7);

    try {
        const payload = verifyToken(token);
        req.user = payload; // { id, email, plan }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
}

// ── Middleware : limites du plan Free ─────────────────────────────
function requirePlan(minPlan) {
    const hierarchy = { FREE: 0, PRO: 1, BUSINESS: 2 };
    return (req, res, next) => {
        const userLevel = hierarchy[req.user?.plan] ?? 0;
        const required  = hierarchy[minPlan] ?? 0;
        if (userLevel >= required) return next();
        return res.status(403).json({
            error:   'Plan insuffisant',
            current: req.user?.plan,
            required: minPlan,
        });
    };
}

module.exports = { hashPassword, verifyPassword, generateToken, verifyToken, requireAuth, requirePlan };