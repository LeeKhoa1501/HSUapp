// HSUBackend/src/routes/evaluationRoutes.js
const express = require('express');
const {
    getEvaluableCourses,
    submitEvaluation,
    getEvaluationQuestions
} = require('../controllers/evaluationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Lấy danh sách môn CÓ THỂ đánh giá
router.route('/evaluatable').get(protect, getEvaluableCourses);

// Lấy bộ câu hỏi đánh giá
router.route('/questions').get(protect, getEvaluationQuestions);

// Nộp bài đánh giá
router.route('/').post(protect, submitEvaluation);


module.exports = router;