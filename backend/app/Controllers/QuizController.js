const pool = require('../../database/db');
const Wallet = require('../Models/Wallet');
const Gamification = require('../Models/Gamification');
const Notification = require('../Models/Notification');

const SESSION_SIZE = 10;
const AD_BOOST_AMOUNT = 3;

const QuizController = {
    async listCategories(req, res) {
        try {
            const userId = req.user.id;
            const { rows } = await pool.query(`
                SELECT c.*,
                    (SELECT COUNT(*)::int FROM questions q WHERE q.category_id = c.id AND q.status = 'active') AS total_questions,
                    (SELECT COUNT(*)::int FROM questions q
                        WHERE q.category_id = c.id AND q.status = 'active'
                        AND q.id NOT IN (SELECT question_id FROM quiz_progress WHERE user_id = $1)
                    ) AS remaining_questions,
                    (SELECT COALESCE(SUM(q.reward_amount), 0) FROM questions q
                        WHERE q.category_id = c.id AND q.status = 'active'
                        AND q.id NOT IN (SELECT question_id FROM quiz_progress WHERE user_id = $1)
                    ) AS potential_reward,
                    (SELECT COALESCE(SUM(q.xp_amount), 0) FROM questions q
                        WHERE q.category_id = c.id AND q.status = 'active'
                        AND q.id NOT IN (SELECT question_id FROM quiz_progress WHERE user_id = $1)
                    ) AS potential_xp
                FROM categories c
                WHERE c.status = 'active'
                ORDER BY c.name;
            `, [userId]);
            return res.json({ categories: rows });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao buscar categorias." });
        }
    },

    async getRandomQuiz(req, res) {
        try {
            const userId = req.user.id;
            const { categorySlug } = req.query;

            let query = `
                SELECT q.id, q.question_type, q.video_url, q.question_text,
                       q.option_a, q.option_b, q.option_c, q.option_d,
                       q.reward_amount, q.xp_amount, q.difficulty_level, c.name AS category_name, c.slug AS category_slug
                FROM questions q
                JOIN categories c ON c.id = q.category_id
                WHERE q.status = 'active'
                  AND q.id NOT IN (SELECT question_id FROM quiz_progress WHERE user_id = $1)
            `;
            const params = [userId];
            if (categorySlug) {
                query += ` AND c.slug = $2`;
                params.push(categorySlug);
            }
            query += ` ORDER BY RANDOM() LIMIT 1;`;

            const { rows } = await pool.query(query, params);
            if (rows.length === 0) {
                return res.status(404).json({ error: "Sem novas perguntas disponíveis nesta categoria por agora." });
            }

            await pool.query(
                `INSERT INTO ad_impressions (user_id, network, placement) VALUES ($1, 'none', 'before_quiz');`,
                [userId]
            );

            await pool.query(
                `INSERT INTO quiz_issued (user_id, question_id, issued_at)
                 VALUES ($1, $2, CURRENT_TIMESTAMP)
                 ON CONFLICT (user_id, question_id) DO UPDATE SET issued_at = CURRENT_TIMESTAMP;`,
                [userId, rows[0].id]
            );

            return res.json({ quiz: rows[0] });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao buscar pergunta." });
        }
    },

    async submitAnswer(req, res) {
        const client = await pool.connect();
        try {
            const userId = req.user.id;
            const userCountry = req.user.country;
            const { questionId, selectedOption } = req.body;

            if (!questionId || !selectedOption) {
                return res.status(400).json({ error: "Informe a pergunta e a opção selecionada." });
            }

            await client.query('BEGIN');

            const checkProgress = await client.query(
                'SELECT id FROM quiz_progress WHERE user_id = $1 AND question_id = $2;',
                [userId, questionId]
            );
            if (checkProgress.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: "Já respondeste a esta pergunta." });
            }

            const questionRes = await client.query(
                'SELECT category_id, correct_option, reward_amount, xp_amount, explanation, question_text FROM questions WHERE id = $1;',
                [questionId]
            );
            if (questionRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: "Pergunta não encontrada." });
            }
            const { correct_option, reward_amount, xp_amount, explanation } = questionRes.rows[0];
            const isCorrect = selectedOption.toUpperCase() === correct_option.toUpperCase();
            const xpEarned = isCorrect ? xp_amount : Math.ceil(xp_amount / 5);
            const currency = userCountry === 'Moçambique' ? 'MTN' : 'USD';

            await client.query(
                `INSERT INTO quiz_progress (user_id, question_id, selected_option, is_correct, xp_received)
                 VALUES ($1, $2, $3, $4, $5);`,
                [userId, questionId, selectedOption.toUpperCase(), isCorrect, xpEarned]
            );

            const { progress, leveledUp } = await Gamification.registerAnswer(userId, { isCorrect, xpEarned }, client);

            const missionResult = await Gamification.updateMissionProgress(userId, 'answer_5_quizzes', 1, client);
            const weeklyMissionResult = await Gamification.updateMissionProgress(userId, 'weekly_50', 1, client);

            let rewardPaid = 0;

            if (isCorrect) {
                await Wallet.addAvailable(userId, reward_amount, currency, client);
                rewardPaid = reward_amount;

                await client.query(
                    `INSERT INTO transactions (user_id, type, amount, currency, status) VALUES ($1, 'REWARD', $2, $3, 'COMPLETED');`,
                    [userId, reward_amount, currency]
                );
                await client.query(
                    `INSERT INTO rewards (user_id, type, amount, currency, status) VALUES ($1, 'quiz', $2, $3, 'confirmed');`,
                    [userId, reward_amount, currency]
                );

                const referrerRes = await client.query('SELECT referred_by FROM users WHERE id = $1;', [userId]);
                if (referrerRes.rows.length > 0 && referrerRes.rows[0].referred_by) {
                    const referralBonus = parseFloat(reward_amount) * 0.15;
                    const referrerId = referrerRes.rows[0].referred_by;
                    await Wallet.addAvailable(referrerId, referralBonus, currency, client);
                    await client.query(
                        `INSERT INTO transactions (user_id, type, amount, currency, status) VALUES ($1, 'REFERRAL_BONUS', $2, $3, 'COMPLETED');`,
                        [referrerId, referralBonus, currency]
                    );
                    await Notification.create(referrerId, {
                        category: 'reward',
                        title: 'Bónus de indicação recebido',
                        message: `Recebeste ${referralBonus.toFixed(2)} ${currency} de bónus de indicação.`
                    }, client);
                }
            }

            const sessionComplete = progress.questions_answered > 0 && progress.questions_answered % SESSION_SIZE === 0;
            let session = null;

            if (sessionComplete) {
                const reviewRes = await client.query(
                    `SELECT qp.selected_option, qp.is_correct, q.question_text, q.correct_option, q.explanation, q.reward_amount
                     FROM quiz_progress qp JOIN questions q ON q.id = qp.question_id
                     WHERE qp.user_id = $1
                     ORDER BY qp.id DESC LIMIT $2;`,
                    [userId, SESSION_SIZE]
                );
                const reviewItems = reviewRes.rows.reverse();
                const correctCount = reviewItems.filter(r => r.is_correct).length;
                const totalEarned = reviewItems.reduce((sum, r) => sum + (r.is_correct ? parseFloat(r.reward_amount) : 0), 0);
                const maxPossible = reviewItems.reduce((sum, r) => sum + parseFloat(r.reward_amount), 0);

                session = {
                    correctCount,
                    totalQuestions: reviewItems.length,
                    totalEarned: parseFloat(totalEarned.toFixed(2)),
                    maxPossible: parseFloat(maxPossible.toFixed(2)),
                    currency,
                    review: reviewItems.map(r => ({
                        questionText: r.question_text,
                        selectedOption: r.selected_option,
                        correctOption: r.correct_option,
                        isCorrect: r.is_correct,
                        explanation: r.explanation
                    }))
                };
            }

            const firstQuiz = progress.questions_answered === 1;
            const firstCorrect = isCorrect && progress.correct_answers === 1;

            const unlockedAchievements = [];
            if (firstQuiz) {
                const a = await Gamification.unlockAchievement(userId, 'first_quiz', client);
                if (a) unlockedAchievements.push(a);
            }
            if (firstCorrect) {
                const a = await Gamification.unlockAchievement(userId, 'first_correct', client);
                if (a) unlockedAchievements.push(a);
            }
            if (progress.current_streak >= 7) {
                const a = await Gamification.unlockAchievement(userId, 'streak_7', client);
                if (a) unlockedAchievements.push(a);
            }

            if (leveledUp) {
                await Notification.create(userId, {
                    category: 'activity',
                    title: 'Subiu de nível!',
                    message: `Parabéns! Alcançaste o nível ${progress.level}.`
                }, client);
            }
            for (const ach of unlockedAchievements) {
                await Notification.create(userId, {
                    category: 'activity',
                    title: 'Nova conquista desbloqueada!',
                    message: `${ach.icon} ${ach.title} — ${ach.description}`
                }, client);
            }

            await client.query('COMMIT');

            return res.json({
                correct: isCorrect,
                message: isCorrect ? "Parabéns! Você acertou." : "Resposta incorreta.",
                correctOption: correct_option,
                explanation,
                xpEarned,
                rewardPaid,
                currency,
                sessionComplete,
                session,
                progress: {
                    xp_total: progress.xp_total,
                    level: progress.level,
                    current_streak: progress.current_streak,
                    leveledUp
                },
                unlockedAchievements,
                completedMissions: [missionResult, weeklyMissionResult].filter(Boolean).map(r => r.completedMission)
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(error);
            return res.status(500).json({ error: "Erro no servidor ao processar resposta." });
        } finally {
            client.release();
        }
    },

    async adBoost(req, res) {
        try {
            const userId = req.user.id;
            const userCountry = req.user.country;
            const currency = userCountry === 'Moçambique' ? 'MTN' : 'USD';

            const { rows } = await pool.query(
                'SELECT questions_answered, last_ad_boost_count FROM user_progress WHERE user_id = $1;',
                [userId]
            );
            if (rows.length === 0) {
                return res.status(404).json({ error: "Progresso não encontrado." });
            }
            const { questions_answered, last_ad_boost_count } = rows[0];
            const currentSessionIndex = Math.floor(questions_answered / SESSION_SIZE);

            if (questions_answered === 0 || questions_answered % SESSION_SIZE !== 0) {
                return res.status(400).json({ error: "Só podes reforçar o valor logo após completares uma série de 10 perguntas." });
            }
            if (last_ad_boost_count >= currentSessionIndex) {
                return res.status(400).json({ error: "Já usaste o reforço desta série." });
            }

            await Wallet.addAvailable(userId, AD_BOOST_AMOUNT, currency);
            await pool.query(
                `INSERT INTO transactions (user_id, type, amount, currency, status) VALUES ($1, 'AD_BOOST', $2, $3, 'COMPLETED');`,
                [userId, AD_BOOST_AMOUNT, currency]
            );
            await pool.query(
                'UPDATE user_progress SET last_ad_boost_count = $1 WHERE user_id = $2;',
                [currentSessionIndex, userId]
            );

            return res.json({ message: "Bónus de anúncio aplicado!", bonus: AD_BOOST_AMOUNT, currency });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao aplicar reforço de anúncio." });
        }
    },

    async addQuiz(req, res) {
        try {
            const {
                categorySlug, quizTitle, questionType, videoUrl, questionText,
                optionA, optionB, optionC, optionD, correctOption,
                explanation, rewardAmount, xpAmount, difficultyLevel
            } = req.body;

            if (!categorySlug || !questionText || !correctOption) {
                return res.status(400).json({ error: "Preencha os campos obrigatórios da pergunta." });
            }

            const catRes = await pool.query('SELECT id FROM categories WHERE slug = $1;', [categorySlug]);
            if (catRes.rows.length === 0) {
                return res.status(404).json({ error: "Categoria não encontrada." });
            }
            const categoryId = catRes.rows[0].id;

            let quizId;
            const quizRes = await pool.query(
                'SELECT id FROM quizzes WHERE category_id = $1 AND title = $2;',
                [categoryId, quizTitle || 'Quiz geral']
            );
            if (quizRes.rows.length > 0) {
                quizId = quizRes.rows[0].id;
            } else {
                const newQuiz = await pool.query(
                    `INSERT INTO quizzes (category_id, title, difficulty_level, created_by)
                     VALUES ($1, $2, $3, $4) RETURNING id;`,
                    [categoryId, quizTitle || 'Quiz geral', difficultyLevel || 1, req.user.id]
                );
                quizId = newQuiz.rows[0].id;
            }

            const { rows } = await pool.query(
                `INSERT INTO questions (quiz_id, category_id, question_type, video_url, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, reward_amount, xp_amount, difficulty_level)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *;`,
                [quizId, categoryId, questionType || 'multiple_choice', videoUrl || null, questionText,
                    optionA || null, optionB || null, optionC || null, optionD || null,
                    correctOption.toUpperCase(), explanation || null,
                    rewardAmount || 0.70, xpAmount || 10, difficultyLevel || 1]
            );

            return res.status(201).json({ message: "Pergunta cadastrada!", question: rows[0] });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao cadastrar pergunta." });
        }
    }
};

module.exports = QuizController;
