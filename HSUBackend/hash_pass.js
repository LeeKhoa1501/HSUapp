// hash_pass.js
const bcrypt = require('bcryptjs'); // Đảm bảo đã cài bcryptjs

const passwordToHash = '123456'; // Tmật khẩu gốc nhé 
const saltRounds = 10; // Độ phức tạp hash (10 là đủ tốt)

bcrypt.genSalt(saltRounds, function(err, salt) {
    if (err) {
        console.error("Lỗi tạo salt:", err);
        return;
    }
    bcrypt.hash(passwordToHash, salt, function(err, hash) {
        if (err) {
            console.error("Lỗi hash mật khẩu:", err);
            return;
        }
        console.log('Mật khẩu gốc:', passwordToHash);
        console.log('Mật khẩu đã hash:', hash); // <-- Copy chuỗi hash này
    });
});