// client/app.js

async function fetchCountryInfo(name) {
  const url = `http://localhost:3000/api/country/${name}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Country API failed");
  return resp.json();
}

async function fetchWeather(countryCode) {
  const url = `http://localhost:3000/api/weather/${countryCode}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Weather API failed");
  return resp.json();
}

async function fetchExchangeRate() {
  const url = `http://localhost:3000/api/exchange`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Exchange API failed");
  return resp.json();
}

let lastResult = null; // store last computed result

document.getElementById("fetchBtn").addEventListener("click", async () => {
  const selectEl = document.getElementById("country");
  const city = selectEl.value;
  const countryName = selectEl.options[selectEl.selectedIndex].text;
  const output = document.getElementById("output");
  const saveBtn = document.getElementById("saveBtn");

  try {
    // 1. Country lookup
    const countryData = await fetchCountryInfo(countryName);
    const countryInfo = countryData[0]; // RestCountries returns an array
    const currencyCode = Object.keys(countryInfo.currencies)[0];

    // 2. Weather (use city for OpenWeather)
    const weather = await fetchWeather(city);

    // 3. Exchange rate
    const exchange = await fetchExchangeRate();
    const localCurrencyRate = exchange.conversion_rates[currencyCode] || null;

    // 4. Compute score
    const wind = weather.wind?.speed || 0;
    const clouds = weather.clouds?.all || 0;
    const score = Math.max(0, wind * 10 - clouds * 0.5);

    lastResult = {
      city,
      country: countryInfo.name.common,
      currency: currencyCode,
      wind_speed: wind,
      cloud_cover: clouds,
      currency_rate: localCurrencyRate,
      score,
    };

    output.textContent = JSON.stringify(lastResult, null, 2);
    saveBtn.disabled = false; // enable save
  } catch (err) {
    output.textContent = `Error: ${err.message}`;
    saveBtn.disabled = true;
  }
});

// Handle Save button

document.getElementById("saveBtn").addEventListener("click", async () => {
  if (!lastResult) return alert("No result to save!");

  try {
    const resp = await fetch("http://localhost:3000/records", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "46a93d405a5d4e2495762af39232ecbb760e6f3cce13771b36bf4f2f265d053e", // later we add Google ID token too
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
      headers: { "x-api-key": "46a93d405a5d4e2495762af39232ecbb760e6f3cce13771b36bf4f2f265d053e" }
    });
    if (!resp.ok) throw new Error("Failed to fetch history");
    const records = await resp.json();

    const tbody = document.querySelector("#history tbody");
    tbody.innerHTML = ""; // clear old rows

    records.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.country}</td>
        <td>${r.score}</td>
        <td>${new Date(r.createdAt).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    document.querySelector("#history tbody").innerHTML =
      `<tr><td colspan="3">Error loading history</td></tr>`;
  }
}
