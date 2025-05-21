// populateTimetable.js (Phiên bản cuối cùng, dùng courseId+date, log lỗi insert)
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// --- Cấu hình đọc file .env ---
const NODE_ENV = process.env.NODE_ENV || 'development';
const envPath = path.resolve(__dirname, `.env.${NODE_ENV}`);
const defaultEnvPath = path.resolve(__dirname, '.env');
console.log(`[ENV] Attempting to load environment variables from: ${envPath}`);
if (fs.existsSync(envPath)) { dotenv.config({ path: envPath }); console.log(`[ENV] Loaded variables from ${envPath}`); }
else { console.log(`[ENV] File not found: ${envPath}. Attempting fallback...`); if (fs.existsSync(defaultEnvPath)) { dotenv.config({ path: defaultEnvPath, override: false }); console.log(`[ENV] Fallback .env loaded.`); } else { console.log(`[ENV] Fallback .env file not found either.`); } }

// --- Import Models ---
const Timetable = require('./src/models/Timetable'); // <<< CHỈ DÙNG MODEL NÀY >>>
const Course = require('./src/models/Course');
const User = require('./src/models/User');
// const Attendance = require('./src/models/attendance'); // <<< ĐÃ XÓA/KHÔNG DÙNG >>>

// --- Import Fake Attendance Data ---
let fakeAttendanceData = [];
// >>> ĐƯỜNG DẪN ĐẾN FILE JSON (DÙNG courseId + date) <<<
const fakeAttendancePath = '../HSUMobileApp/assets/data/fakeAttendance.json'; // Để cùng cấp với script này
try {
    const resolvedPath = path.resolve(__dirname, fakeAttendancePath); console.log(`[DATA] Attempting to load fake attendance data from: ${resolvedPath}`);
    if (fs.existsSync(resolvedPath)) { fakeAttendanceData = require(fakeAttendancePath); if (!Array.isArray(fakeAttendanceData)) { console.warn(`[DATA] Warning: Content is not a valid JSON array.`); fakeAttendanceData = []; } else { console.log(`[DATA] Successfully loaded ${fakeAttendanceData.length} records.`); } }
    else { console.warn(`[DATA] Warning: File not found at ${resolvedPath}.`); }
} catch (e) { console.error(`[DATA] Error loading/parsing ${fakeAttendancePath}. Error: ${e.message}`); fakeAttendanceData = []; }

