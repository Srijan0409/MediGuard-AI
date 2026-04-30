const Tesseract = require('tesseract.js');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const Claim = require('../models/Claim');
const { fromPath } = require('pdf2pic');


exports.processClaim = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        let filePath = req.file.path;
        console.log(`Processing file: ${filePath}`);

        let fullText = '';

        // Handle PDF files
        if (filePath.toLowerCase().endsWith('.pdf')) {
            const options = {
                density: 300,
                saveFilename: "page",
                savePath: "./uploads",
                format: "png",
                width: 1200,
                height: 1600
            };

            const convert = fromPath(filePath, options);

            for (let i = 1; i <= 3; i++) {
                try {
                    const page = await convert(i);

                    if (!page || !page.path) break;

                    console.log("Generated Image Path:", page.path);
                    console.log("Processing page:", i);

                    const { data: { text } } = await Tesseract.recognize(page.path, 'eng');

                    console.log("PAGE TEXT:", text);

                    fullText += text + "\n";

                    // Optional: Cleanup converted image to save space
                    if (fs.existsSync(page.path)) fs.unlinkSync(page.path);

                } catch (err) {
                    console.log("Stopped at page:", i);
                    break;
                }
            }
        } else {
            // 1. OCR directly with Tesseract.js for image files
            console.log('Starting OCR for image...');
            const { data: { text: imageText } } = await Tesseract.recognize(filePath, 'eng');
            fullText = imageText;
            console.log('OCR Complete.');
        }

        // FIX 3 — CLEAN OCR TEXT & NORMALIZE
        fullText = fullText
            .replace(/E(\d+)/g, '$1')   // E5000 → 5000
            .replace(/M(\d+)/g, '$1')   // M1500 → 1500
            .replace(/\s+/g, ' ');

        // FIX 2 — REMOVE DATE NOISE (6-8 digit numbers like 12032024)
        fullText = fullText.replace(/\b\d{6,8}\b/g, "");

        // 2. Feature Extraction
        const fullTextLower = fullText.toLowerCase();
        const fullTextLength = fullText.length;

        // STEP 1 — PRINT OCR OUTPUT (VERY IMPORTANT)
        console.log("-----------------------------------------");
        console.log("OCR TEXT OUTPUT:\n", fullText);
        console.log("-----------------------------------------");

        // STEP 2 — RELAX YOUR CONDITION (Demo Friendly)
        if (!fullText || fullText.trim().length < 5) {
            console.error("OCR failed: Extracted fullText is too short or empty.");

            // STEP 4 — SAFE FALLBACK (BEST PRACTICE)
            const fallbackResponse = {
                status: "Manual Review",
                probability: 0,
                reason: "Low OCR confidence"
            };
            console.log("Sending fallback response:", fallbackResponse);
            return res.json(fallbackResponse);
        }

        let hasCriticalKeywords = 0;
        let detectedCritical = [];
        const criticalWords = ['surgery', 'emergency', 'icu', 'critical', 'trauma', 'operation'];
        for (const word of criticalWords) {
            if (new RegExp(`\\b${word}\\b`, 'i').test(fullText)) {
                hasCriticalKeywords = 1;
                detectedCritical.push(word);
            }
        }

        let hasFraudKeywords = 0;
        const fraudWords = ['altered', 'fake', 'rewrite', 'photoshop', 'duplicate'];
        for (const word of fraudWords) {
            if (new RegExp(`\\b${word}\\b`, 'i').test(fullText)) {
                hasFraudKeywords = 1;
                break;
            }
        }

        // STEP 3 — IMPROVE KEYWORD DETECTION (Safe Keywords)
        const safeKeywords = ["checkup", "consultation", "routine"];
        const hasSafeKeywords = safeKeywords.some(word =>
            new RegExp(`\\b${word}\\b`, 'i').test(fullText)
        );

        // FIX 1 — IMPROVE AMOUNT EXTRACTION
        let amountMentioned = 0;

        // Step 1: Extract amount near keywords (total, amount, bill, charges)
        const amountMatch = fullText.match(/(total|amount|bill|charges)[^\d]{0,20}(\d{3,6})/i);
        if (amountMatch) {
            amountMentioned = parseInt(amountMatch[2]);
        }

        // Step 2: OCR error handling (Fallback for noisy text)
        if (!amountMentioned || amountMentioned === 0) {
            const noisyMatch = fullText.match(/[A-Z]?\s?(\d{3,6})/g);
            if (noisyMatch) {
                const cleaned = noisyMatch
                    .map(x => x.replace(/\D/g, ""))
                    .map(Number)
                    .filter(n =>
                        n >= 100 && n <= 100000 &&  // valid range for standard claims
                        !(n >= 1900 && n <= 2099)   // remove potential years
                    );

                if (cleaned.length > 0) {
                    amountMentioned = Math.max(...cleaned);
                }
            }
        }

        // FIX 4 — LIMIT AMOUNT RANGE (Safety check)
        if (amountMentioned > 100000) {
            amountMentioned = 0;
        }

        const features = {
            fullText_length: fullTextLength,
            has_critical_keywords: hasCriticalKeywords,
            detected_keywords: detectedCritical,
            has_fraud_keywords: hasFraudKeywords,
            amount_mentioned: amountMentioned
        };

        // 3. Call ML Model via Python
        const pythonScriptPath = path.resolve(__dirname, '../../ml-model/predict.py');
        const pythonProcess = spawn('python', [pythonScriptPath, JSON.stringify(features)]);

        let pythonReturnData = '';
        let pythonReturnError = '';

        pythonProcess.stdout.on('data', (data) => {
            pythonReturnData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            pythonReturnError += data.toString();
        });

        pythonProcess.on('close', async (code) => {
            console.log(`Python process exited with code ${code}`);

            if (code !== 0) {
                console.error("Python Error:", pythonReturnError);
                return res.status(500).json({ success: false, message: 'ML Model Error', error: pythonReturnError });
            }

            try {
                // Parse Python JSON output
                const result = JSON.parse(pythonReturnData);

                if (result.error) {
                    return res.status(500).json({ success: false, message: 'ML Model Error', error: result.error });
                }

                // 4. Decision Logic
                let decision = 'Approved';
                let rejectionReason = '';

                // FIX 4 — IMPROVE DECISION LOGIC (Considering Safe Keywords and Probability)
                if (result.fraud === 1) {
                    if (result.probability < 0.3 || hasSafeKeywords) {
                        decision = "Approved";
                    } else {
                        decision = 'Rejected';
                        if (features.has_fraud_keywords) {
                            rejectionReason = "Suspicious document alteration keywords detected.";
                        } else if (features.fullText_length < 300) {
                            rejectionReason = "Claim document lacks sufficient details or looks incomplete.";
                        } else {
                            rejectionReason = "System detected an irregular pattern corresponding to a potential fraud attempt.";
                        }
                    }
                }

                // 5. Save to SQLite
                try {
                    Claim.save({
                        filename: req.file.originalname,
                        extractedText: fullText,
                        fraud: result.fraud,
                        probability: parseFloat((result.probability * 100).toFixed(2)),
                        decision: decision,
                        rejectionReason: rejectionReason
                    });
                } catch (dbErr) {
                    console.error("SQLite Save Error (continuing without DB):", dbErr);
                }

                // 6. Return response
                const responseData = {
                    success: true,
                    data: {
                        decision: decision,
                        probability: (result.probability * 100).toFixed(2),
                        reason: rejectionReason,
                        features: features
                    }
                };
                console.log("Sending response:", responseData);
                res.json(responseData);

            } catch (err) {
                console.error("Parsing Error:", err);
                return res.status(500).json({ success: false, message: 'Error parsing ML result' });
            }
        });

    } catch (error) {
        console.error("FULL ERROR:", error);

        res.status(500).json({
            success: false,
            error: error?.message || "Something went wrong in backend"
        });
    }
};

exports.getAllClaims = (req, res) => {
    try {
        const claims = Claim.find();
        res.json({ success: true, data: claims });
    } catch (error) {
        console.error("Error fetching claims:", error);
        res.status(500).json({ success: false, message: "Error fetching claims." });
    }
};
