// server/index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./db");
const Record = require("./models/Record");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// DB connection
connectDB(process.env.MONGODB_URI);

// Routes
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Temporary test: insert a record
app.post("/test-insert", async (req, res) => {
  try {
    const record = new Record({
      country: "Testland",
      score: 75,
      data: { example: "test" },
    });
    await record.save();
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Temporary test: list records
app.get("/test-list", async (req, res) => {
  try {
    const records = await Record.find().lean();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