// --- ===== CẤU HÌNH DỮ LIỆU ===== ---
const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) { console.error('\nFATAL ERROR: MONGODB_URI not defined!'); process.exit(1); }
console.log('[CONFIG] MONGODB_URI loaded.');
const studentUserId = '67f8d41c5e62d05207534b7f'; // <-- User ID
console.log(`[CONFIG] Target studentUserId: ${studentUserId}`);
// --- Định nghĩa LỊCH HỌC & THÔNG TIN HỌC KỲ (Sử dụng cấu hình của anh) ---
const semesterSchedules = [
    // === HỌC KỲ 1 (2024-2025) - Khoảng 18 tuần ===
    { semester: 'Học kỳ 1', academicYear: '2024-2025', startDate: '2024-09-16', endDate: '2025-01-17', // <<< Kết thúc sau 18 tuần
        courses:[ 
        { courseId: '68182af0e0c6d908c3b9f30b', dayOfWeek: 'Thứ 2', startTime: '07:00', endTime: '11:30', room: 'C.301', instructor: 'Nguyễn Trọng Phát' },
        { courseId: '68182af0e0c6d908c3b9f30c', dayOfWeek: 'Thứ 3', startTime: '07:30', endTime: '11:30', room: 'B.205', instructor: 'Thầy Minh Dũng' },
        { courseId: '68182af0e0c6d908c3b9f30d', dayOfWeek: 'Thứ 4', startTime: '07:00', endTime: '11:30', room: 'A.101', instructor: 'Thầy Đỗ Minh' },
        { courseId: '68182af0e0c6d908c3b9f30e', dayOfWeek: 'Thứ 5', startTime: '13:00', endTime: '16:30', room: 'B.205', instructor: 'Bùi Hữu Trí' },
        { courseId: '68182af0e0c6d908c3b9f30f', dayOfWeek: 'Thứ 6', startTime: '07:00', endTime: '10:30', room: 'B.205', instructor: 'Lê Thị Thu Hà' },
        { courseId: '68182af0e0c6d908c3b9f310', dayOfWeek: 'Thứ 7', startTime: '07:00', endTime: '10:30', room: 'B.205', instructor: 'Lê Thị Thu Hà' }, 
    ] },
    // === HỌC KỲ TẾT (2024-2025) - Khoảng 8 tuần ===
    { semester: 'Học kỳ tết', academicYear: '2024-2025', startDate: '2025-01-20', endDate: '2025-03-14', // <<< Kết thúc sau 8 tuần
        courses: [ 
            { courseId: '68182af0e0c6d908c3b9f30f', dayOfWeek: 'Thứ 3', startTime: '07:00', endTime: '10:30', room: 'B.205', instructor: 'Lê Thị Thu Hà' },
            { courseId: '68182af0e0c6d908c3b9f310', dayOfWeek: 'Thứ 5', startTime: '07:00', endTime: '10:30', room: 'B.205', instructor: 'Lê Thị Thu Hà' },
            { courseId: '68182af0e0c6d908c3b9f316', dayOfWeek: 'Thứ 7', startTime: '13:00', endTime: '15:30', room: 'B.405', instructor: 'Trang Hồng Sơn' }, 
        ] },
    // === HỌC KỲ 2 (2024-2025) - Khoảng 18 tuần ===
    { semester: 'Học kỳ 2', academicYear: '2024-2025', startDate: '2025-03-24', endDate: '2025-07-18', // <<< Kết thúc sau 17 tuần (cần chỉnh nếu muốn 18)
        courses: [ 
            { courseId: '68182af0e0c6d908c3b9f311', dayOfWeek: 'Thứ 2', startTime: '07:00', endTime: '09:30', room: 'A.405', instructor: 'Cô Nguyễn An' },
            { courseId: '68182af0e0c6d908c3b9f312', dayOfWeek: 'Thứ 3', startTime: '13:00', endTime: '15:30', room: 'B.102', instructor: 'Thầy Thanh' },
            { courseId: '68182af0e0c6d908c3b9f313', dayOfWeek: 'Thứ 4', startTime: '07:00', endTime: '11:00', room: 'C.103', instructor: 'Trang Hồng Sơn' }, 
            { courseId: '68182af0e0c6d908c3b9f315', dayOfWeek: 'Thứ 5', startTime: '13:00', endTime: '15:30', room: 'B.305', instructor: 'Dương Văn Thuận' },
            { courseId: '68182af0e0c6d908c3b9f316', dayOfWeek: 'Thứ 6', startTime: '13:00', endTime: '15:30', room: 'B.405', instructor: 'Trang Hồng Sơn' },
         ] },
    // === HỌC KỲ HÈ (2024-2025) - Khoảng 8 tuần ===
    { semester: 'Học kỳ hè', academicYear: '2024-2025', startDate: '2025-07-21', endDate: '2025-09-12', // <<< Kết thúc sau 8 tuần
        courses: [ 
            { courseId: '68182af0e0c6d908c3b9f317', dayOfWeek: 'Thứ 2', startTime: '07:00', endTime: '10:30', room: 'B.205', instructor: 'Cô Hà Trang' },
            { courseId: '68182af0e0c6d908c3b9f318', dayOfWeek: 'Thứ 4', startTime: '07:00', endTime: '10:30', room: 'B.305', instructor: 'Bùi Hữu Trí' },
            { courseId: '68182af0e0c6d908c3b9f319', dayOfWeek: 'Thứ 6', startTime: '07:00', endTime: '11:30', room: 'B.205', instructor: 'Dương Hồng Minh' },
        ] },
];
console.log(`[CONFIG] Loaded definitions for ${semesterSchedules.length} semester configurations.`);
// --- === KẾT THÚC PHẦN CẤU HÌNH === ---


