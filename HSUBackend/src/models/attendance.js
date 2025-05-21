// src/models/attendance.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const attendanceSchema = new Schema({
    // Sinh viên nào?
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Buổi học nào trong thời khóa biểu? (Rất quan trọng để link đúng buổi)
    timetableEntryId: { type: Schema.Types.ObjectId, ref: 'Timetable', required: true },
    // Trạng thái điểm danh cho buổi học đó
    status: {
        type: String,
        required: true,
        enum: ['Present', 'Absent', 'Late', 'Excused'], // Có mặt, Vắng, Trễ, Có phép
        default: 'Absent' // Mặc định là vắng nếu không có ghi nhận khác? (Tùy logic)
    },
    // Ngày thực tế của buổi điểm danh (lấy từ Timetable entry, lưu lại cho tiện query)
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    // Thời gian check-in thực tế (nếu có hệ thống check-in)
    attendanceTime: { type: Date },
    // Ghi chú của Giảng viên (vd: Vắng có phép, Trễ 5p)
    notes: { type: String, trim: true },
    // Ai là người ghi nhận điểm danh này (GV nào?) - Tùy chọn
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' }

}, {
    collection: 'attendances', // Tên collection trong DB
    timestamps: true // Thời gian ghi nhận điểm danh
});

// Index để tìm điểm danh theo user và ngày, hoặc theo buổi học
attendanceSchema.index({ userId: 1, date: 1 });
attendanceSchema.index({ timetableEntryId: 1, userId: 1 }, { unique: true }); // Đảm bảo mỗi SV chỉ có 1 record/buổi học

const CheckIn = mongoose.model('attendance', attendanceSchema);
module.exports = CheckIn;