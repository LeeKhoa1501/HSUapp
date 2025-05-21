// HSUBackend/src/controllers/academicRequestController.js
const mongoose = require('mongoose');
const AcademicRequest = require('../models/AcademicRequest');
const User = require('../models/User'); // Model User của anh được đăng ký là 'users'
const Location = require('../models/Location');
const asyncHandler = require('express-async-handler');

// @desc    Tạo một yêu cầu học vụ mới
const createAcademicRequest = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { requestType, requestTitle, studentNotes, receivingCampusId } = req.body;

    if (!requestType || !requestTitle || !studentNotes) { // studentNotes là bắt buộc theo model
        res.status(400);
        throw new Error('Vui lòng điền đầy đủ Loại yêu cầu, Tiêu đề và Nội dung yêu cầu.');
    }

    const newRequestData = { userId, requestType, requestTitle: requestTitle.trim(), studentNotes: studentNotes.trim(), status: 'Pending' };
    if (receivingCampusId) {
        if (!mongoose.Types.ObjectId.isValid(receivingCampusId)) { res.status(400); throw new Error('ID Cơ sở nhận không hợp lệ.'); }
        const campusExists = await Location.findById(receivingCampusId);
        if (!campusExists) { res.status(404); throw new Error('Cơ sở nhận đã chọn không tồn tại.'); }
        newRequestData.receivingCampusId = receivingCampusId;
    }
    const academicRequest = new AcademicRequest(newRequestData);
    const savedRequest = await academicRequest.save();
    const populatedRequest = await AcademicRequest.findById(savedRequest._id)
        .populate({ path: 'userId', select: 'fullName studentId', model: 'users' }) // Chỉ định model 'users'
        .populate({ path: 'receivingCampusId', select: 'name', model: 'Location' }) // Chỉ định model 'Location'
        .lean();
    res.status(201).json({ success: true, message: 'Yêu cầu học vụ của bạn đã được gửi.', data: populatedRequest });
});

// @desc    Lấy danh sách các yêu cầu học vụ của user hiện tại
const getMyAcademicRequests = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const requests = await AcademicRequest.find({ userId: userId })
        .populate({ path: 'receivingCampusId', select: 'name', model: 'Location'}) // Chỉ định model 'Location'
        .sort({ requestDate: -1 }).lean();
    res.status(200).json({ success: true, count: requests.length, data: requests });
});

// @desc    Lấy chi tiết một yêu cầu học vụ bằng ID
const getAcademicRequestById = asyncHandler(async (req, res) => {
    const requestId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(requestId)) { res.status(400); throw new Error('ID yêu cầu không hợp lệ.'); }
    const academicRequest = await AcademicRequest.findById(requestId)
        .populate({ path: 'userId', select: 'studentId fullName email studentClass major', model: 'users' })
        .populate({ path: 'receivingCampusId', select: 'name address building', model: 'Location' })
        .populate({ path: 'processedBy', select: 'fullName', model: 'users' });
    if (!academicRequest) { res.status(404); throw new Error('Không tìm thấy yêu cầu học vụ.'); }
    if (academicRequest.userId._id.toString() !== req.user._id.toString()) { res.status(403); throw new Error('Bạn không có quyền xem yêu cầu này.'); }
    res.json({ success: true, data: academicRequest });
});

