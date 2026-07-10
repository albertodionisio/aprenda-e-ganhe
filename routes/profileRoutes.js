const express = require('express');
const router = express.Router();
const ProfileController = require('../app/Controllers/ProfileController');
const { protectRoute } = require('../app/Middleware/authMiddleware');

router.get('/', protectRoute, ProfileController.getProfile);
router.put('/', protectRoute, ProfileController.updateProfile);
router.put('/password', protectRoute, ProfileController.changePassword);

module.exports = router;
