// src/routes/gradeRoutes.js
const express = require('express');
const { getMyGrades } = require('../controllers/gradeController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/my').get(protect, getMyGrades); // GET /api/grades/my

module.exports = router;