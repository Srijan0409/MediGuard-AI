document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // LANDING PAGE ANIMATIONS & INTERACTIONS
    // ==========================================
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // Parallax effect for the background stethoscope on scroll
        gsap.to("#bg-steth", {
            yPercent: -15,
            ease: "none",
            scrollTrigger: {
                trigger: "body",
                start: "top top",
                end: "bottom bottom",
                scrub: true
            }
        });

        // Feature cards stagger animation
        gsap.from(".feature-card", {
            y: 50,
            opacity: 0,
            duration: 0.8,
            stagger: 0.2,
            ease: "power2.out",
            scrollTrigger: {
                trigger: "#features",
                start: "top 80%"
            }
        });
    }

    // Navbar blur/glass effect enhancer on scroll
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.style.background = 'rgba(255, 255, 255, 0.9)';
                navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.05)';
            } else {
                navbar.style.background = 'rgba(255, 255, 255, 0.7)';
                navbar.style.boxShadow = 'none';
            }
        }
    });
    // ==========================================

    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('claimDocument');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const checkBtn = document.getElementById('checkBtn');
    const btnText = checkBtn.querySelector('span');
    const spinner = checkBtn.querySelector('.spinner');
    const fileInputWrapper = document.querySelector('.file-input-wrapper');
    
    const resultCard = document.getElementById('resultCard');
    const statusIcon = document.getElementById('statusIcon');
    const decisionText = document.getElementById('decisionText');
    const probText = document.getElementById('probText');
    const reasonContainer = document.getElementById('reasonContainer');
    const reasonText = document.getElementById('reasonText');

    // Drag and Drop Handling
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileInputWrapper.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        fileInputWrapper.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        fileInputWrapper.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        fileInputWrapper.classList.add('drag-active');
    }

    function unhighlight(e) {
        fileInputWrapper.classList.remove('drag-active');
    }

    fileInputWrapper.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            fileInput.files = files;
            const event = new Event('change');
            fileInput.dispatchEvent(event);
        }
    });

    // Display selected filename
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileNameDisplay.textContent = e.target.files[0].name;
            resultCard.classList.add('hidden'); // Hide previous result
            resultCard.classList.remove('approved', 'rejected');
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
        resultCard.classList.remove('approved', 'rejected');

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
        // Trigger CSS animation reflow when showing the result
        resultCard.classList.remove('hidden');
        resultCard.style.animation = 'none';
        void resultCard.offsetWidth; /* trigger reflow */
        resultCard.style.animation = null;
        
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
        setTimeout(() => {
            resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
});
