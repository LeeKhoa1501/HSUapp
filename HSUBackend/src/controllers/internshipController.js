// HSUBackend/src/controllers/internshipController.js
const mongoose = require('mongoose');
const InternshipRequest = require('../models/InternshipRequest');
const Company = require('../models/Company');
const User = require('../models/User');
const Location = require('../models/Location');
const asyncHandler = require('express-async-handler');

// --- HELPER FUNCTIONS ---

// Helper function để log lỗi chi tiết (giữ nguyên)
const handleError = (res, error, controllerName, statusCode = 500) => {
    console.error(`[InternshipCtrl][${controllerName}] ERROR: ${error.message}`);
    console.error(error.stack);
    if (res.headersSent) return;
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: `Dữ liệu không hợp lệ cho trường ${error.path}: "${error.value}".` });
    }
    const finalStatusCode = res.statusCode !== 200 ? res.statusCode : statusCode;
    return res.status(finalStatusCode).json({ success: false, message: error.message || 'Đã có lỗi xảy ra trên máy chủ.' });
};

// Helper để lấy và populate request, tránh lặp code
const getPopulatedInternshipRequest = (id) => {
    return InternshipRequest.findById(id)
        .populate({ path: 'companyId', select: 'name industry website address contactPerson contactEmail contactPhone' })
        .populate({ path: 'receivingCampusId', select: 'name address building', model: 'Location' })
        .populate({ path: 'userId', select: 'studentId fullName email studentClass major majorName', model: 'users' })
        .populate({ path: 'processedBy', select: 'fullName email', model: 'users' })
        .lean(); // Sử dụng lean() để tăng hiệu suất
};

// --- CONTROLLERS ---

// @desc    Tạo đơn xin thực tập mới
const createInternshipRequest = asyncHandler(async (req, res) => {
    const controllerName = 'createInternshipRequest';
    try {
        const userId = req.user._id;
        const {
            semester, studentClass, academicYear, internshipType,
            companyId, companyNameOther, companyAddressOther, companyContactOther,
            receivingCampusId, notes, startDate, endDate
        } = req.body;

        // 1. Validation các trường bắt buộc
        if (!semester || !academicYear || !internshipType || !receivingCampusId || (!companyId && !companyNameOther)) {
            res.status(400);
            throw new Error('Vui lòng điền đủ thông tin bắt buộc: Học kỳ, Năm học, Loại hình TT, Nơi nhận HS, và Thông tin công ty.');
        }

        // 2. Kiểm tra tính hợp lệ và sự tồn tại của các ID
        if (receivingCampusId) {
            if (!mongoose.Types.ObjectId.isValid(receivingCampusId)) { res.status(400); throw new Error('ID Cơ sở nhận không hợp lệ.'); }
            const campusExists = await Location.findById(receivingCampusId).lean();
            if (!campusExists) { res.status(404); throw new Error('Cơ sở nhận đã chọn không tồn tại.'); }
        }
        let companyObjectId = null;
        if (companyId) {
            if (!mongoose.Types.ObjectId.isValid(companyId)) { res.status(400); throw new Error('ID Doanh nghiệp không hợp lệ.'); }
            const companyExists = await Company.findById(companyId).lean();
            if (!companyExists) { res.status(404); throw new Error('Doanh nghiệp đã chọn không tồn tại.'); }
            companyObjectId = companyId;
        }

        // 3. Lấy thông tin lớp học của sinh viên nếu chưa có
        let finalStudentClass = studentClass;
        if (!finalStudentClass) {
            const studentUser = await User.findById(userId).select('studentClass').lean();
            if (!studentUser || !studentUser.studentClass) { res.status(400); throw new Error("Không thể xác định Lớp của sinh viên từ hồ sơ."); }
            finalStudentClass = studentUser.studentClass;
        }

        // 4. Tạo đối tượng dữ liệu mới
        const newRequestData = {
            userId,
            studentClass: finalStudentClass,
            semester,
            academicYear,
            internshipType,
            receivingCampusId,
            notes: notes || '',
            status: 'Pending',
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
        };

        if (companyObjectId) {
            newRequestData.companyId = companyObjectId;
        } else {
            newRequestData.companyNameOther = String(companyNameOther).trim();
            if (companyAddressOther) newRequestData.companyAddressOther = String(companyAddressOther).trim();
            if (companyContactOther) newRequestData.companyContactOther = String(companyContactOther).trim();
        }

        // 5. Lưu vào cơ sở dữ liệu
        const newInternshipRequest = new InternshipRequest(newRequestData);
        const savedRequest = await newInternshipRequest.save();
        
        const populatedRequest = await getPopulatedInternshipRequest(savedRequest._id);

        res.status(201).json({ success: true, message: 'Yêu cầu thực tập của bạn đã được gửi.', data: populatedRequest });
    } catch (error) {
        handleError(res, error, controllerName);
    }
});

