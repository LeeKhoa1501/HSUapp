// src/routes/locationRoutes.js
const express = require('express');
const { getLocations } = require('../controllers/LocationController'); // Import controller

const router = express.Router(); // Tạo một đối tượng Router của Express

// Định nghĩa route: Khi có request GET tới đường dẫn gốc ('/') của router này
// thì gọi hàm getLocations từ controller
router.route('/').get(getLocations);

module.exports = router; // Xuất router ra để server.js sử dụng