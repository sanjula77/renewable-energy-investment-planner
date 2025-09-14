// server/middleware/googleAuth.js
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const client = jwksClient({
  jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000, // 10 minutes
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function verifyGoogleIdToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Missing Bearer token" });

  jwt.verify(
    token,
    getKey,
    {
      algorithms: ["RS256"],
      issuer: ["https://accounts.google.com", "accounts.google.com"],
    },
    (err, decoded) => {
      if (err) return res.status(401).json({ error: "Invalid token" });
      if (decoded.aud !== process.env.GOOGLE_CLIENT_ID) {
        return res.status(401).json({ error: "Invalid audience" });
      }
      req.user = decoded; // contains Google profile claims
      next();
    }
  );
}

module.exports = verifyGoogleIdToken;
