const User = require('../Models/User');
const Wallet = require('../Models/Wallet');
const Gamification = require('../Models/Gamification');
const Notification = require('../Models/Notification');
const pool = require('../../database/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function signToken(user) {
    return jwt.sign(
        { id: user.id, name: user.name, country: user.country, role: user.role || 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

const AuthController = {
    async register(req, res) {
        const client = await pool.connect();
        try {
            const { name, username, email, password, phone, country, language, referralCode } = req.body;

            if (!name || !username || !email || !password) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
}
if (password.length < 6) {
    return res.status(400).json({ error: "Senha muito fraca. Use pelo menos 6 caracteres." });
}
if (username.length < 4 || !/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: "Nome de usuário deve ter pelo menos 4 caracteres e conter apenas letras, números ou underscore." });
}
if (phone && !/^\+?[0-9]{8,15}$/.test(phone.replace(/\s/g, ''))) {
    return res.status(400).json({ error: "Número de telefone inválido. Use só dígitos (mínimo 8, ex: +258841234567)." });
}
            }

            const emailExists = await User.findByEmail(email);
            if (emailExists) {
                return res.status(400).json({ error: "Este e-mail já está cadastrado." });
            }
            const usernameExists = await User.findByUsername(username);
            if (usernameExists) {
                return res.status(400).json({ error: "Este nome de usuário já está em uso." });
            }

            let referredBy = null;
            if (referralCode) {
                const referrer = await User.findByReferralCode(referralCode.trim().toUpperCase());
                if (referrer) referredBy = referrer.id;
            }

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            await client.query('BEGIN');

            const newUser = await User.create({
                name, username, email, passwordHash, phone, country, language, referredBy
            }, client);

            await Wallet.create(newUser.id, client);
            await Gamification.ensureProgress(newUser.id, client);

            if (referredBy) {
                await client.query(
                    `INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2);`,
                    [referredBy, newUser.id]
                );
                await Notification.create(referredBy, {
                    category: 'activity',
                    title: 'Novo indicado!',
                    message: `${name} criou uma conta usando o seu código de indicação.`
                }, client);
            }

            await Notification.create(newUser.id, {
                category: 'activity',
                title: 'Bem-vindo(a) à plataforma!',
                message: 'A sua conta foi criada com sucesso. Comece a responder quizzes e ganhe recompensas.'
            }, client);

            await client.query('COMMIT');

            const token = signToken({ ...newUser, role: 'user' });

            return res.status(201).json({
                message: "Conta criada com sucesso!",
                token,
                user: newUser
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(error);
            return res.status(500).json({ error: "Erro interno ao registrar usuário." });
        } finally {
            client.release();
        }
    },

    async login(req, res) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: "Informe e-mail e senha." });
            }

            const user = await User.findByEmail(email);
            if (!user) {
                return res.status(400).json({ error: "E-mail ou senha incorretos." });
            }

            if (user.account_status === 'blocked') {
                return res.status(403).json({ error: "Esta conta está bloqueada. Contacte o suporte." });
            }

            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(400).json({ error: "E-mail ou senha incorretos." });
            }

            await User.updateLastLogin(user.id);

            const token = signToken(user);

            return res.json({
                message: "Login realizado com sucesso!",
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    email: user.email,
                    country: user.country,
                    language: user.language,
                    role: user.role,
                    is_premium: user.is_premium,
                    referral_code: user.referral_code
                }
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro interno ao realizar login." });
        }
    }
};

module.exports = AuthController;
