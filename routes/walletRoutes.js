const express = require('express');
const router = express.Router();
const WalletController = require('../app/Controllers/WalletController');
const { protectRoute } = require('../app/Middleware/authMiddleware');

router.get('/balance', protectRoute, WalletController.getBalance);
router.get('/history', protectRoute, WalletController.getHistory);
router.get('/withdrawals', protectRoute, WalletController.myWithdrawals);
router.post('/withdraw', protectRoute, WalletController.requestWithdrawal);

module.exports = router;
