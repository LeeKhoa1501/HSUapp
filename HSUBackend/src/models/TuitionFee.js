// src/models/TuitionFee.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tuitionFeeSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    semester: { type: String, required: true }, // Ví dụ: "Học kỳ 1", "Học kỳ hè"
    academicYear: { type: String, required: true }, // Ví dụ: "2024-2025"
    description: { type: String, default: 'Học phí' }, // Mô tả khoản phí
    amountDue: { type: Number, required: true, default: 0 }, // Số tiền phải đóng
    amountPaid: { type: Number, default: 0 }, // Số tiền đã đóng
    dueDate: { type: Date }, // Hạn chót thanh toán
    paymentDate: { type: Date }, // Ngày thanh toán cuối cùng (nếu có)
    status: {
        type: String,
        enum: ['Unpaid', 'Paid', 'Partially Paid', 'Overdue'],
        default: 'Unpaid'
    },
    // Có thể thêm mảng chi tiết các khoản cấu thành học phí nếu cần
    // feeItems: [{ description: String, amount: Number }]
}, {
    collection: 'tuitionfees', // Tên collection
    timestamps: true
});

// Index để query nhanh theo user và kỳ học
tuitionFeeSchema.index({ userId: 1, academicYear: -1, semester: 1 }); // Sắp xếp năm giảm dần

const TuitionFee = mongoose.model('TuitionFee', tuitionFeeSchema);
module.exports = TuitionFee;