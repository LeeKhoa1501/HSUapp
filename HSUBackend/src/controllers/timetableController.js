// src/controllers/timetableController.js
const mongoose = require('mongoose');
const Timetable = require('../models/Timetable'); // Model cho collection 'Timetable'
const Course = require('../models/Course');   // Model cho collection 'courses'
const Location = require('../models/Location'); // Model cho collection 'Locations' (kiểm tra lại tên chính xác trong DB)

// --- Hàm: Lấy toàn bộ lịch sử thời khóa biểu của User ---
const getMyTimetable = async (req, res) => {
    console.log('[TimetableCtrl] === Handling GET /api/timetable/my ===');
    const userId = req.user?._id;

    if (!userId) {
        return res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
    }

    try {
        const pipeline = [
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            {
                $lookup: {
                    from: 'courses',
                    localField: 'courseId',
                    foreignField: '_id',
                    as: 'courseDetails'
                }
            },
            { $unwind: { path: '$courseDetails', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'Locations', // Quan trọng: Đảm bảo tên collection 'Locations' hoặc 'locations' đúng với DB của anh
                    localField: 'locationId',
                    foreignField: '_id',
                    as: 'locationDetails'
                }
            },
            { $unwind: { path: '$locationDetails', preserveNullAndEmptyArrays: true } },
            { $sort: { date: -1, startTime: 1 } },
            {
                $project: {
                    _id: 1,
                    date: 1,
                    dayOfWeek: 1,
                    startTime: 1,
                    endTime: 1,
                    room: 1,
                    instructor: 1,
                    semester: 1,
                    academicYear: 1,
                    classId: 1,
                    attendanceStatus: 1,
                    attendanceCheckInTime: 1,
                    attendanceNotes: 1,
                    isAttendanceOpen: 1,
                    courseCode: '$courseDetails.courseCode',
                    courseName: '$courseDetails.courseName',
                    credits: '$courseDetails.credits',
                    locationName: '$locationDetails.name'
                }
            }
        ];

        console.log(`[TimetableCtrl][getMyTimetable] Executing aggregation for user: ${userId}`);
        const userTimetable = await Timetable.aggregate(pipeline);
        console.log(`[TimetableCtrl][getMyTimetable] Found ${userTimetable.length} timetable entries.`);

        res.status(200).json({
            success: true,
            count: userTimetable.length,
            data: userTimetable
        });

    } catch (error) {
        console.error('--- ERROR in getMyTimetable Controller ---', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy thời khóa biểu.' });
    }
};

// --- HÀM MỚI: Lấy lịch học chỉ cho ngày hôm nay của User ---
const getTodayTimetable = async (req, res) => {
    console.log('[TimetableCtrl] === Handling GET /api/timetable/today ===');
    const userId = req.user?._id;

    if (!userId) {
        return res.status(401).json({ success: false, message: 'Chưa xác thực người dùng.' });
    }

    try {
        // Lấy ngày hiện tại theo múi giờ Việt Nam, định dạng YYYY-MM-DD
        const now = new Date();
        // 'en-CA' cho YYYY-MM-DD, 'Asia/Ho_Chi_Minh' để đảm bảo đúng ngày ở VN
        const todayDateString = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });


        console.log(`[TimetableCtrl][getTodayTimetable] Fetching for user ${userId} on date ${todayDateString}`);

        const pipeline = [
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    date: todayDateString // Chỉ lấy các buổi học của ngày hôm nay
                }
            },
            {
                $lookup: {
                    from: 'courses',
                    localField: 'courseId',
                    foreignField: '_id',
                    as: 'courseDetails'
                }
            },
            { $unwind: { path: '$courseDetails', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'Locations', // Quan trọng: Đảm bảo tên collection 'Locations' hoặc 'locations' đúng với DB của anh
                    localField: 'locationId',
                    foreignField: '_id',
                    as: 'locationDetails'
                }
            },
            { $unwind: { path: '$locationDetails', preserveNullAndEmptyArrays: true } },
            {
                $sort: { startTime: 1 } // Sắp xếp theo giờ bắt đầu
            },
            {
                $project: { // Chỉ lấy những trường cần thiết cho card "Lịch học hôm nay"
                    _id: 1,             // ID của bản ghi Timetable (cần cho key hoặc action sau này)
                    date: 1,            // YYYY-MM-DD
                    startTime: 1,       // HH:mm
                    endTime: 1,         // HH:mm
                    room: 1,
                    // instructor: '$courseDetails.instructor', // Nếu instructor lưu trong course, hoặc là trường riêng trong Timetable
                    courseName: '$courseDetails.courseName', // Tên môn học
                    // Thêm các trường khác nếu TodayTimetableCard cần
                    // Ví dụ: classId: 1, locationName: '$locationDetails.name'
                }
            }
        ];

        const todayTimetableEntries = await Timetable.aggregate(pipeline);
        console.log(`[TimetableCtrl][getTodayTimetable] Found ${todayTimetableEntries.length} entries for today.`);

        res.status(200).json({
            success: true,
            count: todayTimetableEntries.length,
            data: todayTimetableEntries // Mảng các buổi học của ngày hôm nay
        });

    } catch (error) {
        console.error('--- ERROR in getTodayTimetable Controller ---', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch học hôm nay.' });
    }
};


