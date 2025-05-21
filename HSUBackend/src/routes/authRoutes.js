// src/routes/authRoutes.js
const express = require('express');
const { loginUser,getMe  } = require('../controllers/authController'); // Import controller
const { protect } = require('../middleware/authMiddleware'); // <-- Đảm bảo đã import protect
const router = express.Router();

// Định nghĩa route POST cho /login
router.post('/login', loginUser);
router.get('/me', protect, getMe); // Chỉ dùng .get() một lần

// Thêm route POST /register sau này

module.exports = router;