const mongoose = require('mongoose');

const productSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    richDescription: {
        type: String,
        default: ''
    },
    brand: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Brand',
        required: true 
    },
    sizes: [{
        size: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    price: {
        type: Number,
        required: true,
        min: 0
    },
    discountedPrice: {
        type:Number
    },
 
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    images: [{
        type: String
    }],
    isDeleted: {
        type: Boolean,
        default: false
    },
    gender: {  // New Field
        type: String,
        enum: ['Male', 'Female', 'Unisex'],
        required: true
    },
    dateCreated: {
        type: Date,
        default: Date.now
    },
    badgeText : {
        type: String,
    },
    offer: {  // Add this field
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Offer'
    }
});

module.exports = mongoose.model('Products', productSchema);
