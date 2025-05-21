// src/routes/locationRoutes.js
const express = require('express');
// Import controller cho locations (mình cần tạo file này nữa)
const { getLocations } = require('../controllers/LocationController'); // <-- Đường dẫn đến controller

const router = express.Router();

// Định nghĩa route GET '/' cho locations
router.route('/').get(getLocations);

// Sau này có thể thêm các route khác như POST (thêm), PUT (sửa), DELETE (xóa)
// router.route('/').post(createLocation);
// router.route('/:id').get(getLocationById).put(updateLocation).delete(deleteLocation);

module.exports = router;