// --- HÀM: Kiểm tra xem có buổi học nào đang mở điểm danh không ---
const checkSessionAvailability = async (req, res) => {
     console.log('[TimetableCtrl] === Handling GET /api/timetable/check-availability ===');
     const userId = req.user?._id;
     if (!userId) return res.status(401).json({ success: false, message: 'Chưa xác thực.' });

     try {
        const now = new Date();
        // Thời gian và ngày theo múi giờ Việt Nam
        const vnTime = now.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }); // HH:mm
        const todayDateString = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // YYYY-MM-DD

        console.log(`[TimetableCtrl][checkAvailability] Checking for user ${userId} at ${todayDateString} ${vnTime}`);

        const findCriteria = {
             userId: new mongoose.Types.ObjectId(userId),
             date: todayDateString,
             isAttendanceOpen: true,
             startTime: { $lte: vnTime },
             endTime: { $gt: vnTime }
         };

         console.log('[TimetableCtrl][checkAvailability] Find Criteria:', findCriteria);

         const currentSession = await Timetable.findOne(findCriteria)
                                         .populate('courseId', 'courseCode courseName')
                                         .populate('locationId', 'name');

        if (currentSession) {
            console.log(`[TimetableCtrl][checkAvailability] Found open session: ${currentSession.courseId?.courseCode}`);
             const responseData = {
                _id: currentSession._id,
                date: currentSession.date,
                startTime: currentSession.startTime,
                endTime: currentSession.endTime,
                room: currentSession.room,
                classId: currentSession.classId,
                semester: currentSession.semester,
                academicYear: currentSession.academicYear,
                courseCode: currentSession.courseId?.courseCode,
                courseName: currentSession.courseId?.courseName,
                locationName: currentSession.locationId?.name,
             };
             res.status(200).json({ success: true, data: responseData });
        } else {
            console.log(`[TimetableCtrl][checkAvailability] No open session found for user ${userId}.`);
             res.status(200).json({ success: true, data: null, message: 'Hiện không có buổi học nào đang mở điểm danh.' });
        }

     } catch (error) {
          console.error('--- ERROR in checkSessionAvailability Controller ---', error);
          res.status(500).json({ success: false, message: 'Lỗi server khi kiểm tra buổi học điểm danh.' });
     }
};

