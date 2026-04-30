const form = document.getElementById("form");
const result = document.getElementById("result");
const statusText = document.getElementById("status");
const probText = document.getElementById("prob");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    result.classList.remove("hidden");
    statusText.textContent = "Processing...";

    try {
        let fd = new FormData(form);
        let res = await fetch("http://localhost:5000/api/upload", {
            method: "POST",
            body: fd
        });
        
        let data = await res.json();
        
        if (data.success) {
            statusText.textContent = data.data.decision === 'Approved' ? "Approved ✅" : "Rejected ❌";
            probText.textContent = "Fraud Probability: " + data.data.probability + "%";
        } else {
            statusText.textContent = "Error";
            const errorMsg = data.error || data.message || "Upload failed";
            probText.textContent = errorMsg;
            alert(errorMsg || "Unknown error occurred");
        }
    } catch (err) {
        statusText.textContent = "Server Error";
        probText.textContent = "Could not connect to backend.";
    }
});

function goAdmin() {
    window.location.href = "dash.html";
}
