// HSUBackend/src/models/InternshipRequest.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const internshipTypeEnum = ['nhan_thuc', 'kien_tap', 'tot_nghiep', 'du_an_doanh_nghiep', 'other'];
const internshipStatusEnum = ['Pending', 'Approved', 'Rejected', 'InProgress', 'Completed', 'Cancelled'];

const internshipRequestSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'users', required: true, index: true }, // <<<< SỬA Ở ĐÂY
    requestCode: { type: String, unique: true, sparse: true, trim: true },
    studentClass: { type: String, required: [true, 'Lớp sinh viên là bắt buộc'] },
    semester: { type: String, required: [true, 'Học kỳ (mã) là bắt buộc'] },
    academicYear: { type: String, required: [true, 'Năm học là bắt buộc'] },
    internshipType: {
        type: String,
        required: [true, 'Loại hình thực tập là bắt buộc'],
        enum: { values: internshipTypeEnum, message: 'Loại hình "{VALUE}" không hợp lệ.' }
    },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' }, // Giữ nguyên ref nếu Company model là 'Company'
    companyNameOther: { type: String, trim: true, required: function() { return !this.companyId && !this.isModified('companyId'); } },
    companyAddressOther: { type: String, trim: true },
    companyContactOther: { type: String, trim: true },
    receivingCampusId: { type: Schema.Types.ObjectId, ref: 'Location' }, // Giữ nguyên ref nếu Location model là 'Location'
    requestDate: { type: Date, default: Date.now },
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
        type: String,
        enum: { values: internshipStatusEnum, message: 'Trạng thái "{VALUE}" không hợp lệ.' },
        default: 'Pending'
    },
    notes: { type: String, trim: true },
    processedBy: { type: Schema.Types.ObjectId, ref: 'users' }, // <<<< SỬA Ở ĐÂY
    processedDate: { type: Date },
    approvalNotes: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
    statusUpdateHistory: [{
        status: { type: String, enum: internshipStatusEnum },
        updatedAt: { type: Date, default: Date.now },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'users' }, // <<<< SỬA Ở ĐÂY
        notes: String
    }]
}, { timestamps: true, collection: 'internshiprequests' });

internshipRequestSchema.index({ userId: 1, semester: 1, academicYear: 1 });

internshipRequestSchema.pre('save', async function(next) {
    if (this.isNew && !this.requestCode) { // Chỉ tạo khi là đơn mới và chưa có mã
        try {
            const year = this.academicYear ? this.academicYear.split('-')[0].slice(-2) : new Date().getFullYear().toString().slice(-2);
            const semesterPart = this.semester ? this.semester.slice(-1) : 'X'; // Lấy từ this.semester
            // Đếm số đơn trong kỳ và năm đó để tạo số thứ tự
            const countInSemester = await this.constructor.countDocuments({
                academicYear: this.academicYear,
                semester: this.semester // Dùng this.semester
            });
            let attempt = 0; let uniqueCodeFound = false; let baseCodePrefix = `TT${year}${semesterPart}-`; let newCode;
            while (!uniqueCodeFound && attempt < 20) {
                attempt++; newCode = `${baseCodePrefix}${String(countInSemester + attempt).padStart(4, '0')}`; // Pad 4 số
                const existing = await this.constructor.findOne({ requestCode: newCode });
                if (!existing) { uniqueCodeFound = true; this.requestCode = newCode; }
            }
            if (!uniqueCodeFound) this.requestCode = `${baseCodePrefix}${Date.now().toString().slice(-5)}`;
            console.log(`[MODEL] Generated requestCode: ${this.requestCode} for semester ${this.semester}`); // Thêm log
        } catch (error) { console.error("[MODEL] Error generating requestCode:", error); }
    }
    // ... (phần statusUpdateHistory) ...
    next();
});

module.exports = mongoose.model('InternshipRequest', internshipRequestSchema);