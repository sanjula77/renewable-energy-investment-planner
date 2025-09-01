const express = require("express");
const Record = require("../record.model");
const apiKeyMiddleware = require("../middleware/apiKey");
const auth0Middleware = require("../middleware/auth0");

const router = express.Router();

// Protect with both API key + Auth0
router.use(apiKeyMiddleware);
router.use(auth0Middleware);

// POST /records
router.post("/", async (req, res) => {
  try {
    const { country, score } = req.body;
    if (!country || !score) {
      return res.status(400).json({ error: "country and score are required" });
    }
    // attach user from Auth0
    const userId = req.auth?.sub || "unknown";
    const record = new Record({ country, score, userId });
    await record.save();
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /records
router.get("/", async (req, res) => {
  try {
    const userId = req.auth?.sub || "unknown";
    const records = await Record.find({ userId }).sort({ createdAt: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
