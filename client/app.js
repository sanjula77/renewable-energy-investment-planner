// client/app.js

// Map city names to currency codes for exchange rate lookup
const cityToCurrencyCode = {
  "New York": "USD",
  "Berlin": "EUR", 
  "Mumbai": "INR",
  "Colombo": "LKR",
  "Sao Paulo": "BRL"
};

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

document.getElementById("fetchBtn").addEventListener("click", async () => {
  const country = document.getElementById("country").value;
  const output = document.getElementById("output");

  try {
    const [weather, exchange] = await Promise.all([
      fetchWeather(country),
      fetchExchangeRate(),
    ]);

    // Extract some values
    const wind = weather.wind?.speed || 0;
    const clouds = weather.clouds?.all || 0;
    const currencyCode = cityToCurrencyCode[country];
    const localCurrencyRate = currencyCode ? exchange.conversion_rates[currencyCode] || null : null;

    // Very simple score formula
    const score = Math.max(0, wind * 10 - clouds * 0.5);

    const result = {
      country,
      wind_speed: wind,
      cloud_cover: clouds,
      currency_rate: localCurrencyRate,
      score,
    };

    output.textContent = JSON.stringify(result, null, 2);
  } catch (err) {
    output.textContent = `Error: ${err.message}`;
  }
});
