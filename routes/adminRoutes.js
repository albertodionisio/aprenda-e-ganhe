const express = require('express');
const router = express.Router();
const AdminController = require('../app/Controllers/AdminController');
const { protectRoute, adminOnly } = require('../app/Middleware/authMiddleware');

router.use(protectRoute, adminOnly());

router.get('/dashboard', AdminController.getDashboard);
router.get('/users', AdminController.listUsers);
router.put('/users/:userId/status', adminOnly(['admin']), AdminController.updateUserStatus);
router.get('/withdrawals', AdminController.listWithdrawals);
router.put('/withdrawals/:withdrawalId', adminOnly(['admin', 'financeiro']), AdminController.resolveWithdrawal);
router.get('/questions', AdminController.listQuestions);

module.exports = router;
