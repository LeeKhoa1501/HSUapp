// HSUBackend/src/controllers/notificationController.js
const mongoose = require('mongoose');
const Notification = require('../models/Notification'); // Đảm bảo Model Notification đã được tạo và export đúng
const User = require('../models/User'); // Cần thiết nếu createNotification kiểm tra sự tồn tại của recipient
const asyncHandler = require('express-async-handler');

/**
 * @desc    Lấy danh sách thông báo của người dùng hiện tại, sắp xếp mới nhất lên đầu
 * @route   GET /api/notifications/my
 * @access  Private
 */
const getMyNotifications = asyncHandler(async (req, res) => {
    const controllerName = 'getMyNotifications';
    const userId = req.user?._id; // Lấy từ middleware protect

    console.log(`[NotifCtrl][${controllerName}] Fetching notifications for User ID: ${userId}`);

    if (!userId) {
        console.error(`[NotifCtrl][${controllerName}] Unauthorized: User ID not found in request.`);
        return res.status(401).json({ success: false, message: 'Xác thực không thành công, vui lòng đăng nhập lại.' });
    }

    try {
        const notifications = await Notification.find({ recipientId: userId })
            .sort({ createdAt: -1 }) // Thông báo mới nhất lên đầu
            .limit(50) // Giới hạn số lượng để tránh quá tải, có thể phân trang sau này
            .lean(); // Sử dụng lean để tăng hiệu suất nếu chỉ đọc

        console.log(`[NotifCtrl][${controllerName}] Found ${notifications.length} notifications for user ${userId}.`);
        res.status(200).json({
            success: true,
            count: notifications.length,
            data: notifications
        });
    } catch (error) {
        console.error(`[NotifCtrl][${controllerName}] --- ERROR ---`);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách thông báo.' });
    }
});

/**
 * @desc    Đánh dấu một thông báo cụ thể là đã đọc
 * @route   PUT /api/notifications/:notificationId/mark-as-read
 * @access  Private
 */
const markSingleNotificationAsRead = asyncHandler(async (req, res) => {
    const controllerName = 'markSingleNotificationAsRead';
    const userId = req.user._id;
    const { notificationId } = req.params;

    console.log(`[NotifCtrl][${controllerName}] User ${userId} marking notification ${notificationId} as read.`);

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        console.warn(`[NotifCtrl][${controllerName}] Invalid notificationId format: ${notificationId}`);
        res.status(400);
        throw new Error('ID thông báo không hợp lệ.');
    }

    try {
        const notification = await Notification.findOne({
            _id: notificationId,
            recipientId: userId // Đảm bảo user chỉ cập nhật thông báo của chính mình
        });

        if (!notification) {
            console.warn(`[NotifCtrl][${controllerName}] Notification ${notificationId} not found for user ${userId}.`);
            res.status(404);
            throw new Error('Không tìm thấy thông báo hoặc bạn không có quyền truy cập thông báo này.');
        }

        if (notification.isRead) {
            console.log(`[NotifCtrl][${controllerName}] Notification ${notificationId} was already marked as read.`);
            // Vẫn trả về thành công và thông tin thông báo
            return res.status(200).json({ success: true, message: 'Thông báo đã được đánh dấu là đã đọc trước đó.', data: notification });
        }

        notification.isRead = true;
        const updatedNotification = await notification.save();

        console.log(`[NotifCtrl][${controllerName}] Notification ${updatedNotification._id} marked as read.`);
        res.status(200).json({
            success: true,
            message: 'Đã đánh dấu thông báo là đã đọc.',
            data: updatedNotification // Trả về thông báo đã cập nhật
        });

    } catch (error) {
        console.error(`[NotifCtrl][${controllerName}] --- ERROR ---`);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        // asyncHandler sẽ tự bắt lỗi và next(error)
        // Middleware xử lý lỗi chung trong server.js sẽ gửi response
        // Tuy nhiên, nếu muốn response cụ thể hơn ở đây:
        if (!res.headersSent) {
             const statusCode = res.statusCode !== 200 ? res.statusCode : (error.status || 500);
             res.status(statusCode).json({ success: false, message: error.message || 'Lỗi máy chủ khi cập nhật trạng thái thông báo.' });
        }
    }
});

/**
 * @desc    Đánh dấu TẤT CẢ thông báo của user là đã đọc
 * @route   PUT /api/notifications/mark-all-as-read
 * @access  Private
 */
const markAllAsRead = asyncHandler(async (req, res) => {
    const controllerName = 'markAllAsRead';
    const userId = req.user._id;
    console.log(`[NotifCtrl][${controllerName}] User ${userId} is marking all unread notifications as read.`);

    try {
        const updateResult = await Notification.updateMany(
            { recipientId: userId, isRead: false }, // Chỉ cập nhật những thông báo CHƯA ĐỌC của user này
            { $set: { isRead: true } }             // Set isRead thành true
        );

        console.log(`[NotifCtrl][${controllerName}] Update result for user ${userId}: Matched ${updateResult.matchedCount}, Modified ${updateResult.modifiedCount}`);

        res.status(200).json({
            success: true,
            message: updateResult.modifiedCount > 0
                ? `Đã đánh dấu ${updateResult.modifiedCount} thông báo là đã đọc.`
                : 'Không có thông báo mới nào để đánh dấu đã đọc.',
            data: {
                modifiedCount: updateResult.modifiedCount,
                matchedCount: updateResult.matchedCount
            }
        });

    } catch (error) {
        console.error(`[NotifCtrl][${controllerName}] --- ERROR ---`);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cố gắng đánh dấu tất cả thông báo đã đọc.' });
        }
    }
});


// (Tùy chọn) Hàm tạo thông báo mới - Thường dùng cho Admin hoặc hệ thống tự động
const createNotification = asyncHandler(async (req, res) => {
    const controllerName = 'createNotification';
    console.log(`[NotifCtrl][${controllerName}] Attempting to create notification.`);
    // Trong thực tế, cần kiểm tra quyền của req.user (ví dụ: req.user.role === 'admin')

    const { recipientId, title, shortDescription, fullContent, link, type } = req.body;

    if (!recipientId || !title || !fullContent) {
        res.status(400);
        throw new Error('Vui lòng cung cấp người nhận, tiêu đề và nội dung đầy đủ cho thông báo.');
    }
    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        res.status(400);
        throw new Error('ID người nhận (recipientId) không hợp lệ.');
    }
    // Kiểm tra xem recipientId có tồn tại trong User collection không
    const userExists = await User.findById(recipientId);
    if (!userExists) {
        res.status(404);
        throw new Error(`Không tìm thấy người dùng với ID: ${recipientId}`);
    }

    try {
        const notification = await Notification.create({
            recipientId,
            title,
            shortDescription,
            fullContent,
            link,
            type: type || 'other', // Mặc định nếu không có type
            isRead: false // Thông báo mới luôn là chưa đọc
        });
        console.log(`[NotifCtrl][${controllerName}] Notification created successfully: ${notification._id}`);
        res.status(201).json({ success: true, message: "Thông báo đã được tạo.", data: notification });
    } catch (error) {
        console.error(`[NotifCtrl][${controllerName}] --- ERROR ---`);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join('. ') });
        }
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo thông báo.' });
        }
    }
});

module.exports = {
    getMyNotifications,
    markSingleNotificationAsRead, // Đổi tên cho rõ ràng
    markAllAsRead,
    createNotification // Export nếu Khoa muốn có API tạo thông báo (ví dụ cho Postman test)
};