const form = document.getElementById("form");
const result = document.getElementById("result");
const statusText = document.getElementById("status");
const probText = document.getElementById("prob");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  result.classList.remove("hidden");
  statusText.textContent = "Processing...";

  await new Promise(r => setTimeout(r, 1200));

  const ok = Math.random() > 0.5;

  statusText.textContent = ok ? "Approved ✅" : "Rejected ❌";
  probText.textContent = "Fraud Probability: " + Math.floor(Math.random()*100) + "%";
});

function goAdmin(){
  window.location.href="dash.html";
}
