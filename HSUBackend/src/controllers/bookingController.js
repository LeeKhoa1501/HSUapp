// HSUBackend/src/controllers/bookingController.js
const Booking = require('../models/Booking');
const Location = require('../models/Location');
const Shift = require('../models/Shift');
const User = require('../models/User'); // Cần User model nếu $lookup vào users trong getAllBookings
const mongoose = require('mongoose');

// === Tạo một lượt đặt phòng mới ===
const createBooking = async (req, res) => {
    const controllerName = 'createBooking';
    console.log(`[BK_CTRL] [${controllerName}] === Handling POST /api/bookings ===`);
    console.log(`[BK_CTRL] [${controllerName}] User ID from middleware:`, req.user?._id || 'No user attached!');
    console.log(`[BK_CTRL] [${controllerName}] Request Body Received:`, JSON.stringify(req.body, null, 2));

    const {
        locationId, shiftId, bookingDate, startTime, endTime,
        numberOfParticipants, purpose, purposeDetail, notes, phoneNumber
    } = req.body;
    const userId = req.user?._id;

    if (!userId) {
        console.error(`[BK_CTRL] [${controllerName}] Validation Error: Missing userId (unauthorized).`);
        return res.status(401).json({ success: false, message: 'Không xác định được người dùng. Vui lòng đăng nhập lại.' });
    }

    let missingFields = [];
    if (!locationId) missingFields.push('Địa điểm');
    if (!shiftId) missingFields.push('Ca học');
    if (!bookingDate) missingFields.push('Ngày đặt');
    if (!startTime) missingFields.push('Giờ bắt đầu');
    if (!endTime) missingFields.push('Giờ kết thúc');
    if (!numberOfParticipants) missingFields.push('Số người tham dự');
    if (!purpose) missingFields.push('Mục đích');

    if (missingFields.length > 0) {
        const errMsg = `Vui lòng điền đầy đủ thông tin bắt buộc: ${missingFields.join(', ')}.`;
        console.error(`[BK_CTRL] [${controllerName}] Validation Error:`, errMsg, { missingFields });
        return res.status(400).json({ success: false, message: errMsg });
    }

    const numParticipants = Number(numberOfParticipants);
    if (isNaN(numParticipants) || numParticipants <= 0) {
        console.error(`[BK_CTRL] [${controllerName}] Validation Error: Invalid numberOfParticipants value:`, numberOfParticipants);
        return res.status(400).json({ success: false, message: 'Số người tham dự phải là một số lớn hơn 0.' });
    }

    if (purpose === 'other' && (!purposeDetail || String(purposeDetail).trim() === '')) {
        console.error(`[BK_CTRL] [${controllerName}] Validation Error: Missing purposeDetail for "other".`);
        return res.status(400).json({ success: false, message: 'Vui lòng nhập chi tiết mục đích khi chọn "Khác".' });
    }

    try {
        console.log(`[BK_CTRL] [${controllerName}] Attempting to convert ObjectIDs...`);
        let locationObjectId, shiftObjectId;
        try {
            if (!mongoose.Types.ObjectId.isValid(locationId)) throw new mongoose.Error.CastError('ObjectId', locationId, 'locationId');
            locationObjectId = new mongoose.Types.ObjectId(locationId);

            if (!mongoose.Types.ObjectId.isValid(shiftId)) throw new mongoose.Error.CastError('ObjectId', shiftId, 'shiftId');
            shiftObjectId = new mongoose.Types.ObjectId(shiftId);
            console.log(`[BK_CTRL] [${controllerName}] Converted ObjectIDs - Location: ${locationObjectId}, Shift: ${shiftObjectId}`);
        } catch (castError) {
            console.error(`[BK_CTRL] [${controllerName}] ObjectId Casting Error: ${castError.message}`);
            return res.status(400).json({ success: false, message: `ID không hợp lệ cho trường ${castError.path}: "${castError.value}".` });
        }

        console.log(`[BK_CTRL] [${controllerName}] Parsing bookingDate: ${bookingDate}`);
        const bookingDateObject = new Date(bookingDate + 'T00:00:00.000Z');
        if (isNaN(bookingDateObject.getTime())) {
            console.error(`[BK_CTRL] [${controllerName}] Invalid Date Object from string: ${bookingDate}`);
            return res.status(400).json({ success: false, message: 'Định dạng ngày đặt không hợp lệ (cần YYYY-MM-DD).' });
        }
        console.log(`[BK_CTRL] [${controllerName}] Parsed Date Object (UTC): ${bookingDateObject.toISOString()}`);

        console.log(`[BK_CTRL] [${controllerName}] Checking existence of Location and Shift...`);
        const [locationExists, shiftExists] = await Promise.all([
            Location.findById(locationObjectId).lean(),
            Shift.findById(shiftObjectId).lean()
        ]);
        console.log(`[BK_CTRL] [${controllerName}] Location exists: ${!!locationExists}, Shift exists: ${!!shiftExists}`);
        if (!locationExists) {
            console.error(`[BK_CTRL] [${controllerName}] Validation Error: Location not found for ID: ${locationId}`);
            return res.status(404).json({ success: false, message: 'Địa điểm đã chọn không tồn tại.' });
        }
        if (!shiftExists) {
            console.error(`[BK_CTRL] [${controllerName}] Validation Error: Shift not found for ID: ${shiftId}`);
            return res.status(404).json({ success: false, message: 'Ca học đã chọn không tồn tại.' });
        }
        
        console.log(`[BK_CTRL] [${controllerName}] Checking for existing booking for this slot...`);
        const existingBooking = await Booking.findOne({
            locationId: locationObjectId,
            shiftId: shiftObjectId,
            bookingDate: bookingDateObject,
            status: { $in: ['pending', 'approved'] }
        }).lean();

        if (existingBooking) {
            console.warn(`[BK_CTRL] [${controllerName}] Conflict: Slot already booked. Existing Booking ID: ${existingBooking._id}`);
            return res.status(409).json({ success: false, message: 'Rất tiếc, phòng này đã có người khác đặt vào thời gian bạn chọn. Vui lòng chọn thời gian hoặc phòng khác.' });
        }
        console.log(`[BK_CTRL] [${controllerName}] Slot is available.`);

        console.log(`[BK_CTRL] [${controllerName}] Creating new Booking instance...`);
        const newBooking = new Booking({
            userId,
            locationId: locationObjectId,
            shiftId: shiftObjectId,
            bookingDate: bookingDateObject,
            startTime: String(startTime),
            endTime: String(endTime),
            numberOfParticipants: numParticipants,
            purpose: String(purpose),
            purposeDetail: purpose === 'other' ? String(purposeDetail || '').trim() : '',
            notes: String(notes || '').trim(),
            phoneNumber: String(phoneNumber || '').trim(),
            status: 'pending'
        });
        console.log(`[BK_CTRL] [${controllerName}] New booking instance prepared:`, newBooking.toObject());

        console.log(`[BK_CTRL] [${controllerName}] Attempting to save booking...`);
        const savedBooking = await newBooking.save();
        console.log(`[BK_CTRL] [${controllerName}] Booking saved successfully! ID: ${savedBooking._id}`);

        console.log(`[BK_CTRL] [${controllerName}] Sending success response.`);
        return res.status(201).json({
            success: true,
            message: 'Yêu cầu đặt phòng của bạn đã được gửi thành công và đang chờ xử lý!',
            data: savedBooking
        });

    } catch (error) {
        console.error(`[BK_CTRL] [${controllerName}] --- ERROR ---`);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        if (error.errors) console.error('Validation Errors:', error.errors);
        if (error.path && typeof error.value !== 'undefined') console.error('Cast Error Path:', error.path, 'Value:', error.value);
        console.error('Error Stack:', error.stack);
        console.error(`[BK_CTRL] [${controllerName}] --- END ERROR ---`);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join('. ') });
        }
        if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({ success: false, message: `Dữ liệu không hợp lệ cho trường ${error.path}: "${error.value}".` });
        }
        return res.status(500).json({ success: false, message: 'Đã có lỗi xảy ra trên máy chủ khi tạo yêu cầu đặt phòng.' });
    }
};

