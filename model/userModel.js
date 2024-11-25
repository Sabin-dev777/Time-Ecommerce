const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');

const userSchema = new mongoose.Schema({
    firstname:{
        type:String,
        required:true,
        trim:true,
       
    },
    lastname:{
        type:String,
        required:true,
        trim:true
    },
    email:{
        type:String,
        required:true,
        trim:true,
        lowercase:true,
       
    },
    mobile:{
        type:String,
        required:true,
        trim:true,
       
    },
    password:{
        type:String,
        required:true,
        minLength : 8
    },
    role:{
        type:String,
        default:"user"
    },
    isverified:{
        type:Boolean,
        default:false
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    token:{
        type:String,
        default: " "
    },
    address:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Address'
    }],
    wishlist:[
        {type:mongoose.Schema.Types.ObjectId,
            ref:'Product'
        }
    ],
    walletBalance : {
        type:Number,
        default:0.0

    },
    walletTransactions: [
        {
            amount: Number,
            date: Date,
            type: { type: String, enum: ['Credit', 'Debit'] },
            description: String
        }
    ],
   

    
    },{
    timestamps:true
})


userSchema.pre('save',async function(next){
    if(!this.isModified('password')){
        return next()
    }


    const salt = await bcrypt.genSaltSync(10);
    this.password = await bcrypt.hash(this.password,salt)

});
userSchema.methods.isPasswordMatched = async function(enteredPassword){
    
     const isMatch=  await bcrypt.compare(enteredPassword,this.password);
    return isMatch;
   
}

module.exports = mongoose.model('User',userSchema)