// @desc    Sinh viên hủy một yêu cầu học vụ (nếu đang Pending)
const cancelAcademicRequest = asyncHandler(async (req, res) => {
    const requestId = req.params.id; const userId = req.user._id;
    const academicRequest = await AcademicRequest.findById(requestId);
    if (!academicRequest) { res.status(404); throw new Error('Không tìm thấy yêu cầu.'); }
    if (academicRequest.userId.toString() !== userId.toString()) { res.status(403); throw new Error('Không có quyền hủy.'); }
    if (academicRequest.status !== 'Pending') { res.status(400); throw new Error(`Không thể hủy khi trạng thái là "${academicRequest.status}".`); }
    academicRequest.status = 'Cancelled'; academicRequest.processedBy = userId; academicRequest.processedDate = Date.now();
    academicRequest.statusUpdateHistory.push({ status: 'Cancelled', updatedBy: userId, notes: 'Sinh viên tự hủy yêu cầu.' });
    const updatedRequest = await academicRequest.save();
    const populatedRequest = await AcademicRequest.findById(updatedRequest._id).populate({path:'userId', select:'fullName studentId', model:'users'}).populate({path:'receivingCampusId', select:'name', model:'Location'}).lean();
    res.json({ success: true, message: 'Đã hủy yêu cầu.', data: populatedRequest });
});

// @desc    (Demo) Admin/Phòng ban duyệt một yêu cầu học vụ
const approveAcademicRequest = asyncHandler(async (req, res) => {
    const requestId = req.params.id; const { adminNotes } = req.body;
    const academicRequest = await AcademicRequest.findById(requestId);
    if (!academicRequest) { res.status(404); throw new Error('Không tìm thấy yêu cầu.'); }
    if (academicRequest.status !== 'Pending' && academicRequest.status !== 'Processing') { res.status(400); throw new Error(`Không thể duyệt khi trạng thái là "${academicRequest.status}".`); }
    academicRequest.status = 'Approved'; academicRequest.processedBy = req.user._id; academicRequest.processedDate = Date.now();
    if(adminNotes) academicRequest.adminNotes = adminNotes;
    academicRequest.statusUpdateHistory.push({ status: 'Approved', updatedBy: req.user._id, notes: adminNotes || 'Yêu cầu đã duyệt (Demo).' });
    const updatedRequest = await academicRequest.save();
    const populatedRequest = await AcademicRequest.findById(updatedRequest._id).populate({path:'userId', select:'fullName studentId', model:'users'}).populate({path:'receivingCampusId', select:'name', model:'Location'}).lean();
    res.json({ success: true, message: 'Đã duyệt yêu cầu (Demo).', data: populatedRequest });
});

// @desc    (Demo) Admin/Phòng ban từ chối một yêu cầu học vụ
const rejectAcademicRequest = asyncHandler(async (req, res) => {
    const requestId = req.params.id; const { adminNotes } = req.body; // adminNotes sẽ là lý do từ chối
    if (!adminNotes || adminNotes.trim() === "") { res.status(400); throw new Error('Vui lòng cung cấp lý do/ghi chú từ chối.'); }
    const academicRequest = await AcademicRequest.findById(requestId);
    if (!academicRequest) { res.status(404); throw new Error('Không tìm thấy yêu cầu.'); }
    if (academicRequest.status !== 'Pending' && academicRequest.status !== 'Processing') { res.status(400); throw new Error(`Không thể từ chối khi trạng thái là "${academicRequest.status}".`); }
    academicRequest.status = 'Rejected'; academicRequest.processedBy = req.user._id; academicRequest.processedDate = Date.now();
    academicRequest.adminNotes = adminNotes; // Lưu lý do từ chối vào adminNotes
    academicRequest.statusUpdateHistory.push({ status: 'Rejected', updatedBy: req.user._id, notes: `Lý do từ chối: ${adminNotes}` });
    const updatedRequest = await academicRequest.save();
    const populatedRequest = await AcademicRequest.findById(updatedRequest._id).populate({path:'userId', select:'fullName studentId', model:'users'}).populate({path:'receivingCampusId', select:'name', model:'Location'}).lean();
    res.json({ success: true, message: 'Đã từ chối yêu cầu (Demo).', data: populatedRequest });
});

module.exports = { 
     createAcademicRequest, 
     getMyAcademicRequests, 
     getAcademicRequestById, 
     cancelAcademicRequest, 
     approveAcademicRequest, 
     rejectAcademicRequest 
};