// HSUBackend/src/routes/studyPlanRoutes.js
const express = require('express');
const {
    getMyStudyPlan,
    getAvailableCourses,
    updateStudyPlan
} = require('../controllers/studyPlanController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Lấy kế hoạch hiện tại của user
router.route('/my').get(protect, getMyStudyPlan)

// Cập nhật (ghi đè) kế hoạch của user
router.route('/my').put(protect, updateStudyPlan); // Dùng PUT để cập nhật toàn bộ

// Lấy danh sách môn có thể thêm vào kế hoạch
router.route('/available-courses').get(protect, getAvailableCourses);

module.exports = router;