const express = require('express');
const router = express.Router();
const PremiumController = require('../app/Controllers/PremiumController');
const { protectRoute, adminOnly } = require('../app/Middleware/authMiddleware');

router.get('/plans', protectRoute, PremiumController.listPlans);
router.get('/status', protectRoute, PremiumController.myStatus);
router.post('/subscribe', protectRoute, PremiumController.subscribe);
router.post('/confirm', protectRoute, adminOnly(), PremiumController.confirmSubscription);

module.exports = router;
