// src/controllers/locationController.js
const Location = require('../models/Location'); // Import Location Model

// @desc    Lấy tất cả địa điểm
// @route   GET /api/locations
// @access  Public (Ai cũng có thể gọi)
const getLocations = async (req, res) => {
    try {
        // Tìm tất cả documents trong collection 'locations'
        // .select('name') chỉ lấy trường 'name' và '_id' (mặc định)
        // .sort('name') sắp xếp theo tên A-Z
        const locations = await Location.find({}, '-__v').sort('name'); 

        res.status(200).json({
            success: true,
            count: locations.length,
            data: locations
        });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách địa điểm:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi Server khi lấy danh sách địa điểm'
        });
    }
};

// Xuất hàm controller ra để route có thể dùng
module.exports = {
    getLocations,
    // Thêm các hàm khác sau này nếu cần (vd: thêm, sửa, xóa location)
};