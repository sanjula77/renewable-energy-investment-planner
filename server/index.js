// server/index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./db");
const Record = require("./models/Record");
const apiKeyAuth = require("./middleware/apiKey");
const verifyGoogleIdToken = require("./middleware/googleAuth");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// DB connection
connectDB(process.env.MONGODB_URI);

// Public route
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Protected routes
app.post("/records", apiKeyAuth, async (req, res) => {
  try {
    const record = new Record(req.body);
    await record.save();
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/records", apiKeyAuth, async (req, res) => {
  try {
    const records = await Record.find().lean();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected with Google OAuth2
app.get(
  "/records-secure",
  apiKeyAuth,
  verifyGoogleIdToken,
  async (req, res) => {
    try {
      const records = await Record.find().lean();
      res.json({ user: req.user.email, records });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

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

// Proxy: Get country info (currency, etc.)
app.get("/api/country/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const encodedName = encodeURIComponent(name);
    const url = `https://restcountries.com/v3.1/name/${encodedName}`;
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy: Get weather by country
app.get("/api/weather/:country", async (req, res) => {
  try {
    const { country } = req.params;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${country}&appid=${process.env.OPENWEATHERMAP_KEY}&units=metric`;
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy: Get exchange rates
app.get("/api/exchange", async (_req, res) => {
  try {
    const url = `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGERATE_KEY}/latest/USD`;
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
