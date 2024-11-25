const mongoose = require('mongoose');

const couponSchema = mongoose.Schema({
    couponCode: {
        type: String,
        required: true
    },
    discount: {
        type: Number,
        required: true
    },
    validUntil: {
        type: Date,
        required: true
    },
    status: {
        type: Boolean,
        default: true
    },
    // usageLimit: {
    //     type: Number,
    //     default: null
    // },
    // usageCount: {
    //     type: Number,
    //     default: 0
    // },
    // maxUsagePerUser: {
    //     type: Number,
    //     default: 1
    // },
    minPurchaseAmount: {
        type: Number,
        default: 0 // Minimum purchase required to apply this coupon
    },
    maxDiscount: {
        type: Number,
        default: null // Maximum discount amount allowed
    },
    appliedCarts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cart'
    }],
    usersApplied: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
});

module.exports = mongoose.model('Coupon', couponSchema);
