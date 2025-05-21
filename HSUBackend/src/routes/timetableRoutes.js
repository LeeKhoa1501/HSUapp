// src/routes/timetableRoutes.js
const express = require('express');
const {
    getMyTimetable,
    getTodayTimetable,        // Import hàm mới
    checkSessionAvailability,
    checkInAttendance
} = require('../controllers/timetableController');
const { protect } = require('../middleware/authMiddleware'); // Middleware xác thực người dùng

const router = express.Router();

// Lấy toàn bộ lịch sử thời khóa biểu của user đã đăng nhập
router.route('/my').get(protect, getMyTimetable);

// LẤY LỊCH HỌC CHỈ CHO NGÀY HÔM NAY của user đã đăng nhập
router.route('/today').get(protect, getTodayTimetable); // API mới cho HomeScreen

// Kiểm tra xem có buổi học nào đang mở và trong giờ điểm danh không
router.route('/check-availability').get(protect, checkSessionAvailability);

// Sinh viên thực hiện check-in điểm danh
router.route('/checkin').post(protect, checkInAttendance); // Dùng POST vì có cập nhật dữ liệu

module.exports = router;