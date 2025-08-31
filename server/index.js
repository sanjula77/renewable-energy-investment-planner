const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load env variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running 🚀" });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
