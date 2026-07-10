const User = require('../Models/User');
const bcrypt = require('bcryptjs');
const pool = require('../../database/db');

const ProfileController = {
    async getProfile(req, res) {
        try {
            const user = await User.findById(req.user.id);
            if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
            return res.json({ user });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao buscar perfil." });
        }
    },

    async updateProfile(req, res) {
        try {
            const { name, phone, language, avatarUrl } = req.body;
            const user = await User.updateProfile(req.user.id, { name, phone, language, avatarUrl });
            return res.json({ message: "Perfil atualizado com sucesso!", user });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao atualizar perfil." });
        }
    },

    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            if (!currentPassword || !newPassword || newPassword.length < 6) {
                return res.status(400).json({ error: "Informe a senha atual e uma nova senha com pelo menos 6 caracteres." });
            }

            const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1;', [req.user.id]);
            const isMatch = await bcrypt.compare(currentPassword, rows[0].password_hash);
            if (!isMatch) {
                return res.status(400).json({ error: "Senha atual incorreta." });
            }

            const salt = await bcrypt.genSalt(10);
            const newHash = await bcrypt.hash(newPassword, salt);
            await User.updatePassword(req.user.id, newHash);

            return res.json({ message: "Senha alterada com sucesso!" });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Erro ao alterar senha." });
        }
    }
};

module.exports = ProfileController;
