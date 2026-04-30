const Tesseract = require('tesseract.js');
const { spawn } = require('child_process');
const path = require('path');
const Claim = require('../models/Claim');
const { fromPath } = require('pdf2pic');

exports.processClaim = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        let filePath = req.file.path;
        console.log(`Processing file: ${filePath}`);

        let text = '';

        // Handle PDF files using pdf2pic
        if (filePath.toLowerCase().endsWith('.pdf')) {
            console.log('PDF detected. Converting first up to 3 pages to images...');
            const options = {
                density: 300,
                saveFilename: `converted_${Date.now()}`,
                savePath: path.dirname(filePath),
                format: "png",
                width: 2048,
                height: 2048
            };
            try {
                const storeAsImage = fromPath(filePath, options);
                for (let i = 1; i <= 3; i++) {
                    try {
                        const result = await storeAsImage(i);
                        console.log(`PDF Page ${i} converted successfully. Running OCR...`);
                        const ocrResult = await Tesseract.recognize(result.path, 'eng');
                        text += ocrResult.data.text + ' ';
                    } catch (e) {
                        // Probably no more pages
                        console.log(`No more pages after page ${i - 1} or error on page ${i}`);
                        break;
                    }
                }
            } catch (pdfErr) {
                console.error("PDF Conversion Error:", pdfErr);
                return res.status(500).json({ success: false, message: 'Error processing PDF document' });
            }
        } else {
            // 1. OCR directly with Tesseract.js for image files
            console.log('Starting OCR for image...');
            const { data } = await Tesseract.recognize(filePath, 'eng');
            text = data.text;
            console.log('OCR Complete.');
        }

        // 2. Feature Extraction
        const textLower = text.toLowerCase();
        const textLength = text.length;

        // OCR FAILURE HANDLING
        if (textLength < 50) {
            console.error("OCR failed: Extracted text is too short.");
            return res.status(400).json({ success: false, message: 'Document is unreadable or empty. Please upload a clearer document.' });
        }
        
        let hasCriticalKeywords = 0;
        const criticalWords = ['surgery', 'emergency', 'icu', 'critical', 'trauma', 'operation'];
        for (const word of criticalWords) {
            if (new RegExp(`\\b${word}\\b`, 'i').test(text)) {
                hasCriticalKeywords = 1;
                break;
            }
        }

        let hasFraudKeywords = 0;
        const fraudWords = ['altered', 'fake', 'rewrite', 'photoshop', 'duplicate'];
        for (const word of fraudWords) {
            if (new RegExp(`\\b${word}\\b`, 'i').test(text)) {
                hasFraudKeywords = 1;
                break;
            }
        }

        // Extract amount handling Indian currencies and plain large numbers
        let amountMentioned = 0; // default
        const explicitMatch = text.match(/(?:[\$₹]|Rs\.?|INR|Amount\s*:?)\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)/i);
        if (explicitMatch && explicitMatch[1]) {
            amountMentioned = parseFloat(explicitMatch[1].replace(/,/g, ''));
        } else {
            // Fallback: look for plain large numbers (>= 500)
            const plainNumberRegex = /\b(\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?)\b/g;
            let match;
            while ((match = plainNumberRegex.exec(text)) !== null) {
                const val = parseFloat(match[1].replace(/,/g, ''));
                if (val >= 500 && val !== new Date().getFullYear()) {
                    amountMentioned = val;
                    break;
                }
            }
        }

        const features = {
            text_length: textLength,
            has_critical_keywords: hasCriticalKeywords,
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

                if (result.fraud === 1) {
                    decision = 'Rejected';
                    if (features.has_fraud_keywords) {
                         rejectionReason = "Suspicious document alteration keywords detected.";
                    } else if (features.text_length < 300) {
                         rejectionReason = "Claim document lacks sufficient details or looks incomplete.";
                    } else {
                         rejectionReason = "System detected an irregular pattern corresponding to a potential fraud attempt.";
                    }
                }

                // 5. Save to SQLite
                try {
                    Claim.save({
                        filename: req.file.originalname,
                        extractedText: text,
                        fraud: result.fraud,
                        probability: parseFloat((result.probability * 100).toFixed(2)),
                        decision: decision,
                        rejectionReason: rejectionReason
                    });
                } catch (dbErr) {
                    console.error("SQLite Save Error (continuing without DB):", dbErr);
                }

                // 6. Return response
                res.json({
                    success: true,
                    data: {
                        decision: decision,
                        probability: (result.probability * 100).toFixed(2),
                        reason: rejectionReason,
                        features: features
                    }
                });

            } catch (err) {
                console.error("Parsing Error:", err);
                return res.status(500).json({ success: false, message: 'Error parsing ML result' });
            }
        });

    } catch (error) {
        console.error("Upload process error:", error);
        res.status(500).json({ success: false, message: "Server processing error." });
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
