// src/controllers/examController.js
const mongoose = require('mongoose');
const ExamSchedule = require('../models/ExamSchedule'); // Import model vừa tạo

const getMyExams = async (req, res) => {
    console.log('[ExamCtrl] === Handling GET /api/exams/my ===');
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa xác thực.' });

    try {
        const pipeline = [
            // 1. Tìm lịch thi của user này
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },

            // 2. Lấy thông tin môn học từ 'courses'
            {
                $lookup: {
                    from: 'courses',       // Tên collection courses (chữ thường)
                    localField: 'courseId',
                    foreignField: '_id',
                    as: 'courseInfo'      // Đổi tên để tránh trùng courseDetails
                }
            },
            // Biến mảng courseInfo thành object (hoặc null nếu không tìm thấy)
            { $unwind: { path: '$courseInfo', preserveNullAndEmptyArrays: true } },

            // 3. Lấy thông tin địa điểm từ 'Locations'
            {
                $lookup: {
                    from: 'Locations',     // Tên collection Locations (chữ L hoa)
                    localField: 'locationId',
                    foreignField: '_id',
                    as: 'locationInfo'    // Đổi tên để tránh trùng locationDetails
                }
            },
             // Biến mảng locationInfo thành object (hoặc null nếu không tìm thấy)
            { $unwind: { path: '$locationInfo', preserveNullAndEmptyArrays: true } },

            // 4. Sắp xếp theo ngày thi, rồi giờ thi
            { $sort: { date: 1, startTime: 1 } },

            // 5. Chọn lọc và định dạng lại kết quả cuối cùng
            {
                $project: {
                    // Giữ lại từ ExamSchedule
                    _id: 1,
                    date: 1,
                    startTime: 1,
                    durationMinutes: 1,
                    room: 1,
                    examType: 1,
                    examFormat: 1,
                    notes: 1,
                    classId: 1,

                    // Lấy từ courseInfo
                    courseCode: '$courseInfo.courseCode',
                    courseName: '$courseInfo.courseName',

                    // Lấy từ locationInfo
                    locationName: '$locationInfo.name' // Tên cơ sở
                    // Bỏ các trường không cần: userId, courseId, locationId, courseInfo, locationInfo, __v
                }
            }
        ];

        console.log(`[ExamCtrl] Executing aggregation for user: ${userId}`);
        const userExams = await ExamSchedule.aggregate(pipeline);
        console.log(`[ExamCtrl] Found ${userExams.length} exam entries.`);

        res.status(200).json({ success: true, count: userExams.length, data: userExams });

    } catch (error) {
        console.error('--- ERROR in getMyExams Controller ---', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch thi.' });
    }
};

module.exports = { getMyExams };