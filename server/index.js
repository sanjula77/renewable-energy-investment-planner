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

// In-memory cache for embassy lookups
const EMBASSY_TTL_MS = 5 * 60 * 1000; // 5 minutes
const embassyCache = new Map(); // key: `${src}|${dest}` -> { data, expiresAt }

// Static fallback by destination name (lowercase) if scraping fails
const EMBASSY_FALLBACK_BY_DEST = {
  canada: 25,
  germany: 30,
  "united states": 50,
  "united states of america": 50,
  india: 35,
  japan: 20,
  turkey: 25,
  "sri lanka": 10,
  australia: 22,
  france: 30,
};

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

// Aggregate score route with dynamic region weights
app.get("/api/score", async (req, res) => {
  try {
    const countryQuery = String(req.query.country || "").trim();
    const cityQuery = String(req.query.city || countryQuery).trim();
    if (!countryQuery) {
      return res.status(400).json({ error: "Missing country query param" });
    }

    // Helpers
    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function round2(x) { return Math.round(x * 100) / 100; }

    function calculateRisk(stability, embassyCount) {
      const politicalRisk = stability !== null ? ((-stability + 2.5) / 5) * 10 : 5;
      const embassyRisk = embassyCount > 5 ? 1 : (5 - embassyCount);
      let rawScore = (politicalRisk * 10) + (embassyRisk * 5);
      if (rawScore > 100) rawScore = 100;
      if (rawScore < 0) rawScore = 0;
      let category = "Low";
      if (rawScore > 30 && rawScore <= 60) category = "Medium";
      else if (rawScore > 60 && rawScore <= 80) category = "High";
      else if (rawScore > 80) category = "Extreme";
      return { risk_score: rawScore, category };
    }

    // 1) Country info
    const rCountry = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(countryQuery)}`);
    const countryArr = await rCountry.json();
    if (!rCountry.ok || !Array.isArray(countryArr) || !countryArr[0]) {
      return res.status(502).json({ error: "Failed to resolve country info" });
    }
    const countryInfo = countryArr[0];
    const currencyCode = Object.keys(countryInfo.currencies || {})[0] || null;
    const countryCode2 = countryInfo.cca2;
    const countryCode3 = countryInfo.cca3;
    const countryNameCommon = countryInfo?.name?.common || countryQuery;
    const region = countryInfo?.region || null;          // e.g., "Europe", "Americas"
    const subregion = countryInfo?.subregion || null;    // e.g., "Northern Europe", "South America"
    const continentName = Array.isArray(countryInfo?.continents) ? (countryInfo.continents[0] || null) : null; // e.g., "South America"

    // 2) Weather
    const rWeather = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityQuery)}&appid=${process.env.OPENWEATHERMAP_KEY}&units=metric`);
    const weather = await rWeather.json();
    if (!rWeather.ok) {
      return res.status(rWeather.status).json(weather);
    }
    const wind = weather?.wind?.speed || 0;
    const clouds = weather?.clouds?.all || 0;
    const lat = weather?.coord?.lat;
    const lon = weather?.coord?.lon;

    // 3) Exchange
    const rEx = await fetch(`https://v6.exchangerate-api.com/v6/${process.env.EXCHANGERATE_KEY}/latest/USD`);
    const exchange = await rEx.json();
    if (!rEx.ok) {
      return res.status(rEx.status).json(exchange);
    }
    const currencyRate = currencyCode ? (exchange?.conversion_rates?.[currencyCode] || null) : null;

    // 4) Political Stability (World Bank PV.EST)
    const rPol = await fetch(`https://api.worldbank.org/v2/country/${encodeURIComponent(String(countryCode3 || "").toUpperCase())}/indicator/PV.EST?format=json&per_page=100`);
    const polData = await rPol.json();
    if (!rPol.ok) {
      return res.status(rPol.status).json(polData);
    }
    const entries = Array.isArray(polData) ? (polData[1] || []) : [];
    const latest = entries.find(e => e.value !== null);
    const stability = latest?.value ?? null;

    // 5) Embassy count (use internal proxy for robustness)
    const destName = String(countryNameCommon || "").toLowerCase();
    const baseSelf = `${req.protocol}://${req.get('host')}`;
    const rEmb = await fetch(`${baseSelf}/api/embassies/usa/${encodeURIComponent(destName)}`);
    const embResp = await rEmb.json();
    if (!rEmb.ok) {
      return res.status(rEmb.status).json(embResp);
    }
    const embassyCount = embResp?.embassy_count ?? 0;

    // 6) Solar potential via our solar proxy (prefer coords)
    const solarUrl = lat != null && lon != null
      ? `${baseSelf}/api/solar?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
      : `${baseSelf}/api/solar?country=${encodeURIComponent(countryNameCommon)}`;
    const rSolar = await fetch(solarUrl);
    const solarData = await rSolar.json();
    if (!rSolar.ok) {
      return res.status(rSolar.status).json(solarData);
    }
    const solarPotentialKwhPerM2Day = (typeof solarData?.solar_potential === 'number') ? solarData.solar_potential : null;

    // 7) Risk score
    const { risk_score, category } = calculateRisk(stability, embassyCount);

    // 8) Dynamic weights by region/country (simple lookup)
    function getWeights(country, regionName, subregionName, continent) {
      const solarHeavyCountries = new Set(["Brazil", "India", "Kenya", "Sri Lanka"]);
      const windHeavyCountries = new Set(["Denmark", "United Kingdom", "Germany", "United States"]);
      if (solarHeavyCountries.has(country)) return { solar: 0.6, wind: 0.3, risk: 0.1 };
      if (windHeavyCountries.has(country)) return { solar: 0.3, wind: 0.6, risk: 0.1 };

      // Continent/Subregion fallbacks
      const isAfrica = continent === "Africa" || regionName === "Africa";
      const isSouthAmerica = continent === "South America" || subregionName === "South America" || regionName === "Americas" && subregionName === "South America";
      const isSouthAsia = subregionName === "Southern Asia" || subregionName === "South Asia";

      const isNorthernEurope = subregionName === "Northern Europe";
      const isNorthAmerica = continent === "North America" || subregionName === "Northern America";

      if (isAfrica || isSouthAmerica || isSouthAsia) {
        return { solar: 0.6, wind: 0.3, risk: 0.1 };
      }
      if (isNorthernEurope || isNorthAmerica) {
        return { solar: 0.3, wind: 0.6, risk: 0.1 };
      }
      return { solar: 0.5, wind: 0.4, risk: 0.1 }; // default balanced
    }
    const weights = getWeights(countryNameCommon, region, subregion, continentName);

    // 9) Normalize to 0–100
    const solar_score = Math.min(100, Math.max(0, (Number(solarPotentialKwhPerM2Day || 0) / 6) * 100));
    const wind_score = Math.min(100, Math.max(0, (Number(wind || 0) / 15) * 100));

    // 10) Final score
    const scoreRaw = (solar_score * weights.solar) + (wind_score * weights.wind) - (risk_score * weights.risk);
    const score = Math.max(0, Math.min(100, scoreRaw));

    return res.json({
      country: countryNameCommon,
      city: cityQuery,
      wind_speed: round2(wind),
      solar_potential: solarPotentialKwhPerM2Day,
      solar_score: Math.round(solar_score),
      currency_rate: currencyRate,
      stability,
      embassy_count: embassyCount,
      risk_score,
      risk_category: category,
      weights,
      score: Math.round(score)
    });
  } catch (err) {
    res.status(500).json({ error: err.message, where: "server/score" });
  }
});

// Proxy: Global Solar Atlas by coordinates or country
app.get("/api/solar", async (req, res) => {
  try {
    let { lat, lon, country } = req.query;

    // If country provided but no coords, resolve to lat/lon via RestCountries
    if ((!lat || !lon) && country) {
      const encodedName = encodeURIComponent(String(country));
      const rC = await fetch(`https://restcountries.com/v3.1/name/${encodedName}`);
      const dataC = await rC.json();
      if (rC.ok && Array.isArray(dataC) && dataC[0]?.latlng) {
        lat = dataC[0].latlng[0];
        lon = dataC[0].latlng[1];
      }
    }

    if (!lat || !lon) {
      return res.status(400).json({ error: "Missing lat/lon or country" });
    }

    // Global Solar Atlas Long-Term Averages endpoint (no API key required)
    // Docs example: https://api.globalsolaratlas.info/data/lta?loc=LAT,LON
    const baseUrl = process.env.GSA_LTA_URL || "https://api.globalsolaratlas.info/data/lta";
    const url = `${baseUrl}?loc=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`;

    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }
    if (!r.ok) return res.status(r.status).json(data);

    // Extract kWh/m²/day from annual GHI (kWh/m²/year ÷ 365)
    let solarPotential = null;
    const annual = data?.annual?.data || {};
    const ghiAnnual = (typeof annual.GHI === 'number') ? annual.GHI
                    : (typeof annual.ghi === 'number') ? annual.ghi
                    : null;
    if (typeof ghiAnnual === 'number') {
      solarPotential = ghiAnnual / 365;
    } else {
      // Fallback: PVOUT_csi is kWh/kWp/year, not the same unit, but can provide a rough signal
      const pvoutAnnual = (typeof annual.PVOUT_csi === 'number') ? annual.PVOUT_csi
                         : (typeof annual.pvout_csi === 'number') ? annual.pvout_csi
                         : null;
      if (typeof pvoutAnnual === 'number') {
        solarPotential = pvoutAnnual / 365;
      }
    }

    res.json({
      lat: Number(lat),
      lon: Number(lon),
      solar_potential: solarPotential,
      source: { url, provider: "Global Solar Atlas" },
      raw: data
    });
  } catch (err) {
    res.status(500).json({ error: err.message, where: "server/solar" });
  }
});

