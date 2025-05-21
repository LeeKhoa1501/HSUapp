// src/controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
// KHÔNG cần require dotenv ở đây nữa

const generateToken = (id) => {
    const secret = process.env.JWT_SECRET; // Đọc từ process.env (đã load bởi server.js)
    if (!secret) { throw new Error('JWT Secret not configured'); }
    return jwt.sign({ id }, secret, { expiresIn: '30d' });
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;
    console.log(`[AUTH] Login attempt for email: ${email}`); // Log email nhận được

    if (!email || !password) { return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu' }); }

    try {
        // Tìm user, đảm bảo lấy cả password về để so sánh
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        // console.log('[AUTH] User found:', user ? user.email : 'Not Found'); // Log xem có tìm thấy user không

        if (user && (await user.matchPassword(password))) { // Gọi matchPassword
            console.log('[AUTH] Password matched!'); // Log khi khớp pass
            const token = generateToken(user._id);
            if (!token) { return res.status(500).json({ success: false, message: 'Lỗi server khi tạo token.' }); }

            res.status(200).json({
                success: true,
                message: 'Đăng nhập thành công',
                data: {
                    _id: user._id,
                    email: user.email,
                    fullName: user.fullName, 
                    studentId: user.studentId,
                    role: user.role,
                },
                token: token,
            });
        } else {
            console.log('[AUTH] Password mismatch or user not found.'); // Log khi sai
            res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
        }
    } catch (error) {
        console.error('[AUTH] Login Error:', error);
        if (error.message === 'JWT Secret not configured') { res.status(500).json({ success: false, message: 'Lỗi cấu hình server (JWT).' });}
        else { res.status(500).json({ success: false, message: 'Lỗi server khi đăng nhập' }); }
    }
};

// --- HÀM MỚI: Lấy thông tin user hiện tại ---
/**
 * @desc    Lấy thông tin của user đang đăng nhập (dựa trên token)
 * @route   GET /api/auth/me
 * @access  Private (Cần middleware 'protect')
 */
const getMe = async (req, res) => {
    console.log('[AUTH] === Handling GET /api/auth/me ===');
    // Middleware 'protect' đã chạy trước và gắn user vào req.user (nếu token hợp lệ)
    const user = req.user;

    // Kiểm tra xem user có tồn tại trong request không
    if (!user) {
         console.error('[AUTH][getMe] User object not found in request. Middleware protect might have failed or was not used.');
         // Trả về lỗi 404 nếu không tìm thấy user (hoặc 401 nếu do token)
         return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin người dùng liên kết với token này.' });
    }

    console.log(`[AUTH][getMe] Returning info for user: ${user.email}`);
    // Trả về các thông tin cần thiết của user (status 200 OK)
    // KHÔNG BAO GIỜ trả về password hash
    res.status(200).json({
        success: true,
        data: {
            _id: user._id,
            email: user.email,
            fullName: user.fullName,
            studentId: user.studentId,
            role: user.role,
            phoneNumber: user.phoneNumber, // Lấy thêm SĐT ví dụ
            isActive: user.isActive      // Lấy thêm trạng thái ví dụ
            // Thêm các trường khác từ User model mà anh muốn trả về
        }
    });
    // Lưu ý: Không cần khối try...catch ở đây vì lỗi DB (nếu có) thường đã được xử lý trong middleware `protect` khi tìm user.
    // Nếu muốn chắc chắn hơn, có thể thêm try...catch đơn giản.
};
// --- KẾT THÚC HÀM MỚI ---


// --- CẬP NHẬT EXPORT ---
module.exports = {
    loginUser,
    getMe // <-- Export hàm getMe
};

module.exports = { loginUser,getMe };