// HSUBackend/src/controllers/notificationController.js
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const asyncHandler = require('express-async-handler');

/**
 * @desc    Lấy danh sách thông báo của người dùng hiện tại
 * @route   GET /api/notifications/my
 * @access  Private
 */
const getMyNotifications = asyncHandler(async (req, res) => {
    const userId = req.user._id; // Lấy từ middleware protect
    console.log(`[NotifCtrl] Fetching notifications for user: ${userId}`);

    try {
        const notifications = await Notification.find({ recipientId: userId })
            .sort({ createdAt: -1 }) // Thông báo mới nhất lên đầu
            .limit(50) // Giới hạn số lượng thông báo trả về để tránh quá tải
            .lean(); // Sử dụng lean để tăng hiệu suất nếu chỉ đọc

        res.status(200).json({
            success: true,
            count: notifications.length,
            data: notifications
        });
    } catch (error) {
        console.error('[NotifCtrl][getMyNotifications] Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách thông báo.' });
    }
});

/**
 * @desc    Đánh dấu một thông báo là đã đọc
 * @route   PUT /api/notifications/:notificationId/mark-as-read
 * @access  Private
 */
const markNotificationAsRead = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const notificationId = req.params.notificationId;
    console.log(`[NotifCtrl] Marking notification ${notificationId} as read for user ${userId}`);

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        res.status(400);
        throw new Error('ID thông báo không hợp lệ.');
    }

    try {
        const notification = await Notification.findOne({
            _id: notificationId,
            recipientId: userId // Đảm bảo user chỉ đánh dấu đã đọc thông báo của chính mình
        });

        if (!notification) {
            res.status(404);
            throw new Error('Không tìm thấy thông báo hoặc bạn không có quyền cập nhật.');
        }

        if (notification.isRead) {
            return res.status(200).json({ success: true, message: 'Thông báo đã được đánh dấu đã đọc trước đó.', data: notification });
        }

        notification.isRead = true;
        const updatedNotification = await notification.save();

        res.status(200).json({
            success: true,
            message: 'Đã đánh dấu thông báo là đã đọc.',
            data: updatedNotification
        });

    } catch (error) {
        console.error('[NotifCtrl][markAsRead] Error:', error);
        if (!res.headersSent) { // Tránh gửi response nhiều lần nếu lỗi đã được throw và bắt bởi asyncHandler
             const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
             res.status(statusCode).json({ success: false, message: error.message || 'Lỗi server khi cập nhật thông báo.' });
        }
    }
});


// Thêm hàm tạo thông báo (ví dụ cho Admin hoặc hệ thống tự tạo) - TÙY CHỌN
const createNotification = asyncHandler(async (req, res) => {
    // Đây là ví dụ cơ bản, trong thực tế cần kiểm tra quyền (ví dụ: chỉ Admin)
    // Hoặc hàm này có thể được gọi nội bộ bởi các service khác trong hệ thống
    const { recipientId, title, shortDescription, fullContent, link, type } = req.body;

    if (!recipientId || !title || !fullContent) {
        res.status(400);
        throw new Error('Vui lòng cung cấp người nhận, tiêu đề và nội dung đầy đủ.');
    }
    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        res.status(400);
        throw new Error('ID người nhận không hợp lệ.');
    }

    try {
        const notification = await Notification.create({
            recipientId,
            title,
            shortDescription,
            fullContent,
            link,
            type
        });
        res.status(201).json({ success: true, data: notification });
    } catch (error) {
        console.error('[NotifCtrl][createNotification] Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi tạo thông báo.' });
    }
});


module.exports = {
    getMyNotifications,
    markNotificationAsRead,
    createNotification // Export nếu Khoa muốn có API tạo thông báo (ví dụ cho Postman test)
};