// --- Lấy TẤT CẢ các lượt đặt phòng (Thường cho Admin) ---
const getAllBookings = async (req, res) => {
    const controllerName = 'getAllBookings';
    console.log(`[BK_CTRL] [${controllerName}] === Handling GET /api/bookings ===`);
    try {
        const pipeline = [
            { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userInfo' } },
            { $lookup: { from: 'locations', localField: 'locationId', foreignField: '_id', as: 'locationInfo' } },
            { $lookup: { from: 'shifts', localField: 'shiftId', foreignField: '_id', as: 'shiftInfo' } },
            { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$locationInfo', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$shiftInfo', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    // Chỉ bao gồm các trường muốn trả về
                    _id: 1,
                    bookingDate: 1,
                    startTime: 1,
                    endTime: 1,
                    numberOfParticipants: 1,
                    purpose: 1,
                    purposeDetail: 1,
                    notes: 1,
                    status: 1,
                    phoneNumber: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    // Thông tin từ các collection đã join
                    userName: '$userInfo.fullName', // **KHOA KIỂM TRA MODEL User CÓ TRƯỜNG fullName KHÔNG (HAY LÀ name)**
                    userEmail: '$userInfo.email',   // **KHOA KIỂM TRA MODEL User**
                    locationName: '$locationInfo.name', // **KHOA KIỂM TRA MODEL Location**
                    locationBuilding: '$locationInfo.building', // **KHOA KIỂM TRA MODEL Location**
                    shiftName: '$shiftInfo.name', // **KHOA KIỂM TRA MODEL Shift (có thể là shiftInfo.label)**
                }
            },
            { $sort: { createdAt: -1 } }
        ];
        console.log(`[BK_CTRL] [${controllerName}] Executing aggregation pipeline...`);
        const bookings = await Booking.aggregate(pipeline);
        console.log(`[BK_CTRL] [${controllerName}] Aggregation complete. Found ${bookings.length} total bookings.`);

        console.log(`[BK_CTRL] [${controllerName}] Sending success response.`);
        return res.status(200).json({ success: true, count: bookings.length, data: bookings });
    } catch (error) {
        console.error(`[BK_CTRL] [${controllerName}] --- ERROR ---`);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        console.error(`[BK_CTRL] [${controllerName}] --- END ERROR ---`);
        return res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách đặt phòng.' });
    }
};

