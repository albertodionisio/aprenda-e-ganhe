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

const FRONTEND_DIR = path.join(__dirname, '../frontend/src');
app.use(express.static(FRONTEND_DIR));

app.get('/', (req, res) => {
    res.redirect('/views/Public/index.html');
});

app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: "Rota não encontrada." });
    }
    return res.status(404).send('Página não encontrada.');
});

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
            console.log('Categorias já existem, seed inicial não é necessário.');
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
            ['available_languages', 'pt'],
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

        console.log('Seed inicial concluído com sucesso!');
    } catch (err) {
        console.error('Erro ao popular dados iniciais:', err);
    }
}

async function ensureExtraQuestions() {
    const MARKER = 'O João ganha 8000 MTN por mês e gasta sempre tudo antes do fim do mês, sem guardar nada. Qual seria o primeiro passo mais indicado para ele começar a organizar as finanças?';
    try {
        const check = await pool.query('SELECT id FROM questions WHERE question_text = $1;', [MARKER]);
        if (check.rows.length > 0) {
            console.log('Perguntas extra (cenários) já existem, nada a fazer.');
            return;
        }
        console.log('A adicionar perguntas extra com cenários reais...');

        const catRes = await pool.query('SELECT id, slug FROM categories;');
        const catIds = {};
        catRes.rows.forEach(r => { catIds[r.slug] = r.id; });

        const quizRes = await pool.query('SELECT id, category_id FROM quizzes;');
        const quizIds = {};
        quizRes.rows.forEach(r => {
            const slug = Object.keys(catIds).find(s => catIds[s] === r.category_id);
            if (slug) quizIds[slug] = r.id;
        });

        const extraQuestions = [
            ['financas', 'O João ganha 8000 MTN por mês e gasta sempre tudo antes do fim do mês, sem guardar nada. Qual seria o primeiro passo mais indicado para ele começar a organizar as finanças?', 'Pedir um empréstimo para os últimos dias do mês', 'Anotar todas as despesas durante um mês para perceber onde o dinheiro vai', 'Deixar de comprar comida', 'Ignorar o problema, pois é normal', 'B', 'Antes de qualquer plano, é preciso saber para onde o dinheiro está realmente a ir.'],
            ['financas', 'A Ana recebeu um bónus inesperado no trabalho. Ela quer usá-lo de forma inteligente. Qual destas opções é a mais sensata?', 'Gastar tudo em roupa nova imediatamente', 'Guardar uma parte numa poupança e usar o resto com moderação', 'Emprestar tudo a um amigo sem registo', 'Comprar algo caro a crédito', 'B', 'Equilibrar poupança e uso consciente evita arrependimentos financeiros.'],
            ['financas', 'O Carlos quer comprar uma mota que custa 45.000 MTN, mas só tem 10.000 MTN guardados. Qual é a abordagem mais responsável?', 'Comprar já, usando crédito com juros altos', 'Criar um plano de poupança mensal até juntar o valor', 'Pedir emprestado a vários amigos ao mesmo tempo', 'Desistir de qualquer poupança', 'B', 'Poupar de forma planeada evita dívidas e juros desnecessários.'],
            ['financas', 'A Fátima paga a renda da casa todos os meses, mas às vezes esquece-se e paga com atraso, gerando multa. O que a ajudaria mais?', 'Pagar quando se lembrar, sem planear', 'Definir um dia fixo do mês e criar um lembrete', 'Parar de pagar a renda', 'Pedir para o senhorio esquecer a multa sempre', 'B', 'Rotinas e lembretes reduzem esquecimentos e custos extra com multas.'],
            ['financas', 'O Miguel investiu todas as suas poupanças num único negócio de um amigo, sem pesquisar nada sobre o risco. O que ele fez de errado?', 'Nada, negócios de amigos são sempre seguros', 'Não diversificou o risco nem pesquisou antes de investir', 'Investiu pouco dinheiro', 'Guardou dinheiro a mais', 'B', 'Colocar todo o dinheiro num único investimento sem análise aumenta muito o risco de perda.'],
            ['financas', 'A Sara ganha em MTN mas sonha em poupar para comprar algo em dólares no futuro. O que ela deve ter em conta?', 'As taxas de câmbio podem variar e afetar o valor poupado', 'O câmbio nunca muda', 'Não faz diferença nenhuma', 'É melhor não poupar nada', 'A', 'A variação cambial pode aumentar ou diminuir o poder de compra da poupança.'],
            ['financas', 'O Paulo recebe o salário e logo no mesmo dia gasta em coisas não planeadas. O que um orçamento mensal ajudaria a evitar?', 'Nada, orçamento não serve para nada', 'Gastos por impulso sem controlo', 'Ganhar mais dinheiro automaticamente', 'Pagar menos impostos', 'B', 'Um orçamento ajuda a distinguir entre necessidades e gastos por impulso.'],

            ['tecnologia', 'A Marta recebeu uma mensagem a dizer que ganhou um prémio e pedindo os dados do cartão bancário para "confirmar". O que ela deve fazer?', 'Enviar os dados rapidamente para não perder o prémio', 'Desconfiar e não partilhar dados bancários por mensagem', 'Reenviar a mensagem para todos os amigos', 'Ligar para o número da mensagem imediatamente', 'B', 'Pedidos de dados bancários por mensagem inesperada são um sinal clássico de fraude (phishing).'],
            ['tecnologia', 'O Nelson usa a mesma senha simples em todas as suas contas online. Qual é o maior risco disso?', 'Nenhum, é mais prático assim', 'Se uma conta for invadida, todas as outras ficam vulneráveis também', 'As contas ficam mais rápidas', 'A internet fica mais lenta', 'B', 'Reutilizar senhas significa que uma única fuga de dados compromete várias contas ao mesmo tempo.'],
            ['tecnologia', 'A Célia quer guardar fotos importantes sem risco de perder tudo se o telemóvel avariar. O que a nuvem (cloud) permite fazer?', 'Apagar as fotos automaticamente', 'Guardar cópias na internet, acessíveis de qualquer aparelho', 'Tornar o telemóvel mais lento', 'Impedir o uso da câmara', 'B', 'A nuvem serve exatamente para guardar cópias seguras fora do aparelho físico.'],
            ['tecnologia', 'O Vasco usa Wi-Fi público num café para aceder ao banco online, sem qualquer proteção extra. Qual é o risco?', 'Nenhum, redes públicas são sempre seguras', 'Outras pessoas na mesma rede podem tentar intercetar os dados', 'O telemóvel carrega mais rápido', 'A app do banco fica mais bonita', 'B', 'Redes Wi-Fi públicas são mais fáceis de serem monitorizadas por terceiros mal-intencionados.'],
            ['tecnologia', 'A Ivone recebeu um e-mail de um remetente desconhecido com um anexo estranho pedindo para abrir urgentemente. O que é mais prudente fazer?', 'Abrir imediatamente por curiosidade', 'Não abrir e verificar a origem antes de qualquer ação', 'Reencaminhar para todos os contactos', 'Responder com dados pessoais', 'B', 'Anexos inesperados são uma forma comum de espalhar vírus e malware.'],
            ['tecnologia', 'O Bruno quer comprar um novo telemóvel e vê um anúncio com preço muito abaixo do mercado, pedindo pagamento antecipado por transferência. O que deve considerar?', 'Comprar de imediato, é uma pechincha', 'Desconfiar, pois preços muito abaixo do normal podem indicar burla', 'Pagar sem verificar o vendedor', 'Nunca comprar telemóveis online', 'B', 'Ofertas exageradamente baratas, com pagamento antecipado obrigatório, são um sinal de alerta comum.'],
            ['tecnologia', 'A Rosa quer proteger melhor a conta do banco online. Qual destas opções aumenta mais a segurança?', 'Usar sempre a mesma senha simples', 'Ativar a autenticação de dois fatores (2FA)', 'Partilhar a senha co

            ['emprego', 'O Hélder vai a uma entrevista de emprego e não sabe nada sobre a empresa nem sobre a vaga. Qual é a melhor preparação antes da entrevista?', 'Não se preparar, pois improvisar é melhor', 'Pesquisar sobre a empresa e rever os requisitos da vaga', 'Chegar atrasado de propósito', 'Levar o currículo de outra pessoa', 'B', 'Conhecer a empresa e a vaga mostra interesse genuíno e ajuda a responder melhor às perguntas.'],
            ['emprego', 'A Teresa está a escrever o currículo e tem dúvidas sobre incluir experiências antigas sem relação com a vaga. O que é mais indicado?', 'Incluir tudo, mesmo sem relação nenhuma', 'Focar nas experiências mais relevantes para a vaga', 'Inventar experiências para parecer melhor', 'Deixar o currículo em branco', 'B', 'Um currículo direcionado à vaga é mais eficaz do que um currículo genérico com tudo.'],
            ['emprego', 'O André recebeu uma crítica do seu chefe sobre um erro no trabalho. Qual é a atitude mais profissional?', 'Discutir e negar o erro sempre', 'Ouvir, entender o que pode melhorar e ajustar o comportamento', 'Ignorar completamente o comentário', 'Demitir-se imediatamente', 'B', 'Feedback, mesmo que difícil de ouvir, é uma oportunidade de crescimento profissional.'],
            ['emprego', 'A Isabel quer criar uma rede de contactos profissionais mas não sabe por onde começar. O que é um bom primeiro passo?', 'Evitar falar com colegas de trabalho', 'Participar em eventos da área e manter contacto com colegas e ex-colegas', 'Esconder o que faz profissionalmente', 'Só falar com desconhecidos na rua', 'B', 'Networking cresce naturalmente ao manter e cultivar relações profissionais existentes.'],
            ['emprego', 'O Domingos está a preparar-se para pedir um aumento de salário. Qual argumento é mais eficaz?', 'Dizer que precisa de mais dinheiro para despesas pessoais', 'Apresentar resultados concretos e contribuições para a empresa', 'Ameaçar sair se não receber o aumento', 'Comparar-se negativamente com colegas', 'B', 'Argumentos baseados em resultados e valor entregue à empresa são mais convincentes.'],
            ['emprego', 'A Lurdes foi chamada para uma segunda entrevista mas não sabe o que vestir. Qual é geralmente a escolha mais segura?', 'Roupa de praia', 'Roupa adequada e alinhada com a cultura da empresa', 'Pijama, por ser mais confortável', 'Roupa de desporto', 'B', 'Vestir-se de forma adequada ao contexto da empresa transmite profissionalismo.'],
            ['emprego', 'O Jaime perdeu o emprego recentemente e está desanimado para procurar um novo. O que pode ajudar a retomar a procura de forma mais eficaz?', 'Desistir de procurar', 'Atualizar o currículo e definir um plano diário de candidaturas', 'Candidatar-se apenas uma vez por mês', 'Esperar que o emprego apareça sozinho', 'B', 'Um plano estruturado de procura aumenta as chances de conseguir novas oportunidades.'],

            ['livros', 'O Simão terminou de ler um livro mas já não se lembra dos pontos principais uma semana depois. O que o ajudaria a reter melhor o conteúdo?', 'Ler mais rápido da próxima vez', 'Fazer um resumo ou anotações após cada capítulo', 'Ler sempre o mesmo livro repetidamente sem pausa', 'Evitar pensar sobre o que leu', 'B', 'Resumir e anotar ajuda a fixar melhor as ideias principais na memória.'],
            ['livros', 'A Beatriz quer escolher entre um livro de ficção e um livro técnico para aprender sobre um tema novo. Qual critério faz mais sentido usar?', 'Escolher apenas pela capa mais bonita', 'Considerar o objetivo: aprender factos ou explorar uma história', 'Escolher sempre o livro mais curto', 'Não ler nenhum dos dois', 'B', 'O objetivo da leitura (aprender ou entreter-se) ajuda a escolher o tipo de livro certo.'],
            ['livros', 'O Filipe lê um livro de não-ficção sobre finanças, mas duvida se as informações são confiáveis. O que pode verificar?', 'Não verificar nada e aceitar tudo', 'A credibilidade do autor e as fontes citadas no livro', 'Só olhar para o número de páginas', 'A cor da capa do livro', 'B', 'Livros de não-ficção confiáveis costumam citar fontes e ter autores com credibilidade no tema.'],
            ['livros', 'A Sónia quer começar a ler mais, mas sente que nunca tem tempo. O que poderia ajudá-la a criar o hábito?', 'Esperar até ter um dia totalmente livre', 'Reservar 10-15 minutos fixos por dia para leitura', 'Ler só quando estiver de férias', 'Desistir da ideia de ler', 'B', 'Pequenos blocos de tempo consistentes criam o hábito de leitura mais facilmente do que esperar por tempo livre.'],
            ['livros', 'O Rui está a ler um romance e sente dificuldade em acompanhar os vários personagens. O que pode ajudar?', 'Desistir do livro imediatamente', 'Fazer pequenas anotações sobre cada personagem à medida que aparecem', 'Ler o livro ao contrário', 'Ignorar os nomes dos personagens', 'B', 'Anotar detalhes dos personagens ajuda a acompanhar histórias mais complexas.'],

            ['desenvolvimento-pessoal', 'A Cristina tem uma lista longa de tarefas e não sabe por onde começar o dia. O que a ajudaria mais?', 'Fazer tudo ao mesmo tempo', 'Priorizar as tarefas mais importantes primeiro', 'Não fazer nenhuma tarefa', 'Escolher tarefas aleatoriamente', 'B', 'Priorizar ajuda a garantir que o mais importante é feito primeiro, mesmo com tempo limitado.'],
            ['desenvolvimento-pessoal', 'O Adriano costuma adiar tarefas importantes até ao último momento, o que lhe causa muito stress. Que hábito o ajudaria mais?', 'Continuar a adiar sem mudar nada', 'Dividir tarefas grandes em passos menores e começar cedo', 'Trabalhar só sob pressão extrema', 'Evitar todas as tarefas difíceis para sempre', 'B', 'Dividir tarefas grandes em partes menores reduz a procrastinação e o stress.'],
            ['desenvolvimento-pessoal', 'A Alzira quer melhorar a sua produtividade, mas costuma fazer várias coisas ao mesmo tempo (multitarefa). O que a ciência sugere sobre isso?', 'Multitarefa aumenta sempre a produtividade', 'Focar numa tarefa de cada vez costuma ser mais eficiente', 'Não faz diferença nenhuma', 'É impossível fazer uma tarefa de cada vez', 'B', 'Estudos mostram que alternar constantemente entre tarefas reduz a eficiência geral.'],
            ['desenvolvimento-pessoal', 'O Elias dorme poucas horas todos os dias para "ter mais tempo produtivo". Qual é o efeito real disso a longo prazo?', 'Aumenta sempre a produtividade sem consequências', 'Reduz o foco, a energia e o desempenho geral', 'Não tem nenhum efeito', 'Só afeta o humor, nada mais', 'B', 'A privação de sono prejudica a concentração, memória e desempenho, mesmo que pareça "ganhar tempo".'],
            ['desenvolvimento-pessoal', 'A Joana fica muito frustrada sempre que recebe uma crítica, mesmo que seja construtiva. O que a inteligência emocional ajudaria a desenvolver?', 'Ignorar todas as críticas para sempre', 'Reconhecer a emoção e responder de forma equilibrada, sem reagir por impulso', 'Evitar qualquer situação social', 'Reagir sempre com raiva imediata', 'B', 'A inteligência emocional envolve reconhecer as próprias emoções e geri-las de forma equilibrada.'],
        ];
        
        for (const q of extraQuestions) {
            const [slug, text, a, b, c, d, correct, explanation] = q;
            if (!quizIds[slug] || !catIds[slug]) continue;
            await pool.query(
                `INSERT INTO questions (quiz_id, category_id, question_type, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, reward_amount, xp_amount, difficulty_level)
                 VALUES ($1,$2,'multiple_choice',$3,$4,$5,$6,$7,$8,$9,0.05,10,2);`,
                [quizIds[slug], catIds[slug], text, a, b, c, d, correct, explanation]
            );
        }

        console.log(`Foram adicionadas ${extraQuestions.length} perguntas extra com cenários reais!`);
    } catch (err) {
        console.error('Erro ao adicionar perguntas extra:', err);
    }
}

async function ensureMigrations() {
    try {
        await pool.query(`ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS last_ad_boost_count INT DEFAULT 0;`);
        await pool.query(`UPDATE questions SET reward_amount = 0.70 WHERE reward_amount <> 0.70;`);
        console.log('Migrações aplicadas: coluna de reforço por anúncio + recompensa de 0.70 por pergunta.');
    } catch (err) {
        console.error('Erro ao aplicar migrações:', err);
    }
}

const PORT = process.env.PORT || 3000;
ensureSchema().then(ensureSeed).then(ensureExtraQuestions).then(ensureMigrations).then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
});
