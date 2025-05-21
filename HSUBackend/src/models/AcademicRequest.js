// HSUBackend/src/models/AcademicRequest.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// === ĐẢM BẢO MẢNG NÀY KHỚP VỚI CÁC VALUE TRONG FRONTEND ===
const requestTypeEnum = [
    'XN_SV',                   // Giấy xác nhận Sinh viên (Anh có thể thêm label này vào frontend nếu cần)
    'GXN_CTDT',                // GXN Chưa hoàn tất CTĐT (Anh đang dùng "incomplete_program_cert" ở FE)
    'GXN_NVQS',                // GXN Hoãn NVQS (Anh đang dùng "military_deferral_cert" ở FE)
    'DK_HP_TRE',               // Đăng ký học phần trễ hạn
    'RUT_HP',                  // Rút học phần
    'XEM_LAI_BAI_THI',         // Xem lại bài thi
    'KHIEU_NAI_DIEM',          // Khiếu nại điểm
    'OTHER_REQUEST',           // Loại khác (Anh đang dùng "other" ở FE)

    // === THÊM CÁC GIÁ TRỊ TỪ FRONTEND VÀO ĐÂY CHO ĐỒNG BỘ ===
    'incomplete_program_cert', // Từ FE cho "GXN-Chưa hoàn tất CTĐT"
    'personal_profile_cert',   // Từ FE cho "GXN-Hồ sơ cá nhân"
    'military_deferral_cert',  // <<<< GIÁ TRỊ GÂY LỖI, CẦN CÓ Ở ĐÂY
    'tax_deduction_cert',      // Từ FE cho "GXN-Giảm trừ thuế TNCN"
    'social_bank_loan_cert',   // Từ FE cho "GXN-Vay vốn Ngân hàng CSXH"
    'completion_cert',         // Từ FE cho "GXN-Hoàn tất CTĐT"
    'english_cert',            // Từ FE cho "Giấy xác nhận tiếng Anh"
    'other'                    // Từ FE cho "Khác" (đã có OTHER_REQUEST, anh chọn 1 cái)
];
// Lọc bỏ các giá trị trùng lặp (nếu có)
const uniqueRequestTypeEnum = [...new Set(requestTypeEnum)];


const academicRequestStatusEnum = ['Pending', 'Processing', 'Approved', 'Rejected', 'Completed', 'Cancelled'];

const academicRequestSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'users', required: true, index: true },
    requestCode: { type: String, unique: true, sparse: true, trim: true },
    requestType: {
        type: String,
        required: [true, 'Loại yêu cầu là bắt buộc.'],
        enum: {
            values: uniqueRequestTypeEnum, // <<<< SỬ DỤNG MẢNG ĐÃ LỌC TRÙNG
            message: 'Loại yêu cầu "{VALUE}" không hợp lệ.'
        }
    },
    requestTitle: {
        type: String,
        required: [true, 'Tiêu đề/Tên yêu cầu là bắt buộc.'],
        trim: true
    },
    studentNotes: { type: String, trim: true, required: [true, 'Nội dung/Ghi chú của bạn là bắt buộc.'] },
    receivingCampusId: { type: Schema.Types.ObjectId, ref: 'Location' },
    requestDate: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: { values: academicRequestStatusEnum, message: 'Trạng thái "{VALUE}" không hợp lệ.' },
        default: 'Pending'
    },
    processedBy: { type: Schema.Types.ObjectId, ref: 'users' },
    processedDate: { type: Date },
    adminNotes: { type: String, trim: true },
    statusUpdateHistory: [{
        status: { type: String, enum: academicRequestStatusEnum },
        updatedAt: { type: Date, default: Date.now },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'users' },
        notes: String
    }]
}, { timestamps: true, collection: 'academicrequests' });

academicRequestSchema.index({ userId: 1, requestDate: -1 });

academicRequestSchema.pre('save', async function(next) {
    if (this.isNew && !this.requestCode) {
        try {
            const today = new Date(); const year = today.getFullYear().toString().slice(-2); const month = (today.getMonth() + 1).toString().padStart(2, '0'); const day = today.getDate().toString().padStart(2, '0');
            const countToday = await this.constructor.countDocuments({ createdAt: { $gte: new Date(today.setHours(0,0,0,0)), $lte: new Date(today.setHours(23,59,59,999)) } });
            let attempt = 0; let uniqueCodeFound = false; let baseCodePrefix = `YCHV-${year}${month}${day}-`; let newCode;
            while (!uniqueCodeFound && attempt < 20) { attempt++; newCode = `${baseCodePrefix}${String(countToday + attempt).padStart(3, '0')}`; const existing = await this.constructor.findOne({ requestCode: newCode }); if (!existing) { uniqueCodeFound = true; this.requestCode = newCode; } }
            if (!uniqueCodeFound) this.requestCode = `${baseCodePrefix}${Date.now().toString().slice(-5)}`;
        } catch (error) { console.error("[AcademicRequest Model] Error generating requestCode:", error); }
    }
    if (this.isNew) { this.statusUpdateHistory.push({ status: this.status, updatedBy: this.userId, notes: 'Yêu cầu được tạo mới.' }); }
    next();
});

module.exports = mongoose.model('AcademicRequest', academicRequestSchema);