// --- Lấy các lượt đặt phòng của NGƯỜI DÙNG HIỆN TẠI ---
const getMyBookings = async (req, res) => {
    const controllerName = 'getMyBookings';
    console.log(`[BK_CTRL] [${controllerName}] === Handling GET /api/bookings/my ===`);
    const userId = req.user?._id;
    console.log(`[BK_CTRL] [${controllerName}] User ID: ${userId}`);

    if (!userId) {
        console.error(`[BK_CTRL] [${controllerName}] Error: userId not found in req.user.`);
        return res.status(401).json({ success: false, message: 'Yêu cầu không hợp lệ, thiếu thông tin người dùng.' });
    }

    try {
        const pipeline = [
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $lookup: { from: 'locations', localField: 'locationId', foreignField: '_id', as: 'locationInfo' } },
            { $lookup: { from: 'shifts', localField: 'shiftId', foreignField: '_id', as: 'shiftInfo' } },
            { $unwind: { path: '$locationInfo', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$shiftInfo', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    // Chỉ bao gồm các trường muốn trả về
                    _id: 1, // Giữ lại _id của booking
                    bookingDate: 1,
                    startTime: 1,
                    endTime: 1,
                    numberOfParticipants: 1,
                    purpose: 1,
                    purposeDetail: 1,
                    notes: 1,
                    status: 1,
                    phoneNumber: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    // Thông tin từ các collection đã join
                    locationName: '$locationInfo.name', // **KHOA KIỂM TRA MODEL Location**
                    locationBuilding: '$locationInfo.building', // **KHOA KIỂM TRA MODEL Location**
                    shiftName: '$shiftInfo.name', // **KHOA KIỂM TRA MODEL Shift (có thể là shiftInfo.label)**
                }
            },
            { $sort: { createdAt: -1 } }
        ];
        console.log(`[BK_CTRL] [${controllerName}] Executing aggregation pipeline for user: ${userId}`);
        const myBookings = await Booking.aggregate(pipeline);
        console.log(`[BK_CTRL] [${controllerName}] Aggregation complete. Found ${myBookings.length} bookings for user.`);

        console.log(`[BK_CTRL] [${controllerName}] Sending success response.`);
        return res.status(200).json({ success: true, count: myBookings.length, data: myBookings });
    } catch (error) {
        console.error(`[BK_CTRL] [${controllerName}] --- ERROR for user ${userId} ---`);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);
        console.error(`[BK_CTRL] [${controllerName}] --- END ERROR ---`);
        return res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch sử đặt phòng của bạn.' });
    }
};

module.exports = {
    createBooking,
    getAllBookings,
    getMyBookings,
};