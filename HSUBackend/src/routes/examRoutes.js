// src/routes/examRoutes.js
const express = require('express');
const { getMyExams } = require('../controllers/examController'); // Import controller
const { protect } = require('../middleware/authMiddleware');     // Import middleware xác thực

const router = express.Router();

// GET /api/exams/my (Phải đăng nhập mới xem được)
router.route('/my').get(protect, getMyExams);

module.exports = router;