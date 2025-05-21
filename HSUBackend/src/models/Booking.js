// src/models/Booking.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId, // Kiểu dữ liệu đặc biệt cho ID của MongoDB
        ref: 'User', // Tham chiếu tới Model 'User'
        required: true
    },
    locationId: {
        type: Schema.Types.ObjectId,
        ref: 'Location', // Tham chiếu tới Model 'Location' (sẽ tạo sau)
        required: true
    },
    shiftId: {
        type: Schema.Types.ObjectId,
        ref: 'Shift', // Tham chiếu tới Model 'Shift' (sẽ tạo sau)
        required: true
    },
    bookingDate: {
        type: Date, // Lưu dưới dạng Date object
        required: true
    },
    startTime: { // Giờ bắt đầu thực tế người dùng nhập
        type: String,
        required: true
        // match: [/^\d{2}:\d{2}$/, 'Định dạng giờ bắt đầu phải là HH:mm'] // Regex kiểm tra format (tùy chọn)
    },
    endTime: { // Giờ kết thúc thực tế người dùng nhập
        type: String,
        required: true
        // match: [/^\d{2}:\d{2}$/, 'Định dạng giờ kết thúc phải là HH:mm'] // Regex kiểm tra format (tùy chọn)
    },
    numberOfParticipants: {
        type: Number,
        required: true,
        min: [1, 'Số người tham dự phải lớn hơn 0'] // Ràng buộc giá trị tối thiểu
    },
    purpose: { // Giá trị value của Radio Button
        type: String,
        required: true,
        enum: ['event_project', 'poster', 'consult', 'other'] // Chỉ cho phép các giá trị này
    },
    purposeDetail: { // Mô tả thêm
        type: String,
        trim: true
    },
    notes: { // Ghi chú
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled'], // Các trạng thái có thể có
        default: 'pending' // Trạng thái mặc định
    }
}, { timestamps: true }); // Tự động thêm createdAt, updatedAt

const Booking = mongoose.model('Booking', bookingSchema); // Tạo model 'Booking' liên kết collection 'bookings'

module.exports = Booking;