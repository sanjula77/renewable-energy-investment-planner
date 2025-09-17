// client/app.js

function showMessage(msg, isError = false) {
  const el = document.getElementById("statusMsg");
  el.style.color = isError ? "red" : "green";
  el.textContent = msg;
}

function debounce(fn, delay = 1000) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

const cache = {
  weather: {},
  exchange: null,
  country: {},
  political: {},
  embassy: {},
  solar: {}
};

async function fetchCountryInfo(name) {
  if (cache.country[name]) return cache.country[name];
  const url = `http://localhost:3000/api/country/${name}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    let detail = await resp.text().catch(() => "");
    throw new Error(`Country API failed: ${detail}`);
  }
  const data = await resp.json();
  cache.country[name] = data;
  return data;
}

async function fetchWeather(city) {
  if (cache.weather[city]) return cache.weather[city];
  const url = `http://localhost:3000/api/weather/${city}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    let detail = await resp.text().catch(() => "");
    throw new Error(`Weather API failed: ${detail}`);
  }
  const data = await resp.json();
  cache.weather[city] = data;
  return data;
}

async function fetchExchangeRate() {
  if (cache.exchange) return cache.exchange;
  const url = `http://localhost:3000/api/exchange`;
  const resp = await fetch(url);
  if (!resp.ok) {
    let detail = await resp.text().catch(() => "");
    throw new Error(`Exchange API failed: ${detail}`);
  }
  const data = await resp.json();
  cache.exchange = data;
  return data;
}

// NEW: Global Solar Atlas (via backend proxy)
async function fetchSolarByCountryOrCoords({ country, lat, lon }) {
  const key = country ? `country:${country}` : `coords:${lat},${lon}`;
  if (cache.solar[key]) return cache.solar[key];
  const params = new URLSearchParams();
  if (country) params.set('country', country);
  if (lat != null && lon != null) {
    params.set('lat', lat);
    params.set('lon', lon);
  }
  const resp = await fetch(`http://localhost:3000/api/solar?${params.toString()}`);
  if (!resp.ok) {
    let detail = await resp.text().catch(() => "");
    throw new Error(`Solar API failed: ${detail}`);
  }
  const data = await resp.json();
  cache.solar[key] = data;
  return data;
}

// NEW: World Bank Political Stability
async function fetchPoliticalStability(code) {
  if (cache.political[code]) return cache.political[code];
  const resp = await fetch(`http://localhost:3000/api/political/${code}`);
  if (!resp.ok) {
    let detail = await resp.text().catch(() => "");
    throw new Error(`Political Stability API failed: ${detail}`);
  }
  const data = await resp.json();
  cache.political[code] = data;
  return data;
}

// NEW: Travel Info Embassy count
async function fetchEmbassyCount(src, dest) {
  const key = `${src}-${dest}`;
  if (cache.embassy[key]) return cache.embassy[key];
  const resp = await fetch(`http://localhost:3000/api/embassies/${src}/${dest}`);
  if (!resp.ok) {
    let detail = await resp.text().catch(() => "");
    throw new Error(`Embassy API failed: ${detail}`);
  }
  const data = await resp.json();
  cache.embassy[key] = data;
  return data;
}

// NEW: Aggregate embassy presence for destination
async function fetchEmbassyTotal(dest) {
  if (cache.embassy[`TOTAL-${dest}`]) return cache.embassy[`TOTAL-${dest}`];
  const resp = await fetch(`http://localhost:3000/api/embassies-total/${dest}`);
  if (!resp.ok) {
    let detail = await resp.text().catch(() => "");
    throw new Error(`Embassy Total API failed: ${detail}`);
  }
  const data = await resp.json();
  cache.embassy[`TOTAL-${dest}`] = data;
  return data;
}

// Risk calculation function
function calculateRisk(stability, embassyCount) {
  // Map stability (−2.5 → 10 risk, +2.5 → 0 risk)
  const politicalRisk = stability !== null
    ? ((-stability + 2.5) / 5) * 10
    : 5; // default medium if missing

  // Embassy risk: fewer embassies = higher risk
  const embassyRisk = embassyCount > 5 ? 1 : (5 - embassyCount);

  // Weighted formula (0–100 scale approximation)
  let rawScore = (politicalRisk * 10) + (embassyRisk * 5);
  if (rawScore > 100) rawScore = 100;
  if (rawScore < 0) rawScore = 0;

  // Classify
  let category = "Low";
  if (rawScore > 30 && rawScore <= 60) category = "Medium";
  else if (rawScore > 60 && rawScore <= 80) category = "High";
  else if (rawScore > 80) category = "Extreme";

  return { risk_score: rawScore, category };
}

let lastResult = null; // store last computed result

// ---- Scoring config (easy to tweak) ----
const SCORE_CONFIG = {
  // Choose which formula to use: 'multiplicative' | 'weighted' | 'sqrtPenalty'
  formula: 'multiplicative',

  energy: {
    // Wind contribution (normalize by a cap and scale to 0–100)
    windCapMs: 20,
    cloudPenaltyPerPct: 0.2,
    minEnergyFloor: 5,
    // Solar normalization (kWh/m²/day)
    solarMinKWhPerM2Day: 2,   // 2 -> roughly poor
    solarMaxKWhPerM2Day: 7,   // 7 -> excellent
  },

  risk: {
    // Risk category weights (higher => stronger penalty)
    categoryMultiplier: {
      Low: 0.6,
      Medium: 0.8,
      High: 1.0,
      Extreme: 1.2,
    },

    // Multiplicative formula parameters
    baseDampen: 0.6,
    maxRiskImpact: 0.7,

    // Weighted formula parameters
    energyWeight: 0.75,
    riskWeight: 0.8,

    // Sqrt penalty formula parameters
    sqrtScale: 4.5,
  },

  // Blend weights for combined energy (wind vs solar)
  weights: {
    wind: 0.6,
    solar: 0.4,
  }
};

