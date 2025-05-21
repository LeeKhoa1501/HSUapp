// src/controllers/bookingController.js
const Booking = require('../models/Booking'); // Đảm bảo Model dùng key numberOfParticipants
const Location = require('../models/Location');
const Shift = require('../models/Shift');
const mongoose = require('mongoose');

const createBooking = async (req, res) => {
    console.log('[BK_CTRL] === Handling POST /api/bookings ===');
    console.log('[BK_CTRL] User ID from middleware:', req.user?._id || 'No user attached!');
    console.log('[BK_CTRL] Request Body Received:', JSON.stringify(req.body, null, 2));

    // <<< LẤY ĐÚNG KEY TỪ req.body MÀ FRONTEND GỬI LÊN >>>
    const {
        locationId,
        shiftId,
        bookingDate, // Frontend đang gửi dạng YYYY-MM-DD
        startTime,
        endTime,
        numberOfParticipants, // <<< Sửa tên biến ở đây
        purpose,
        purposeDetail,
        notes,
        phoneNumber // Lấy thêm phoneNumber nếu Frontend gửi
    } = req.body;
    const userId = req.user?._id;

    // --- Validation cơ bản ---
    if (!userId) {
        console.error('[BK_CTRL] Validation Error: Missing userId.');
        return res.status(401).json({ success: false, message: 'Không xác định được người dùng.' });
    }
    // <<< KIỂM TRA ĐÚNG BIẾN numberOfParticipants >>>
    if (!locationId || !shiftId || !bookingDate || !startTime || !endTime || !numberOfParticipants || !purpose) {
        console.error('[BK_CTRL] Validation Error: Missing required fields.', { locationId, shiftId, bookingDate, startTime, endTime, numberOfParticipants, purpose });
        // Tạo thông báo lỗi chi tiết hơn (tùy chọn)
        let missingFields = [];
        if (!locationId) missingFields.push('Địa điểm');
        if (!shiftId) missingFields.push('Ca học');
        if (!bookingDate) missingFields.push('Ngày đặt');
        if (!startTime) missingFields.push('Giờ bắt đầu');
        if (!endTime) missingFields.push('Giờ kết thúc');
        if (!numberOfParticipants) missingFields.push('Số người tham dự');
        if (!purpose) missingFields.push('Mục đích');
        return res.status(400).json({ success: false, message: `Vui lòng điền đầy đủ thông tin bắt buộc: ${missingFields.join(', ')}.` });
    }
     // Kiểm tra kiểu dữ liệu số người
     if (isNaN(Number(numberOfParticipants)) || Number(numberOfParticipants) <= 0) {
        console.error('[BK_CTRL] Validation Error: Invalid numberOfParticipants.');
        return res.status(400).json({ success: false, message: 'Số người tham dự phải là một số lớn hơn 0.' });
    }
    // Kiểm tra mục đích "Khác"
     if (purpose === 'Khác' && !purposeDetail) { // Giả sử giá trị value của radio "Khác" là 'other' hoặc text "Khác"
          console.error('[BK_CTRL] Validation Error: Missing purposeDetail for "Other".');
          return res.status(400).json({ success: false, message: 'Vui lòng nhập chi tiết mục đích khi chọn "Khác".' });
     }


    try {
        // --- Chuyển đổi IDs ---
        console.log('[BK_CTRL] Converting ObjectIDs...');
        let locationObjectId, shiftObjectId;
        try {
            locationObjectId = new mongoose.Types.ObjectId(locationId);
            shiftObjectId = new mongoose.Types.ObjectId(shiftId);
            console.log('[BK_CTRL] Converted ObjectIDs - Location:', locationObjectId, 'Shift:', shiftObjectId);
        } catch (castError) { throw new mongoose.Error.CastError('ObjectId', `ID "${castError.value}" không hợp lệ cho ${castError.path}.`); }


        // --- Parse và Validate Date ---
        // Frontend gửi YYYY-MM-DD, trực tiếp tạo Date từ đó (MongoDB lưu UTC)
        console.log('[BK_CTRL] Parsing bookingDate:', bookingDate);
        const bookingDateObject = new Date(bookingDate + 'T00:00:00.000Z'); // Thêm giờ UTC để tránh lệch ngày
        if (isNaN(bookingDateObject.getTime())) {
             console.error('[BK_CTRL] Invalid Date Object from string:', bookingDate);
             throw new Error('Định dạng ngày đặt không hợp lệ (cần YYYY-MM-DD).');
        }
        console.log('[BK_CTRL] Parsed Date Object (UTC):', bookingDateObject.toISOString());


        // --- Kiểm tra sự tồn tại Location & Shift ---
        console.log('[BK_CTRL] Checking existence of Location and Shift...');
        const [locationExists, shiftExists] = await Promise.all([
             Location.findById(locationObjectId).lean(), // Dùng lean cho nhanh
             Shift.findById(shiftObjectId).lean()
         ]);
        console.log('[BK_CTRL] Location exists:', !!locationExists, 'Shift exists:', !!shiftExists);
        if (!locationExists) return res.status(404).json({ success: false, message: 'Địa điểm đã chọn không tồn tại.' });
        if (!shiftExists) return res.status(404).json({ success: false, message: 'Ca học đã chọn không tồn tại.' });


        // --- Tạo booking mới ---
        console.log('[BK_CTRL] Creating new Booking instance...');
        const newBooking = new Booking({
            userId: userId,
            locationId: locationObjectId,
            shiftId: shiftObjectId,
            bookingDate: bookingDateObject, // Lưu dạng Date object
            startTime: String(startTime),
            endTime: String(endTime),
            // <<< SỬ DỤNG ĐÚNG KEY numberOfParticipants >>>
            // Đảm bảo Model Booking.js cũng dùng key này
            numberOfParticipants: Number(numberOfParticipants),
            purpose: String(purpose),
            purposeDetail: String(purposeDetail || ''),
            notes: String(notes || ''),
            phoneNumber: String(phoneNumber || ''), // <<< Thêm phoneNumber nếu Model có
            status: 'pending' // Trạng thái mặc định
        });
        console.log('[BK_CTRL] New booking instance prepared:', newBooking);

        // --- Lưu vào database ---
        console.log('[BK_CTRL] Saving booking...');
        const savedBooking = await newBooking.save();
        console.log('[BK_CTRL] Booking saved successfully! ID:', savedBooking._id);

        // --- Trả về thành công ---
        return res.status(201).json({
            success: true,
            message: 'Yêu cầu đặt phòng đã được gửi thành công!',
            data: savedBooking // Có thể chỉ trả về ID hoặc message
        });

    } catch (error) {
        console.error('--- ERROR in createBooking Controller ---');
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        if (error.errors) console.error('Validation Errors:', error.errors);
        if (error.path) console.error('Cast Error Path:', error.path, 'Value:', error.value);
        console.error('--- END ERROR ---');

        if (error.name === 'ValidationError') { const messages = Object.values(error.errors).map(val => val.message); return res.status(400).json({ success: false, message: messages.join('. ') }); }
        if (error instanceof mongoose.Error.CastError) { return res.status(400).json({ success: false, message: `Dữ liệu không hợp lệ cho trường ${error.path}: ${error.value}.` }); }
        // Trả về lỗi cụ thể hơn nếu có thể
         if (error.message.includes('Định dạng ngày đặt không hợp lệ')) {
             return res.status(400).json({ success: false, message: error.message });
         }
        return res.status(500).json({ success: false, message: 'Lỗi server khi tạo yêu cầu đặt phòng.' });
    }
};

