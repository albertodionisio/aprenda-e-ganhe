const express = require('express');
const router = express.Router();
const QuizController = require('../app/Controllers/QuizController');
const { protectRoute, adminOnly } = require('../app/Middleware/authMiddleware');
const antiFraudCheck = require('../app/Middleware/antiFraud');

router.get('/categories', protectRoute, QuizController.listCategories);
router.get('/next', protectRoute, QuizController.getRandomQuiz);
router.post('/submit', protectRoute, antiFraudCheck, QuizController.submitAnswer);
router.post('/ad-boost', protectRoute, QuizController.adBoost);
router.post('/add', protectRoute, adminOnly(), QuizController.addQuiz);

module.exports = router;
