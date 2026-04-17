const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },
    extractedText: {
        type: String,
        required: true
    },
    fraud: {
        type: Number, // 0 for valid, 1 for fraud
        required: true
    },
    probability: {
        type: Number,
        required: true
    },
    decision: {
        type: String, // "Approved" or "Rejected"
        required: true
    },
    rejectionReason: {
        type: String,
        default: ""
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const Claim = mongoose.model('Claim', claimSchema);

module.exports = Claim;
