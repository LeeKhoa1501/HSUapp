// HSUBackend/src/routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const {
    getEvents,
    getEventById,
    getAttendedEventsSummaryDemo
} = require('../controllers/eventController'); // Đảm bảo đường dẫn này đúng

// @route   GET /api/events
// @desc    Lấy tất cả sự kiện (có thể có query params để filter/paginate)
router.get('/', getEvents);

// @route   GET /api/events/summary/attended-demo
// @desc    Lấy tóm tắt các sự kiện đã kết thúc (demo cho trang chủ)
router.get('/summary/attended-demo', getAttendedEventsSummaryDemo);


// @route   GET /api/events/:id
// @desc    Lấy chi tiết một sự kiện
router.get('/:id', getEventById);


module.exports = router;