// HSUBackend/src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const {
    getMyNotifications,
    markSingleNotificationAsRead, // Sử dụng tên hàm đã đổi
    markAllAsRead,
    createNotification
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// Áp dụng middleware 'protect' cho tất cả các route trong file này
// Điều này có nghĩa là tất cả API này đều yêu cầu người dùng phải đăng nhập
router.use(protect);

// @route   GET /api/notifications/my
// @desc    Lấy danh sách thông báo của người dùng hiện tại
router.route('/my').get(getMyNotifications);

// @route   PUT /api/notifications/mark-all-as-read
// @desc    Đánh dấu TẤT CẢ thông báo của user là đã đọc
router.route('/mark-all-as-read').put(markAllAsRead); // API mới

// @route   PUT /api/notifications/:notificationId/mark-as-read
// @desc    Đánh dấu một thông báo cụ thể là đã đọc
// Route này phải được đặt SAU '/mark-all-as-read' để tránh 'mark-all-as-read' bị hiểu nhầm là một notificationId
router.route('/:notificationId/mark-as-read').put(markSingleNotificationAsRead);

// @route   POST /api/notifications/
// @desc    (Tùy chọn - cho Admin/test) Tạo một thông báo mới
// Khoa có thể bỏ comment dòng dưới nếu muốn test tạo thông báo từ Postman
// router.route('/').post(createNotification);

module.exports = router;