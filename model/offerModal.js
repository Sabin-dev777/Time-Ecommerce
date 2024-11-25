const mongoose = require('mongoose');

const offerSchema = mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['percentage', 'fixed', 'bogo'], // Buy-One-Get-One
        required: true
    },
    value: {
        type: Number, // For percentage or fixed value
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category' // Optional, if the offer is for a category
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Products' // Optional, if the offer is for a specific product
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('Offer', offerSchema);