const pool = require('../../database/db');
const Notification = require('../Models/Notification');

const PremiumController = {
    async listPlans(req, res) {
        try {
            const { rows } = await pool.query('SELECT * FROM premium_plans ORDER BY price_usd;');
            return res.json({ plans: rows });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao buscar planos Premium." });
        }
    },

    // ATENÇÃO: não há processamento real de pagamento aqui.
    // Cria a assinatura como "pending_payment" — confirmação real deve vir
    // de um webhook do gateway de pagamento escolhido (PayPal, Stripe, PaySuite, etc).
    async subscribe(req, res) {
        const client = await pool.connect();
        try {
            const { planId, paymentMethod } = req.body;
            const userId = req.user.id;

            const planRes = await client.query('SELECT * FROM premium_plans WHERE id = $1;', [planId]);
            if (planRes.rows.length === 0) {
                return res.status(404).json({ error: "Plano não encontrado." });
            }
            const plan = planRes.rows[0];

            await client.query('BEGIN');

            const endDate = new Date(Date.now() + plan.duration_days * 86400000);
            const { rows } = await client.query(
                `INSERT INTO user_subscriptions (user_id, plan_id, end_date, status, payment_method)
                 VALUES ($1, $2, $3, 'pending_payment', $4) RETURNING *;`,
                [userId, planId, endDate, paymentMethod || 'não definido']
            );

            await Notification.create(userId, {
                category: 'premium',
                title: 'Assinatura Premium criada',
                message: `A sua assinatura do plano "${plan.name}" está pendente de confirmação de pagamento.`
            }, client);

            await client.query('COMMIT');

            return res.status(201).json({
                message: "Assinatura criada. Aguardando confirmação de pagamento.",
                subscription: rows[0],
                note: "A confirmação automática do pagamento depende da integração com um gateway real (PayPal, Stripe, M-Pesa, etc)."
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(error);
            return res.status(500).json({ error: "Erro ao criar assinatura." });
        } finally {
            client.release();
        }
    },

    async confirmSubscription(req, res) {
        const client = await pool.connect();
        try {
            const { subscriptionId } = req.body;
            await client.query('BEGIN');

            const subRes = await client.query(
                `UPDATE user_subscriptions SET status = 'active' WHERE id = $1 RETURNING *;`,
                [subscriptionId]
            );
            if (subRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: "Assinatura não encontrada." });
            }
            const subscription = subRes.rows[0];

            await client.query('UPDATE users SET is_premium = TRUE WHERE id = $1;', [subscription.user_id]);
            await Notification.create(subscription.user_id, {
                category: 'premium',
                title: 'Premium ativado!',
                message: 'O seu pagamento foi confirmado e o plano Premium já está ativo.'
            }, client);

            await client.query('COMMIT');
            return res.json({ message: "Assinatura confirmada e Premium ativado.", subscription });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(error);
            return res.status(500).json({ error: "Erro ao confirmar assinatura." });
        } finally {
            client.release();
        }
    },

    async myStatus(req, res) {
        try {
            const { rows } = await pool.query(
                `SELECT s.*, p.name AS plan_name, p.benefits
                 FROM user_subscriptions s JOIN premium_plans p ON p.id = s.plan_id
                 WHERE s.user_id = $1 ORDER BY s.start_date DESC LIMIT 1;`,
                [req.user.id]
            );
            return res.json({ subscription: rows[0] || null });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao buscar assinatura." });
        }
    }
};

module.exports = PremiumController;
