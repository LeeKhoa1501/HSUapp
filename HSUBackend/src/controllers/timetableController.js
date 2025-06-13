// HSUBackend/src/controllers/timetableController.js
const mongoose = require('mongoose');
const Timetable = require('../models/Timetable');
const Course = require('../models/Course');
const Location = require('../models/Location'); // Đảm bảo tên Model này khớp khi đăng ký

// Helper function để lấy ngày hiện tại YYYY-MM-DD theo giờ Việt Nam
const getCurrentVNDateString = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
};

// Helper function để lấy giờ hiện tại HH:mm theo giờ Việt Nam
const getCurrentVNTimeString = () => {
    return new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
};

// --- Hàm: Lấy toàn bộ lịch sử thời khóa biểu của User ---
const getMyTimetable = async (req, res) => {
    console.log('[TimetableCtrl] === Handling GET /api/timetable/my ===');
    const userId = req.user?._id;

    if (!userId) {
        console.error('[TimetableCtrl][getMyTimetable] Error: Unauthorized - userId not found.');
        return res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
    }

    try {
        const pipeline = [
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $lookup: { from: 'courses', localField: 'courseId', foreignField: '_id', as: 'courseDetails' } },
            { $unwind: { path: '$courseDetails', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: 'Location', localField: 'locationId', foreignField: '_id', as: 'locationDetails' } }, 
            { $unwind: { path: '$locationDetails', preserveNullAndEmptyArrays: true } },
            { $sort: { date: -1, startTime: 1 } },
            {
                $project: {
                    _id: 1, date: 1, dayOfWeek: 1, startTime: 1, endTime: 1, room: 1,
                    instructor: 1, semester: 1, academicYear: 1, classId: 1,
                    attendanceStatus: 1, attendanceCheckInTime: 1, attendanceNotes: 1,
                    isAttendanceOpen: 1,
                    courseCode: '$courseDetails.courseCode',
                    courseName: '$courseDetails.courseName',
                    credits: '$courseDetails.credits',
                    locationName: '$locationDetails.name' // Đảm bảo model Location có trường 'name'
                }
            }
        ];

        console.log(`[TimetableCtrl][getMyTimetable] Executing aggregation for user: ${userId}`);
        const userTimetable = await Timetable.aggregate(pipeline);
        console.log(`[TimetableCtrl][getMyTimetable] Found ${userTimetable.length} timetable entries.`);

        res.status(200).json({ success: true, count: userTimetable.length, data: userTimetable });
    } catch (error) {
        console.error('[TimetableCtrl][getMyTimetable] --- ERROR ---');
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy thời khóa biểu.' });
    }
};