// ---- Helper: compute energy potential from wind + clouds (0–100) ----
function computeEnergyPotential(wind, clouds) {
  const cap = SCORE_CONFIG.energy.windCapMs;
  const windNorm = Math.min(Math.max(wind, 0), cap) / cap; // 0–1
  const raw = windNorm * 100;
  const cloudPenalty = (Math.min(Math.max(clouds, 0), 100)) * SCORE_CONFIG.energy.cloudPenaltyPerPct;
  const energy = Math.max(
    SCORE_CONFIG.energy.minEnergyFloor,
    Math.min(100, raw - cloudPenalty)
  );
  return energy;
}

// Normalize solar potential (kWh/m²/day) to 0–100
function normalizeSolarPotential(kwhPerM2Day) {
  const minV = SCORE_CONFIG.energy.solarMinKWhPerM2Day;
  const maxV = SCORE_CONFIG.energy.solarMaxKWhPerM2Day;
  const v = Math.min(Math.max(Number(kwhPerM2Day || 0), minV), maxV);
  const norm01 = (v - minV) / (maxV - minV);
  return Math.round(norm01 * 100);
}

// ---- Helper: category-adjusted risk factor ----
function categoryFactor(category) {
  return SCORE_CONFIG.risk.categoryMultiplier[category] ?? 1.0;
}

// ---- Alternative scoring formulas (pick via SCORE_CONFIG.formula) ----
// 1) Multiplicative damping (default): energy * (1 - adjustedRisk)
function formulaMultiplicative(energy, risk_score, category) {
  const cf = categoryFactor(category);
  const effective = SCORE_CONFIG.risk.baseDampen * cf;
  const riskTerm = Math.min(
    SCORE_CONFIG.risk.maxRiskImpact,
    (Math.min(Math.max(risk_score, 0), 100) / 100) * effective
  );
  return energy * (1 - riskTerm);
}

// 2) Weighted blend: score = wE*energy + (1-wE)*(100 - riskPenalty)
function formulaWeighted(energy, risk_score, category) {
  const wE = SCORE_CONFIG.risk.energyWeight;
  const riskPenalty = Math.min(
    100,
    (Math.min(Math.max(risk_score, 0), 100)) * SCORE_CONFIG.risk.riskWeight * categoryFactor(category)
  );
  const blended = (wE * energy) + ((1 - wE) * (100 - riskPenalty));
  return blended;
}

// 3) Square-root penalty: score = energy - sqrt(risk_score) * scale * catFactor
function formulaSqrtPenalty(energy, risk_score, category) {
  const penalty = Math.sqrt(Math.min(Math.max(risk_score, 0), 100)) * SCORE_CONFIG.risk.sqrtScale * categoryFactor(category);
  return energy - penalty;
}

document.getElementById("fetchBtn").addEventListener(
  "click",
  debounce(async () => {
    const selectEl = document.getElementById("country");
    const city = selectEl.value;
    const countryName = selectEl.options[selectEl.selectedIndex].text;
    const output = document.getElementById("output");
    const saveBtn = document.getElementById("saveBtn");

    try {
      showMessage("Fetching data...", false);

      // Use backend aggregated scoring with dynamic weights
      const scoreResp = await fetch(`http://localhost:3000/api/score?country=${encodeURIComponent(countryName)}&city=${encodeURIComponent(city)}`);
      if (!scoreResp.ok) {
        let detail = await scoreResp.text().catch(() => "");
        throw new Error(`Score API failed: ${detail}`);
      }
      const aggregated = await scoreResp.json();

      lastResult = aggregated;

      output.textContent = JSON.stringify(lastResult, null, 2);
      saveBtn.disabled = false;
      showMessage("Data fetched successfully ✅", false);
    } catch (err) {
      output.textContent = "";
      saveBtn.disabled = true;
      showMessage(err.message, true);
    }
  }, 1200)
);

// Handle Save button
document.getElementById("saveBtn").addEventListener("click", async () => {
  if (!lastResult) return alert("No result to save!");

  try {
    const resp = await fetch("http://localhost:3000/records", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key":
          "46a93d405a5d4e2495762af39232ecbb760e6f3cce13771b36bf4f2f265d053e",
      },
      body: JSON.stringify({
        country: lastResult.country,
        score: lastResult.score,
        data: lastResult,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Save failed (${resp.status})`);
    }

    const saved = await resp.json();
    alert(`Saved! Record ID: ${saved._id}`);
    await loadHistory();
  } catch (err) {
    alert(err.message);
  }
});

// Load history when page opens
window.addEventListener("DOMContentLoaded", loadHistory);

async function loadHistory() {
  try {
    const resp = await fetch("http://localhost:3000/records", {
      headers: {
        "x-api-key":
          "46a93d405a5d4e2495762af39232ecbb760e6f3cce13771b36bf4f2f265d053e",
      },
    });
    if (!resp.ok) throw new Error("Failed to fetch history");
    const records = await resp.json();

    const tbody = document.querySelector("#history tbody");
    tbody.innerHTML = ""; // clear old rows

    records.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.country}</td>
        <td>${r?.data?.solar_potential ?? ''}</td>
        <td>${r?.data?.solar_score ?? ''}</td>
        <td>${r.score}</td>
        <td>${new Date(r.createdAt).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    document.querySelector(
      "#history tbody"
    ).innerHTML = `<tr><td colspan="3">Error loading history</td></tr>`;
  }
}
