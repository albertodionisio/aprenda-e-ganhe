const pool = require('../../database/db');

// Valida o tempo de resposta usando o horário registado no SERVIDOR
// (gravado em quiz_issued quando a pergunta foi entregue via GET /quiz/next),
// e não o "startTime" que o cliente enviar — que pode ser forjado.
const antiFraudCheck = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { questionId } = req.body;

        if (!questionId) {
            return res.status(400).json({ error: "Informe a pergunta que está a responder." });
        }

        const { rows } = await pool.query(
            'SELECT issued_at FROM quiz_issued WHERE user_id = $1 AND question_id = $2;',
            [userId, questionId]
        );

        if (rows.length === 0) {
            return res.status(400).json({ error: "Pergunta não foi carregada corretamente. Peça uma nova pergunta antes de responder." });
        }

        const duration = (Date.now() - new Date(rows[0].issued_at).getTime()) / 1000;
        if (duration < 1.5) {
            return res.status(403).json({ error: "Resposta bloqueada pelo sistema anti-fraude. Tempo de leitura humano insuficiente." });
        }

        next();
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erro ao validar resposta." });
    }
};

module.exports = antiFraudCheck;
