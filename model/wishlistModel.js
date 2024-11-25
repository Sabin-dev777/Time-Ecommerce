const mongoose = require("mongoose");

const wishlistSchema = mongoose.Schema({
    userId : {
        type: mongoose.Schema.Types.ObjectId,
        ref:"user"
    },
    products:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Products"
    }]

})

module.exports = mongoose.model("Wishlist", wishlistSchema);