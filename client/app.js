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

document.getElementById("fetchBtn").addEventListener("click", async () => {
  const selectEl = document.getElementById("country");
  const city = selectEl.value;
  const countryName = selectEl.options[selectEl.selectedIndex].text;
  const output = document.getElementById("output");

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

    const result = {
      city,
      country: countryInfo.name.common,
      currency: currencyCode,
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