// // Proxy: Travel Advisory API
// app.get("/api/risk/:code", async (req, res) => {
//   try {
//     const rawCode = req.params.code || "";
//     const code = rawCode.toUpperCase(); // expects country code like "DE", "US", "IN"
//     const url = `https://www.travel-advisory.info/api?countrycode=${encodeURIComponent(code)}`;
//     const r = await fetch(url, {
//       headers: {
//         Accept: "application/json",
//         "User-Agent": "re-invest-planner/1.0 (+http://localhost)",
//       },
//     });
//     const data = await r.json().catch(() => ({}));
//     if (!r.ok) return res.status(r.status).json(data);
//     res.json(data);
//   } catch (err) {
//     res.status(502).json({ error: "upstream fetch failed", details: err.message });
//   }
// });

// World Bank Political Stability
app.get("/api/political/:code", async (req, res) => {
  try {
    // Normalize to ISO3 uppercase as required by World Bank
    const { code } = req.params; // e.g., LKA
    const iso3 = String(code || "").toUpperCase();
    const url = `https://api.worldbank.org/v2/country/${iso3}/indicator/PV.EST?format=json&per_page=100`;
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);

    // Find most recent non-null value
    const entries = Array.isArray(data) ? (data[1] || []) : [];
    const latest = entries.find(e => e.value !== null);
    res.json({ stability: latest?.value || null, year: latest?.date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Travel Info (Embassy count)
app.get("/api/embassies/:src/:dest", async (req, res) => {
  try {
    // Normalize to ISO3 uppercase; many APIs expect ISO3
    const { src, dest } = req.params;
    const source = String(src || "").toLowerCase();
    const destination = String(dest || "").toLowerCase();
    if (!process.env.TRAVELINFO_KEY) {
      return res.status(500).json({
        error: "Missing TRAVELINFO_KEY",
        hint: "Set TRAVELINFO_KEY in .env and restart the server"
      });
    }
    async function getCountryVariants(code) {
      const variants = new Set([code]);
      if (code === "usa") {
        variants.add("us");
        variants.add("united states of america");
        variants.add("united states");
      }
      // prefer full country name first (to mirror Postman success cases)
      try {
        const urlByName = `https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}`;
        const rrn = await fetch(urlByName);
        if (rrn.ok) {
          const arr = await rrn.json();
          const info = Array.isArray(arr) ? arr[0] : arr;
          if (info?.name?.common) variants.add(String(info.name.common).toLowerCase());
        }
      } catch (_) {}
      try {
        const url = `https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}`;
        const rr = await fetch(url);
        if (rr.ok) {
          const arr = await rr.json();
          const info = Array.isArray(arr) ? arr[0] : arr;
          if (info?.cca2) variants.add(String(info.cca2).toLowerCase());
          if (info?.cca3) variants.add(String(info.cca3).toLowerCase());
          if (info?.name?.common) variants.add(String(info.name.common).toLowerCase());
        }
      } catch (_) {}
      return Array.from(variants);
    }

    async function tryFetchEmbassy(a, b) {
      const url = `https://travel-info-api.p.rapidapi.com/find-embassy?source=${encodeURIComponent(a)}&destination=${encodeURIComponent(b)}`;
      const r = await fetch(url, {
        headers: {
          "x-rapidapi-key": process.env.TRAVELINFO_KEY,
          "x-rapidapi-host": "travel-info-api.p.rapidapi.com"
        }
      });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return { ok: r.ok, status: r.status, statusText: r.statusText, data };
    }

    const srcVariants = await getCountryVariants(source);
    const destVariants = await getCountryVariants(destination);
    // Prioritize trying full names first if present
    const sortByNameFirst = (a, b) => {
      const isName = (x) => x.length > 3; // rough heuristic: names > 3 chars not equal to iso2/3
      return (isName(b) ? 1 : 0) - (isName(a) ? 1 : 0);
    };
    srcVariants.sort(sortByNameFirst);
    destVariants.sort(sortByNameFirst);

    // Cache check
    const cacheKey = `${source}|${destination}`;
    const cached = embassyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({
        embassy_count: Array.isArray(cached.data) ? cached.data.length : (Array.isArray(cached.data?.data) ? cached.data.data.length : 0),
        embassies: Array.isArray(cached.data) ? cached.data : (Array.isArray(cached.data?.data) ? cached.data.data : []),
        request_used: cached.request_used || null,
        cache: { hit: true, ttl_ms: EMBASSY_TTL_MS, expiresAt: cached.expiresAt }
      });
    }
    const errors = [];
    for (const sv of srcVariants) {
      for (const dv of destVariants) {
        const attempt = await tryFetchEmbassy(sv, dv);
        if (attempt.ok) {
          const embList = Array.isArray(attempt.data) ? attempt.data : (Array.isArray(attempt.data?.data) ? attempt.data.data : []);
          const responsePayload = { embassy_count: Array.isArray(embList) ? embList.length : 0, embassies: embList, request_used: { source: sv, destination: dv }, cache: { hit: false, ttl_ms: EMBASSY_TTL_MS } };
          embassyCache.set(cacheKey, { data: embList, request_used: responsePayload.request_used, expiresAt: Date.now() + EMBASSY_TTL_MS });
          return res.json(responsePayload);
        } else {
          errors.push({ source: sv, destination: dv, status: attempt.status, statusText: attempt.statusText, body: attempt.data });
        }
      }
    }

    // All attempts failed: gracefully degrade with fallback response
    const fallbackCount = EMBASSY_FALLBACK_BY_DEST[destination] || 0;
    const payload = {
      embassy_count: fallbackCount,
      embassies: [],
      warning: fallbackCount > 0 ? "static_fallback_used" : "fallback_used",
      details: { tried: errors.length, errors },
      cache: { hit: false, ttl_ms: EMBASSY_TTL_MS }
    };
    embassyCache.set(cacheKey, { data: [], request_used: null, expiresAt: Date.now() + EMBASSY_TTL_MS });
    return res.status(200).json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message, where: "server/embassies" });
  }
});

// Aggregate: estimate total embassy presence for a destination
app.get("/api/embassies-total/:dest", async (req, res) => {
  try {
    const { dest } = req.params;
    const destination = String(dest || "").toUpperCase();
    // Major diplomatic senders to approximate presence
    const sources = ["USA", "GBR", "DEU", "FRA", "JPN", "CHN", "IND", "AUS", "CAN", "BRA"];

    // Reuse helper functions defined above
    async function tryFetchEmbassy(a, b) {
      const url = `https://travel-info-api.p.rapidapi.com/find-embassy?source=${encodeURIComponent(a)}&destination=${encodeURIComponent(b)}`;
      const r = await fetch(url, {
        headers: {
          "x-rapidapi-key": process.env.TRAVELINFO_KEY,
          "x-rapidapi-host": "travel-info-api.p.rapidapi.com"
        }
      });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return { ok: r.ok, status: r.status, statusText: r.statusText, data };
    }

    const results = [];
    for (const src of sources) {
      if (src === destination) continue; // avoid self
      const attempt = await tryFetchEmbassy(src, destination);
      const embList = attempt.ok ? (Array.isArray(attempt.data) ? attempt.data : (Array.isArray(attempt.data?.data) ? attempt.data.data : [])) : [];
      results.push({ source: src, ok: attempt.ok, count: embList.length });
    }

    const total = results.reduce((sum, r) => sum + r.count, 0);
    res.json({ destination, total_embassy_count: total, breakdown: results });
  } catch (err) {
    res.status(500).json({ error: err.message, where: "server/embassies-total" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
