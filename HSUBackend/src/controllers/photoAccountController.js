// HSUBackend/src/controllers/photoAccountController.js
const asyncHandler = require('express-async-handler');
const PhotoAccount = require('../models/PhotoAccount'); // Đường dẫn đến Model
const PhotoTransaction = require('../models/PhotoTransaction'); // Đường dẫn đến Model
const User = require('../models/User'); // Đường dẫn đến Model User

// @desc    Lấy thông tin tài khoản photo của user đang đăng nhập
// @route   GET /api/photo-account/me
// @access  Private
const getMyPhotoAccountInfo = asyncHandler(async (req, res) => {
    const userId = req.user._id; // Được cung cấp bởi middleware `protect`

    let photoAccount = await PhotoAccount.findOne({ userId: userId });

    if (!photoAccount) {
        // Nếu không tìm thấy, tự động tạo một tài khoản mới với số dư 0
        console.log(`Tài khoản photo không tồn tại cho user ${userId}. Đang tạo mới...`);
        photoAccount = await PhotoAccount.create({ userId: userId, balance: 0 });
        if (!photoAccount) {
             res.status(500);
             throw new Error('Không thể tạo tài khoản photo mới.');
        }
        console.log(`Đã tạo tài khoản photo mới cho user ${userId} với số dư 0.`);
    }

    const user = await User.findById(userId).select('fullName studentId email');

    res.json({
        success: true,
        data: {
            userName: user ? user.fullName : 'Không rõ',
            studentId: user ? user.studentId : 'N/A',
            balance: photoAccount.balance,
            lastTransactionDate: photoAccount.lastTransactionDate,
            _id: photoAccount._id
        }
    });
});

// @desc    Lấy lịch sử giao dịch photo của user đang đăng nhập
// @route   GET /api/photo-account/me/transactions
// @access  Private
const getMyPhotoTransactions = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const pageSize = parseInt(req.query.pageSize) || 15;
    const page = parseInt(req.query.pageNumber) || 1;

    const count = await PhotoTransaction.countDocuments({ userId: userId });
    const transactions = await PhotoTransaction.find({ userId: userId })
        .sort({ transactionDate: -1, createdAt: -1 })
        .limit(pageSize)
        .skip(pageSize * (page - 1));

    res.json({
        success: true,
        count,
        page,
        pages: Math.ceil(count / pageSize),
        data: transactions
    });
});

module.exports = {
    getMyPhotoAccountInfo,
    getMyPhotoTransactions
};