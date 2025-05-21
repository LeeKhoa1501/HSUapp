// src/models/Course.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const courseSchema = new Schema({
    courseCode: { // Ví dụ: "LE202DV01"
        type: String,
        required: true,
        unique: true, // Mã môn nên là duy nhất
        trim: true,
        uppercase: true
    },
    courseName: { // Ví dụ: "Tư duy Phản biện"
        type: String,
        required: true,
        trim: true
    },
    credits: { // Số tín chỉ
        type: Number,
        required: true
    },
    hasPrerequisite: { // Có tiên quyết không
        type: Boolean,
        default: false
    },
    fee: { // Học phí gốc (có thể thay đổi theo kỳ)
        type: Number
    },
    notes: { // Ghi chú thêm
        type: String
    }
    // Các trường khác nếu cần
}, { collection: 'courses' }); 

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;