// HSUBackend/src/routes/bookingRoutes.js
const express = require('express');
const { createBooking, getAllBookings, getMyBookings } = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware'); // Import middleware xác thực

const router = express.Router();

// --- Route để TẠO một booking mới ---
// POST /api/bookings/
router.route('/')
    .post(protect, createBooking);

// --- Route để LẤY TẤT CẢ bookings (Thường cho Admin) ---
// GET /api/bookings/
// Nếu chỉ Admin được xem, thêm isAdmin: .get(protect, isAdmin, getAllBookings);
router.route('/') // Có thể gộp vào dòng trên: .get(getAllBookings)
    .get(protect, getAllBookings); 

// --- Route để SINH VIÊN LẤY booking CỦA CHÍNH MÌNH ---
// GET /api/bookings/my
router.route('/my')
    .get(protect, getMyBookings); // << ĐẢM BẢO DÙNG GET VÀ getMyBookings

module.exports = router;