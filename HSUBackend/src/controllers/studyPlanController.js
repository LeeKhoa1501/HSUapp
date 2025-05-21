// HSUBackend/src/controllers/studyPlanController.js
const mongoose = require('mongoose');
const StudyPlan = require('../models/StudyPlan');
const Course = require('../models/Course');
const Grade = require('../models/Grade'); // Để kiểm tra môn đã học/có điểm

/**
 * @desc    Lấy kế hoạch học tập của user hiện tại
 * @route   GET /api/study-plan/my
 * @access  Private
 */
const getMyStudyPlan = async (req, res) => {
    console.log('[StudyPlanCtrl] === Handling GET /my ===');
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa xác thực.' });

    try {
        let studyPlan = await StudyPlan.findOne({ userId: userId })
            .populate({
                path: 'plannedSemesters.courses.courseId',
                select: 'courseCode courseName credits'
            })
            .populate({
                path: 'unsortedCourses.courseId',
                select: 'courseCode courseName credits'
            })
            .lean(); // <<< Thêm lean() để lấy plain object

        if (!studyPlan) {
            console.log(`[StudyPlanCtrl] No study plan found for user ${userId}, returning empty plan.`);
            // Trả về cấu trúc rỗng chuẩn để FE xử lý
            studyPlan = { plannedSemesters: [], unsortedCourses: [] };
        } else {
             // Sắp xếp lại các kỳ (nếu có)
              if (studyPlan.plannedSemesters && studyPlan.plannedSemesters.length > 1) {
                   studyPlan.plannedSemesters.sort((a, b) => (a.semesterCode || '').localeCompare(b.semesterCode || ''));
              }
             // Đảm bảo các mảng courses tồn tại (phòng trường hợp populate lỗi)
             studyPlan.plannedSemesters = (studyPlan.plannedSemesters || []).map(sem => ({
                ...sem,
                courses: (sem.courses || []).filter(c => c.courseId) // Lọc bỏ course bị null sau populate
             }));
             studyPlan.unsortedCourses = (studyPlan.unsortedCourses || []).filter(c => c.courseId); // Lọc bỏ course bị null
        }

        console.log(`[StudyPlanCtrl] Found/created study plan for user ${userId}`);
        res.status(200).json({ success: true, data: studyPlan });

    } catch (error) {
        console.error('--- ERROR in getMyStudyPlan ---', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy kế hoạch học tập.' });
    }
};

/**
 * @desc    Lấy danh sách môn học có thể thêm vào kế hoạch
 * @route   GET /api/study-plan/available-courses
 * @access  Private
 */
const getAvailableCourses = async (req, res) => {
    console.log('[StudyPlanCtrl] === Handling GET /available-courses ===');
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa xác thực.' });

    try {
        // --- Lấy ID các môn cần loại trừ ---
        // 1. Môn đã có điểm
        const gradedCourses = await Grade.find({ userId: userId }).distinct('courseId');
        const gradedCourseIds = new Set(gradedCourses.map(id => id.toString()));
        console.log(`[StudyPlanCtrl][Available] Found ${gradedCourseIds.size} graded courses.`);

        // 2. Môn đã có trong kế hoạch
        const currentPlan = await StudyPlan.findOne({ userId: userId }).select('plannedSemesters.courses.courseId unsortedCourses.courseId').lean();
        let plannedCourseIds = new Set();
        if (currentPlan) {
            // Dùng optional chaining và filter(Boolean) để an toàn hơn
            (currentPlan.plannedSemesters || []).forEach(sem =>
                (sem.courses || []).forEach(c => c.courseId && plannedCourseIds.add(c.courseId.toString()))
            );
            (currentPlan.unsortedCourses || []).forEach(c => c.courseId && plannedCourseIds.add(c.courseId.toString()));
        }
        console.log(`[StudyPlanCtrl][Available] Found ${plannedCourseIds.size} planned courses.`);

        // 3. Tổng hợp ID cần loại trừ
        const excludeIds = [...gradedCourseIds, ...plannedCourseIds];
        const excludeObjectIds = excludeIds
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));
        console.log(`[StudyPlanCtrl][Available] Total ${excludeObjectIds.length} courses to exclude.`);

        // 4. Lấy TẤT CẢ môn học, trừ những môn trong danh sách loại trừ
        //    *** KHÔNG LỌC THEO CHƯƠNG TRÌNH ĐÀO TẠO Ở ĐÂY ***
        const availableCourses = await Course.find({
            //  _id: { $nin: excludeObjectIds } 
         })
         .select('courseCode courseName credits _id') // Lấy các trường cần thiết
         .sort({ courseCode: 1 }) // Sắp xếp theo mã môn
         .lean(); // Dùng lean để trả về plain object

        console.log(`[StudyPlanCtrl][Available] Found ${availableCourses.length} available courses after exclusion.`);
        res.status(200).json({ success: true, data: availableCourses });

    } catch (error) {
        console.error('--- ERROR in getAvailableCourses ---', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách môn học.' });
    }
};


/**
 * @desc    Cập nhật (ghi đè) toàn bộ kế hoạch học tập
 * @route   PUT /api/study-plan/my
 * @access  Private
 */
const updateStudyPlan = async (req, res) => {
    console.log('[StudyPlanCtrl] === Handling PUT /my ===');
    const userId = req.user?._id;
    const { plannedSemesters, unsortedCourses } = req.body;

    if (!userId) return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
    // Validate cấu trúc cơ bản
    if (!Array.isArray(plannedSemesters) || !Array.isArray(unsortedCourses)) {
        return res.status(400).json({ success: false, message: 'Dữ liệu kế hoạch gửi lên không hợp lệ.' });
    }

    try {
        console.log(`[StudyPlanCtrl] Updating plan for user ${userId}`);

        // Chuẩn bị dữ liệu để lưu (chỉ lưu ID của course)
        const updateData = {
            plannedSemesters: plannedSemesters.map(sem => ({
                semesterCode: sem.semesterCode,
                semesterName: sem.semesterName,
                academicYear: sem.academicYear,
                // Đảm bảo chỉ lưu courseId hợp lệ
                courses: (sem.courses || [])
                         .filter(c => c?.courseId && mongoose.Types.ObjectId.isValid(c.courseId))
                         .map(c => ({ courseId: new mongoose.Types.ObjectId(c.courseId) }))
            })).filter(sem => sem.semesterCode), // Bỏ qua kỳ không có mã
            unsortedCourses: (unsortedCourses || [])
                             .filter(c => c?.courseId && mongoose.Types.ObjectId.isValid(c.courseId))
                             .map(c => ({ courseId: new mongoose.Types.ObjectId(c.courseId) }))
        };


        const updatedPlan = await StudyPlan.findOneAndUpdate(
            { userId: userId },
            { $set: updateData }, // Sử dụng $set để ghi đè
            { new: true, upsert: true, runValidators: true } // runValidators để kiểm tra schema
        );

        console.log(`[StudyPlanCtrl] Plan updated successfully for user ${userId}`);
        res.status(200).json({ success: true, message: 'Kế hoạch học tập đã được cập nhật.' });

    } catch (error) {
        console.error('--- ERROR in updateStudyPlan ---', error);
        if (error.name === 'ValidationError') { const messages = Object.values(error.errors).map(val => val.message); return res.status(400).json({ success: false, message: messages.join('. ') }); }
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật kế hoạch.' });
    }
};

module.exports = {
    getMyStudyPlan,
    getAvailableCourses,
    updateStudyPlan
};