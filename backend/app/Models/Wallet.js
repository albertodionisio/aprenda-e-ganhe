const pool = require('../../database/db');

const Wallet = {
    async create(userId, client = pool) {
        const { rows } = await client.query(
            'INSERT INTO wallets (user_id) VALUES ($1) RETURNING *;', [userId]
        );
        return rows[0];
    },

    async getByUser(userId) {
        const { rows } = await pool.query('SELECT * FROM wallets WHERE user_id = $1;', [userId]);
        return rows[0];
    },

    async addAvailable(userId, amount, currency, client = pool) {
        const column = currency.toUpperCase() === 'MTN' ? 'balance_available_mtn' : 'balance_available_usd';
        const totalColumn = currency.toUpperCase() === 'MTN' ? 'total_earned_mtn' : 'total_earned_usd';
        const query = `
            UPDATE wallets
            SET ${column} = ${column} + $1,
                ${totalColumn} = ${totalColumn} + $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING *;
        `;
        const { rows } = await client.query(query, [amount, userId]);
        return rows[0];
    },

    async deductAvailable(userId, amount, currency, client = pool) {
        const column = currency.toUpperCase() === 'MTN' ? 'balance_available_mtn' : 'balance_available_usd';
        const query = `
            UPDATE wallets
            SET ${column} = ${column} - $1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2 AND ${column} >= $1
            RETURNING *;
        `;
        const { rows } = await client.query(query, [amount, userId]);
        return rows[0];
    }
};

module.exports = Wallet;
