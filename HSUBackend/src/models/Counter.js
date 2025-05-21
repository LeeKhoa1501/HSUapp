// HSUBackend/src/models/Counter.js
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // Ví dụ: 'internshipApplication_2025'
    seq: { type: Number, default: 0 }
});

counterSchema.statics.getNextSequenceValue = async function(sequenceName) {
    const sequenceDocument = await this.findOneAndUpdate(
        { _id: sequenceName },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return sequenceDocument.seq;
};

const Counter = mongoose.model('Counter', counterSchema);
module.exports = Counter;