// --- getAllBookings (Giữ nguyên logic Aggregation như trước) ---
const getAllBookings = async (req, res) => {
     console.log('[BK_CTRL] === Handling GET /api/bookings ===');
     try {
         const pipeline = [
             // Pipeline aggregation như cũ để join và project
             { $lookup: { from: 'locations', localField: 'locationId', foreignField: '_id', as: 'locationInfo' } },
             { $lookup: { from: 'shifts', localField: 'shiftId', foreignField: '_id', as: 'shiftInfo' } },
             { $unwind: { path: '$locationInfo', preserveNullAndEmptyArrays: true } },
             { $unwind: { path: '$shiftInfo', preserveNullAndEmptyArrays: true } },
             { $project: {
                 locationId: 0, shiftId: 0, __v: 0, locationInfo: 0, shiftInfo: 0,
                 _id: 1, userId: 1, bookingDate: 1, startTime: 1, endTime: 1,
                 // <<< Đảm bảo lấy đúng numberOfParticipants từ DB >>>
                 numberOfParticipants: 1, // <<< Sửa lại nếu model dùng key khác
                 purpose: 1, purposeDetail: 1, notes: 1, status: 1, createdAt: 1, updatedAt: 1, phoneNumber: 1, // <<< Thêm phoneNumber
                 locationName: '$locationInfo.name',
                 locationBuilding: '$locationInfo.building', // <<< Lấy thêm building
                 shiftName: '$shiftInfo.name', // <<< Hoặc '$shiftInfo.label'
             } },
             { $sort: { createdAt: -1 } }
           ];
         console.log('[BK_CTRL] Executing aggregation for all bookings...');
         const bookings = await Booking.aggregate(pipeline);
         console.log(`[BK_CTRL] Found ${bookings.length} bookings.`);
         return res.status(200).json({ success: true, count: bookings.length, data: bookings });
     } catch (error) { /* ... (Xử lý lỗi như cũ) ... */ }
 };

