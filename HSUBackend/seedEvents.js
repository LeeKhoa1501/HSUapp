// HSUBackend/src/seedEvents.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');      // Đường dẫn tới file connectDB của anh
const Event = require('./src/models/Event');        // Model Event
const sampleEvents = require('./seedEvents'); // Dữ liệu mẫu

// Cấu hình dotenv để load biến môi trường
// Giả sử file .env của anh nằm ở thư mục gốc của project HSUAPPNEW (ngoài HSUBackend)
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

// Kết nối tới MongoDB
connectDB();

const importData = async () => {
  try {
    // Xóa hết dữ liệu Event cũ (CẨN THẬN KHI CHẠY TRÊN PRODUCTION)
    await Event.deleteMany();
    console.log('Dữ liệu Event cũ đã được xóa...');

    // Chuyển đổi chuỗi ngày tháng từ JSON sang đối tượng Date của JavaScript
    const eventsToInsert = sampleEvents.map(event => ({
      ...event,
      startDate: new Date(event.startDate),
      endDate: event.endDate ? new Date(event.endDate) : undefined // undefined sẽ không lưu trường đó
    }));

    await Event.insertMany(eventsToInsert);
    console.log('Dữ liệu Event mẫu đã được import thành công!');
    mongoose.disconnect(); // Ngắt kết nối sau khi xong
    process.exit();
  } catch (error) {
    console.error(`Lỗi khi import dữ liệu Event: ${error.message}`);
    mongoose.disconnect();
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await Event.deleteMany();
    console.log('Dữ liệu Event đã được xóa thành công!');
    mongoose.disconnect();
    process.exit();
  } catch (error) {
    console.error(`Lỗi khi xóa dữ liệu Event: ${error.message}`);
    mongoose.disconnect();
    process.exit(1);
  }
};

// Xử lý argument từ command line để chọn hành động
if (process.argv[2] === '-destroy') {
  destroyData();
} else {
  importData(); // Mặc định là import nếu không có argument -destroy
}