const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
    brandname: {
      type: String,
      required: true,
      unique: true
    },
    description: {
      type: String,
      default: ''
    },
    logo: {
      type: String,
      default: ''
    },
    isActive: {
      type: Boolean,
     
    }
  });

  module.exports = mongoose.model('Brand',brandSchema);