// --- getMyBookings (Giữ nguyên logic Aggregation như trước, đảm bảo lấy đúng numberOfParticipants) ---
const getMyBookings = async (req, res) => {
    console.log('[BK_CTRL] === Handling GET /api/bookings/mybookings ===');
    const userId = req.user?._id;
    if (!userId) { /* ... */ }
    try {
         const pipeline = [
           { $match: { userId: new mongoose.Types.ObjectId(userId) } },
           { $lookup: { from: 'locations', localField: 'locationId', foreignField: '_id', as: 'locationInfo' } },
           { $lookup: { from: 'shifts', localField: 'shiftId', foreignField: '_id', as: 'shiftInfo' } },
           { $unwind: { path: '$locationInfo', preserveNullAndEmptyArrays: true } },
           { $unwind: { path: '$shiftInfo', preserveNullAndEmptyArrays: true } },
           { $project: {
               locationId: 0, shiftId: 0, __v: 0, locationInfo: 0, shiftInfo: 0,
               _id: 1, userId: 1, bookingDate: 1, startTime: 1, endTime: 1,
               numberOfParticipants: 1, // <<< Đảm bảo lấy đúng key
               purpose: 1, purposeDetail: 1, notes: 1, status: 1, createdAt: 1, updatedAt: 1, phoneNumber: 1, // <<< Thêm phoneNumber
               locationName: '$locationInfo.name',
               locationBuilding: '$locationInfo.building', // <<< Lấy thêm building
               shiftName: '$shiftInfo.name', // <<< Hoặc '$shiftInfo.label'
             } },
           { $sort: { createdAt: -1 } }
         ];
        console.log(`[BK_CTRL] Executing aggregation for user: ${userId}`);
        const myBookings = await Booking.aggregate(pipeline);
        console.log(`[BK_CTRL] Found ${myBookings.length} bookings for user.`);
        return res.status(200).json({ success: true, count: myBookings.length, data: myBookings });
    } catch (error) { /* ... (Xử lý lỗi như cũ) ... */ }
};

module.exports = {
    createBooking,
    getAllBookings,
    getMyBookings,
};