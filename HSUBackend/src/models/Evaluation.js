// HSUBackend/src/models/Evaluation.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const answerSchema = new Schema({
    questionId: { type: String, required: true },
    questionText: { type: String, trim: true }, // Lưu lại text để tiện xem
    rating: { type: Number, min: 1, max: 5 }, // Cho câu hỏi rating
    comment: { type: String, trim: true }      // Cho câu hỏi comment
}, { _id: false });

const evaluationSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    semester: { type: String, required: true, index: true },
    academicYear: { type: String, required: true, index: true },
    instructorId: { type: Schema.Types.ObjectId, ref: 'User' }, // ID Giảng viên (nếu có)
    instructorName: { type: String, trim: true },              // Hoặc Tên Giảng viên
    answers: {
        type: [answerSchema],
        required: true,
        validate: [v => Array.isArray(v) && v.length > 0, 'Answers cannot be empty.']
    },
    generalComment: { type: String, trim: true },
    submittedAt: { type: Date, default: Date.now }
}, {
    collection: 'evaluations',
    timestamps: { createdAt: 'submittedAt', updatedAt: false }
});

evaluationSchema.index({ userId: 1, courseId: 1, semester: 1, academicYear: 1 }, { unique: true, sparse: true });

const Evaluation = mongoose.model('Evaluation', evaluationSchema);
module.exports = Evaluation;