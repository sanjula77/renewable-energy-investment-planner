const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./src/db");

// Load env variables
dotenv.config({ path: "../.env" });

console.log("MONGODB_URI:", process.env.MONGODB_URI);

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect MongoDB
connectDB();

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running 🚀" });
});

const Record = require("./src/record.model");

// Test insert/read route
app.get("/test-db", async (req, res) => {
  try {
    const record = new Record({ country: "LK", score: 75 });
    await record.save();
    const records = await Record.find();
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
