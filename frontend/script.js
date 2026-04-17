document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('claimDocument');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const checkBtn = document.getElementById('checkBtn');
    const btnText = checkBtn.querySelector('span');
    const spinner = checkBtn.querySelector('.spinner');
    
    const resultCard = document.getElementById('resultCard');
    const statusIcon = document.getElementById('statusIcon');
    const decisionText = document.getElementById('decisionText');
    const probText = document.getElementById('probText');
    const reasonContainer = document.getElementById('reasonContainer');
    const reasonText = document.getElementById('reasonText');

    // Display selected filename
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileNameDisplay.textContent = e.target.files[0].name;
            resultCard.classList.add('hidden'); // Hide previous result
        }
    });

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (fileInput.files.length === 0) {
            alert('Please select a file first.');
            return;
        }

        const formData = new FormData();
        formData.append('claimDocument', fileInput.files[0]);

        // UI Loading State
        checkBtn.disabled = true;
        btnText.textContent = 'Processing Claim...';
        spinner.classList.remove('hidden');
        resultCard.classList.add('hidden');

        try {
            // Note: Since everything running locally on the same server, fetch relative route
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Server error occurred');
            }

            displayResult(data.data);
            
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while processing the claim: ' + error.message);
        } finally {
            // Reset UI Loading State
            checkBtn.disabled = false;
            btnText.textContent = 'Check Claim';
            spinner.classList.add('hidden');
        }
    });

    function displayResult(data) {
        resultCard.classList.remove('hidden');
        
        // Remove previous status classes
        resultCard.classList.remove('approved', 'rejected');
        
        probText.textContent = `${data.probability}%`;
        
        if (data.decision === 'Approved') {
            resultCard.classList.add('approved');
            statusIcon.innerHTML = '✅';
            decisionText.textContent = 'Claim Approved';
            probText.className = 'prob-low';
            reasonContainer.classList.add('hidden');
        } else {
            resultCard.classList.add('rejected');
            statusIcon.innerHTML = '❌';
            decisionText.textContent = 'Claim Rejected';
            probText.className = 'prob-high';
            
            if (data.reason) {
                reasonText.textContent = data.reason;
                reasonContainer.classList.remove('hidden');
            } else {
                reasonContainer.classList.add('hidden');
            }
        }
        
        // Smooth scroll to result
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});