// --- HÀM: Sinh viên thực hiện Check-in Điểm danh ---
const checkInAttendance = async (req, res) => {
    const { timetableEntryId } = req.body;
    const userId = req.user?._id;

    console.log(`[TimetableCtrl] === Handling POST /api/timetable/checkin - User: ${userId}, Timetable Entry ID: ${timetableEntryId} ===`);

    if (!userId) return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
    if (!timetableEntryId) return res.status(400).json({ success: false, message: 'Thiếu ID buổi học cần điểm danh.' });

    try {
        const timetableEntry = await Timetable.findOne({
            _id: new mongoose.Types.ObjectId(timetableEntryId),
            userId: new mongoose.Types.ObjectId(userId)
        });

        if (!timetableEntry) {
            console.warn(`[TimetableCtrl][checkIn] Timetable entry not found or user mismatch. ID: ${timetableEntryId}, User: ${userId}`);
            return res.status(404).json({ success: false, message: 'Buổi học không tồn tại hoặc bạn không có quyền điểm danh.' });
        }

        if (!timetableEntry.isAttendanceOpen) {
             console.warn(`[TimetableCtrl][checkIn] Attendance not open for entry: ${timetableEntryId}`);
             return res.status(400).json({ success: false, message: 'Giảng viên chưa mở hoặc đã đóng điểm danh cho buổi học này.' });
         }

         if (timetableEntry.attendanceStatus === 'Present' || timetableEntry.attendanceStatus === 'Late') {
             console.warn(`[TimetableCtrl][checkIn] Already attended for entry: ${timetableEntryId}`);
             return res.status(400).json({ success: false, message: 'Bạn đã điểm danh cho buổi học này rồi.' });
         }

        const checkInTime = new Date();
        let newStatus = 'Present';

        try {
            const [startHour, startMinute] = timetableEntry.startTime.split(':').map(Number);
            // Tạo Date object cho thời gian bắt đầu buổi học, sử dụng ngày của buổi học và múi giờ UTC để so sánh chuẩn
            // Date string từ DB là YYYY-MM-DD
            const lessonDatePart = timetableEntry.date; // Ví dụ: "2025-05-10"
            const lessonStartDateTime = new Date(`${lessonDatePart}T${timetableEntry.startTime}:00.000Z`); // Giả sử startTime là HH:mm và date là YYYY-MM-DD (đã ở UTC hoặc giờ địa phương tùy cách lưu)
                                                                                                            // Nếu startTime và date đang lưu theo giờ VN, cần điều chỉnh cho đúng khi tạo Date object
            // Để an toàn, nên chuẩn hóa giờ bắt đầu về cùng múi giờ với checkInTime (thường là UTC khi new Date())
            // Hoặc, nếu startTime là giờ VN, thì checkInTime cũng nên được chuyển về giờ VN trước khi so sánh.
            // Cách đơn giản hơn là so sánh trực tiếp string HH:mm nếu date đã khớp.
            // Tuy nhiên, so sánh thời gian chính xác cần Date object.

            // Giả định: timetableEntry.date là YYYY-MM-DD (đã đúng ngày)
            // timetableEntry.startTime là HH:mm (giờ VN)
            // Cần tạo một Date object cho thời điểm bắt đầu buổi học tại VN.
            const [sH, sM] = timetableEntry.startTime.split(':').map(Number);
            const lessonStartDateObj = new Date(timetableEntry.date); // Date này sẽ có giờ là 00:00:00 theo local timezone của server
            // Để chính xác với VN, và giả sử server có thể ở múi giờ khác:
            const dateParts = timetableEntry.date.split('-');
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1; // Tháng trong JS Date là 0-11
            const day = parseInt(dateParts[2]);

            // Tạo thời điểm bắt đầu buổi học tại múi giờ Việt Nam
            const lessonStartDateTimeVN = new Date(Date.UTC(year, month, day, sH, sM, 0) - (7 * 60 * 60 * 1000)); // Trừ 7 tiếng để về UTC, sau đó new Date() sẽ tự chuyển về local server time
                                                                                                               // Hoặc dùng thư viện như moment-timezone để xử lý múi giờ chuẩn hơn.
            // Cách đơn giản nhất nếu server cũng đang chạy ở múi giờ VN +7
            // const lessonStartForCompare = new Date(`${timetableEntry.date}T${timetableEntry.startTime}:00`);


            const fifteenMinutesInMillis = 15 * 60 * 1000;

            // Lấy thời gian hiện tại theo giờ Việt Nam để so sánh
            const nowVNHours = parseInt(new Date().toLocaleTimeString('en-CA', {hour: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh'}));
            const nowVNMinutes = parseInt(new Date().toLocaleTimeString('en-CA', {minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh'}));

            const checkInTimeTotalMinutes = nowVNHours * 60 + nowVNMinutes;
            const lessonStartTimeTotalMinutes = sH * 60 + sM;


            if (checkInTimeTotalMinutes > lessonStartTimeTotalMinutes + 15) { // Trễ sau 15 phút
                newStatus = 'Late';
                console.log(`[TimetableCtrl][checkIn] Marked as Late for entry: ${timetableEntryId}`);
            }

        } catch(timeError){
            console.error("[TimetableCtrl][checkIn] Error comparing times, defaulting to Present:", timeError);
        }

        timetableEntry.attendanceStatus = newStatus;
        timetableEntry.attendanceCheckInTime = checkInTime; // Lưu giờ UTC hiện tại của server
        await timetableEntry.save();

        console.log(`[TimetableCtrl][checkIn] Attendance recorded successfully for entry: ${timetableEntryId} with status: ${newStatus}`);
        res.status(200).json({ success: true, message: 'Điểm danh thành công!' });

    } catch (error) {
         console.error('--- ERROR in checkInAttendance Controller ---', error);
          if (error instanceof mongoose.Error.CastError) {
              return res.status(400).json({ success: false, message: 'ID buổi học cung cấp không hợp lệ.' });
          }
         res.status(500).json({ success: false, message: 'Lỗi server khi thực hiện điểm danh.' });
    }
};

module.exports = {
    getMyTimetable,
    getTodayTimetable,        // Export hàm mới
    checkSessionAvailability,
    checkInAttendance
};