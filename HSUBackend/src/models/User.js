// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 
const Schema = mongoose.Schema; // Viết tắt cho tiện

// Định nghĩa cấu trúc cho User document
const userSchema = new Schema({
    email: {
        type: String,
        required: [true, 'Email là bắt buộc'], // Bắt buộc nhập
        unique: true, // Đảm bảo email là duy nhất
        lowercase: true, // Tự động chuyển thành chữ thường
        trim: true, // Tự động loại bỏ khoảng trắng đầu/cuối
        match: [/.+\@.+\..+/, 'Vui lòng nhập email hợp lệ'] // Kiểm tra định dạng email đơn giản
    },
    password: {
        type: String,
        required: [true, 'Mật khẩu là bắt buộc'],
        // Lưu ý: Không nên đặt minLength ở đây vì mình sẽ lưu hash
    },
    fullName: {
        type: String,
        required: [true, 'Họ tên là bắt buộc'],
        trim: true
    },
    studentId: { // Mã số sinh viên
        type: String,
        unique: true,
        // sparse: true // Cho phép nhiều giá trị null/undefined (nếu user không phải sv)
        // Hoặc không cần required nếu có thể là giảng viên/admin
    },
    phoneNumber: {
        type: String,
        trim: true
    },
    role: {
        type: String,
        enum: ['student', 'lecturer', 'admin'], // Chỉ cho phép các giá trị này
        default: 'student' // Giá trị mặc định là student
    },
    isActive: {
        type: Boolean,
        default: true // Mặc định là active
    },

    photoBalance: 
    { type: Number, default: 0 },
    // Tự động thêm createdAt và updatedAt
}, { timestamps: true }); 
// --- 2. Thêm phương thức so sánh mật khẩu ---
userSchema.methods.matchPassword = async function(enteredPassword) {
    // this.password là mật khẩu đã hash trong DB
    // enteredPassword là mật khẩu người dùng nhập vào form login
    return await bcrypt.compare(enteredPassword, this.password);
};

// --- TODO: Thêm phương thức mã hóa password trước khi lưu ---
// Phần này cần khi làm chức năng Đăng ký (Register)
// userSchema.pre('save', async function(next) {
//   if (!this.isModified('password')) {
//     next();
//   }
//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
// });
// Tạo Model 'User' dựa trên userSchema, liên kết với collection 'users' trong DB
const User = mongoose.model('users', userSchema);

module.exports = User; // Xuất Model ra để sử dụng ở nơi khác