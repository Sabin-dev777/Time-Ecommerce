const mongoose = require('mongoose');

const referralSchema = mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true // Ensure unique referral codes
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reward: {
        type: Number,
        required: true // The reward amount for the referral
    },
    referralCount: {
        type: Number,
        default: 0 // Number of successful referrals
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('Referral', referralSchema);
