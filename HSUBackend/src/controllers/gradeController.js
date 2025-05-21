// src/controllers/gradeController.js
const mongoose = require('mongoose');
const Grade = require('../models/Grade'); // Import model Grade

const getMyGrades = async (req, res) => {
    console.log('[GradeCtrl] === Handling GET /api/grades/my ===');
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa xác thực.' });

    try {
        const pipeline = [
            // 1. Tìm điểm của user này
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            // 2. Lấy thông tin môn học
            {
                $lookup: {
                    from: 'courses', // Collection courses
                    localField: 'courseId',
                    foreignField: '_id',
                    as: 'courseInfo'
                }
            },
            { $unwind: { path: '$courseInfo', preserveNullAndEmptyArrays: true } }, // Giữ lại điểm nếu không tìm thấy môn

            // 3. Sắp xếp (Ví dụ: theo năm học, học kỳ giảm dần)
            { $sort: { academicYear: -1, semester: -1 } },

            // 4. Chọn lọc trường dữ liệu trả về
            {
                $project: {
                    // Lấy từ Grade gốc
                    _id: 1, // ID của bản ghi điểm
                    semester: 1,
                    academicYear: 1,
                    midtermScore: 1,
                    assignmentScore: 1,
                    practicalScore: 1,
                    finalExamScore: 1,
                    overallScore: 1,
                    letterGrade: 1,
                    status: 1,
                    notes: 1,
                    // Lấy từ courseInfo
                    courseCode: '$courseInfo.courseCode',
                    courseName: '$courseInfo.courseName',
                    credits: '$courseInfo.credits' // Lấy tín chỉ nếu cần hiển thị
                    // Bỏ userId, courseId, courseInfo
                }
            }
        ];

        console.log(`[GradeCtrl] Executing aggregation for user: ${userId}`);
        const userGrades = await Grade.aggregate(pipeline);
        console.log(`[GradeCtrl] Found ${userGrades.length} grade entries.`);

        res.status(200).json({ success: true, count: userGrades.length, data: userGrades });

    } catch (error) {
        console.error('--- ERROR in getMyGrades Controller ---', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy điểm.' });
    }
};

module.exports = { getMyGrades };