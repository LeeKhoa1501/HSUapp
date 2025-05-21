// src/models/Grade.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const gradeSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    semester: { type: String, required: true }, // Ví dụ: "Học kỳ 1", "Học kỳ Tết"
    academicYear: { type: String, required: true }, // Ví dụ: "2023-2024"
    // Các cột điểm thành phần (tùy theo cấu trúc điểm của trường)
    midtermScore: { type: Number },
    assignmentScore: { type: Number },
    practicalScore: { type: Number },
    finalExamScore: { type: Number },
    // Điểm tổng kết (số và chữ)
    overallScore: { type: Number }, // Điểm số (hệ 10 hoặc 4)
    letterGrade: { type: String }, // Điểm chữ (A, B+, C...)
    status: { type: String, enum: ['Passed', 'Failed', 'In Progress'], default: 'In Progress' }, // Trạng thái môn học
    notes: { type: String } // Ghi chú thêm (vd: Cấm thi, Đang chờ phúc khảo...)
}, {
    collection: 'grades', // Tên collection
    timestamps: true // Thời gian tạo/cập nhật điểm
});

// Index tổng hợp để query điểm theo user, kỳ, năm
gradeSchema.index({ userId: 1, academicYear: 1, semester: 1 });
// Index để query điểm của một môn cụ thể
gradeSchema.index({ userId: 1, courseId: 1 });

const Grade = mongoose.model('Grade', gradeSchema);
module.exports = Grade;