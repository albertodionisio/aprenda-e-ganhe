require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const pool = require('./database/db');

const authRoutes = require('./routes/authRoutes');
const walletRoutes = require('./routes/walletRoutes');
const quizRoutes = require('./routes/quizRoutes');
const gamificationRoutes = require('./routes/gamificationRoutes');
const profileRoutes = require('./routes/profileRoutes');
const referralRoutes = require('./routes/referralRoutes');
const premiumRoutes = require('./routes/premiumRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API Aprenda e Ganhe está no ar.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Serve o frontend (HTML/CSS/JS estáticos) a partir do mesmo servidor,
// para que backend e frontend fiquem hospedados juntos, num único serviço/domínio.
const FRONTEND_DIR = path.join(__dirname, '../frontend/src');
app.use(express.static(FRONTEND_DIR));

// Página inicial (pública) abre automaticamente ao acessar a raiz do domínio
app.get('/', (req, res) => {
    res.redirect('/views/Public/index.html');
});

// Tratamento de rota inexistente (só se aplica a chamadas de API não encontradas;
// rotas de páginas .html não encontradas caem aqui também, como 404 comum)
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: "Rota não encontrada." });
    }
    return res.status(404).send('Página não encontrada.');
});

// Tratamento de erro genérico
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Erro interno inesperado no servidor." });
});

async function ensureSchema() {
    try {
        const { rows } = await pool.query(`SELECT to_regclass('public.users') AS exists;`);
        if (!rows[0].exists) {
            console.log('A criar as tabelas do banco de dados...');
            const schema = fs.readFileSync(path.join(__dirname, 'database/schema.sql')).toString();
            await pool.query(schema);
            console.log('Tabelas criadas com sucesso!');
        } else {
            console.log('Tabelas já existem, nada a fazer.');
        }
    } catch (err) {
        console.error('Erro ao criar tabelas:', err);
    }
}

