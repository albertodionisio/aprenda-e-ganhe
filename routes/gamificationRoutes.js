const express = require('express');
const router = express.Router();
const GamificationController = require('../app/Controllers/GamificationController');
const { protectRoute } = require('../app/Middleware/authMiddleware');

router.get('/progress', protectRoute, GamificationController.getProgress);
router.get('/missions', protectRoute, GamificationController.getMissions);
router.get('/achievements', protectRoute, GamificationController.getAchievements);
router.get('/ranking', protectRoute, GamificationController.getRanking);

module.exports = router;
