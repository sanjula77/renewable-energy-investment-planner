function apiKeyMiddleware(req, res, next) {
  const clientKey = req.headers["x-api-key"];
  const serverKey = process.env.INTERNAL_API_KEY;

  if (!clientKey || clientKey !== serverKey) {
    return res.status(401).json({ error: "Unauthorized: Invalid API key" });
  }
  next();
}

module.exports = apiKeyMiddleware;
