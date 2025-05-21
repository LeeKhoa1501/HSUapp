// src/controllers/attendanceController.js
const mongoose = require('mongoose');
const Timetable = require('../models/Timetable'); // <<< ĐỌC TỪ ĐÂY
// const Attendance = require('../models/attendance'); // <<< KHÔNG DÙNG MODEL NÀY

/**
 * @desc    Lấy dữ liệu điểm danh tổng hợp (ĐỌC TỪ TIMETABLE)
 * @route   GET /api/attendance/summary
 * @access  Private
 */
const getAttendanceSummary = async (req, res) => {
    console.log('[AttendanceCtrl] === Handling GET /api/attendance/summary (Reading from Timetable) ===');
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa xác thực.' });

    try {
        const pipeline = [
            // 1. Lọc user
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            // 2. Join courses
            { $lookup: { from: 'courses', localField: 'courseId', foreignField: '_id', as: 'courseInfo' } },
            { $unwind: { path: '$courseInfo', preserveNullAndEmptyArrays: true } },
            // 3. Nhóm lần 1: Đếm TẤT CẢ trạng thái có thể có
            {
                $group: {
                    _id: { academicYear: '$academicYear', semester: '$semester', courseId: '$courseId', courseCode: '$courseInfo.courseCode', courseName: '$courseInfo.courseName' },
                    totalSessions: { $sum: 1 }, // Tổng số buổi học của môn này trong kỳ
                    // Đếm các trạng thái cụ thể
                    presentDirectCount: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'Present'] }, 1, 0] } }, // Đếm trực tiếp 'Present'
                    absentCount: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'Absent'] }, 1, 0] } },
                    lateCount: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'Late'] }, 1, 0] } },
                    excusedCount: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'Excused'] }, 1, 0] } },
                    notYetCount: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'NotYet'] }, 1, 0] } }, // Đếm buổi chưa diễn ra
                    nullCount: { $sum: { $cond: [{ $eq: ['$attendanceStatus', null] }, 1, 0] } }      // Đếm buổi chưa có trạng thái (lỗi?)
                }
            },
             // 4. Thêm trường semesterOrderValue (như cũ)
             { $addFields: { semesterOrderValue: { $switch: { branches: [ { case: { $eq: ["$_id.semester", "Học kỳ 1"] }, then: 1 }, { case: { $eq: ["$_id.semester", "Học kỳ Tết"] }, then: 2 }, { case: { $eq: ["$_id.semester", "Học kỳ 2"] }, then: 3 }, { case: { $eq: ["$_id.semester", "Học kỳ Hè"] }, then: 4 }, ], default: 99 } } } },
            // 5. Nhóm lần 2: Gom theo kỳ và tính toán Present Count chính xác
            {
                $group: {
                    _id: { academicYear: '$_id.academicYear', semester: '$_id.semester', semesterOrder: '$semesterOrderValue' },
                    courses: {
                        $push: {
                            courseId: '$_id.courseId', courseCode: '$_id.courseCode', courseName: '$_id.courseName',
                            totalSessions: '$totalSessions',
                            absentCount: '$absentCount',
                            lateCount: '$lateCount',
                            excusedCount: '$excusedCount',
                            // >>> TÍNH PRESENT COUNT CHÍNH XÁC <<<
                            // Cách 1: Đếm trực tiếp (nếu dữ liệu 'Present' đã đúng sau khi chạy script)
                            presentCount: '$presentDirectCount',
                            // Cách 2: Tính gián tiếp (An toàn hơn nếu có lỗi gán status)
                            // presentCount: {
                            //    $max: [ 0, { $subtract: [ '$totalSessions', { $add: [ '$absentCount', '$lateCount', '$excusedCount', '$notYetCount', '$nullCount' ] } ] } ]
                            // }
                        }
                    }
                }
            },
            // 6. Sắp xếp các kỳ (như cũ)
            { $sort: { '_id.academicYear': -1, '_id.semesterOrder': 1 } },
            // 7. Định dạng output (như cũ)
            { $project: { _id: 0, title: { $concat: [ '$_id.semester', ' (', '$_id.academicYear', ')' ] }, data: '$courses' } }
        ];

        console.log(`[AttendanceCtrl][Summary] Executing aggregation (from Timetable) for user: ${userId}`);
        const attendanceSummary = await Timetable.aggregate(pipeline); // <<< QUERY TRÊN TIMETABLE >>>
        console.log(`[AttendanceCtrl][Summary] Found ${attendanceSummary.length} semester summaries.`);
        res.status(200).json({ success: true, data: attendanceSummary });

    } catch (error) { console.error('--- ERROR in getAttendanceSummary Controller ---', error); res.status(500).json({ success: false, message: 'Lỗi server.' }); }
};

/**
 * @desc    Lấy chi tiết các buổi VẮNG/TRỄ/PHÉP (ĐỌC TỪ TIMETABLE)
 * @route   GET /api/attendance/details?courseId=...[&status=...]
 * @access  Private
 */
const getAttendanceDetails = async (req, res) => {
    console.log('[AttendanceCtrl] === Handling GET /api/attendance/details (from Timetable) ===');
    const userId = req.user?._id;
    const { courseId, status } = req.query; // Không cần semester/academicYear nữa vì courseId là đủ

    if (!userId) return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) return res.status(400).json({ success: false, message: 'ID môn học không hợp lệ.' });

    let statusFilter = ['Absent', 'Late', 'Excused']; // Mặc định chỉ lấy 3 loại này
    if (status) { /* ... xử lý status filter nếu muốn lọc thêm ... */ }

    try {
         // Query trực tiếp trên Timetable
         const findCriteria = {
             userId: new mongoose.Types.ObjectId(userId),
             courseId: new mongoose.Types.ObjectId(courseId),
             attendanceStatus: { $in: statusFilter } // Chỉ lấy các trạng thái cần xem chi tiết
         };

         console.log(`[AttendanceCtrl][Details] Finding details with criteria:`, findCriteria);
         const detailedEntries = await Timetable.find(findCriteria)
                                            .select('date startTime endTime attendanceStatus attendanceNotes attendanceCheckInTime') // Chỉ lấy các trường cần thiết
                                            .sort({ date: 1 }); // Sắp xếp theo ngày

         console.log(`[AttendanceCtrl][Details] Found ${detailedEntries.length} detail entries.`);
         res.status(200).json({
             success: true,
             count: detailedEntries.length,
             data: detailedEntries
         });

    } catch (error) { console.error('--- ERROR in getAttendanceDetails ---', error); res.status(500).json({ success: false, message: 'Lỗi server.' }); }
};

module.exports = { getAttendanceSummary, getAttendanceDetails };