// @desc    Lấy danh sách đơn thực tập của user hiện tại
const getMyInternshipRequests = asyncHandler(async (req, res) => {
    const controllerName = 'getMyInternshipRequests';
    try {
        const userId = req.user._id;
        // Lấy tham số từ query string, ví dụ: /api/internships/my?academicYear=2024-2025&semester=HK1
        const { academicYear, semester } = req.query;

        console.log(`[InternshipCtrl] Fetching requests for User: ${userId}, Year: ${academicYear}, Semester: ${semester}`);

        // Xây dựng bộ lọc động
        const filter = { userId: userId };
        if (academicYear && academicYear !== 'all') {
            filter.academicYear = academicYear;
        }
        if (semester && semester !== 'all') {
            filter.semester = semester;
        }

        const requests = await InternshipRequest.find(filter) // Áp dụng bộ lọc
            .populate({ path: 'companyId', select: 'name' })
            .populate({ path: 'receivingCampusId', select: 'name', model: 'Location' })
            .sort({ academicYear: -1, semester: -1, createdAt: -1 })
            .lean();

        res.status(200).json({ success: true, count: requests.length, data: requests });
    } catch (error) {
        handleError(res, error, controllerName);
    }
});


// @desc    Lấy danh sách công ty
const getCompanies = asyncHandler(async (req, res) => {
    const controllerName = 'getCompanies';
    try {
        const companies = await Company.find({ isActive: true })
            .select('name _id industry website address') // Bỏ các trường contact để giảm dữ liệu không cần thiết
            .sort({ name: 1 })
            .lean(); // Dùng lean()
        res.status(200).json({ success: true, count: companies.length, data: companies });
    } catch (error) {
        handleError(res, error, controllerName);
    }
});

// @desc    Lấy chi tiết một đơn xin thực tập bằng ID
const getInternshipRequestById = asyncHandler(async (req, res) => {
    const controllerName = 'getInternshipRequestById';
    try {
        const requestId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            res.status(400); throw new Error('ID đơn không hợp lệ.');
        }

        const internshipRequest = await getPopulatedInternshipRequest(requestId);

        if (!internshipRequest) {
            res.status(404); throw new Error('Không tìm thấy đơn thực tập này.');
        }

        if (internshipRequest.userId._id.toString() !== req.user._id.toString() /* && req.user.role !== 'admin' */) {
            res.status(403); throw new Error('Bạn không có quyền xem đơn thực tập này.');
        }

        res.status(200).json({ success: true, data: internshipRequest });
    } catch (error) {
        handleError(res, error, controllerName);
    }
});

