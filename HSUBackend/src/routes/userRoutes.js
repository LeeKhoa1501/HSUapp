// src/routes/userRoutes.js
const express = require('express');
const { getUserProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware'); // Dùng lại middleware protect

const router = express.Router();

// Định nghĩa route GET /me, yêu cầu xác thực
router.route('/me').get(protect, getUserProfile);

module.exports = router;