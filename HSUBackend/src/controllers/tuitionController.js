// src/controllers/tuitionController.js
const mongoose = require('mongoose');
const TuitionFee = require('../models/TuitionFee'); // Import model mới

/**
 * @desc    Lấy lịch sử học phí của user đang đăng nhập
 * @route   GET /api/tuition/my
 * @access  Private
 */
const getMyTuitionFees = async (req, res) => {
    console.log('[TuitionCtrl] === Handling GET /api/tuition/my ===');
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa xác thực.' });

    try {
        // Tìm tất cả các bản ghi học phí của user, sắp xếp theo năm giảm, kỳ tăng
        const tuitionHistory = await TuitionFee.find({ userId: new mongoose.Types.ObjectId(userId) })
                                          .sort({ academicYear: -1, semester: 1 }); // Có thể cần logic sort semester phức tạp hơn

        console.log(`[TuitionCtrl] Found ${tuitionHistory.length} tuition records for user ${userId}.`);

        res.status(200).json({
            success: true,
            count: tuitionHistory.length,
            data: tuitionHistory // Trả về mảng dữ liệu học phí
        });

    } catch (error) {
        console.error('--- ERROR in getMyTuitionFees Controller ---', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy thông tin học phí.' });
    }
};

module.exports = { getMyTuitionFees };