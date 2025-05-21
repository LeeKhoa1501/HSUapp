// HSUBackend/src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Đảm bảo đường dẫn đến User model là chính xác

const protect = async (req, res, next) => {
    console.log('[AuthMiddleware][protect] Called.');
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        console.log('[AuthMiddleware][protect] Authorization header with Bearer found.');
        try {
            token = req.headers.authorization.split(' ')[1];
            console.log('[AuthMiddleware][protect] Token extracted:', token ? 'Yes (hidden)' : 'No');

            const secret = process.env.JWT_SECRET;
            console.log('[AuthMiddleware][protect] JWT_SECRET available:', secret ? 'Yes' : '!!! No !!!');
            if (!secret) {
                console.error('[AuthMiddleware][protect] JWT_SECRET is not configured!');
                throw new Error('JWT Secret not configured in middleware');
            }

            const decoded = jwt.verify(token, secret);
            console.log('[AuthMiddleware][protect] Token decoded payload:', decoded);

            try {
                req.user = await User.findById(decoded.id).select('-password'); // Không lấy password
                if (req.user) {
                    console.log(`[AuthMiddleware][protect] User ID '${req.user._id}' (Role: '${req.user.role}') found in DB.`);
                } else {
                    console.warn(`[AuthMiddleware][protect] User ID '${decoded.id}' from token NOT found in DB.`);
                }
            } catch (dbError) {
                console.error('[AuthMiddleware][protect] DB Error finding user:', dbError);
                return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xác thực người dùng.' });
            }

            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Người dùng không tồn tại hoặc token không hợp lệ.' });
            }

            console.log('[AuthMiddleware][protect] Authentication successful. Proceeding...');
            next();
        } catch (error) {
            console.error('[AuthMiddleware][protect] Token verification/processing error:', error.name, error.message);
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã bị thay đổi.' });
            }
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ success: false, message: 'Token đã hết hạn. Vui lòng đăng nhập lại.' });
            }
            if (error.message === 'JWT Secret not configured in middleware') {
                return res.status(500).json({ success: false, message: 'Lỗi cấu hình máy chủ (JWT_SECRET).' });
            }
            // Lỗi chung khác
            return res.status(401).json({ success: false, message: 'Xác thực thất bại. Không thể truy cập.' });
        }
    } else {
        console.log('[AuthMiddleware][protect] No Bearer token found in Authorization header.');
        // Biến token ở scope này sẽ là undefined nếu không vào if block ở trên.
        // Không cần check if (!token) nữa vì nếu vào else này thì chắc chắn là không có token theo chuẩn.
        res.status(401).json({ success: false, message: 'Chưa xác thực. Yêu cầu token để truy cập.' });
    }
};

// Hàm mới để giới hạn quyền truy cập dựa trên vai trò (role)
// ...roles là rest parameter, nhận các vai trò được phép dưới dạng một mảng
const restrictTo = (...allowedRoles) => {
    return (req, res, next) => {
        // Middleware `protect` phải chạy trước và gán `req.user` và `req.user.role`
        if (!req.user || !req.user.role) {
            console.warn('[AuthMiddleware][restrictTo] req.user or req.user.role is missing. Ensure "protect" middleware runs first.');
            return res.status(403).json({ // 403 Forbidden - User đã được xác thực nhưng không có quyền
                success: false,
                message: 'Thông tin người dùng hoặc vai trò không được xác định. Không thể phân quyền.'
            });
        }

        const userRole = req.user.role;
        console.log(`[AuthMiddleware][restrictTo] User Role: '${userRole}'. Allowed Roles: [${allowedRoles.join(', ')}].`);

        if (!allowedRoles.includes(userRole)) {
            console.log(`[AuthMiddleware][restrictTo] Access DENIED. User role '${userRole}' is NOT in allowed roles.`);
            return res.status(403).json({
                success: false,
                message: `Bạn không có quyền thực hiện hành động này. Yêu cầu vai trò: ${allowedRoles.join(' hoặc ')}.`
            });
        }

        console.log(`[AuthMiddleware][restrictTo] Access GRANTED for role '${userRole}'. Proceeding...`);
        next(); // Người dùng có vai trò hợp lệ, cho phép tiếp tục
    };
};

module.exports = { protect, restrictTo }; // Xuất cả hai hàm