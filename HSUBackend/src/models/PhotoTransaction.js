// HSUBackend/src/models/PhotoTransaction.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const photoTransactionSchema = new Schema({
    photoAccountId: { // Liên kết với tài khoản photo của user
        type: Schema.Types.ObjectId,
        ref: 'PhotoAccount', // Tên Model PhotoAccount vừa tạo
        required: true,
        index: true
    },
    userId: { // Giữ lại userId để dễ query nếu cần (hoặc có thể populate từ photoAccountId)
        type: Schema.Types.ObjectId,
        ref: 'User', // Tên Model User của anh
        required: true,
        index: true
    },
    type: { // Loại giao dịch
        type: String,
        enum: ['PRINT', 'COPY', 'SCAN', 'DEPOSIT_AUTO', 'DEPOSIT_MANUAL', 'ADJUSTMENT'],
        required: true,
        default: 'PRINT'
    },
    amount: { // Số tiền giao dịch (âm cho chi tiêu, dương cho nạp)
        type: Number,
        required: true
    },
    description: { // Mô tả chi tiết giao dịch
        type: String,
        trim: true,
        required: [true, 'Mô tả giao dịch là bắt buộc']
    },
    pages: { // Số trang (nếu là giao dịch in/photo)
        type: Number,
        min: 0
    },
    documentName: { // Tên tài liệu (nếu có)
        type: String,
        trim: true
    },
    transactionDate: { // Ngày thực hiện giao dịch
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true,
    collection: 'PhotoTransactions'
});

photoTransactionSchema.index({ userId: 1, transactionDate: -1 }); // Index để query lịch sử nhanh

module.exports = mongoose.model('PhotoTransaction', photoTransactionSchema);