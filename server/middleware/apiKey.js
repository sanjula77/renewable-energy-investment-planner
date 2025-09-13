// server/middleware/apiKey.js
require("dotenv").config();

function apiKeyAuth(req, res, next) {
  const clientKey = req.header("x-api-key");
  if (!clientKey || clientKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized: invalid API key" });
  }
  next();
}

module.exports = apiKeyAuth;
