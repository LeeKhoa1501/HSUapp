// src/routes/shiftRoutes.js
const express = require('express');
const { getShifts } = require('../controllers/shiftController'); // Import controller

const router = express.Router();

// Định nghĩa route GET '/' cho shifts
router.route('/').get(getShifts);

module.exports = router;