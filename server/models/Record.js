// server/models/Record.js
const mongoose = require("mongoose");

const RecordSchema = new mongoose.Schema(
  {
    country: String,
    score: Number,
    data: Object, // raw API response, flexible for MVP
  },
  { timestamps: true }
);

module.exports = mongoose.model("Record", RecordSchema);