// @desc    Sinh viên hủy đơn xin thực tập của mình
const cancelInternshipRequest = asyncHandler(async (req, res) => {
    const controllerName = 'cancelInternshipRequest';
    try {
        const requestId = req.params.id;
        const userId = req.user._id;

        const internshipRequest = await InternshipRequest.findById(requestId);
        if (!internshipRequest) { res.status(404); throw new Error('Không tìm thấy đơn thực tập.'); }
        if (internshipRequest.userId.toString() !== userId.toString()) { res.status(403); throw new Error('Bạn không có quyền hủy đơn này.'); }
        if (internshipRequest.status !== 'Pending') { res.status(400); throw new Error(`Không thể hủy khi đơn đã ở trạng thái "${internshipRequest.status}".`); }

        internshipRequest.status = 'Cancelled';
        internshipRequest.processedBy = userId;
        internshipRequest.processedDate = Date.now();
        internshipRequest.statusUpdateHistory.push({ status: 'Cancelled', updatedBy: userId, notes: 'Sinh viên tự hủy đơn.' });
        
        const updatedRequest = await internshipRequest.save();
        const populatedRequest = await getPopulatedInternshipRequest(updatedRequest._id);

        res.json({ success: true, message: 'Đơn thực tập của bạn đã được hủy.', data: populatedRequest });
    } catch (error) {
        handleError(res, error, controllerName);
    }
});

// @desc    (Demo) Admin/GV duyệt một đơn thực tập
const approveInternshipRequest = asyncHandler(async (req, res) => {
    const controllerName = 'approveInternshipRequest';
    try {
        const requestId = req.params.id;
        const { adminNotes } = req.body;

        const internshipRequest = await InternshipRequest.findById(requestId);
        if (!internshipRequest) { res.status(404); throw new Error('Không tìm thấy đơn thực tập.'); }
        if (internshipRequest.status !== 'Pending') { res.status(400); throw new Error(`Đơn đã ở trạng thái "${internshipRequest.status}", không thể duyệt lại.`); }

        internshipRequest.status = 'Approved';
        internshipRequest.processedBy = req.user._id;
        internshipRequest.processedDate = Date.now();
        if (adminNotes) internshipRequest.adminNotes = adminNotes;
        internshipRequest.statusUpdateHistory.push({ status: 'Approved', updatedBy: req.user._id, notes: adminNotes || 'Đã duyệt đơn (Demo).' });
        
        const updatedRequest = await internshipRequest.save();
        const populatedRequest = await getPopulatedInternshipRequest(updatedRequest._id);

        res.json({ success: true, message: 'Đã duyệt đơn thực tập (Demo).', data: populatedRequest });
    } catch (error) {
        handleError(res, error, controllerName);
    }
});

// @desc    (Demo) Admin/GV từ chối một đơn thực tập
const rejectInternshipRequest = asyncHandler(async (req, res) => {
    const controllerName = 'rejectInternshipRequest';
    try {
        const requestId = req.params.id;
        const { adminNotes } = req.body;

        if (!adminNotes || String(adminNotes).trim() === "") { res.status(400); throw new Error('Vui lòng cung cấp lý do/ghi chú từ chối.'); }

        const internshipRequest = await InternshipRequest.findById(requestId);
        if (!internshipRequest) { res.status(404); throw new Error('Không tìm thấy đơn thực tập.'); }
        if (internshipRequest.status !== 'Pending') { res.status(400); throw new Error(`Đơn đã ở trạng thái "${internshipRequest.status}", không thể từ chối.`); }

        internshipRequest.status = 'Rejected';
        internshipRequest.processedBy = req.user._id;
        internshipRequest.processedDate = Date.now();
        internshipRequest.adminNotes = adminNotes.trim();
        internshipRequest.statusUpdateHistory.push({ status: 'Rejected', updatedBy: req.user._id, notes: `Lý do từ chối: ${adminNotes.trim()}` });
        
        const updatedRequest = await internshipRequest.save();
        const populatedRequest = await getPopulatedInternshipRequest(updatedRequest._id);
        
        res.json({ success: true, message: 'Đã từ chối đơn thực tập (Demo).', data: populatedRequest });
    } catch (error) {
        handleError(res, error, controllerName);
    }
});

module.exports = {
    getMyInternshipRequests,
    createInternshipRequest,
    getCompanies,
    getInternshipRequestById,
    cancelInternshipRequest,
    approveInternshipRequest,
    rejectInternshipRequest
};