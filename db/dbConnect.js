const mongoose = require("mongoose");

const dbConnect = ()=>{
    try {
        const conn = mongoose.connect(process.env.MONGO_URI)
        console.log("Database is connected")
        
    } catch (error) {
        console.log("Database connection is failed");
        
    }
}
module.exports = dbConnect;