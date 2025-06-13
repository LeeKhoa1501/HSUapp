// HSUBackend/src/controllers/internshipController.js
const mongoose = require('mongoose');
const InternshipRequest = require('../models/InternshipRequest');
const Company = require('../models/Company'); // Giả sử Model đăng ký là 'Company'
const User = require('../models/User');       // Model User được đăng ký là 'users'
const Location = require('../models/Location'); // Giả sử Model đăng ký là 'Location'
const asyncHandler = require('express-async-handler');

// Helper function để log lỗi chi tiết
const handleError = (res, error, controllerName, statusCode = 500) => {
    console.error(`[InternshipCtrl][${controllerName}] --- ERROR ---`);
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack); // Rất quan trọng để debug
    console.error(`[InternshipCtrl][${controllerName}] --- END ERROR ---`);

    if (res.headersSent) { // Nếu response đã được gửi thì không làm gì thêm
        return;
    }
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    if (error instanceof mongoose.Error.CastError) {
        return res.status(400).json({ success: false, message: `Dữ liệu không hợp lệ cho trường ${error.path}: "${error.value}".` });
    }
    const finalStatusCode = res.statusCode !== 200 ? res.statusCode : statusCode; // Giữ status code đã set nếu có
    return res.status(finalStatusCode).json({ success: false, message: error.message || 'Đã có lỗi xảy ra trên máy chủ.' });
};


// @desc    Lấy danh sách đơn thực tập của user hiện tại
const getMyInternshipRequests = asyncHandler(async (req, res) => {
    const controllerName = 'getMyInternshipRequests';
    console.log(`[InternshipCtrl][${controllerName}] === Handling GET /api/internships/my ===`);
    const userId = req.user?._id;

    if (!userId) {
        console.error(`[InternshipCtrl][${controllerName}] Error: Unauthorized - userId not found.`);
        return res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
    }
    console.log(`[InternshipCtrl][${controllerName}] Fetching requests for User ID: ${userId}`);

    try {
        const requests = await InternshipRequest.find({ userId: userId })
            .populate({ path: 'companyId', select: 'name industry' }) // Đảm bảo Model Company đăng ký là 'Company'
            .populate({ path: 'receivingCampusId', select: 'name building', model: 'Location' }) // Đảm bảo Model Location là 'Location'
            .populate({ path: 'userId', select: 'fullName studentId email', model: 'users' }) // User model là 'users'
            .sort({ requestDate: -1, createdAt: -1 }) // Sắp xếp ưu tiên requestDate, rồi đến createdAt
            .lean();

        console.log(`[InternshipCtrl][${controllerName}] Found ${requests.length} internship requests.`);
        res.status(200).json({ success: true, count: requests.length, data: requests });
    } catch (error) {
        handleError(res, error, controllerName);
    }
});

// @desc    Tạo đơn xin thực tập mới
const createInternshipRequest = asyncHandler(async (req, res) => {
    const controllerName = 'createInternshipRequest';
    console.log(`[InternshipCtrl][${controllerName}] === Handling POST /api/internships ===`);
    console.log(`[InternshipCtrl][${controllerName}] User ID: ${req.user?._id}`);
    console.log(`[InternshipCtrl][${controllerName}] Request Body:`, JSON.stringify(req.body, null, 2));

    const userId = req.user._id; // Đã qua protect nên req.user._id phải có
    const {
        semester, studentClass, academicYear, internshipType,
        companyId, companyNameOther, companyAddressOther, companyContactOther,
        receivingCampusId, notes, startDate, endDate
    } = req.body;

    // Validation các trường bắt buộc
    if (!semester || !academicYear || !internshipType || !receivingCampusId || (!companyId && !companyNameOther)) {
        res.status(400);
        throw new Error('Vui lòng điền đủ thông tin bắt buộc: Học kỳ, Năm học, Loại hình TT, Nơi nhận HS, và Thông tin công ty.');
    }

    try {
        let finalStudentClass = studentClass;
        if (!finalStudentClass && userId) {
            const studentUser = await User.findById(userId).select('studentClass').lean();
            if (!studentUser) { res.status(404); throw new Error('Không tìm thấy thông tin sinh viên (để lấy lớp).'); }
            finalStudentClass = studentUser.studentClass || 'N/A';
        }
        if (!finalStudentClass || finalStudentClass === 'N/A') {
            res.status(400); throw new Error("Không thể xác định Lớp/Ngành của sinh viên.");
        }

        if (receivingCampusId && !mongoose.Types.ObjectId.isValid(receivingCampusId)) {
            res.status(400); throw new Error('ID Cơ sở nhận không hợp lệ.');
        }
        if (receivingCampusId) {
            const campusExists = await Location.findById(receivingCampusId).lean();
            if (!campusExists) { res.status(404); throw new Error('Cơ sở nhận đã chọn không tồn tại.'); }
        }

        let companyObjectId = null;
        if (companyId) {
            if (!mongoose.Types.ObjectId.isValid(companyId)) {
                res.status(400); throw new Error('ID Doanh nghiệp không hợp lệ.');
            }
            const companyExists = await Company.findById(companyId).lean();
            if (!companyExists) { res.status(404); throw new Error('Doanh nghiệp đã chọn không tồn tại.'); }
            companyObjectId = companyId;
        }

        const newRequestData = {
            userId,
            studentClass: finalStudentClass,
            semester,
            academicYear,
            internshipType,
            receivingCampusId: receivingCampusId ? new mongoose.Types.ObjectId(receivingCampusId) : undefined,
            notes: notes || '',
            status: 'Pending',
            startDate: startDate ? new Date(startDate + 'T00:00:00.000Z') : null, // Chuẩn hóa về UTC
            endDate: endDate ? new Date(endDate + 'T00:00:00.000Z') : null,     // Chuẩn hóa về UTC
        };

        if (companyObjectId) {
            newRequestData.companyId = companyObjectId;
        } else if (companyNameOther) { // Chỉ lưu thông tin other nếu không có companyId
            newRequestData.companyNameOther = String(companyNameOther).trim();
            if (companyAddressOther) newRequestData.companyAddressOther = String(companyAddressOther).trim();
            if (companyContactOther) newRequestData.companyContactOther = String(companyContactOther).trim();
        }

        const newInternshipRequest = new InternshipRequest(newRequestData);
        console.log(`[InternshipCtrl][${controllerName}] Saving new internship request...`);
        const savedRequest = await newInternshipRequest.save();
        console.log(`[InternshipCtrl][${controllerName}] Internship request saved. ID: ${savedRequest._id}`);

        // Populate để trả về thông tin đầy đủ hơn
        const populatedRequest = await InternshipRequest.findById(savedRequest._id)
            .populate({ path: 'companyId', select: 'name industry' })
            .populate({ path: 'receivingCampusId', select: 'name building', model: 'Location' })
            .populate({ path: 'userId', select: 'fullName studentId email', model: 'users' })
            .lean();

        res.status(201).json({ success: true, message: 'Yêu cầu thực tập của bạn đã được gửi và đang chờ xử lý.', data: populatedRequest });
    } catch (error) {
        handleError(res, error, controllerName);
    }
});

