const mongoose = require("mongoose");

const dbConnect = ()=>{
    try {
        const conn = mongoose.connect(process.env.MONGO_URI)
       
        
    } catch (error) {
       
        
    }
}
module.exports = dbConnect;