const mongoose = require('mongoose');

const cartSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Products",
            required: true
        },
        quantity: {
            type: Number,
            default: 1
        },
        size: {
            type: String, // Ensure this field is included
            required: true
        },
        isActive: {
            type: Boolean,
            default: true
        },
        discountedPrice:{
            type: Number
        }
    }],
    total: {
        type: Number,
        default: 0
    },
    orderPlaced: {
        type: Boolean,
        default: false
    },
    appliedCoupon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon'
    }
});

module.exports = mongoose.model("Cart", cartSchema);
