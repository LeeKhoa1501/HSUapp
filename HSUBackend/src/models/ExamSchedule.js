// src/models/ExamSchedule.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const examScheduleSchema = new Schema({
    // Ai thi? Liên kết với User
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Thi môn gì? Liên kết với Course
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    // Thi ở đâu? Liên kết với Location (Cơ sở) - Quan trọng cho yêu cầu của anh
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: false }, // Cho phép null nếu thi online hoặc không rõ
    // Ngày thi cụ thể (BẮT BUỘC)
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // Định dạng YYYY-MM-DD
    // Giờ bắt đầu thi
    startTime: { type: String, required: true },
    // Thời gian làm bài (phút)
    durationMinutes: { type: Number },
    // Phòng thi cụ thể
    room: { type: String },
    // Loại thi (Giữa kỳ / Cuối kỳ...)
    examType: { type: String, default: 'Cuối kỳ' },
    // Hình thức thi (Tự luận / Trắc nghiệm...)
    examFormat: { type: String },
     // Mã lớp học phần (Nếu cần phân biệt lớp thi)
     classId: { type: String },
    // Ghi chú thêm
    notes: { type: String }
}, {
    collection: 'examschedules', // Tên collection trong MongoDB (chữ thường, số nhiều)
    timestamps: true // Tự động thêm createdAt, updatedAt
});

// Index để tìm kiếm nhanh theo user và ngày
examScheduleSchema.index({ userId: 1, date: 1 });

const ExamSchedule = mongoose.model('ExamSchedule', examScheduleSchema);
module.exports = ExamSchedule;