const pool = require('../../database/db');

function generateReferralCode(name) {
    const base = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'USER';
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `${base}${suffix}`;
}

const User = {
    async create({ name, username, email, passwordHash, phone, country, language, referredBy }, client = pool) {
        const referralCode = generateReferralCode(name);
        const query = `
            INSERT INTO users (name, username, email, password_hash, phone, country, language, referred_by, referral_code)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, name, username, email, country, language, referral_code, role, created_at;
        `;
        const values = [name, username, email, passwordHash, phone || null, country || 'Moçambique', language || 'pt', referredBy || null, referralCode];
        const { rows } = await client.query(query, values);
        return rows[0];
    },

    async findByEmail(email) {
        const { rows } = await pool.query('SELECT * FROM users WHERE email = $1;', [email]);
        return rows[0];
    },

    async findByUsername(username) {
        const { rows } = await pool.query('SELECT * FROM users WHERE username = $1;', [username]);
        return rows[0];
    },

    async findByReferralCode(code) {
        const { rows } = await pool.query('SELECT * FROM users WHERE referral_code = $1;', [code]);
        return rows[0];
    },

    async findById(id) {
        const { rows } = await pool.query(
            `SELECT id, name, username, email, phone, country, language, avatar_url, role,
                    account_status, referral_code, is_premium, created_at
             FROM users WHERE id = $1;`, [id]);
        return rows[0];
    },

    async updateLastLogin(id) {
        await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1;', [id]);
    },

    async updateProfile(id, { name, phone, language, avatarUrl }) {
        const { rows } = await pool.query(
            `UPDATE users SET
                name = COALESCE($1, name),
                phone = COALESCE($2, phone),
                language = COALESCE($3, language),
                avatar_url = COALESCE($4, avatar_url)
             WHERE id = $5
             RETURNING id, name, username, email, phone, country, language, avatar_url;`,
            [name, phone, language, avatarUrl, id]
        );
        return rows[0];
    },

    async updatePassword(id, passwordHash) {
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2;', [passwordHash, id]);
    },

    async setAccountStatus(id, status) {
        const { rows } = await pool.query(
            `UPDATE users SET account_status = $1 WHERE id = $2 RETURNING id, account_status;`,
            [status, id]
        );
        return rows[0];
    },

    async listAll({ search, limit = 50, offset = 0 }) {
        if (search) {
            const { rows } = await pool.query(
                `SELECT id, name, username, email, country, role, account_status, is_premium, created_at
                 FROM users WHERE name ILIKE $1 OR email ILIKE $1 OR username ILIKE $1
                 ORDER BY created_at DESC LIMIT $2 OFFSET $3;`,
                [`%${search}%`, limit, offset]
            );
            return rows;
        }
        const { rows } = await pool.query(
            `SELECT id, name, username, email, country, role, account_status, is_premium, created_at
             FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2;`,
            [limit, offset]
        );
        return rows;
    },

    async countAll() {
        const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM users;');
        return rows[0].total;
    }
};

module.exports = User;