// --- Hàm chính để tạo dữ liệu ---
const populateTimetableData = async () => {
    let connection; let exitCode = 0;
    try {
        // --- 1. Kết nối DB ---
        console.log(`\n[DB] Connecting...`); connection = await mongoose.connect(MONGO_URI); console.log('[DB] Connected');
        // --- 2. Xác thực User ---
        console.log(`\n[VALIDATION] User: ${studentUserId}`); let userObjectId; try { if (!mongoose.Types.ObjectId.isValid(studentUserId)) throw new Error('Invalid ID'); userObjectId = new mongoose.Types.ObjectId(studentUserId); const user = await User.findById(userObjectId).lean(); if (!user) throw new Error('Not found'); console.log(`[VALIDATION] User OK: ${user.name || studentUserId}`); } catch (e) { console.error('User Error:', e.message); throw e; }
        // --- 3. Xác thực Courses ---
        const cIds = semesterSchedules.flatMap(s => s.courses.map(c => c.courseId)); const uCIds = [...new Set(cIds)]; if (uCIds.length > 0) { console.log(`\n[VALIDATION] Courses (${uCIds.length})...`); const cOIds = uCIds.map(id => { try { if (!mongoose.Types.ObjectId.isValid(id)) throw new Error(`Invalid ID: "${id}"`); return new mongoose.Types.ObjectId(id); } catch (err) { throw err; } }); const existing = await Course.find({ '_id': { $in: cOIds } }).select('_id').lean(); const existingSet = new Set(existing.map(c => c._id.toString())); const missing = uCIds.filter(id => !existingSet.has(id)); if (missing.length > 0) { console.error('FATAL: Missing course IDs:', missing); throw new Error('Missing course IDs.'); } console.log('[VALIDATION] Courses OK.'); } else { console.log('\n[VALIDATION] No courses.'); }
        // === 4. XÓA DỮ LIỆU CŨ ===
        console.log(`\n[CLEANUP] Deleting old data...`); const del = await Timetable.deleteMany({ userId: userObjectId }); console.log(`[CLEANUP] Deleted ${del.deletedCount} entries.`);

        const timetableEntriesToInsert = []; const dayOfWeekMap = { 'Chủ Nhật': 0, 'CN': 0, 'Thứ 2': 1, 'T2': 1, 'Thứ 3': 2, 'T3': 2, 'Thứ 4': 3, 'T4': 3, 'Thứ 5': 4, 'T5': 4, 'Thứ 6': 5, 'T6': 5, 'Thứ 7': 6, 'T7': 6 }; const today = new Date();
        const insertedEntryMap = new Map(); // Map: "courseId-date" -> { _id, startTime }

        // === 5. PHASE 1: TẠO DỮ LIỆU CƠ BẢN ===
        console.log('\n--- PHASE 1: Generating base timetable entries ---');
        for (const semesterData of semesterSchedules) {
             console.log(`[PHASE 1] Processing Semester: ${semesterData.semester} (${semesterData.academicYear})`);
             let semesterStartDate, semesterEndDate; try { semesterStartDate = new Date(semesterData.startDate + 'T00:00:00Z'); semesterEndDate = new Date(semesterData.endDate + 'T23:59:59Z'); if (isNaN(semesterStartDate.getTime()) || isNaN(semesterEndDate.getTime()) || semesterEndDate < semesterStartDate) throw new Error('Invalid dates'); } catch (e) { console.error(`   [PHASE 1] Date error. Skipping. ${e.message}`); continue; }
             if (!Array.isArray(semesterData.courses) || semesterData.courses.length === 0) { console.log(`   [PHASE 1] No courses. Skipping.`); continue; }

             for (const courseData of semesterData.courses) {
                 const targetDayOfWeek = dayOfWeekMap[courseData.dayOfWeek]; let courseObjectId; try { courseObjectId = new mongoose.Types.ObjectId(courseData.courseId); if (targetDayOfWeek === undefined) throw new Error(`Invalid dayOfWeek: "${courseData.dayOfWeek}"`); } catch (e) { console.warn(`   [PHASE 1] Skipping course ${courseData.courseId}. ${e.message}`); continue; }
                 let currentDate = new Date(semesterStartDate);
                 while (currentDate <= semesterEndDate) {
                     if (currentDate.getUTCDay() === targetDayOfWeek) {
                         const dateString = currentDate.toISOString().split('T')[0];
                         let attendanceStatus; const dateOnly = new Date(dateString + 'T00:00:00Z'); const todayOnly = new Date(today.toISOString().split('T')[0] + 'T00:00:00Z');
                         if (dateOnly <= todayOnly) { attendanceStatus = 'Present'; } else { attendanceStatus = 'NotYet'; }
                         const timeRegex = /^\d{2}:\d{2}$/; if (!timeRegex.test(courseData.startTime) || !timeRegex.test(courseData.endTime)) { console.warn(`   [PHASE 1][WARN] Invalid time format. Skipping entry. Course: ${courseData.courseId}, Date: ${dateString}`); currentDate.setUTCDate(currentDate.getUTCDate() + 1); continue; }
                         timetableEntriesToInsert.push({ userId: userObjectId, courseId: courseObjectId, date: dateString, dayOfWeek: courseData.dayOfWeek, startTime: courseData.startTime, endTime: courseData.endTime, room: courseData.room, instructor: courseData.instructor, semester: semesterData.semester, academicYear: semesterData.academicYear, attendanceStatus: attendanceStatus, attendanceNotes: null, isAttendanceOpen: false });
                     }
                     currentDate.setUTCDate(currentDate.getUTCDate() + 1);
                 }
             }
              console.log(`[PHASE 1] Finished courses for ${semesterData.semester}.`);
         }
        console.log(`--- PHASE 1 COMPLETE: ${timetableEntriesToInsert.length} base entries generated ---`);

        // === 6. INSERT DỮ LIỆU CƠ BẢN VÀ TẠO MAP ===
        let insertedDocs = []; let successfullyInsertedCount = 0;
        if (timetableEntriesToInsert.length > 0) {
            console.log(`\n[INSERT] Attempting to insert ${timetableEntriesToInsert.length} base entries...`);
            try {
                const insertPromises = timetableEntriesToInsert.map(entry => Timetable.create(entry));
                const results = await Promise.allSettled(insertPromises);
                results.forEach((result, index) => {
                  if (result.status === 'fulfilled') {
                    insertedDocs.push(result.value);
                    const doc = result.value; const key = `${doc.courseId.toString()}-${doc.date}`;
                    insertedEntryMap.set(key, { _id: doc._id, startTime: doc.startTime });
                  } else { console.error(`[INSERT][ERROR] Failed insert at index ${index}: ${result.reason?.message || result.reason}`); }
                });
                successfullyInsertedCount = insertedDocs.length;
                console.log(`[INSERT] Finished. Successfully inserted: ${successfullyInsertedCount}. Failed: ${timetableEntriesToInsert.length - successfullyInsertedCount}.`);
                if (insertedEntryMap.size > 0) { console.log(`[INSERT] Created map for ${insertedEntryMap.size} entries.`); }
            } catch (bulkInsertError) { console.error("[INSERT] General error during insert:", bulkInsertError.message); }
        } else { console.log('\n[INSERT] No base entries generated.'); }

        // === 7. PHASE 2: CẬP NHẬT TỪ fakeAttendance.json (DÙNG courseId và date) ===
        if (fakeAttendanceData.length > 0 && insertedEntryMap.size > 0) {
            console.log('\n--- PHASE 2: Applying fake data (using courseId & date) ---');
            let updateCount = 0; const updatePromises = []; const invalidFakeRecords = []; const notFoundKeys = new Set();
            for (const fakeRecord of fakeAttendanceData) {
                 if (!fakeRecord.courseId?.$oid || !fakeRecord.date || !fakeRecord.status || !fakeRecord.userId?.$oid) { console.warn(`   [P2][SKIP] Invalid format:`, fakeRecord); invalidFakeRecords.push(fakeRecord); continue; }
                 if (fakeRecord.userId.$oid !== studentUserId) { console.warn(`   [P2][SKIP] User ID mismatch.`); invalidFakeRecords.push(fakeRecord); continue; }
                 if (!/^\d{4}-\d{2}-\d{2}$/.test(fakeRecord.date)) { console.warn(`   [P2][SKIP] Invalid date format: "${fakeRecord.date}"`); invalidFakeRecords.push(fakeRecord); continue; }
                 let fakeCourseObjectId; try { if (!mongoose.Types.ObjectId.isValid(fakeRecord.courseId.$oid)) throw new Error('Invalid ObjectId'); fakeCourseObjectId = new mongoose.Types.ObjectId(fakeRecord.courseId.$oid); } catch(e) { console.warn(`   [P2][SKIP] Invalid courseId: "${fakeRecord.courseId.$oid}".`); invalidFakeRecords.push(fakeRecord); continue; }

                 const entryKey = `${fakeCourseObjectId.toString()}-${fakeRecord.date}`;
                 const mappedEntry = insertedEntryMap.get(entryKey);
                 if (!mappedEntry || !mappedEntry._id) { notFoundKeys.add(entryKey); continue; }
                 const targetTimetableId = mappedEntry._id; const entryStartTime = mappedEntry.startTime;

                 let fakeCheckInTime = null; if ( (fakeRecord.status === 'Present' || fakeRecord.status === 'Late') && entryStartTime && fakeRecord.date ) { try { const [h,m]=entryStartTime.split(':').map(Number); fakeCheckInTime = new Date(`${fakeRecord.date}T00:00:00Z`); fakeCheckInTime.setUTCHours(h,m,0,0); if (fakeRecord.status === 'Late') { const lM=Math.floor(Math.random()*16)+5; fakeCheckInTime.setUTCMinutes(fakeCheckInTime.getUTCMinutes()+lM); } else { const vM=Math.floor(Math.random()*11)-5; fakeCheckInTime.setUTCMinutes(fakeCheckInTime.getUTCMinutes()+vM); } } catch(tE){ console.error(`   [P2][ERR] SimTime ${entryKey}:`,tE); fakeCheckInTime = null; } }

                 const filter = { _id: targetTimetableId, userId: userObjectId }; const update = { $set: { attendanceStatus: fakeRecord.status, attendanceNotes: fakeRecord.notes || null, attendanceCheckInTime: fakeCheckInTime } };
                 updatePromises.push( Timetable.updateOne(filter, update).then(result => { if (result.modifiedCount > 0) { updateCount++; } else if (result.matchedCount === 0) { console.error(`   [P2][ERR] Update failed! ID ${targetTimetableId} not found`); } }).catch(err => { console.error(`   [P2][ERR] Updating ${targetTimetableId}:`, err.message); }) );
            }
            await Promise.all(updatePromises);
            console.log(`--- PHASE 2 COMPLETE: Attempted ${fakeAttendanceData.length}. Updated ${updateCount}. ---`);
            if (invalidFakeRecords.length > 0) { console.warn(`   [P2][WARN] ${invalidFakeRecords.length} skipped records.`); } if (notFoundKeys.size > 0) { console.warn(`   [P2][WARN] Could not find matches for ${notFoundKeys.size} (courseId-date) keys:`, [...notFoundKeys]); console.warn(`   Ensure courseId/date in JSON match schedule.`); }
        } else { console.log('\n--- PHASE 2 SKIPPED: No fake data or no base entries mapped. ---'); }

        console.log('\n[SUCCESS] Population finished.');

    } catch (error) { console.error('\n--- SCRIPT FAILED ---'); console.error('Error:', error.message); exitCode = 1; }
    finally {  if (connection?.close) { try { await connection.close(); console.log('\n[DB] Disconnected'); } catch (e) { console.error('[DB] Disconnect Error:', e.message); if (!exitCode) exitCode = 1; } } else { console.log('\n[DB] No active connection or already closed.') } process.exit(exitCode); }
};

// --- Chạy hàm chính ---
populateTimetableData();