// HSUBackend/src/routes/internshipRoutes.js
const express = require('express');
const router = express.Router();
const {
    getMyInternshipRequests,
    createInternshipRequest,
    getCompanies,
    getInternshipRequestById,   // Hàm này cần req.params.id
    cancelInternshipRequest,    // Hàm này cần req.params.id
    approveInternshipRequest,   // Hàm này cần req.params.id
    rejectInternshipRequest     // Hàm này cần req.params.id
} = require('../controllers/internshipController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
    .post(createInternshipRequest);

router.route('/my')
    .get(getMyInternshipRequests);

router.route('/companies')
    .get(getCompanies);

// === ĐẢM BẢO ROUTE NÀY ĐÚNG VỚI DẤU HAI CHẤM CHO PARAMETER ID ===
router.route('/:id') // <<<< PHẢI LÀ /:id (CÓ DẤU :)
    .get(getInternshipRequestById); // Lấy chi tiết

router.route('/:id/cancel').put(cancelInternshipRequest);
router.route('/:id/approve').put(approveInternshipRequest);
router.route('/:id/reject').put(rejectInternshipRequest);

module.exports = router;