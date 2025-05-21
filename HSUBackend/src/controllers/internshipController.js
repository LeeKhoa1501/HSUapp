// HSUBackend/src/controllers/internshipController.js
const mongoose = require('mongoose');
const InternshipRequest = require('../models/InternshipRequest');
const Company = require('../models/Company');
const User = require('../models/User'); // <<< ANH ĐÃ REQUIRE MODEL USER VỚI TÊN LÀ `User`
                                     // NHƯNG ANH ĐĂNG KÝ NÓ VỚI MONGOOSE LÀ 'users'
const Location = require('../models/Location');
const asyncHandler = require('express-async-handler');

// @desc    Lấy danh sách đơn thực tập của user hiện tại
const getMyInternshipRequests = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const requests = await InternshipRequest.find({ userId: userId })
        .populate('companyId', 'name industry')
        .populate('receivingCampusId', 'name building')
        // >>> KHI POPULATE, MONGOOSE SẼ DÙNG `ref` TRONG SCHEMA InternshipRequest <<<
        // Nếu ref là 'users', nó sẽ tìm model tên 'users'.
        .populate({ path: 'userId', select: 'fullName studentId email', model: 'users' }) // Chỉ định rõ model nếu ref là 'User' nhưng model đăng ký là 'users'
        // HOẶC, nếu ref trong InternshipRequestSchema đã là 'users' thì chỉ cần:
        // .populate('userId', 'fullName studentId email')
        .sort({ requestDate: -1 })
        .lean();
    res.status(200).json({ success: true, count: requests.length, data: requests });
});

// @desc    Tạo đơn xin thực tập mới
const createInternshipRequest = asyncHandler(async (req, res) => {
    // ... (logic tạo đơn như cũ, không cần thay đổi gì ở đây nếu tên trường semester đã đúng) ...
    // Quan trọng là Model InternshipRequest đã được sửa ref: 'users' cho các trường liên quan đến User
    const userId = req.user._id;
    const {semester, studentClass, academicYear, internshipType, companyId, companyNameOther, companyAddressOther, companyContactOther, receivingCampusId, notes, startDate, endDate } = req.body;
    if (!semester || !academicYear || !internshipType || !receivingCampusId || (!companyId && !companyNameOther)) { res.status(400); throw new Error('Vui lòng điền đủ thông tin bắt buộc.');}
    // ... (phần còn lại của createInternshipRequest giữ nguyên như phiên bản đầy đủ trước đó)
     let finalStudentClass = studentClass;
     if (!finalStudentClass && userId) { const studentUser = await User.findById(userId).select('studentClass').lean(); if (!studentUser) { res.status(404); throw new Error('Không tìm thấy thông tin sinh viên.'); } finalStudentClass = studentUser.studentClass || 'N/A'; }
     if(!finalStudentClass){ res.status(400); throw new Error("Không thể xác định Lớp/Ngành.");}
     if (receivingCampusId && !mongoose.Types.ObjectId.isValid(receivingCampusId)) { res.status(400); throw new Error('ID Cơ sở nhận không hợp lệ.');}
     if(receivingCampusId){ const campusExists = await Location.findById(receivingCampusId); if (!campusExists) { res.status(404); throw new Error('Cơ sở nhận đã chọn không tồn tại.');}}
     if (companyId) { if (!mongoose.Types.ObjectId.isValid(companyId)) { res.status(400); throw new Error('ID Doanh nghiệp không hợp lệ.'); } const companyExists = await Company.findById(companyId); if (!companyExists) { res.status(404); throw new Error('Doanh nghiệp đã chọn không tồn tại.'); } }
     const newRequestData = { userId, studentClass: finalStudentClass, semester, academicYear, internshipType, receivingCampusId, notes: notes || '', status: 'Pending', startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, };
     if (companyId) { newRequestData.companyId = companyId; } else { newRequestData.companyNameOther = companyNameOther.trim(); if (companyAddressOther) newRequestData.companyAddressOther = companyAddressOther.trim(); if (companyContactOther) newRequestData.companyContactOther = companyContactOther.trim(); }
     const newInternshipRequest = new InternshipRequest(newRequestData); const savedRequest = await newInternshipRequest.save();
     const populatedRequest = await InternshipRequest.findById(savedRequest._id).populate('companyId', 'name industry').populate('receivingCampusId', 'name building').populate({ path: 'userId', select: 'fullName studentId email', model: 'users' }).lean(); // Chỉ định model: 'users'
     res.status(201).json({ success: true, message: 'Yêu cầu thực tập của bạn đã được gửi.', data: populatedRequest });
});

// @desc    Lấy danh sách công ty
const getCompanies = asyncHandler(async (req, res) => { /* ... như cũ ... */
     const companies = await Company.find({ isActive: true }).select('name _id industry website').sort({ name: 1 });
     res.status(200).json({ success: true, count: companies.length, data: companies });
});

