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

        // Handle PDF files using pdf2pic
        if (filePath.toLowerCase().endsWith('.pdf')) {
            console.log('PDF detected. Converting first page to image...');
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
                const result = await storeAsImage(1); // Convert page 1
                filePath = result.path;
                console.log(`PDF converted successfully. Image saved at: ${filePath}`);
            } catch (pdfErr) {
                console.error("PDF Conversion Error:", pdfErr);
                return res.status(500).json({ success: false, message: 'Error processing PDF document' });
            }
        }

        // 1. OCR directly with Tesseract.js
        console.log('Starting OCR...');
        const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
        console.log('OCR Complete.');

        // 2. Feature Extraction
        const textLower = text.toLowerCase();
        const textLength = text.length;
        
        let hasCriticalKeywords = 0;
        const criticalWords = ['surgery', 'emergency', 'icu', 'critical', 'trauma', 'operation'];
        for (const word of criticalWords) {
            if (textLower.includes(word)) {
                hasCriticalKeywords = 1;
                break;
            }
        }

        let hasFraudKeywords = 0;
        const fraudWords = ['altered', 'fake', 'rewrite', 'photoshop', 'duplicate'];
        for (const word of fraudWords) {
            if (textLower.includes(word)) {
                hasFraudKeywords = 1;
                break;
            }
        }

        // Dummy amount extraction (find first number over 500, else default)
        const amountMatch = text.match(/\$\s*(\d{1,3}(,\d{3})*(\.\d{2})?)/);
        let amountMentioned = 5000; // default
        if (amountMatch && amountMatch[1]) {
            amountMentioned = parseFloat(amountMatch[1].replace(/,/g, ''));
        }

        const features = {
            text_length: textLength,
            has_critical_keywords: hasCriticalKeywords,
            has_fraud_keywords: hasFraudKeywords,
            amount_mentioned: amountMentioned
        };

        // 3. Call ML Model via Python
        const projectRoot = process.env.PROJECT_ROOT || path.join(__dirname, '../../');
        const pythonScriptPath = path.join(projectRoot, 'ml-model/predict.py');
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
                } else if (result.probability > 0.4 && result.probability < 0.5) {
                    // Borderline case
                    decision = 'Requires Manual Review';
                    rejectionReason = "Borderline suspicion score.";
                }

                // 5. Save to MongoDB
                const newClaim = new Claim({
                    filename: req.file.originalname,
                    extractedText: text,
                    fraud: result.fraud,
                    probability: result.probability,
                    decision: decision,
                    rejectionReason: rejectionReason
                });
                await newClaim.save();

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
