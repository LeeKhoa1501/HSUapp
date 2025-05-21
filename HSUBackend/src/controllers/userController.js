// src/controllers/userController.js
const User = require('../models/User'); // Import User model

const getUserProfile = async (req, res) => {
    // Middleware 'protect' đã tìm và gắn user vào req.user rồi
    if (req.user) {
        res.status(200).json({ success: true, data: req.user });
    } else {
        // Trường hợp này ít khi xảy ra nếu protect hoạt động đúng
        res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
};

module.exports = { getUserProfile };