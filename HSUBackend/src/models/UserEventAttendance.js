// HSUBackend/src/models/UserEventAttendance.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userEventAttendanceSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    attendedAt: { type: Date, default: Date.now }, // Thời điểm ghi nhận tham gia
    // Thêm các trường khác nếu cần: status ('Registered', 'Attended'), feedback...
}, {
    timestamps: true,
    collection: 'UserEventAttendances',
    unique: ['userId', 'eventId'] // Đảm bảo một user chỉ tham gia một event một lần
});

const UserEventAttendance = mongoose.model('UserEventAttendance', userEventAttendanceSchema);
module.exports = UserEventAttendance;