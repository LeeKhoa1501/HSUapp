// HSUBackend/src/routes/companyRoutes.js
const express = require('express');
const { getCompanies } = require('../controllers/internshipController');
const { protect } = require('../middleware/authMiddleware'); // Hoặc bỏ protect nếu muốn public
const router = express.Router();

router.route('/').get(protect, getCompanies); // Hoặc bỏ protect nếu public

module.exports = router;