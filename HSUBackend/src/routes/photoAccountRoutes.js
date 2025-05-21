// HSUBackend/src/routes/photoAccountRoutes.js
const express = require('express');
const router = express.Router();
const {
    getMyPhotoAccountInfo,
    getMyPhotoTransactions
} = require('../controllers/photoAccountController'); // Đường dẫn đến Controller
const { protect } = require('../middleware/authMiddleware'); // Middleware xác thực

// Áp dụng middleware `protect` cho tất cả các route trong file này
// Điều này có nghĩa là tất cả API này đều yêu cầu người dùng phải đăng nhập
router.use(protect);

// Định nghĩa route để lấy thông tin tài khoản photo
router.route('/me').get(getMyPhotoAccountInfo);

// Định nghĩa route để lấy lịch sử giao dịch photo
router.route('/me/transactions').get(getMyPhotoTransactions);

module.exports = router;