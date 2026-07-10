const pool = require('../../database/db');
const User = require('../Models/User');

const AdminController = {
    async getDashboard(req, res) {
        try {
            const usersTotal = await pool.query('SELECT COUNT(*)::int AS total FROM users;');
            const usersActive = await pool.query("SELECT COUNT(*)::int AS total FROM users WHERE account_status = 'active';");
            const usersBlocked = await pool.query("SELECT COUNT(*)::int AS total FROM users WHERE account_status = 'blocked';");
            const newToday = await pool.query("SELECT COUNT(*)::int AS total FROM users WHERE created_at::date = CURRENT_DATE;");

            const quizzesDone = await pool.query('SELECT COUNT(*)::int AS total FROM quiz_progress;');
            const avgAccuracy = await pool.query(
                `SELECT ROUND(AVG(CASE WHEN is_correct THEN 100 ELSE 0 END), 1) AS pct FROM quiz_progress;`
            );

            const rewardsPaid = await pool.query(
                `SELECT currency, COALESCE(SUM(amount),0) AS total FROM transactions WHERE type = 'REWARD' GROUP BY currency;`
            );
            const withdrawalsPending = await pool.query("SELECT COUNT(*)::int AS total FROM withdrawals WHERE status = 'pending';");
            const premiumActive = await pool.query("SELECT COUNT(*)::int AS total FROM user_subscriptions WHERE status = 'active';");

            return res.json({
                users: {
                    total: usersTotal.rows[0].total,
                    active: usersActive.rows[0].total,
                    blocked: usersBlocked.rows[0].total,
                    new_today: newToday.rows[0].total
                },
                activity: {
                    quizzes_answered: quizzesDone.rows[0].total,
                    average_accuracy_pct: avgAccuracy.rows[0].pct || 0
                },
                financial: {
                    rewards_paid: rewardsPaid.rows,
                    withdrawals_pending: withdrawalsPending.rows[0].total
                },
                premium: {
                    active_subscriptions: premiumActive.rows[0].total
                }
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao carregar dashboard." });
        }
    },

    async listUsers(req, res) {
        try {
            const { search, limit, offset } = req.query;
            const users = await User.listAll({ search, limit: limit ? parseInt(limit) : 50, offset: offset ? parseInt(offset) : 0 });
            const total = await User.countAll();
            return res.json({ users, total });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao listar usuários." });
        }
    },

    async updateUserStatus(req, res) {
        try {
            const { userId } = req.params;
            const { status } = req.body;
            const allowed = ['active', 'pending', 'limited', 'blocked'];
            if (!allowed.includes(status)) {
                return res.status(400).json({ error: "Estado inválido." });
            }
            const updated = await User.setAccountStatus(userId, status);
            return res.json({ message: "Estado da conta atualizado.", user: updated });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao atualizar estado do usuário." });
        }
    },

    async listWithdrawals(req, res) {
        try {
            const { status } = req.query;
            const query = status
                ? `SELECT w.*, u.name, u.email FROM withdrawals w JOIN users u ON u.id = w.user_id WHERE w.status = $1 ORDER BY w.requested_at DESC;`
                : `SELECT w.*, u.name, u.email FROM withdrawals w JOIN users u ON u.id = w.user_id ORDER BY w.requested_at DESC;`;
            const { rows } = status ? await pool.query(query, [status]) : await pool.query(query);
            return res.json({ withdrawals: rows });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao listar saques." });
        }
    },

    async resolveWithdrawal(req, res) {
        const client = await pool.connect();
        try {
            const { withdrawalId } = req.params;
            const { action } = req.body;

            await client.query('BEGIN');
            const wRes = await client.query('SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE;', [withdrawalId]);
            if (wRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: "Pedido de saque não encontrado." });
            }
            const withdrawal = wRes.rows[0];

            if (action === 'approve') {
                await client.query(
                    `UPDATE withdrawals SET status = 'completed', resolved_at = CURRENT_TIMESTAMP WHERE id = $1;`,
                    [withdrawalId]
                );
                await client.query(
                    `UPDATE transactions SET status = 'COMPLETED' WHERE user_id = $1 AND type = 'WITHDRAWAL' AND status = 'PENDING' AND amount = $2;`,
                    [withdrawal.user_id, withdrawal.amount]
                );
            } else if (action === 'reject') {
                await client.query(
                    `UPDATE withdrawals SET status = 'rejected', resolved_at = CURRENT_TIMESTAMP WHERE id = $1;`,
                    [withdrawalId]
                );
                const column = withdrawal.currency === 'MTN' ? 'balance_available_mtn' : 'balance_available_usd';
                await client.query(
                    `UPDATE wallets SET ${column} = ${column} + $1 WHERE user_id = $2;`,
                    [withdrawal.amount, withdrawal.user_id]
                );
            } else {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: "Ação inválida. Use 'approve' ou 'reject'." });
            }

            await client.query('COMMIT');
            return res.json({ message: `Pedido de saque ${action === 'approve' ? 'aprovado' : 'rejeitado'} com sucesso.` });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(error);
            return res.status(500).json({ error: "Erro ao processar saque." });
        } finally {
            client.release();
        }
    },

    async listQuestions(req, res) {
        try {
            const { rows } = await pool.query(
                `SELECT q.*, c.name AS category_name FROM questions q JOIN categories c ON c.id = q.category_id ORDER BY q.created_at DESC LIMIT 100;`
            );
            return res.json({ questions: rows });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao listar perguntas." });
        }
    }
};

module.exports = AdminController;
