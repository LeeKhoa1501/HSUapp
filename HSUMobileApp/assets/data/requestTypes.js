// HSUMobileApp/assets/data/requestTypes.js

// Mảng chứa các loại yêu cầu học vụ
// label: Tên hiển thị cho người dùng
// value: Giá trị sẽ được lưu vào database (khớp với enum trong Model Backend)
export const ACADEMIC_REQUEST_TYPES = [
    { label: "GXN-Chưa hoàn tất CTĐT", value: "incomplete_program_cert" },
    { label: "GXN-Hồ sơ cá nhân", value: "personal_profile_cert" },
    { label: "GXN-Hoãn nghĩa vụ quân sự", value: "military_deferral_cert" },
    { label: "GXN-Giảm trừ thuế TNCN", value: "tax_deduction_cert" },
    { label: "GXN-Vay vốn Ngân hàng CSXH", value: "social_bank_loan_cert" },
    { label: "GXN-Hoàn tất CTĐT", value: "completion_cert" },
    { label: "Giấy xác nhận tiếng Anh", value: "english_cert" },
    { label: "Khác", value: "other" },
];

// Hàm tiện ích để lấy label từ value (dùng trong màn hình danh sách)
export const getRequestTypeLabel = (value) => {
    const found = ACADEMIC_REQUEST_TYPES.find(type => type.value === value);
    // Trả về label nếu tìm thấy, ngược lại trả về chính value đó (hoặc 'Không xác định')
    return found ? found.label : (value || 'Không xác định');
};