// @desc    Lấy chi tiết một đơn xin thực tập bằng ID
const getInternshipRequestById = asyncHandler(async (req, res) => {
    const requestId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(requestId)) { res.status(400); throw new Error('ID đơn không hợp lệ.');}
    const internshipRequest = await InternshipRequest.findById(requestId)
        .populate('companyId')
        .populate('receivingCampusId', 'name address building')
        .populate({ path: 'userId', select: 'studentId fullName email studentClass major', model: 'users' }); // Chỉ định model: 'users'
        // Cũng populate các trường `processedBy`, `updatedBy` trong `statusUpdateHistory` nếu cần
        // .populate({ path: 'processedBy', select: 'fullName', model: 'users' })
        // .populate({ path: 'statusUpdateHistory.updatedBy', select: 'fullName', model: 'users' });

    if (!internshipRequest) { res.status(404); throw new Error('Không tìm thấy đơn.');}
    if (internshipRequest.userId._id.toString() !== req.user._id.toString()) { res.status(403); throw new Error('Không có quyền xem.');}
    res.json({ success: true, data: internshipRequest });
});

// @desc    Sinh viên hủy đơn xin thực tập của mình
const cancelInternshipRequest = asyncHandler(async (req, res) => { /* ... như cũ, đảm bảo populate đúng model User ... */
     const requestId = req.params.id; const userId = req.user._id;
     const internshipRequest = await InternshipRequest.findById(requestId);
     if (!internshipRequest) { res.status(404); throw new Error('Không tìm thấy đơn.');}
     if (internshipRequest.userId.toString() !== userId.toString()) { res.status(403); throw new Error('Không có quyền hủy.');}
     if (internshipRequest.status !== 'Pending') { res.status(400); throw new Error(`Không thể hủy đơn ở trạng thái "${internshipRequest.status}".`);}
     internshipRequest.status = 'Cancelled'; internshipRequest.processedBy = userId; internshipRequest.processedDate = Date.now();
     internshipRequest.statusUpdateHistory.push({ status: 'Cancelled', updatedBy: userId, notes: 'Sinh viên tự hủy đơn.' });
     const updatedRequest = await internshipRequest.save();
     const populatedRequest = await InternshipRequest.findById(updatedRequest._id).populate('companyId').populate('receivingCampusId').populate({ path: 'userId', select: 'studentId fullName email studentClass major', model: 'users' }).lean();
     res.json({ success: true, message: 'Đã hủy đơn.', data: populatedRequest });
});

// @desc    (Demo) Admin/GV duyệt một đơn thực tập
const approveInternshipRequest = asyncHandler(async (req, res) => { /* ... như cũ, đảm bảo populate đúng model User ... */
     const requestId = req.params.id; const { approvalNotes } = req.body;
     const internshipRequest = await InternshipRequest.findById(requestId);
     if (!internshipRequest) { res.status(404); throw new Error('Không tìm thấy đơn.');}
     if (internshipRequest.status !== 'Pending') { res.status(400); throw new Error(`Đơn đã ở trạng thái "${internshipRequest.status}", không thể duyệt.`);}
     internshipRequest.status = 'Approved'; internshipRequest.processedBy = req.user._id; internshipRequest.processedDate = Date.now();
     if(approvalNotes) internshipRequest.approvalNotes = approvalNotes;
     internshipRequest.statusUpdateHistory.push({ status: 'Approved', updatedBy: req.user._id, notes: approvalNotes || 'Đã duyệt (Demo).' });
     const updatedRequest = await internshipRequest.save();
     const populatedRequest = await InternshipRequest.findById(updatedRequest._id).populate('companyId').populate('receivingCampusId').populate({ path: 'userId', select: 'studentId fullName email studentClass major', model: 'users' }).lean();
     res.json({ success: true, message: 'Đã duyệt đơn (Demo).', data: populatedRequest });
});

// @desc    (Demo) Admin/GV từ chối một đơn thực tập
const rejectInternshipRequest = asyncHandler(async (req, res) => { /* ... như cũ, đảm bảo populate đúng model User ... */
     const requestId = req.params.id; const { rejectionReason } = req.body;
     if (!rejectionReason || rejectionReason.trim() === "") { res.status(400); throw new Error('Cần lý do từ chối.');}
     const internshipRequest = await InternshipRequest.findById(requestId);
     if (!internshipRequest) { res.status(404); throw new Error('Không tìm thấy đơn.');}
     if (internshipRequest.status !== 'Pending') { res.status(400); throw new Error(`Đơn đã ở trạng thái "${internshipRequest.status}", không thể từ chối.`);}
     internshipRequest.status = 'Rejected'; internshipRequest.processedBy = req.user._id; internshipRequest.processedDate = Date.now(); internshipRequest.rejectionReason = rejectionReason;
     internshipRequest.statusUpdateHistory.push({ status: 'Rejected', updatedBy: req.user._id, notes: `Lý do từ chối: ${rejectionReason}` });
     const updatedRequest = await internshipRequest.save();
     const populatedRequest = await InternshipRequest.findById(updatedRequest._id).populate('companyId').populate('receivingCampusId').populate({ path: 'userId', select: 'studentId fullName email studentClass major', model: 'users' }).lean();
     res.json({ success: true, message: 'Đã từ chối đơn (Demo).', data: populatedRequest });
});

module.exports = {
    getMyInternshipRequests, createInternshipRequest, getCompanies,
    getInternshipRequestById, cancelInternshipRequest,
    approveInternshipRequest, rejectInternshipRequest
};