// HSUBackend/src/models/Event.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const eventSchema = new Schema({
    eventName: { type: String, required: [true, 'Tên sự kiện là bắt buộc'], trim: true },
    imageUrl: { type: String, required: [true, 'URL hình ảnh là bắt buộc'] },
    startDate: { type: Date, required: [true, 'Ngày bắt đầu là bắt buộc'] },
    endDate: { type: Date },
    timeString: { type: String, trim: true }, // Ví dụ: "08:00 - 17:00" hoặc "Cả ngày, 15/07"
    location: { type: String, trim: true, default: 'Đại học Hoa Sen' },
    organizer: { type: String, trim: true },
    shortDescription: { type: String, trim: true },
    content: { type: String }, // Nội dung chi tiết
    category: { type: String, trim: true, index: true },
    status: {
        type: String,
        enum: ['Sắp diễn ra', 'Đang diễn ra', 'Đã kết thúc', 'Đã hủy'],
        default: 'Sắp diễn ra',
        index: true
    },
    originalUrl: { type: String, trim: true },
    isFeatured: { type: Boolean, default: false, index: true },
}, {
    timestamps: true,
    collection: 'Events'
});

// Optional: Middleware để tự động cập nhật status dựa trên ngày tháng
// eventSchema.pre('save', function(next) {
//   const now = new Date();
//   if (this.isModified('startDate') || this.isModified('endDate') || this.isNew) {
//     if (this.endDate && this.endDate < now) {
//       this.status = 'Đã kết thúc';
//     } else if (this.startDate <= now && (!this.endDate || this.endDate >= now)) {
//       this.status = 'Đang diễn ra';
//     } else if (this.startDate > now) {
//       this.status = 'Sắp diễn ra';
//     }
//   }
//   next();
// });

// ... schema ...
const Event = mongoose.model('Event', eventSchema);
module.exports = Event;