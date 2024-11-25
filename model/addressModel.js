const mongoose = require('mongoose');
const addressSchema = mongoose.Schema({
    house:{
        type:String,
        required:true
    },
    street:{
        type:String,
        required:true
    },
    city:{
        type:String,
        required:true
    },
    landmark:{
        type:String,
        required:true
    },
    state:{
        type:String,
        required:true
    },
    country:{
        type:String,
        required:true
    },
    zip:{
        type:String,
        required:true
    },
    isDefault:{
        type:Boolean,
        default:false

    },
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    }
});

module.exports = mongoose.model('Address',addressSchema)