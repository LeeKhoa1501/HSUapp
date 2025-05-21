// src/config/db.js
const mongoose = require('mongoose');
// KHÔNG CÓ require('dotenv').config() ở đây nữa

const connectDB = async () => {
  try {
    // Đọc trực tiếp từ process.env đã được server.js load
    const mongoURI = process.env.MONGODB_URI;

    // Log kiểm tra giá trị MONGODB_URI ngay trước khi connect
    console.log(`[DB] Attempting to connect with URI: ${mongoURI ? 'URI Found' : '!!! URI NOT FOUND HERE !!!'}`);

    if (!mongoURI) {
      // Lỗi này bây giờ mới đúng nếu server.js load không thành công
      console.error('[DB] Critical Error: MONGODB_URI is undefined when connectDB is called.');
      process.exit(1);
    }

    const conn = await mongoose.connect(mongoURI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`✅ Connected to DATABASE NAME: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error in connectDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;