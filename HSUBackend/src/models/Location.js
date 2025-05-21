// src/models/Location.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Định nghĩa cấu trúc cho Location document
const locationSchema = new Schema({
    name: { // Tên địa điểm (vd: "Trụ sở chính Nguyễn Văn Tráng")
        type: String,
        required: [true, 'Tên địa điểm là bắt buộc'],
        trim: true,
        unique: true // Tên địa điểm nên là duy nhất
    },
    address: { // Địa chỉ chi tiết
        type: String,
        trim: true
    },
    type: { // Loại địa điểm (vd: campus, hall, lab) - Tùy chọn
        type: String,
        trim: true,
        // enum: ['Main Campus', 'Campus', 'Hall', 'Lab', 'Other'] // Có thể giới hạn loại nếu muốn
    },
    // Thêm các trường khác nếu cần (vd: capacity - sức chứa, equipment - thiết bị có sẵn)
    // capacity: { type: Number },
    // equipment: [{ type: String }] // Mảng các thiết bị
}, { collection: 'Locations' }); 

// Tạo Model 'Location' dựa trên locationSchema
const Location = mongoose.model('Location', locationSchema);

module.exports = Location; // Xuất Model ra