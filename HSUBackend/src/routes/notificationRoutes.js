// HSUBackend/src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const {
    getMyNotifications,
    markNotificationAsRead,
    createNotification // Import nếu Khoa muốn test tạo thông báo
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// Tất cả các route này đều yêu cầu người dùng đã đăng nhập
router.use(protect);

// @route   GET /api/notifications/my
// @desc    Lấy danh sách thông báo của người dùng hiện tại
router.route('/my').get(getMyNotifications);

// @route   PUT /api/notifications/:notificationId/mark-as-read
// @desc    Đánh dấu một thông báo là đã đọc
router.route('/:notificationId/mark-as-read').put(markNotificationAsRead);

// @route   POST /api/notifications/
// @desc    (Tùy chọn - cho Admin/test) Tạo một thông báo mới
// router.route('/').post(createNotification); // Bỏ comment nếu muốn dùng API này

module.exports = router;