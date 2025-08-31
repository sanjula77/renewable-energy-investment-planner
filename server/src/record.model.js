const mongoose = require("mongoose");

const recordSchema = new mongoose.Schema({
  country: String,
  score: Number,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Record", recordSchema);
