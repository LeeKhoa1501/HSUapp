// src/models/Timetable.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Định nghĩa cấu trúc (Schema) cho một bản ghi trong collection Timetable
// Collection này chứa thông tin về các buổi học cụ thể theo lịch
const timetableSchema = new Schema({
    // --- Thông tin liên kết ---
    userId: {
        type: Schema.Types.ObjectId, // Kiểu dữ liệu ObjectId để liên kết
        ref: 'User',                 // Tham chiếu tới Model 'User'
        required: [true, 'UserId là bắt buộc.'], // Bắt buộc phải có userId
        index: true                  // Đánh index để tăng tốc độ query theo userId
    },
    courseId: {
        type: Schema.Types.ObjectId,
        ref: 'Course',               // Tham chiếu tới Model 'Course'
        required: [true, 'CourseId là bắt buộc.']
    },
    locationId: { // Thêm trường này để liên kết với địa điểm (Cơ sở)
        type: Schema.Types.ObjectId,
        ref: 'Location',             // Tham chiếu tới Model 'Location'
        required: false             // Không bắt buộc (vd: học online)
    },
    shiftId: { // Thêm lại shiftId nếu anh vẫn dùng nó để nhóm các buổi học
        type: Schema.Types.ObjectId,
        ref: 'Shift',                // Tham chiếu tới Model 'Shift'
        required: false             // Có thể không bắt buộc nếu dùng startTime/endTime là chính
    },

    // --- Thông tin lịch học cụ thể ---
    date: { // Ngày học cụ thể (Quan trọng cho Calendar)
        type: String,
        required: [true, 'Ngày học là bắt buộc.'],
        match: [/^\d{4}-\d{2}-\d{2}$/, 'Định dạng ngày phải là YYYY-MM-DD'], // Đảm bảo đúng định dạng
        index: true // Index theo ngày để tìm kiếm nhanh
    },
    dayOfWeek: { // Thứ trong tuần (để tham khảo)
        type: String,
        required: [true, 'Thứ trong tuần là bắt buộc.'] // Ví dụ: "Thứ 2", "Thứ 3"...
    },
    startTime: { // Giờ bắt đầu buổi học
        type: String,
        required: [true, 'Giờ bắt đầu là bắt buộc.'],
        match: [/^\d{2}:\d{2}$/, 'Định dạng giờ phải là HH:mm'] // Ví dụ: "07:00"
    },
    endTime: { // Giờ kết thúc buổi học
        type: String,
        required: [true, 'Giờ kết thúc là bắt buộc.'],
        match: [/^\d{2}:\d{2}$/, 'Định dạng giờ phải là HH:mm'] // Ví dụ: "09:30"
    },
    room: { // Phòng học
        type: String,
        trim: true
    },
    instructor: { // Tên giảng viên
        type: String,
        trim: true
    },
    semester: { // Học kỳ
        type: String,
        index: true // Index theo học kỳ
    },
    academicYear: { // Năm học
        type: String,
        index: true // Index theo năm học
    },
    classId: { // Mã lớp học phần (nếu có)
        type: String,
        trim: true
    },

    // --- Thông tin Điểm danh (Thêm vào) ---
    // src/models/Timetable.js
// ...
attendanceStatus: {
    type: String,
    enum: {
        // >>> THÊM 'NotYet' VÀO ĐÂY <<<
        values: ['Present', 'Absent', 'Late', 'Excused', 'NotYet', null],
        message: 'Trạng thái điểm danh không hợp lệ ({VALUE})'
    },
    default: 'NotYet'
},
    attendanceCheckInTime: { // Thời gian sinh viên thực tế check-in/điểm danh
        type: Date,         // Lưu dưới dạng Date object đầy đủ
        default: null
    },
    attendanceNotes: { // Ghi chú của Giảng viên về việc điểm danh
        type: String,
        trim: true
    },
    isAttendanceOpen: { // Cờ để Giảng viên bật/tắt chức năng điểm danh cho buổi này
        type: Boolean,
        default: false,     // Mặc định là đóng điểm danh
        index: true         // Đánh index để tìm nhanh các buổi đang mở điểm danh
    }
    // --- Kết thúc phần điểm danh ---

}, {
    // Chỉ định tên collection trong MongoDB
    collection: 'Timetable', 
    // Tự động thêm trường createdAt và updatedAt
    timestamps: true
});

// --- Indexes (Chỉ mục để tăng tốc độ query) ---
// Index tổng hợp để tối ưu query tìm kiếm lịch học/điểm danh theo user, năm, kỳ
timetableSchema.index({ userId: 1, academicYear: 1, semester: 1 });
// Index để tối ưu query tìm kiếm lịch học/điểm danh theo user và ngày cụ thể
timetableSchema.index({ userId: 1, date: 1 });
// Index để tìm nhanh các buổi học đang mở điểm danh của một user trong một ngày
timetableSchema.index({ userId: 1, date: 1, isAttendanceOpen: 1 });


// Tạo Model 'Timetable' từ Schema trên
const Timetable = mongoose.model('Timetable', timetableSchema);

// Export Model để các file khác (controller) có thể sử dụng
module.exports = Timetable;