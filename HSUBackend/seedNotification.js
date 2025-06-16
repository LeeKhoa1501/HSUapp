// HSUBackend/seedNotifications.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load .env
const NODE_ENV = process.env.NODE_ENV || 'development';
const envPath = path.resolve(__dirname, `src/.env.${NODE_ENV}`); // Giả sử .env trong src
const defaultEnvPath = path.resolve(__dirname, 'src/.env');     // Hoặc .env trong src
if (fs.existsSync(envPath)) { dotenv.config({ path: envPath }); }
else if (fs.existsSync(defaultEnvPath)) { dotenv.config({ path: defaultEnvPath }); }
else { console.warn("Không tìm thấy file .env trong src/"); dotenv.config(); /* Thử load từ gốc project nếu có */ }

const connectDB = require('./src/config/db');
const Notification = require('./src/models/Notification');
const User = require('./src/models/User'); 
const sampleNotifications = require('../HSUMobileApp/assets/data/fakeNotifications.json');

connectDB();

const importData = async () => {
    try {
        await Notification.deleteMany(); // Xóa dữ liệu cũ
        console.log('Dữ liệu Notification cũ đã được xóa...');

        const notificationsToInsert = [];
        for (const notifData of sampleNotifications) {
            // Kiểm tra xem recipientId có tồn tại trong User collection không
            if (mongoose.Types.ObjectId.isValid(notifData.recipientId)) {
                const userExists = await User.findById(notifData.recipientId);
                if (userExists) {
                    notificationsToInsert.push({
                        ...notifData,
                        // Chuyển đổi chuỗi ngày tháng từ JSON sang đối tượng Date
                        createdAt: notifData.createdAt ? new Date(notifData.createdAt) : new Date(),
                        updatedAt: notifData.createdAt ? new Date(notifData.createdAt) : new Date(),
                    });
                } else {
                    console.warn(`Bỏ qua thông báo cho recipientId không tồn tại: ${notifData.recipientId}`);
                }
            } else {
                console.warn(`Bỏ qua thông báo với recipientId không hợp lệ: ${notifData.recipientId}`);
            }
        }

        if (notificationsToInsert.length > 0) {
            await Notification.insertMany(notificationsToInsert);
            console.log(`Đã import ${notificationsToInsert.length} thông báo mẫu thành công!`);
        } else {
            console.log('Không có thông báo hợp lệ nào để import.');
        }
        process.exit();
    } catch (error) {
        console.error(`Lỗi khi import dữ liệu Notification: ${error.message}`);
        process.exit(1);
    } finally {
        mongoose.disconnect();
    }
};

const destroyData = async () => {
    try {
        await Notification.deleteMany();
        console.log('Dữ liệu Notification đã được xóa thành công!');
        process.exit();
    } catch (error) {
        console.error(`Lỗi khi xóa dữ liệu Notification: ${error.message}`);
        process.exit(1);
    } finally {
        mongoose.disconnect();
    }
};

if (process.argv[2] === '-destroy') {
    destroyData();
} else {
    importData();
}