async function ensureSeed() {
    try {
        const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM categories;');
        if (rows[0].total > 0) {
            console.log('Categorias já existem, seed não é necessário.');
            return;
        }
        console.log('A popular o banco de dados com dados iniciais...');

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
            ['financas', 'Qual é uma boa prática financeira?', 'Gastar todo o dinheiro', 'Criar um orçamento', 'Ignorar despesas', 'Fazer dívidas', 'B', 'Criar um orçamento ajuda a controlar entradas e saídas.'],
            ['financas', 'Guardar parte da renda mensalmente é chamado de:', 'Poupança', 'Dívida', 'Imposto', 'Prejuízo', 'A', 'Poupar é a base da organização financeira.'],
            ['financas', 'O que é juro composto?', 'Um imposto fixo', 'Juros sobre juros ao longo do tempo', 'Um tipo de multa', 'Um desconto', 'B', 'O juro composto faz o dinheiro crescer mais rápido com o tempo.'],
            ['financas', 'Qual destas é uma despesa fixa?', 'Renda da casa', 'Cinema', 'Presente de aniversário', 'Viagem', 'A', 'Despesas fixas repetem-se todos os meses com valor semelhante.'],
            ['financas', 'Investir é o mesmo que poupar?', 'Sim, exatamente igual', 'Não, investir busca fazer o dinheiro render', 'Não, investir é só para ricos', 'Sim, mas com mais risco sempre', 'B', 'Investir é aplicar dinheiro visando retorno, diferente de só guardar.'],
            ['financas', 'O que é um orçamento pessoal?', 'Um documento legal', 'Um plano de receitas e despesas', 'Um tipo de empréstimo', 'Uma conta bancária', 'B', 'O orçamento ajuda a planear onde o dinheiro vai.'],

            ['tecnologia', 'O que significa "IA"?', 'Internet Avançada', 'Inteligência Artificial', 'Interface Analógica', 'Informática Aplicada', 'B', 'IA refere-se a sistemas capazes de simular raciocínio humano.'],
            ['tecnologia', 'O que é a "nuvem" (cloud)?', 'Um tipo de tempo', 'Armazenamento de dados via internet', 'Um vírus', 'Um cabo de rede', 'B', 'A nuvem permite guardar e aceder dados através da internet.'],
            ['tecnologia', 'O que é um "bug" em software?', 'Um inseto real', 'Um erro no programa', 'Um tipo de vírus', 'Uma atualização', 'B', 'Bug é o termo usado para erros em programas de computador.'],
            ['tecnologia', 'O que faz uma senha ser mais segura?', 'Ser curta e simples', 'Combinar letras, números e símbolos', 'Ser igual em todos os sites', 'Não ter números', 'B', 'Senhas fortes combinam vários tipos de caracteres.'],
            ['tecnologia', 'O que é o Wi-Fi?', 'Um cabo físico', 'Uma tecnologia de internet sem fios', 'Um tipo de vírus', 'Um programa de edição', 'B', 'Wi-Fi permite ligação à internet sem cabos.'],
            ['tecnologia', 'O que é phishing?', 'Um jogo online', 'Uma tentativa de roubar dados por engano', 'Um tipo de rede social', 'Um antivírus', 'B', 'Phishing é uma fraude para roubar informações pessoais.'],

            ['emprego', 'O que é essencial num currículo?', 'Informações falsas', 'Clareza e objetividade', 'Excesso de cores', 'Textos longos', 'B', 'Um currículo claro facilita a leitura do recrutador.'],
            ['emprego', 'O que fazer antes de uma entrevista?', 'Pesquisar sobre a empresa', 'Chegar atrasado', 'Não se preparar', 'Ignorar o cargo', 'A', 'Conhecer a empresa mostra interesse genuíno.'],
            ['emprego', 'O que é uma "soft skill"?', 'Uma habilidade técnica', 'Uma habilidade comportamental', 'Um tipo de software', 'Um cargo específico', 'B', 'Soft skills são competências como comunicação e trabalho em equipa.'],
            ['emprego', 'O que é networking profissional?', 'Rede de contactos profissionais', 'Um tipo de internet', 'Um curso técnico', 'Um cargo de TI', 'A', 'Networking ajuda a criar oportunidades através de conexões.'],
            ['emprego', 'O que mostrar numa carta de apresentação?', 'Motivação e adequação à vaga', 'Apenas dados pessoais', 'Reclamações do emprego anterior', 'Nada relevante', 'A', 'A carta deve mostrar porque encaixas na vaga.'],
            ['emprego', 'O que é feedback construtivo?', 'Crítica destrutiva', 'Comentário que ajuda a melhorar', 'Elogio vazio', 'Ignorar o desempenho', 'B', 'Feedback construtivo aponta melhorias de forma útil.'],

            ['livros', 'Resumir um livro ajuda a fixar as ideias principais.', 'Verdadeiro', 'Falso', null, null, 'A', 'Resumos reforçam a retenção do conteúdo.'],
            ['livros', 'O que é uma sinopse?', 'Um resumo da obra', 'O nome do autor', 'A capa do livro', 'O preço do livro', 'A', 'A sinopse apresenta o essencial da história ou conteúdo.'],
            ['livros', 'Ler regularmente melhora o vocabulário?', 'Sim', 'Não', null, null, 'A', 'A leitura frequente expande o vocabulário naturalmente.'],
            ['livros', 'O que é um livro não-ficção?', 'Baseado em factos reais', 'Sempre inventado', 'Só sobre fantasia', 'Sem autor definido', 'A', 'Não-ficção trata de temas reais, como biografias e ciência.'],
            ['livros', 'Fazer anotações enquanto se lê ajuda a:', 'Esquecer o conteúdo', 'Reter melhor as ideias', 'Perder tempo', 'Confundir o enredo', 'B', 'Anotar ideias-chave melhora a compreensão e memória.'],

            ['desenvolvimento-pessoal', 'Qual hábito melhora a produtividade?', 'Multitarefa constante', 'Planeamento diário', 'Adiar tarefas', 'Trabalhar sem pausas', 'B', 'Planear o dia ajuda a priorizar tarefas importantes.'],
            ['desenvolvimento-pessoal', 'O que é procrastinação?', 'Organizar tarefas', 'Adiar tarefas importantes', 'Terminar cedo', 'Delegar trabalho', 'B', 'Procrastinar é adiar o que precisa de ser feito.'],
            ['desenvolvimento-pessoal', 'Definir metas SMART ajuda porque são:', 'Vagas e distantes', 'Específicas e mensuráveis', 'Impossíveis', 'Escolhidas por outros', 'B', 'Metas SMART são claras, medíveis e alcançáveis.'],
            ['desenvolvimento-pessoal', 'Dormir bem influencia o desempenho diário?', 'Sim', 'Não', null, null, 'A', 'O sono adequado é essencial para foco e energia.'],
            ['desenvolvimento-pessoal', 'O que é inteligência emocional?', 'Saber matemática', 'Gerir bem as próprias emoções', 'Ser sempre calado', 'Evitar pessoas', 'B', 'Inteligência emocional envolve reconhecer e gerir emoções.'],
        ];

        for (const q of questions) {
            const [slug, text, a, b, c, d, correct, explanation] = q;
            const type = (c === null) ? 'true_false' : 'multiple_choice';
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
    } catch (err) {
        console.error('Erro ao popular dados iniciais:', err);
    }
}

const PORT = process.env.PORT || 3000;
ensureSchema().then(ensureSeed).then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
});
