// src/routes/bookingRoutes.js
const express = require('express');
const { createBooking, getAllBookings, getMyBookings } = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware'); // Import middleware xác thực


const router = express.Router();

// Định nghĩa route POST '/'
// protect sẽ chạy trước createBooking để đảm bảo user đã đăng nhập
router.route('/')
.post(protect, createBooking)
.get(getAllBookings);

router.route('/mybookings')
.post(protect, createBooking);

// Thêm các route khác sau này (vd: GET lấy booking của tôi)
// router.route('/mybookings').get(protect, getMyBookings);

module.exports = router;