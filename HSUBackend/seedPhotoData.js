// HSUBackend/seedPhotoData.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const PhotoAccount = require('./src/models/PhotoAccount');
// === SỬA DÒNG NÀY ĐỂ REQUIRE ĐÚNG MODEL MONGOOSE ===
const PhotoTransaction = require('./src/models/PhotoTransaction'); // <<<< SỬA Ở ĐÂY

// Đọc dữ liệu giao dịch mẫu từ file JSON trong src/data
const sampleTransactionsData = require('./src/data/fakePhotoTransactions.json'); // Dòng này giữ nguyên

dotenv.config();
connectDB();

const seedData = async () => {
    try {
        console.log('Bắt đầu quá trình seed dữ liệu Photo...');
        // Xóa dữ liệu cũ
        // Bây giờ PhotoTransaction.deleteMany sẽ là hàm của Mongoose Model
        await PhotoTransaction.deleteMany({});
        await PhotoAccount.deleteMany({});
        console.log('Dữ liệu PhotoAccount và PhotoTransaction cũ đã được xóa.');

        // ... (phần còn lại của hàm seedData giữ nguyên như code em đã cung cấp ở câu trả lời trước) ...
        const sampleUser = await User.findOne();
        if (!sampleUser) {
            console.error('LỖI: Không tìm thấy user mẫu. Vui lòng tạo user trước.');
            await mongoose.disconnect();
            process.exit(1);
        }
        const userId = sampleUser._id;
        const userNameForLog = sampleUser.fullName || sampleUser.email || userId.toString();
        console.log(`Sẽ tạo dữ liệu photo cho user: ${userNameForLog} (ID: ${userId})`);

        let photoAccount = await PhotoAccount.create({
            userId: userId,
            balance: 0,
        });
        console.log(`   - Đã tạo PhotoAccount (ID: ${photoAccount._id}) cho user ${userNameForLog}.`);

        let currentBalance = 0;
        let latestTransactionDate = null;

        const transactionsToInsert = sampleTransactionsData.map(transData => {
            currentBalance += transData.amount;
            const transactionDate = new Date(transData.transactionDate);
            if (!latestTransactionDate || transactionDate > latestTransactionDate) {
                latestTransactionDate = transactionDate;
            }
            return {
                ...transData,
                photoAccountId: photoAccount._id,
                userId: userId,
                transactionDate: transactionDate
            };
        });

        if (transactionsToInsert.length > 0) {
            await PhotoTransaction.insertMany(transactionsToInsert);
            console.log(`     + Đã import ${transactionsToInsert.length} giao dịch photo từ file JSON.`);
        } else {
            console.log("     - Không có giao dịch nào trong file fakePhotoTransactions.json để import.");
        }

        photoAccount.balance = currentBalance;
        photoAccount.lastTransactionDate = latestTransactionDate || new Date();
        await photoAccount.save();

        console.log(`   - Cập nhật PhotoAccount: Số dư cuối cùng = ${photoAccount.balance}, Ngày GD cuối = ${photoAccount.lastTransactionDate ? photoAccount.lastTransactionDate.toISOString() : 'N/A'}`);
        console.log('Seed dữ liệu Photo thành công!');

    } catch (error) {
        console.error('Lỗi trong quá trình seed dữ liệu photo:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Đã ngắt kết nối MongoDB.');
        // process.exit(error ? 1 : 0); // Bỏ comment nếu muốn script tự thoát
    }
};

seedData();