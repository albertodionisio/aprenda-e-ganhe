const Notification = require('../Models/Notification');

const NotificationController = {
    async list(req, res) {
        try {
            const notifications = await Notification.listForUser(req.user.id);
            const unread = await Notification.unreadCount(req.user.id);
            return res.json({ notifications, unread });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao buscar notificações." });
        }
    },

    async markRead(req, res) {
        try {
            const { id } = req.params;
            const notification = await Notification.markRead(req.user.id, id);
            return res.json({ notification });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao marcar notificação." });
        }
    },

    async markAllRead(req, res) {
        try {
            await Notification.markAllRead(req.user.id);
            return res.json({ message: "Todas as notificações foram marcadas como lidas." });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao marcar notificações." });
        }
    }
};

module.exports = NotificationController;
