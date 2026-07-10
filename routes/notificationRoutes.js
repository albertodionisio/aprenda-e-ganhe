const express = require('express');
const router = express.Router();
const NotificationController = require('../app/Controllers/NotificationController');
const { protectRoute } = require('../app/Middleware/authMiddleware');

router.get('/', protectRoute, NotificationController.list);
router.put('/:id/read', protectRoute, NotificationController.markRead);
router.put('/read-all', protectRoute, NotificationController.markAllRead);

module.exports = router;
