// HSUBackend/src/models/Company.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const companySchema = new Schema({
    name: { type: String, required: true, trim: true, unique: true }, // Tên công ty
    address: { type: String, trim: true },
    website: { type: String, trim: true },
    industry: { type: String, trim: true }, // Lĩnh vực hoạt động
    description: { type: String, trim: true }, // Mô tả ngắn
    contactPerson: { type: String, trim: true },
    contactEmail: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    isActive: { type: Boolean, default: true } // Còn hợp tác hay không
}, { timestamps: true, collection: 'companies' });

companySchema.index({ name: 'text', industry: 'text' }); // Để tìm kiếm

module.exports = mongoose.model('Company', companySchema);