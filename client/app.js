// client/app.js
document.getElementById("fetchBtn").addEventListener("click", () => {
  const country = document.getElementById("country").value;
  const output = document.getElementById("output");

  // For now, just simulate fetching
  const dummyResult = {
    country,
    message: "API integration coming soon...",
  };

  output.textContent = JSON.stringify(dummyResult, null, 2);
});
