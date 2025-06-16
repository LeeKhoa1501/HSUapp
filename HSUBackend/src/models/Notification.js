// HSUBackend/src/models/Notification.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
    recipientId: { // ID của người nhận thông báo (sinh viên)
        type: Schema.Types.ObjectId,
        ref: 'users', // Tham chiếu đến Model User (đã đăng ký là 'users')
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: [true, 'Tiêu đề thông báo là bắt buộc'],
        trim: true,
    },
    shortDescription: { // Mô tả ngắn gọn hiển thị trong danh sách
        type: String,
        trim: true,
    },
    fullContent: { // Nội dung đầy đủ của thông báo
        type: String,
        required: [true, 'Nội dung đầy đủ là bắt buộc'],
        trim: true,
    },
    link: { // Đường dẫn tùy chọn nếu thông báo có liên kết đến trang khác
        type: String,
        trim: true,
    },
    isRead: {
        type: Boolean,
        default: false, // Mặc định là chưa đọc
    },
    type: { // Loại thông báo (ví dụ: 'system', 'academic', 'event', 'survey') - tùy chọn
        type: String,
        enum: ['system', 'academic', 'event', 'survey', 'other'],
        default: 'other',
    },
    // sentAt sẽ được quản lý bởi timestamps.createdAt
}, {
    timestamps: true, // Tự động thêm createdAt và updatedAt (createdAt có thể dùng như sentAt)
    collection: 'notifications' // Tên collection trong MongoDB
});

// Index cho việc truy vấn nhanh theo người nhận và trạng thái đọc
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema); // Đăng ký Model với tên 'Notification'