// @desc    Lấy danh sách công ty
const getCompanies = asyncHandler(async (req, res) => {
    const controllerName = 'getCompanies';
    console.log(`[InternshipCtrl][${controllerName}] === Handling GET /api/internships/companies ===`);
    try {
        const companies = await Company.find({ isActive: true })
            .select('name _id industry website contactPerson contactEmail contactPhone address') // Lấy thêm thông tin
            .sort({ name: 1 })
            .lean();
        res.status(200).json({ success: true, count: companies.length, data: companies });
    } catch (error) {
        handleError(res, error, controllerName);
    }
});

// @desc    Lấy chi tiết một đơn xin thực tập bằng ID
const getInternshipRequestById = asyncHandler(async (req, res) => {
    const controllerName = 'getInternshipRequestById';
    const requestId = req.params.id;
    console.log(`[InternshipCtrl][${controllerName}] === Handling GET /api/internships/:id - Request ID: ${requestId} ===`);

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
        res.status(400); throw new Error('ID đơn không hợp lệ.');
    }

    try {
        const internshipRequest = await InternshipRequest.findById(requestId)
            .populate({ path: 'companyId', select: 'name industry website address contactPerson contactEmail contactPhone' }) // Lấy đủ thông tin công ty
            .populate({ path: 'receivingCampusId', select: 'name address building', model: 'Location' })
            .populate({ path: 'userId', select: 'studentId fullName email studentClass major majorName', model: 'users' }) // Đảm bảo các trường này có trong Model User
            .populate({ path: 'processedBy', select: 'fullName email', model: 'users' });
            // .populate({ path: 'statusUpdateHistory.updatedBy', select: 'fullName', model: 'users' }); // Populate người cập nhật trong lịch sử nếu cần

        if (internshipRequest && internshipRequest.userId) { // Log sau khi có internshipRequest
            console.log(`[InternshipCtrl][${controllerName}][DEBUG] Populated User Data:`, JSON.stringify(internshipRequest.userId, null, 2));
        }

        if (!internshipRequest) {
            res.status(404); throw new Error('Không tìm thấy đơn thực tập này.');
        }

        // Sinh viên chỉ xem được đơn của mình (hoặc Admin)
        if (!req.user || !req.user._id || !internshipRequest.userId || !internshipRequest.userId._id ) {
             res.status(401); throw new Error('Thông tin xác thực không đầy đủ để kiểm tra quyền.');
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
    // ... (Giữ nguyên logic của Khoa, chỉ đảm bảo populate đúng và dùng handleError) ...
    const requestId = req.params.id; const userId = req.user._id;
    console.log(`[InternshipCtrl][${controllerName}] User ${userId} cancelling request ${requestId}`);
    try {
        const internshipRequest = await InternshipRequest.findById(requestId);
        if (!internshipRequest) { res.status(404); throw new Error('Không tìm thấy đơn thực tập.');}
        if (internshipRequest.userId.toString() !== userId.toString()) { res.status(403); throw new Error('Bạn không có quyền hủy đơn thực tập này.');}
        if (internshipRequest.status !== 'Pending') { res.status(400); throw new Error(`Không thể hủy đơn khi đơn đã ở trạng thái "${internshipRequest.status}".`);}

        internshipRequest.status = 'Cancelled';
        internshipRequest.processedBy = userId;
        internshipRequest.processedDate = Date.now();
        internshipRequest.statusUpdateHistory.push({ status: 'Cancelled', updatedBy: userId, notes: 'Sinh viên tự hủy đơn.' });
        const updatedRequest = await internshipRequest.save();

        const populatedRequest = await InternshipRequest.findById(updatedRequest._id)
            .populate('companyId', 'name') // Tùy chọn populate
            .populate({path: 'receivingCampusId', select: 'name', model: 'Location'})
            .populate({ path: 'userId', select: 'studentId fullName email studentClass major majorName', model: 'users' })
            .populate({ path: 'processedBy', select: 'fullName', model: 'users' })
            .lean();
        res.json({ success: true, message: 'Đơn thực tập của bạn đã được hủy.', data: populatedRequest });
    } catch (error) {
        handleError(res, error, controllerName);
    }
});

// @desc    (Demo) Admin/GV duyệt một đơn thực tập
const approveInternshipRequest = asyncHandler(async (req, res) => {
    const controllerName = 'approveInternshipRequest';
    const requestId = req.params.id;
    const { adminNotes } = req.body; // Đã đổi thành adminNotes
    console.log(`[InternshipCtrl][${controllerName}] Approving request ${requestId} by User ${req.user._id}`);
    try {
        const internshipRequest = await InternshipRequest.findById(requestId);
        if (!internshipRequest) { res.status(404); throw new Error('Không tìm thấy đơn thực tập.');}
        if (internshipRequest.status !== 'Pending') { res.status(400); throw new Error(`Đơn thực tập đã ở trạng thái "${internshipRequest.status}", không thể duyệt lại.`);}

        internshipRequest.status = 'Approved';
        internshipRequest.processedBy = req.user._id;
        internshipRequest.processedDate = Date.now();
        if(adminNotes) internshipRequest.adminNotes = adminNotes; // Sử dụng adminNotes
        internshipRequest.statusUpdateHistory.push({ status: 'Approved', updatedBy: req.user._id, notes: adminNotes || 'Đã duyệt đơn (Demo).' });
        const updatedRequest = await internshipRequest.save();

        const populatedRequest = await InternshipRequest.findById(updatedRequest._id)
            .populate('companyId', 'name')
            .populate({path: 'receivingCampusId', select: 'name', model: 'Location'})
            .populate({ path: 'userId', select: 'fullName studentId', model: 'users' })
            .populate({ path: 'processedBy', select: 'fullName', model: 'users' })
            .lean();
        res.json({ success: true, message: 'Đã duyệt đơn thực tập (Demo).', data: populatedRequest });
    } catch (error) {
        handleError(res, error, controllerName);
    }
});

// @desc    (Demo) Admin/GV từ chối một đơn thực tập
const rejectInternshipRequest = asyncHandler(async (req, res) => {
    const controllerName = 'rejectInternshipRequest';
    const requestId = req.params.id;
    const { adminNotes } = req.body; // Đã đổi thành adminNotes
    console.log(`[InternshipCtrl][${controllerName}] Rejecting request ${requestId} by User ${req.user._id} with reason: ${adminNotes}`);

    if (!adminNotes || String(adminNotes).trim() === "") { res.status(400); throw new Error('Vui lòng cung cấp lý do/ghi chú từ chối.');}

    try {
        const internshipRequest = await InternshipRequest.findById(requestId);
        if (!internshipRequest) { res.status(404); throw new Error('Không tìm thấy đơn thực tập.');}
        if (internshipRequest.status !== 'Pending') { res.status(400); throw new Error(`Đơn thực tập đã ở trạng thái "${internshipRequest.status}", không thể từ chối.`);}

        internshipRequest.status = 'Rejected';
        internshipRequest.processedBy = req.user._id;
        internshipRequest.processedDate = Date.now();
        internshipRequest.adminNotes = adminNotes; // Sử dụng adminNotes
        // Nếu Model của Khoa dùng rejectionReason thì: internshipRequest.rejectionReason = adminNotes;
        internshipRequest.statusUpdateHistory.push({ status: 'Rejected', updatedBy: req.user._id, notes: `Lý do từ chối: ${adminNotes}` });
        const updatedRequest = await internshipRequest.save();

        const populatedRequest = await InternshipRequest.findById(updatedRequest._id)
            .populate('companyId', 'name')
            .populate({path: 'receivingCampusId', select: 'name', model: 'Location'})
            .populate({ path: 'userId', select: 'fullName studentId', model: 'users' })
            .populate({ path: 'processedBy', select: 'fullName', model: 'users' })
            .lean();
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