const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./src/db");

// Explicitly load .env from parent directory
dotenv.config({ path: "../.env" });
console.log('🔎 Loaded MONGO URI from .env:', process.env.MONGODB_URI);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Connect MongoDB
connectDB();

// Routes
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running 🚀" });
});

// Records routes (protected)
const recordsRouter = require("./src/routes/records");
app.use("/records", recordsRouter);

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
