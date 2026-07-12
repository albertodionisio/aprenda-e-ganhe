const pool = require('../../database/db');
const Wallet = require('../Models/Wallet');
const Notification = require('../Models/Notification');

const MIN_MTN = parseFloat(process.env.WITHDRAWAL_MIN_MTN || '500');

const WalletController = {
    async getBalance(req, res) {
        try {
            const wallet = await Wallet.getByUser(req.user.id);
            if (!wallet) return res.status(404).json({ error: "Carteira não encontrada." });
            return res.json({ wallet });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao consultar saldo." });
        }
    },

    async getHistory(req, res) {
        try {
            const { rows } = await pool.query(
                `SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50;`,
                [req.user.id]
            );
            return res.json({ transactions: rows });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao consultar histórico." });
        }
    },

    async requestWithdrawal(req, res) {
        const client = await pool.connect();
        try {
            const userId = req.user.id;
            const { amount, paymentMethod, paymentDetails } = req.body;
            const currency = 'MTN';

            if (!amount || !paymentMethod) {
                return res.status(400).json({ error: "Informe valor e método de pagamento." });
            }

            if (parseFloat(amount) < MIN_MTN) {
                return res.status(400).json({ error: `O valor mínimo de saque é ${MIN_MTN} MTN.` });
            }

            await client.query('BEGIN');

            const updated = await Wallet.deductAvailable(userId, amount, currency, client);
            if (!updated) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: "Saldo disponível insuficiente." });
            }

            const { rows } = await client.query(
                `INSERT INTO withdrawals (user_id, amount, currency, payment_method, payment_details, status)
                 VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *;`,
                [userId, amount, currency, paymentMethod, paymentDetails || null]
            );

            await client.query(
                `INSERT INTO transactions (user_id, type, amount, currency, status, payment_method)
                 VALUES ($1,'WITHDRAWAL',$2,$3,'PENDING',$4);`,
                [userId, amount, currency, paymentMethod]
            );

            await Notification.create(userId, {
                category: 'financial',
                title: 'Pedido de saque recebido',
                message: `O seu pedido de saque de ${amount} MTN está a ser processado.`
            }, client);

            await client.query('COMMIT');

            return res.status(201).json({ message: "Pedido de saque registado com sucesso.", withdrawal: rows[0] });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(error);
            return res.status(500).json({ error: "Erro ao processar solicitação de saque." });
        } finally {
            client.release();
        }
    },

    async myWithdrawals(req, res) {
        try {
            const { rows } = await pool.query(
                `SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY requested_at DESC;`,
                [req.user.id]
            );
            return res.json({ withdrawals: rows });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao consultar saques." });
        }
    }
};

module.exports = WalletController;
