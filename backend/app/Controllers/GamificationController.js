const Gamification = require('../Models/Gamification');

const GamificationController = {
    async getProgress(req, res) {
        try {
            const progress = await Gamification.getProgress(req.user.id);
            const nextThreshold = Gamification.LEVEL_THRESHOLDS[progress.level] || null;
            return res.json({ progress, nextLevelXp: nextThreshold });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao buscar progresso." });
        }
    },

    async getMissions(req, res) {
        try {
            const missions = await Gamification.listUserMissions(req.user.id);
            return res.json({ missions });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao buscar missões." });
        }
    },

    async getAchievements(req, res) {
        try {
            const achievements = await Gamification.listUserAchievements(req.user.id);
            return res.json({ achievements });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao buscar conquistas." });
        }
    },

    async getRanking(req, res) {
        try {
            const { period } = req.query;
            const ranking = await Gamification.getRanking(period || 'geral');
            return res.json({ ranking });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao buscar ranking." });
        }
    }
};

module.exports = GamificationController;
