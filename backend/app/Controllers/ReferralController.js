const pool = require('../../database/db');

const ReferralController = {
    async getMyReferrals(req, res) {
        try {
            const userId = req.user.id;

            const codeRes = await pool.query('SELECT referral_code FROM users WHERE id = $1;', [userId]);

            const { rows } = await pool.query(
                `SELECT u.id, u.name, u.username, u.created_at,
                        CASE WHEN u.last_login IS NOT NULL AND u.last_login > NOW() - INTERVAL '30 days'
                             THEN 'ativo' ELSE 'inativo' END AS status
                 FROM referrals r JOIN users u ON u.id = r.referred_id
                 WHERE r.referrer_id = $1 ORDER BY u.created_at DESC;`,
                [userId]
            );

            const earningsRes = await pool.query(
                `SELECT COALESCE(SUM(amount), 0) AS total, currency
                 FROM transactions WHERE user_id = $1 AND type = 'REFERRAL_BONUS'
                 GROUP BY currency;`,
                [userId]
            );

            return res.json({
                referralCode: codeRes.rows[0].referral_code,
                totalReferrals: rows.length,
                activeReferrals: rows.filter(r => r.status === 'ativo').length,
                referrals: rows,
                earnings: earningsRes.rows
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao buscar indicações." });
        }
    }
};

module.exports = ReferralController;
