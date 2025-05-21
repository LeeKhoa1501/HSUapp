// HSUBackend/src/models/StudyPlan.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Chỉ lưu courseId, các thông tin khác sẽ lookup khi cần
const plannedCourseSchema = new Schema({
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
}, { _id: false });

const semesterPlanSchema = new Schema({
    // Dùng mã kỳ để tiện sắp xếp và truy vấn (ví dụ: 2431, 2432, ...)
    // Hoặc có thể dùng semester + academicYear như cũ nếu anh thích
    semesterCode: { type: String, required: true, index: true },
    // Lưu thêm tên kỳ và năm học để hiển thị nếu cần, tránh lookup nhiều lần
    semesterName: { type: String }, // Ví dụ: "Học kỳ 1"
    academicYear: { type: String }, // Ví dụ: "2024-2025"
    courses: [plannedCourseSchema]
}, { _id: false });

const studyPlanSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    // Kế hoạch cho các kỳ cụ thể (sắp xếp theo mã kỳ)
    plannedSemesters: { type: [semesterPlanSchema], default: [] },
    // Các môn chưa được xếp vào kỳ nào
    unsortedCourses: { type: [plannedCourseSchema], default: [] },
}, {
    timestamps: true, // Lưu thời gian cập nhật kế hoạch
    collection: 'studyplans'
});

// Sắp xếp plannedSemesters trước khi lưu (tùy chọn)
// studyPlanSchema.pre('save', function(next) {
//   if (this.plannedSemesters && this.plannedSemesters.length > 1) {
//     this.plannedSemesters.sort((a, b) => (a.semesterCode || '').localeCompare(b.semesterCode || ''));
//   }
//   next();
// });

module.exports = mongoose.model('StudyPlan', studyPlanSchema);