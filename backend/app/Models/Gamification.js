const pool = require('../../database/db');

const LEVEL_THRESHOLDS = [0, 500, 1500, 3000, 5000, 8000, 12000];
function calculateLevel(xp) {
    let level = 1;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
        if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    }
    return level;
}

function getWeekKey(date) {
    const d = new Date(date);
    const oneJan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${week}`;
}

const Gamification = {
    LEVEL_THRESHOLDS,
    calculateLevel,

    async ensureProgress(userId, client = pool) {
        await client.query(
            `INSERT INTO user_progress (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING;`,
            [userId]
        );
    },

    async getProgress(userId) {
        const { rows } = await pool.query('SELECT * FROM user_progress WHERE user_id = $1;', [userId]);
        return rows[0];
    },

    async registerAnswer(userId, { isCorrect, xpEarned }, client = pool) {
        await this.ensureProgress(userId, client);

        const todayStr = new Date().toISOString().slice(0, 10);
        const { rows: progRows } = await client.query('SELECT * FROM user_progress WHERE user_id = $1 FOR UPDATE;', [userId]);
        const prog = progRows[0];

        let { current_streak, longest_streak, last_activity_date } = prog;
        const lastDate = last_activity_date ? new Date(last_activity_date).toISOString().slice(0, 10) : null;

        if (lastDate !== todayStr) {
            const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            current_streak = (lastDate === yesterday) ? current_streak + 1 : 1;
            longest_streak = Math.max(longest_streak, current_streak);
        }

        const newXp = prog.xp_total + xpEarned;
        const newLevel = calculateLevel(newXp);

        const { rows } = await client.query(
            `UPDATE user_progress SET
                xp_total = $1,
                level = $2,
                questions_answered = questions_answered + 1,
                correct_answers = correct_answers + $3,
                current_streak = $4,
                longest_streak = $5,
                last_activity_date = $6
             WHERE user_id = $7
             RETURNING *;`,
            [newXp, newLevel, isCorrect ? 1 : 0, current_streak, longest_streak, todayStr, userId]
        );
        return { progress: rows[0], leveledUp: newLevel > prog.level };
    },

    async incrementQuizCompleted(userId, client = pool) {
        await client.query('UPDATE user_progress SET quizzes_completed = quizzes_completed + 1 WHERE user_id = $1;', [userId]);
    },

    async updateMissionProgress(userId, missionCode, incrementBy = 1, client = pool) {
        const { rows: missionRows } = await client.query('SELECT * FROM missions WHERE code = $1;', [missionCode]);
        const mission = missionRows[0];
        if (!mission) return null;

        const periodKey = mission.reset_period === 'weekly' ? getWeekKey(new Date()) : new Date().toISOString().slice(0, 10);

        await client.query(
            `INSERT INTO user_missions (user_id, mission_id, progress_count, period_key)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, mission_id, period_key)
             DO UPDATE SET progress_count = user_missions.progress_count + $3
             WHERE user_missions.is_completed = FALSE;`,
            [userId, mission.id, incrementBy, periodKey]
        );

        const { rows } = await client.query(
            `SELECT * FROM user_missions WHERE user_id = $1 AND mission_id = $2 AND period_key = $3;`,
            [userId, mission.id, periodKey]
        );
        const userMission = rows[0];
        if (userMission && !userMission.is_completed && userMission.progress_count >= mission.goal_count) {
            await client.query(
                `UPDATE user_missions SET is_completed = TRUE, completed_at = CURRENT_TIMESTAMP WHERE id = $1;`,
                [userMission.id]
            );
            return { completedMission: mission };
        }
        return null;
    },

    async listUserMissions(userId) {
        const todayKey = new Date().toISOString().slice(0, 10);
        const weekKey = getWeekKey(new Date());
        const { rows } = await pool.query(
            `SELECT m.code, m.title, m.description, m.goal_count, m.xp_reward, m.reset_period,
                    COALESCE(um.progress_count, 0) AS progress_count,
                    COALESCE(um.is_completed, FALSE) AS is_completed
             FROM missions m
             LEFT JOIN user_missions um ON um.mission_id = m.id AND um.user_id = $1
                AND um.period_key = CASE WHEN m.reset_period = 'weekly' THEN $2 ELSE $3 END;`,
            [userId, weekKey, todayKey]
        );
        return rows;
    },

    async unlockAchievement(userId, code, client = pool) {
        const { rows: achRows } = await client.query('SELECT * FROM achievements WHERE code = $1;', [code]);
        const achievement = achRows[0];
        if (!achievement) return null;

        const { rows } = await client.query(
            `INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)
             ON CONFLICT (user_id, achievement_id) DO NOTHING RETURNING *;`,
            [userId, achievement.id]
        );
        return rows[0] ? achievement : null;
    },

    async listUserAchievements(userId) {
        const { rows } = await pool.query(
            `SELECT a.code, a.title, a.description, a.icon, ua.unlocked_at
             FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id
             WHERE ua.user_id = $1 ORDER BY ua.unlocked_at DESC;`,
            [userId]
        );
        return rows;
    },

    async getRanking(period = 'geral', limit = 20) {
        const { rows } = await pool.query(
            `SELECT u.id, u.name, u.username, up.xp_total, up.level
             FROM user_progress up JOIN users u ON u.id = up.user_id
             ORDER BY up.xp_total DESC LIMIT $1;`,
            [limit]
        );
        return rows;
    }
};

module.exports = Gamification;
