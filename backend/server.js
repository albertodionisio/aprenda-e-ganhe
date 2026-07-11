require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
