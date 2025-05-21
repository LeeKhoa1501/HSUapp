// src/models/Shift.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Định nghĩa cấu trúc cho Shift document
const shiftSchema = new Schema({
    code: { // Mã ca học (vd: CA1, CA2) - Nên là duy nhất
        type: String,
        required: [true, 'Mã ca học là bắt buộc'],
        unique: true,
        uppercase: true, // Tự động chuyển thành chữ hoa
        trim: true
    },
    name: { // Tên đầy đủ của ca học (vd: "Ca 1 (7:00 - 9:30)")
        type: String,
        required: [true, 'Tên ca học là bắt buộc'],
        trim: true
    },
    startTime: { // Giờ bắt đầu chuẩn của ca
        type: String,
        required: true,
        match: [/^\d{2}:\d{2}$/, 'Định dạng giờ bắt đầu phải là HH:mm']
    },
    endTime: { // Giờ kết thúc chuẩn của ca
        type: String,
        required: true,
        match: [/^\d{2}:\d{2}$/, 'Định dạng giờ kết thúc phải là HH:mm']
    },
    description: { // Mô tả thêm (tùy chọn)
        type: String,
        trim: true
    }
    // Không cần timestamps cho collection này nếu ít thay đổi
}, { collection: 'shifts' }); // Chỉ rõ tên collection là 'shifts'

// Tạo Model 'Shift' dựa trên shiftSchema
const Shift = mongoose.model('Shift', shiftSchema);

module.exports = Shift; // Xuất Model ra