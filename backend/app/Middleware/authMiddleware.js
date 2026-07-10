const jwt = require('jsonwebtoken');

const protectRoute = (req, res, next) => {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: "Acesso negado. Token de autenticação não fornecido." });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Sessão inválida ou expirada. Faça login novamente." });
    }
};

const adminOnly = (allowedRoles = ['admin', 'moderator', 'financeiro']) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: "Acesso restrito à administração." });
        }
        next();
    };
};

module.exports = { protectRoute, adminOnly };
