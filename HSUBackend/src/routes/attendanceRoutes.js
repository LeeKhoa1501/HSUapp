// src/routes/attendanceRoutes.js
const express = require('express');
// Import các hàm từ controller vừa tạo/sửa
const { getAttendanceSummary, getAttendanceDetails } = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware'); // Middleware xác thực

const router = express.Router();

// Định nghĩa route GET /api/attendance/summary (lấy tổng hợp)
router.route('/summary').get(protect, getAttendanceSummary);

// Định nghĩa route GET /api/attendance/details (lấy chi tiết vắng/trễ/phép)
router.route('/details').get(protect, getAttendanceDetails);

module.exports = router;