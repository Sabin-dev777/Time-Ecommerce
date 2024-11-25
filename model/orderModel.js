const mongoose = require('mongoose');

const orderSchema = mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true,
    },
    cartItems: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cart',
        required: true,
    }],
    shippingAddress: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address',
        required: true,
    },
    status: {
        type: String,
        default: 'pending',
        required: true,
    },
    totalprice: {
        type: Number,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    dateOrdered: {
        type: Date,
        default: Date.now,
    },
    orderStatus: {
        type: String,
        enum: ['Order placed', 'shipped', 'delivered', 'cancelled','returned'],
        default: 'Order placed',
    },
    paymentOption: {
        type: String,
        required: true,
        enum: ['cashOnDelivery', 'paypal'],
    },
    refundStatus: {
        type: String,
        enum: ['NotRequested', 'Pending', 'Completed'],
        default: 'NotRequested',
    },
    returnRequest: {
        isRequested: { type: Boolean, default: false },  // Defaults to false
        status: { type: String, enum: ['NotRequested','requested', 'approved', 'declined'], default: 'NotRequested' },  // Default status as 'NotRequested'
        adminNote: { type: String, default: '' },
    },
});

module.exports = mongoose.model('Order', orderSchema);

