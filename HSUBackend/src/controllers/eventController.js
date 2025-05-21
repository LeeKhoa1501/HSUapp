// HSUBackend/src/controllers/eventController.js
const Event = require('../models/Event'); // Đường dẫn này là tương đối từ controllers -> models
const asyncHandler = require('express-async-handler');

// @desc    Lấy tất cả sự kiện, có thể filter và phân trang
// @route   GET /api/events
// @access  Public
const getEvents = asyncHandler(async (req, res) => {
    const pageSize = parseInt(req.query.pageSize) || 10;
    const page = parseInt(req.query.pageNumber) || 1;

    let query = {};

    // Filter theo keyword (tìm kiếm tên sự kiện)
    if (req.query.keyword) {
        query.eventName = { $regex: req.query.keyword, $options: 'i' };
    }

    // Filter theo status (có thể nhận nhiều status, ví dụ: ?status=Sắp diễn ra&status=Đang diễn ra)
    if (req.query.status) {
        if (Array.isArray(req.query.status)) {
            query.status = { $in: req.query.status };
        } else {
            query.status = req.query.status;
        }
    }

    // Filter theo category
    if (req.query.category) {
        query.category = req.query.category;
    }

    try {
        const count = await Event.countDocuments(query);
        const events = await Event.find(query)
            .sort({ startDate: 1 }) // Sắp xếp theo ngày bắt đầu tăng dần (sự kiện gần nhất trước)
            .limit(pageSize)
            .skip(pageSize * (page - 1));

        res.json({ events, page, pages: Math.ceil(count / pageSize), count });
    } catch (error) {
        console.error("Error in getEvents:", error);
        res.status(500).json({ message: "Lỗi Server khi lấy danh sách sự kiện" });
    }
});

// @desc    Lấy chi tiết một sự kiện bằng ID
// @route   GET /api/events/:id
// @access  Public
const getEventById = asyncHandler(async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (event) {
            res.json(event);
        } else {
            res.status(404).json({ message: 'Sự kiện không tìm thấy' });
        }
    } catch (error) {
        console.error(`Error in getEventById for ID ${req.params.id}:`, error);
        if (error.kind === 'ObjectId') { // Nếu ID không đúng định dạng ObjectId
             res.status(400).json({ message: 'ID sự kiện không hợp lệ' });
        } else {
            res.status(500).json({ message: "Lỗi Server khi lấy chi tiết sự kiện" });
        }
    }
});

// @desc    API lấy các sự kiện "Đã kết thúc" để demo "Sự kiện đã tham gia" trên Trang chủ
// @route   GET /api/events/summary/attended-demo
// @access  Public (cho mục đích demo này)
const getAttendedEventsSummaryDemo = asyncHandler(async (req, res) => {
    try {
        // Lấy 3 sự kiện đã kết thúc, sắp xếp theo ngày bắt đầu gần nhất (hoặc ngày kết thúc)
        const attendedEvents = await Event.find({ status: 'Đã kết thúc' })
            .sort({ startDate: -1 }) // Lấy sự kiện đã kết thúc gần đây nhất lên đầu
            .limit(3);

        res.json({ success: true, count: attendedEvents.length, data: attendedEvents });
    } catch (error) {
        console.error("Error in getAttendedEventsSummaryDemo:", error);
        res.status(500).json({ message: "Lỗi Server khi lấy tóm tắt sự kiện đã tham gia" });
    }
});

module.exports = {
    getEvents,
    getEventById,
    getAttendedEventsSummaryDemo
};