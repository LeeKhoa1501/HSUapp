// HSUBackend/src/routes/academicRequestRoutes.js
const express = require('express');
const router = express.Router();
const {
    createAcademicRequest,
    getMyAcademicRequests, // Hàm này được gọi cho /my
    getAcademicRequestById, // Hàm này được gọi cho /:id
    cancelAcademicRequest,
    approveAcademicRequest,
    rejectAcademicRequest
} = require('../controllers/academicRequestController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// Đặt route cụ thể '/my' LÊN TRÊN route động '/:id'
router.route('/my').get(getMyAcademicRequests); // <<<< ROUTE NÀY PHẢI ĐƯỢC ƯU TIÊN

router.route('/')
    .post(createAcademicRequest)

router.route('/:id') // Route này sẽ bắt các giá trị động sau /api/academic-requests/
    .get(getAcademicRequestById);

router.route('/:id/cancel').put(cancelAcademicRequest);
router.route('/:id/approve').put(approveAcademicRequest);
router.route('/:id/reject').put(rejectAcademicRequest);

module.exports = router;