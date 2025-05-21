// src/controllers/shiftController.js
const Shift = require('../models/Shift'); // Import Shift Model

// @desc    Lấy tất cả ca học
// @route   GET /api/shifts
// @access  Public (Hoặc Private nếu cần login để xem ca)
const getShifts = async (req, res) => {
    console.log('[ShiftCtrl] === Handling GET /api/shifts ===');
    try {
        // --- Lấy ĐẦY ĐỦ các trường cần thiết từ DB ---
        // Sắp xếp theo startTime để thứ tự hợp lý trong Picker
        const shiftsFromDB = await Shift.find({}) // Lấy tất cả
        .select('_id name label startTime endTime') // <<< LẤY ĐỦ CÁC TRƯỜNG NÀY
        .sort('startTime') // Sắp xếp theo giờ bắt đầu
        .lean(); // Dùng lean() để trả về plain object, nhanh hơn

        console.log(`[ShiftCtrl] Found ${shiftsFromDB.length} shifts from DB.`);

        // --- KHÔNG CẦN FORMAT LẠI Ở ĐÂY ---
        // Frontend sẽ tự xử lý việc tạo label từ name/startTime/endTime
        // Chỉ cần đảm bảo API trả về đúng các trường cần thiết

        res.status(200).json({
            success: true,
            count: shiftsFromDB.length,
            data: shiftsFromDB // <<< TRẢ VỀ DỮ LIỆU GỐC TỪ DB (đã select đủ trường)
        });

    } catch (error) {
        console.error('--- ERROR in getShifts Controller ---', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi Server khi lấy danh sách ca học'
        });
    }
};

module.exports = {
    getShifts,
};