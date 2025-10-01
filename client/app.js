// client/app.js

function showMessage(msg, isError = false) {
  const el = document.getElementById("statusMsg");
  el.className = isError 
    ? "mb-6 p-4 rounded-md bg-red-50 border border-red-200 text-red-700" 
    : "mb-6 p-4 rounded-md bg-green-50 border border-green-200 text-green-700";
  el.textContent = msg;
  el.classList.remove("hidden");
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
  const resp = await fetch(`http://localhost:3001/api/political/${code}`);
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
  const resp = await fetch(`http://localhost:3001/api/embassies/${src}/${dest}`);
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
  const resp = await fetch(`http://localhost:3001/api/embassies-total/${dest}`);
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

// Helper function to get risk badge styling
function getRiskBadgeClass(category) {
  const classes = {
    'Low': 'bg-green-100 text-green-800 border-green-200',
    'Medium': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'High': 'bg-red-100 text-red-800 border-red-200',
    'Extreme': 'bg-red-200 text-red-900 border-red-300'
  };
  return classes[category] || 'bg-gray-100 text-gray-800 border-gray-200';
}

// Helper function to get score color class
function getScoreColorClass(score) {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

// Create result cards from data
function createResultCards(data) {
  const cardsContainer = document.getElementById('resultCards');
  cardsContainer.innerHTML = '';

  // Location Card
  const locationCard = `
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm transition-colors">
      <div class="flex items-center mb-4">
        <div class="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
          <i class="fas fa-map-marker-alt text-blue-600 dark:text-blue-400"></i>
        </div>
        <h3 class="ml-3 text-lg font-semibold text-gray-900 dark:text-white">Location</h3>
      </div>
      <div class="space-y-2">
        <div class="flex justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">Country:</span>
          <span class="text-sm font-medium text-gray-900 dark:text-white">${data.country || 'N/A'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">City:</span>
          <span class="text-sm font-medium text-gray-900 dark:text-white">${data.city || 'N/A'}</span>
        </div>
      </div>
    </div>
  `;

  // Solar Score Card
  const solarCard = `
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm transition-colors">
      <div class="flex items-center mb-4">
        <div class="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
          <i class="fas fa-sun text-yellow-600 dark:text-yellow-400"></i>
        </div>
        <h3 class="ml-3 text-lg font-semibold text-gray-900 dark:text-white">Solar Potential</h3>
      </div>
      <div class="space-y-2">
        <div class="flex justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">Score:</span>
          <span class="text-sm font-medium ${getScoreColorClass(data.solar_score || 0)}">${data.solar_score || 0}/100</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">Potential:</span>
          <span class="text-sm font-medium text-gray-900 dark:text-white">${data.solar_potential || 'N/A'} kWh/m²/day</span>
        </div>
      </div>
    </div>
  `;

  // Wind Score Card
  const windCard = `
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm transition-colors">
      <div class="flex items-center mb-4">
        <div class="p-2 bg-cyan-100 dark:bg-cyan-900 rounded-lg">
          <i class="fas fa-wind text-cyan-600 dark:text-cyan-400"></i>
        </div>
        <h3 class="ml-3 text-lg font-semibold text-gray-900 dark:text-white">Wind Potential</h3>
      </div>
      <div class="space-y-2">
        <div class="flex justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">Score:</span>
          <span class="text-sm font-medium ${getScoreColorClass(data.wind_score || 0)}">${data.wind_score || 0}/100</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">Wind Speed:</span>
          <span class="text-sm font-medium text-gray-900 dark:text-white">${data.wind_speed || 'N/A'} m/s</span>
        </div>
      </div>
    </div>
  `;

  // Risk Assessment Card
  const riskCard = `
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm transition-colors">
      <div class="flex items-center mb-4">
        <div class="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
          <i class="fas fa-shield-alt text-red-600 dark:text-red-400"></i>
        </div>
        <h3 class="ml-3 text-lg font-semibold text-gray-900 dark:text-white">Risk Assessment</h3>
      </div>
      <div class="space-y-2">
        <div class="flex justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">Category:</span>
          <span class="px-2 py-1 text-xs font-medium rounded-full border ${getRiskBadgeClass(data.risk_category || 'Unknown')}">
            ${data.risk_category || 'Unknown'}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">Score:</span>
          <span class="text-sm font-medium ${getScoreColorClass(100 - (data.risk_score || 0))}">${data.risk_score || 0}/100</span>
        </div>
      </div>
    </div>
  `;

  // Final Score Card
  const finalScoreCard = `
    <div class="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900 dark:to-blue-900 border border-green-200 dark:border-green-700 rounded-lg p-6 shadow-sm transition-colors">
      <div class="flex items-center mb-4">
        <div class="p-2 bg-green-100 dark:bg-green-800 rounded-lg">
          <i class="fas fa-trophy text-green-600 dark:text-green-400"></i>
        </div>
        <h3 class="ml-3 text-lg font-semibold text-gray-900 dark:text-white">Final Investment Score</h3>
      </div>
      <div class="text-center">
        <div class="text-3xl font-bold ${getScoreColorClass(data.score || 0)} mb-2">
          ${data.score || 0}/100
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-300">
          ${data.score >= 80 ? 'Excellent Investment' : 
            data.score >= 60 ? 'Good Investment' : 
            data.score >= 40 ? 'Moderate Investment' : 
            'High Risk Investment'}
        </div>
      </div>
    </div>
  `;

  // Additional Details Card (if available)
  const detailsCard = `
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm transition-colors">
      <div class="flex items-center mb-4">
        <div class="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
          <i class="fas fa-info-circle text-purple-600 dark:text-purple-400"></i>
        </div>
        <h3 class="ml-3 text-lg font-semibold text-gray-900 dark:text-white">Additional Details</h3>
      </div>
      <div class="space-y-2">
        <div class="flex justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">Political Stability:</span>
          <span class="text-sm font-medium text-gray-900 dark:text-white">${data.political_stability || 'N/A'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">Embassy Count:</span>
          <span class="text-sm font-medium text-gray-900 dark:text-white">${data.embassy_count || 'N/A'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">Cloud Coverage:</span>
          <span class="text-sm font-medium text-gray-900 dark:text-white">${data.cloud_coverage || 'N/A'}%</span>
        </div>
      </div>
    </div>
  `;

  cardsContainer.innerHTML = locationCard + solarCard + windCard + riskCard + finalScoreCard + detailsCard;
}

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
    const fullText = selectEl.options[selectEl.selectedIndex].text;
    
    // Map city values to proper country names for the API
    const countryMapping = {
      'New York': 'United States',
      'Berlin': 'Germany', 
      'Mumbai': 'India',
      'Colombo': 'Sri Lanka',
      'Sao Paulo': 'Brazil'
    };
    
    const countryName = countryMapping[city] || 'United States';
    const resultSection = document.getElementById("resultSection");
    const saveBtn = document.getElementById("saveBtn");
    const fetchBtn = document.getElementById("fetchBtn");
    const fetchBtnText = document.getElementById("fetchBtnText");
    const loadingSpinner = document.getElementById("loadingSpinner");
    const statusMsg = document.getElementById("statusMsg");

    try {
      // Show loading state
      fetchBtn.disabled = true;
      fetchBtnText.textContent = "Analyzing...";
      loadingSpinner.classList.remove("hidden");
      statusMsg.classList.add("hidden");

      // Use backend aggregated scoring with dynamic weights
      const scoreResp = await fetch(`http://localhost:3001/api/score?country=${encodeURIComponent(countryName)}&city=${encodeURIComponent(city)}`);
      if (!scoreResp.ok) {
        let detail = await scoreResp.text().catch(() => "");
        throw new Error(`Score API failed: ${detail}`);
      }
      const aggregated = await scoreResp.json();

      lastResult = aggregated;

      // Create and display result cards
      createResultCards(lastResult);
      resultSection.classList.remove("hidden");
      saveBtn.disabled = false;
      showMessage("Analysis completed successfully ✅", false);
    } catch (err) {
      resultSection.classList.add("hidden");
      saveBtn.disabled = true;
      showMessage(err.message, true);
    } finally {
      // Reset loading state
      fetchBtn.disabled = false;
      fetchBtnText.textContent = "Analyze Location";
      loadingSpinner.classList.add("hidden");
    }
  }, 1200)
);

