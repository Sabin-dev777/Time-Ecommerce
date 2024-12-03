const mongoose = require('mongoose');

const categorySchema = mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true,
        uppercase:true

    },
    
    description:{
        type:String,
        required:true
    },
  
    gender:{
        type:String,
        enum:['men','women','unisex']
    },
    isDeleted:{
        type:Boolean,
        default:false
    }

 
});

module.exports = mongoose.model('Category',categorySchema);