const express = require('express');
const router = express.Router();
const ReferralController = require('../app/Controllers/ReferralController');
const { protectRoute } = require('../app/Middleware/authMiddleware');

router.get('/', protectRoute, ReferralController.getMyReferrals);

module.exports = router;
