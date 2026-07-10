const pool = require('../../database/db');

const Notification = {
    async create(userId, { category, title, message }, client = pool) {
        const { rows } = await client.query(
            `INSERT INTO notifications (user_id, category, title, message) VALUES ($1,$2,$3,$4) RETURNING *;`,
            [userId, category, title, message]
        );
        return rows[0];
    },

    async listForUser(userId, limit = 30) {
        const { rows } = await pool.query(
            `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2;`,
            [userId, limit]
        );
        return rows;
    },

    async markRead(userId, notificationId) {
        const { rows } = await pool.query(
            `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *;`,
            [notificationId, userId]
        );
        return rows[0];
    },

    async markAllRead(userId) {
        await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1;', [userId]);
    },

    async unreadCount(userId) {
        const { rows } = await pool.query(
            'SELECT COUNT(*)::int AS total FROM notifications WHERE user_id = $1 AND is_read = FALSE;', [userId]
        );
        return rows[0].total;
    }
};

module.exports = Notification;