// --- HÀM: Lấy lịch học chỉ cho ngày hôm nay của User ---
const getTodayTimetable = async (req, res) => {
    console.log('[TimetableCtrl] === Handling GET /api/timetable/today ===');
    const userId = req.user?._id;

    if (!userId) {
        console.error('[TimetableCtrl][getTodayTimetable] Error: Unauthorized - userId not found.');
        return res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
    }

    try {
        const todayDateString = getCurrentVNDateString();
        console.log(`[TimetableCtrl][getTodayTimetable] Fetching for user ${userId} on date ${todayDateString}`);

        const pipeline = [
            { $match: { userId: new mongoose.Types.ObjectId(userId), date: todayDateString } },
            { $lookup: { from: 'courses', localField: 'courseId', foreignField: '_id', as: 'courseDetails' } },
            { $unwind: { path: '$courseDetails', preserveNullAndEmptyArrays: true } },
            // Bỏ $lookup location nếu không cần thiết cho card "Lịch học hôm nay" để tối ưu
            { $lookup: { from: 'Location', localField: 'locationId', foreignField: '_id', as: 'locationDetails' } },
            { $unwind: { path: '$locationDetails', preserveNullAndEmptyArrays: true } },
            { $sort: { startTime: 1 } },
            {
                $project: {
                    _id: 1, date: 1, startTime: 1, endTime: 1, room: 1,
                    courseName: '$courseDetails.courseName',
                    instructor: 1, // Giữ lại instructor nếu nó là trường của Timetable model
                    // locationName: '$locationDetails.name' // Bỏ nếu bỏ $lookup location
                }
            }
        ];

        const todayTimetableEntries = await Timetable.aggregate(pipeline);
        console.log(`[TimetableCtrl][getTodayTimetable] Found ${todayTimetableEntries.length} entries for today.`);

        res.status(200).json({ success: true, count: todayTimetableEntries.length, data: todayTimetableEntries });
    } catch (error) {
        console.error('[TimetableCtrl][getTodayTimetable] --- ERROR ---', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch học hôm nay.' });
    }
};

// --- HÀM: Kiểm tra xem có buổi học nào đang mở điểm danh không ---
const checkSessionAvailability = async (req, res) => {
    console.log('[TimetableCtrl] === Handling GET /api/timetable/check-availability ===');
    const userId = req.user?._id;
    if (!userId) {
        console.error('[TimetableCtrl][checkAvailability] Error: Unauthorized - userId not found.');
        return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
    }

    try {
        const vnTime = getCurrentVNTimeString();
        const todayDateString = getCurrentVNDateString();
        console.log(`[TimetableCtrl][checkAvailability] Checking for user ${userId} at ${todayDateString} ${vnTime}`);

        const findCriteria = {
            userId: new mongoose.Types.ObjectId(userId),
            date: todayDateString,
            isAttendanceOpen: true, // Chỉ tìm những buổi đang MỞ điểm danh
            startTime: { $lte: vnTime }, // Giờ hiện tại PHẢI SAU hoặc BẰNG giờ bắt đầu
            endTime: { $gt: vnTime }    // Giờ hiện tại PHẢI TRƯỚC giờ kết thúc
        };
        console.log('[TimetableCtrl][checkAvailability] Find Criteria:', findCriteria);

        const currentSession = await Timetable.findOne(findCriteria)
            .populate({ path: 'courseId', select: 'courseCode courseName', model: 'Course' }) // Đảm bảo model là 'Course'
            .populate({ path: 'locationId', select: 'name building', model: 'Location' }) // 
            .lean(); // Dùng lean() để tăng hiệu suất nếu chỉ đọc

        if (currentSession) {
            console.log(`[TimetableCtrl][checkAvailability] Found open session: ${currentSession.courseId?.courseCode}`);
            // Trả về các thông tin cần thiết cho việc check-in
            const responseData = {
                _id: currentSession._id, // ID của bản ghi Timetable
                date: currentSession.date,
                startTime: currentSession.startTime,
                endTime: currentSession.endTime,
                room: currentSession.room,
                courseCode: currentSession.courseId?.courseCode,
                courseName: currentSession.courseId?.courseName,
                locationName: currentSession.locationId?.name,
                // Thêm các trường khác nếu Frontend cần
            };
            res.status(200).json({ success: true, data: responseData });
        } else {
            console.log(`[TimetableCtrl][checkAvailability] No open session found for user ${userId}.`);
            res.status(200).json({ success: true, data: null, message: 'Hiện không có buổi học nào đang mở điểm danh.' });
        }
    } catch (error) {
        console.error('[TimetableCtrl][checkAvailability] --- ERROR ---', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi kiểm tra buổi học điểm danh.' });
    }
};

// --- HÀM: Sinh viên thực hiện Check-in Điểm danh ---
const checkInAttendance = async (req, res) => {
    const { timetableEntryId } = req.body; // Chỉ cần timetableEntryId từ client
    const userId = req.user?._id;

    console.log(`[TimetableCtrl] === Handling POST /api/timetable/checkin - User: ${userId}, Timetable Entry ID: ${timetableEntryId} ===`);

    if (!userId) {
        console.error('[TimetableCtrl][checkIn] Error: Unauthorized - userId not found.');
        return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
    }
    if (!timetableEntryId || !mongoose.Types.ObjectId.isValid(timetableEntryId)) {
        console.error(`[TimetableCtrl][checkIn] Error: Invalid or missing timetableEntryId: ${timetableEntryId}`);
        return res.status(400).json({ success: false, message: 'ID buổi học không hợp lệ hoặc bị thiếu.' });
    }

    try {
        const entryObjectId = new mongoose.Types.ObjectId(timetableEntryId);
        const userObjectId = new mongoose.Types.ObjectId(userId);

        const timetableEntry = await Timetable.findOne({
            _id: entryObjectId,
            userId: userObjectId
        });

        if (!timetableEntry) {
            console.warn(`[TimetableCtrl][checkIn] Timetable entry not found or user mismatch. ID: ${timetableEntryId}, User: ${userId}`);
            return res.status(404).json({ success: false, message: 'Buổi học không tồn tại hoặc bạn không có quyền điểm danh cho buổi này.' });
        }

        if (!timetableEntry.isAttendanceOpen) {
            console.warn(`[TimetableCtrl][checkIn] Attendance not open for entry: ${timetableEntryId}. Current status: ${timetableEntry.isAttendanceOpen}`);
            return res.status(400).json({ success: false, message: 'Giảng viên chưa mở hoặc đã đóng điểm danh cho buổi học này.' });
        }

        if (['Present', 'Late'].includes(timetableEntry.attendanceStatus)) {
            console.warn(`[TimetableCtrl][checkIn] Already attended for entry: ${timetableEntryId}. Status: ${timetableEntry.attendanceStatus}`);
            return res.status(400).json({ success: false, message: 'Bạn đã điểm danh cho buổi học này rồi.' });
        }

        // Xử lý xác định trạng thái Present/Late
        const checkInTime = new Date(); // Thời gian check-in là giờ UTC hiện tại của server
        let newStatus = 'Present';

        const lessonDateString = timetableEntry.date; // Ví dụ: "2025-06-02"
        const lessonStartTimeString = timetableEntry.startTime; // Ví dụ: "13:00"

        // Chuyển đổi thời gian bắt đầu buổi học sang đối tượng Date để so sánh chính xác hơn
        // Giả sử lessonDateString và lessonStartTimeString là giờ Việt Nam (+7)
        const [sH, sM] = lessonStartTimeString.split(':').map(Number);
        
        // Tạo Date object cho thời điểm bắt đầu buổi học THEO GIỜ VIỆT NAM
        // bằng cách kết hợp ngày từ DB và giờ từ DB
        const lessonStartDateParts = lessonDateString.split('-');
        const lessonStartYear = parseInt(lessonStartDateParts[0]);
        const lessonStartMonth = parseInt(lessonStartDateParts[1]) - 1; // Tháng trong JS là 0-11
        const lessonStartDay = parseInt(lessonStartDateParts[2]);
        
        // Tạo đối tượng Date cho thời điểm bắt đầu buổi học tại múi giờ địa phương của server,
        // sau đó sẽ so sánh với thời gian check-in (cũng là giờ địa phương của server)
        const lessonStartDateTimeLocal = new Date(lessonStartYear, lessonStartMonth, lessonStartDay, sH, sM, 0);
        
        // Thời gian cho phép trễ (ví dụ: 15 phút)
        const LATE_THRESHOLD_MINUTES = 15;
        const lessonStartDeadlineForPresent = new Date(lessonStartDateTimeLocal.getTime() + LATE_THRESHOLD_MINUTES * 60 * 1000);

        console.log(`[TimetableCtrl][checkIn] Check-in time (server local): ${checkInTime.toISOString()}`);
        console.log(`[TimetableCtrl][checkIn] Lesson start time (server local): ${lessonStartDateTimeLocal.toISOString()}`);
        console.log(`[TimetableCtrl][checkIn] Deadline for 'Present' status (server local): ${lessonStartDeadlineForPresent.toISOString()}`);

        if (checkInTime > lessonStartDeadlineForPresent) {
            newStatus = 'Late';
            console.log(`[TimetableCtrl][checkIn] Marked as Late for entry: ${timetableEntryId}`);
        } else {
            console.log(`[TimetableCtrl][checkIn] Marked as Present for entry: ${timetableEntryId}`);
        }
        // Kết thúc xử lý Present/Late

        timetableEntry.attendanceStatus = newStatus;
        timetableEntry.attendanceCheckInTime = checkInTime; // Lưu giờ check-in (UTC của server)
        
        console.log(`[TimetableCtrl][checkIn] Attempting to save updated timetable entry: ${timetableEntryId}`);
        await timetableEntry.save();
        console.log(`[TimetableCtrl][checkIn] Attendance recorded successfully for entry: ${timetableEntryId} with status: ${newStatus}`);
        
        res.status(200).json({ success: true, message: `Điểm danh thành công! (Trạng thái: ${newStatus === 'Present' ? 'Có mặt' : 'Trễ'})` });

    } catch (error) {
        console.error('[TimetableCtrl][checkIn] --- ERROR ---', error);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({ success: false, message: 'ID buổi học cung cấp không hợp lệ.' });
        }
        res.status(500).json({ success: false, message: 'Lỗi server khi thực hiện điểm danh.' });
    }
};

module.exports = {
    getMyTimetable,
    getTodayTimetable,
    checkSessionAvailability,
    checkInAttendance
};