// HSUBackend/src/controllers/evaluationController.js
const mongoose = require('mongoose');
const Evaluation = require('../models/Evaluation');
const Grade = require('../models/Grade'); // Dùng Grade để tìm môn đã học
const Course = require('../models/Course');
// const Timetable = require('../models/Timetable'); // Có thể cần để lấy tên GV

// --- Bộ câu hỏi đánh giá chuẩn ---
// Anh có thể tùy chỉnh bộ câu hỏi này
const EVALUATION_QUESTIONS = [
    { questionId: 'content_clarity', questionText: 'Nội dung môn học được trình bày rõ ràng, dễ hiểu.', type: 'rating' },
    { questionId: 'content_relevance', questionText: 'Nội dung môn học phù hợp và hữu ích cho ngành học.', type: 'rating' },
    { questionId: 'instructor_knowledge', questionText: 'Giảng viên thể hiện kiến thức chuyên môn sâu rộng.', type: 'rating' },
    { questionId: 'instructor_preparedness', questionText: 'Giảng viên chuẩn bị bài giảng chu đáo.', type: 'rating' },
    { questionId: 'instructor_communication', questionText: 'Giảng viên truyền đạt dễ hiểu, tạo hứng thú.', type: 'rating' },
    { questionId: 'instructor_feedback', questionText: 'Giảng viên phản hồi bài tập/thắc mắc kịp thời, hữu ích.', type: 'rating' },
    { questionId: 'assessment_fairness', questionText: 'Phương pháp kiểm tra, đánh giá công bằng, phù hợp.', type: 'rating' },
    { questionId: 'general_improvement', questionText: 'Góp ý để cải thiện môn học/giảng viên (nếu có):', type: 'comment' },
];
// -------------------------------------------

/**
 * @desc    Lấy danh sách các môn học sinh viên có thể đánh giá
 * @route   GET /api/evaluations/evaluatable
 * @access  Private
 */
const getEvaluableCourses = async (req, res) => {
    console.log('[EvalCtrl] === Handling GET /evaluatable ===');
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa xác thực.' });

    try {
        // *** Logic phức tạp: Xác định kỳ học "có thể đánh giá" ***
        // Ví dụ đơn giản: Lấy tất cả các môn đã có điểm của user
        // Trong thực tế cần logic phức tạp hơn để xác định đúng kỳ (vd: kỳ vừa kết thúc)
        const learnedCoursesPipeline = [
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
             // Lấy thông tin mới nhất cho mỗi môn trong mỗi kỳ (nếu có nhiều bản ghi điểm)
             { $sort: { createdAt: -1 } }, // Sắp xếp để lấy bản ghi mới nhất (nếu có timestamps)
             { $group: {
                 _id: { courseId: '$courseId', semester: '$semester', academicYear: '$academicYear' },
                 // Lấy thông tin từ bản ghi đầu tiên (mới nhất) của nhóm
                 // instructorNameFromGrade: { $first: '$instructorName' } // Giả sử Grade có tên GV
             }},
             // Join để lấy tên môn
             { $lookup: { from: 'courses', localField: '_id.courseId', foreignField: '_id', as: 'courseInfo' } },
             { $unwind: '$courseInfo' },
             // (Optional) Join Timetable để lấy tên GV nếu Grade không có
             // { $lookup: { ... } }
             { $project: {
                 _id: 0,
                 courseId: '$_id.courseId', semester: '$_id.semester', academicYear: '$_id.academicYear',
                 courseCode: '$courseInfo.courseCode', courseName: '$courseInfo.courseName',
                 // Lấy tên GV từ Grade hoặc Timetable join
                 // instructorName: '$instructorNameFromGrade' // Hoặc từ join khác
                 // Tạm thời bỏ qua instructor ở list này
             }}
        ];
        const learnedCourses = await Grade.aggregate(learnedCoursesPipeline);

        // Lấy danh sách các môn đã đánh giá
        const evaluatedEntries = await Evaluation.find({ userId: userId }).select('courseId semester academicYear -_id').lean();
        const evaluatedSet = new Set(evaluatedEntries.map(e => `${e.courseId}-${e.semester}-${e.academicYear}`));

        // Lọc ra những môn chưa đánh giá
        const evaluatableCourses = learnedCourses.filter(course => {
            const key = `${course.courseId}-${course.semester}-${course.academicYear}`;
            return !evaluatedSet.has(key);
        });

        console.log(`[EvalCtrl] Found ${evaluatableCourses.length} evaluatable courses for user ${userId}`);
        res.status(200).json({ success: true, data: evaluatableCourses });

    } catch (error) {
        console.error('--- ERROR in getEvaluableCourses ---', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách môn học.' });
    }
};

/**
 * @desc    Lấy bộ câu hỏi đánh giá chuẩn
 * @route   GET /api/evaluations/questions
 * @access  Private
 */
const getEvaluationQuestions = async (req, res) => {
     console.log('[EvalCtrl] === Handling GET /questions ===');
     // Chỉ cần trả về mảng câu hỏi
     res.status(200).json({ success: true, data: EVALUATION_QUESTIONS });
 };


/**
 * @desc    Nộp bài đánh giá môn học
 * @route   POST /api/evaluations
 * @access  Private
 */
const submitEvaluation = async (req, res) => {
    console.log('[EvalCtrl] === Handling POST /submit ===');
    const userId = req.user?._id;
    const { courseId, semester, academicYear, instructorId, instructorName, answers, generalComment } = req.body;

    // --- Validate đầu vào cơ bản ---
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
    if (!courseId || !semester || !academicYear || !answers) return res.status(400).json({ success: false, message: 'Thiếu thông tin môn học, kỳ học, hoặc câu trả lời.' });
    if (!Array.isArray(answers) || answers.length === 0) return res.status(400).json({ success: false, message: 'Dữ liệu câu trả lời không hợp lệ.' });
    // Có thể thêm validate chi tiết cho từng answer trong mảng ở đây

    try {
        // --- Kiểm tra đã đánh giá chưa ---
        const existingEvaluation = await Evaluation.findOne({ userId, courseId, semester, academicYear });
        if (existingEvaluation) return res.status(400).json({ success: false, message: 'Bạn đã đánh giá môn học này trong kỳ này rồi.' });

        // --- Tạo bản ghi mới ---
        const newEvaluation = new Evaluation({
            userId, courseId, semester, academicYear,
            instructorId: instructorId || undefined,
            instructorName: instructorName || undefined, // Cần lấy tên GV đúng từ đâu đó nếu không có ID
            answers, generalComment: generalComment || '',
        });

        // --- Lưu vào DB ---
        await newEvaluation.save();

        console.log(`[EvalCtrl] Evaluation submitted successfully for user ${userId}, course ${courseId}`);
        res.status(201).json({ success: true, message: 'Gửi đánh giá thành công!' });

    } catch (error) {
        console.error('--- ERROR in submitEvaluation ---', error);
         if (error.code === 11000) return res.status(400).json({ success: false, message: 'Lỗi: Đánh giá đã tồn tại.' });
         if (error.name === 'ValidationError') { const messages = Object.values(error.errors).map(val => val.message); return res.status(400).json({ success: false, message: messages.join('. ') }); }
        res.status(500).json({ success: false, message: 'Lỗi server khi gửi đánh giá.' });
    }
};

module.exports = { getEvaluableCourses, getEvaluationQuestions, submitEvaluation };