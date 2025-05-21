// HSUBackend/src/server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db'); // Đường dẫn đến file kết nối DB của anh

// --- 1. LOAD BIẾN MÔI TRƯỜNG (.env) ---
// Đảm bảo file .env của anh nằm ở thư mục HSUBackend/ (cùng cấp với thư mục src/)
// Nếu file .env nằm ở thư mục gốc của project (bên ngoài HSUBackend), thì dùng:
// dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config(); // Nếu .env nằm cùng cấp với package.json của HSUBackend

console.log(`[Server Init] MONGODB_URI Loaded: ${process.env.MONGODB_URI ? 'OK' : '!!! UNDEFINED OR NOT LOADED !!!'}`);
console.log(`[Server Init] JWT_SECRET Loaded: ${process.env.JWT_SECRET ? 'OK' : '!!! UNDEFINED !!!'}`);
console.log(`[Server Init] PORT Loaded: ${process.env.PORT || 'Defaulting to 5000'}`);

// --- 2. ĐĂNG KÝ TẤT CẢ MODELS VỚI MONGOOSE ---
// Đây là bước QUAN TRỌNG NHẤT để sửa lỗi MissingSchemaError.
// Require tất cả các model ở đây để đảm bảo chúng được đăng ký với Mongoose
// trước khi bất kỳ routes hay controllers nào sử dụng chúng.
console.log('[Server Init] Registering Mongoose Models...');
require('./models/User');
require('./models/Company');
require('./models/Location');
require('./models/InternshipRequest');
require('./models/Booking');
require('./models/Course');
require('./models/Timetable');
require('./models/ExamSchedule');
require('./models/Grade');
require('./models/TuitionFee');
require('./models/Evaluation');
require('./models/StudyPlan');
require('./models/AcademicRequest');
require('./models/Event');
require('./models/PhotoAccount');
require('./models/PhotoTransaction');
// ... require TẤT CẢ các model khác mà anh có trong thư mục ./models/ ...
console.log('[Server Init] All Mongoose Models should be registered.');

// --- 3. KẾT NỐI DATABASE ---
// Gọi connectDB SAU KHI đã load dotenv và TRƯỚC KHI app bắt đầu lắng nghe request.
connectDB();

const app = express();

// --- 4. MIDDLEWARES CƠ BẢN ---
app.use(cors()); // Cho phép Cross-Origin Resource Sharing
app.use(express.json()); // Middleware để parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Middleware để parse URL-encoded request bodies

// --- 5. IMPORT ROUTES (SAU KHI MODELS ĐÃ ĐƯỢC ĐĂNG KÝ) ---
console.log('[Server Init] Importing routes...');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const locationRoutes = require('./routes/locationRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const bookingRoutes = require ('./routes/bookingRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const examRoutes = require('./routes/examRoutes');
const gradeRoutes = require('./routes/gradeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const tuitionRoutes = require('./routes/tuitionRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const studyPlanRoutes = require('./routes/studyPlanRoutes');
const academicRequestRoutes = require('./routes/academicRequestRoutes');
const companyRoutes = require('./routes/companyRoutes');
const eventRoutes = require('./routes/eventRoutes');
const photoAccountRoutes = require('./routes/photoAccountRoutes');
const internshipRoutes = require('./routes/internshipRoutes'); // Route này cần các model đã đăng ký ở trên
console.log('[Server Init] Routes imported.');

// --- 6. MOUNT ROUTES ---
console.log('[Server Init] Mounting routes...');
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/bookings',bookingRoutes);
app.use('/api/timetable',timetableRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tuition',tuitionRoutes);
app.use('/api/evaluations',evaluationRoutes);
app.use('/api/study-plan', studyPlanRoutes);
app.use('/api/academic-requests',academicRequestRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/photo-account', photoAccountRoutes);
app.use('/api/internships', internshipRoutes);
console.log('[Server Init] Routes mounted.');

// Test route
app.get('/', (req, res) => {
    res.send('HSUAPPNEW Backend API is running...');
});

// --- ERROR HANDLING MIDDLEWARE (Nên đặt ở cuối cùng) ---
app.use((err, req, res, next) => {
    console.error("--- UNHANDLED SERVER ERROR ---");
    const statusCode = err.statusCode || res.statusCode === 200 ? 500 : res.statusCode;
    console.error(`[${statusCode}] ${err.message}`);
    // Không nên gửi stack trace về client trong môi trường production
    // console.error(err.stack);
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Đã có lỗi xảy ra trên máy chủ.',
        // stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server HSUAPPNEW Backend đang chạy trên port ${PORT} ở chế độ ${process.env.NODE_ENV || 'development'}`);
    console.log(`Kết nối MongoDB: ${process.env.MONGODB_URI ? 'OK (dựa trên biến môi trường)' : '!!! Thất bại - MONGO_URI không được load !!!'}`);
});