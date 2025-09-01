const express = require("express");
const Record = require("../record.model");
const apiKeyMiddleware = require("../middleware/apiKey");

const router = express.Router();

// Protect all routes with API key
router.use(apiKeyMiddleware);

// POST /records - create new record
router.post("/", async (req, res) => {
  try {
    const { country, score } = req.body;
    if (!country || !score) {
      return res.status(400).json({ error: "country and score are required" });
    }
    const record = new Record({ country, score });
    await record.save();
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /records - list all records
router.get("/", async (req, res) => {
  try {
    const records = await Record.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
