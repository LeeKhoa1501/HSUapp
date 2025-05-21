// src/routes/tuitionRoutes.js
const express = require('express');
const { getMyTuitionFees } = require('../controllers/tuitionController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/my').get(protect, getMyTuitionFees); // GET /api/tuition/my

module.exports = router;