// Handle Save button
document.getElementById("saveBtn").addEventListener("click", async () => {
  if (!lastResult) return alert("No result to save!");

  try {
    const resp = await fetch("http://localhost:3001/records", {
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
window.addEventListener("DOMContentLoaded", () => {
  loadHistory();
  initializeThemeToggle();
});

// Theme toggle functionality
function initializeThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle.querySelector('i');
  
  // Check for saved theme preference or default to light mode
  const currentTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.classList.toggle('dark', currentTheme === 'dark');
  updateThemeIcon(themeIcon, currentTheme);
  
  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    const newTheme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(themeIcon, newTheme);
  });
}

function updateThemeIcon(icon, theme) {
  if (theme === 'dark') {
    icon.className = 'fas fa-sun text-yellow-500';
  } else {
    icon.className = 'fas fa-moon text-gray-600';
  }
}

async function loadHistory() {
  try {
    const resp = await fetch("http://localhost:3001/records", {
      headers: {
        "x-api-key":
          "46a93d405a5d4e2495762af39232ecbb760e6f3cce13771b36bf4f2f265d053e",
      },
    });
    if (!resp.ok) throw new Error("Failed to fetch history");
    const records = await resp.json();

    const tbody = document.getElementById("historyBody");
    const emptyHistory = document.getElementById("emptyHistory");
    
    tbody.innerHTML = ""; // clear old rows

    if (records.length === 0) {
      emptyHistory.classList.remove("hidden");
      return;
    }

    emptyHistory.classList.add("hidden");

    records.forEach((r, index) => {
      const tr = document.createElement("tr");
      tr.className = index % 2 === 0 ? "bg-white" : "bg-gray-50";
      
      const riskCategory = r?.data?.risk_category || 'Unknown';
      const riskBadgeClass = getRiskBadgeClass(riskCategory);
      
      tr.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            <div class="text-sm font-medium text-gray-900">${r.country}</div>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            <i class="fas fa-sun text-yellow-500 mr-2"></i>
            <span class="text-sm font-medium ${getScoreColorClass(r?.data?.solar_score || 0)}">
              ${r?.data?.solar_score || 'N/A'}
            </span>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            <i class="fas fa-wind text-cyan-500 mr-2"></i>
            <span class="text-sm font-medium ${getScoreColorClass(r?.data?.wind_score || 0)}">
              ${r?.data?.wind_score || 'N/A'}
            </span>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            <i class="fas fa-shield-alt text-red-500 mr-2"></i>
            <span class="px-2 py-1 text-xs font-medium rounded-full border ${riskBadgeClass}">
              ${riskCategory}
            </span>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            <i class="fas fa-trophy text-green-500 mr-2"></i>
            <span class="text-sm font-bold ${getScoreColorClass(r.score || 0)}">
              ${r.score || 'N/A'}
            </span>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          ${new Date(r.createdAt).toLocaleDateString()} ${new Date(r.createdAt).toLocaleTimeString()}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    const tbody = document.getElementById("historyBody");
    const emptyHistory = document.getElementById("emptyHistory");
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-4 text-center text-red-600">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          Error loading history
        </td>
      </tr>
    `;
    emptyHistory.classList.add("hidden");
  }
}
