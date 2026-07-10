require('dotenv').config();
const pool = require('./db');

async function seed() {
    try {
        console.log('Iniciando seed...');

        const categories = [
            ['Finanças', 'financas', 'Educação financeira, poupança e negócios'],
            ['Tecnologia', 'tecnologia', 'Ferramentas digitais, IA e internet'],
            ['Emprego', 'emprego', 'Currículo, entrevistas e carreira'],
            ['Livros', 'livros', 'Ideias e resumos de livros'],
            ['Desenvolvimento Pessoal', 'desenvolvimento-pessoal', 'Hábitos e produtividade'],
        ];
        const catIds = {};
        for (const [name, slug, description] of categories) {
            const { rows } = await pool.query(
                `INSERT INTO categories (name, slug, description) VALUES ($1,$2,$3)
                 ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id, slug;`,
                [name, slug, description]
            );
            catIds[slug] = rows[0].id;
        }

        const quizIds = {};
        for (const slug of Object.keys(catIds)) {
            const { rows } = await pool.query(
                `INSERT INTO quizzes (category_id, title, description, difficulty_level)
                 VALUES ($1, $2, 'Quiz introdutório', 1) RETURNING id;`,
                [catIds[slug], `Introdução a ${slug.replace('-', ' ')}`]
            );
            quizIds[slug] = rows[0].id;
        }

        const questions = [
            ['financas', 'multiple_choice', 'Qual é uma boa prática financeira?',
                'Gastar todo o dinheiro', 'Criar um orçamento', 'Ignorar despesas', 'Fazer dívidas', 'B',
                'Criar um orçamento ajuda a controlar entradas e saídas.'],
            ['financas', 'true_false', 'Guardar parte da renda ajuda no planeamento financeiro.',
                'Verdadeiro', 'Falso', null, null, 'A', 'Poupar é a base da organização financeira.'],
            ['tecnologia', 'multiple_choice', 'O que significa "IA"?',
                'Internet Avançada', 'Inteligência Artificial', 'Interface Analógica', 'Informática Aplicada', 'B',
                'IA refere-se a sistemas capazes de simular raciocínio humano.'],
            ['emprego', 'multiple_choice', 'O que é essencial num currículo?',
                'Informações falsas', 'Clareza e objetividade', 'Excesso de cores', 'Textos longos', 'B',
                'Um currículo claro facilita a leitura do recrutador.'],
            ['livros', 'true_false', 'Resumir um livro ajuda a fixar as ideias principais.',
                'Verdadeiro', 'Falso', null, null, 'A', 'Resumos reforçam a retenção do conteúdo.'],
            ['desenvolvimento-pessoal', 'multiple_choice', 'Qual hábito melhora a produtividade?',
                'Multitarefa constante', 'Planeamento diário', 'Adiar tarefas', 'Trabalhar sem pausas', 'B',
                'Planear o dia ajuda a priorizar tarefas importantes.'],
        ];
        for (const q of questions) {
            const [slug, type, text, a, b, c, d, correct, explanation] = q;
            await pool.query(
                `INSERT INTO questions (quiz_id, category_id, question_type, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, reward_amount, xp_amount, difficulty_level)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0.05,10,1);`,
                [quizIds[slug], catIds[slug], type, text, a, b, c, d, correct, explanation]
            );
        }

        const achievements = [
            ['first_quiz', 'Primeiro Quiz', 'Concluiu o primeiro desafio', '🏆'],
            ['first_correct', 'Primeiro Acerto', 'Respondeu corretamente uma pergunta', '🎯'],
            ['streak_7', 'Sequência de Fogo', 'Participou 7 dias seguidos', '🔥'],
            ['finance_master', 'Mestre das Finanças', 'Completou vários quizzes de Finanças', '💰'],
        ];
        for (const [code, title, description, icon] of achievements) {
            await pool.query(
                `INSERT INTO achievements (code, title, description, icon) VALUES ($1,$2,$3,$4)
                 ON CONFLICT (code) DO NOTHING;`,
                [code, title, description, icon]
            );
        }

        const missions = [
            ['answer_5_quizzes', 'Responda 5 quizzes hoje', 'Complete 5 perguntas em qualquer categoria', 5, 100, 'daily'],
            ['daily_login', 'Login diário', 'Entre na plataforma hoje', 1, 20, 'daily'],
            ['weekly_50', 'Responda 50 perguntas na semana', 'Desafio semanal de participação', 50, 300, 'weekly'],
        ];
        for (const [code, title, description, goal, xp, period] of missions) {
            await pool.query(
                `INSERT INTO missions (code, title, description, goal_count, xp_reward, reset_period)
                 VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING;`,
                [code, title, description, goal, xp, period]
            );
        }

        await pool.query(
            `INSERT INTO premium_plans (name, price_usd, duration_days, benefits)
             VALUES
             ('Premium Mensal', 4.99, 30, 'Mais quizzes diários, estatísticas avançadas, sem limite de energia'),
             ('Premium Anual', 39.99, 365, 'Todos os benefícios mensais + desconto anual + recursos exclusivos')
             ON CONFLICT DO NOTHING;`
        );

        const settings = [
            ['platform_name', 'Aprenda e Ganhe'],
            ['default_language', 'pt'],
            ['available_languages', 'pt,en'],
            ['withdrawal_min_usd', '10'],
            ['withdrawal_min_mtn', '500'],
            ['referral_bonus_percentage', '15'],
        ];
        for (const [key, value] of settings) {
            await pool.query(
                `INSERT INTO platform_settings (setting_key, setting_value) VALUES ($1,$2)
                 ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;`,
                [key, value]
            );
        }

        console.log('Seed concluído com sucesso!');
    } catch (error) {
        console.error('Erro ao popular banco de dados:', error);
    } finally {
        pool.end();
    }
}

seed();
