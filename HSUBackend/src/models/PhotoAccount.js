// HSUBackend/src/models/PhotoAccount.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const photoAccountSchema = new Schema({
    userId: { // Liên kết với User
        type: Schema.Types.ObjectId,
        ref: 'User', // Tên Model User của anh
        required: true,
        unique: true, // Mỗi user chỉ có 1 tài khoản photo
        index: true
    },
    balance: { // Số dư hiện tại (VNĐ)
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    lastTransactionDate: { // Ngày của giao dịch cuối cùng
        type: Date
    }
}, {
    timestamps: true, // Tự động thêm createdAt, updatedAt
    collection: 'PhotoAccounts' // Tên collection trong MongoDB
});

module.exports = mongoose.model('PhotoAccount', photoAccountSchema);