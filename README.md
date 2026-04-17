# MediGuard AI - Healthcare Insurance Claim Validation System

This is a complete 6th-semester mini-project showcasing an AI-powered pipeline to detect fraudulent healthcare insurance claims.

## 🚀 Features
- **Frontend**: Clean, modern UI (HTML/CSS/Vanilla JS) to upload PDF or Image claims.
- **Backend**: Node.js + Express server for handling routing and logic.
- **OCR Engine**: Tesseract.js to extract text from medical documents.
- **Machine Learning**: Python + Scikit-Learn `RandomForestClassifier` to compute a "Fraud Probability Score".
- **Database**: MongoDB (Mongoose) to store prediction records.

---

## 🛠️ Prerequisites
To run this project on your Windows machine, ensure you have the following installed:
1. **Node.js** (includes `npm`) - [Download Node.js](https://nodejs.org/)
2. **Python** (version 3.9+ recommended) - [Download Python](https://www.python.org/downloads/)
3. **MongoDB Configured Locally** - [Download MongoDB Community Server](https://www.mongodb.com/try/download/community)

---

## ▶️ Setup Instructions

### 1. Database Setup
Ensure that your local MongoDB server is running. The backend attempts to connect to:
`mongodb://127.0.0.1:27017/mediguard`

### 2. Machine Learning Environment
Open your terminal/command prompt, and navigate to the project directory:
```bash
cd "d:\Mni project 6th\mediguard-ai"
```
Install the required python packages and pre-train the model:
```bash
pip install -r ml-model\requirements.txt
python ml-model\train.py
```
*(You should see an output: "Model trained with Test Accuracy: x%" and the `.pkl` models generated).*

### 3. Backend Setup
In the same root directory, install Node.js dependencies:
```bash
npm install
```

### 4. Run the Full Application
Start the Node.js server:
```bash
npm start
```

### 5. Access the Frontend
Open your browser and navigate to:
[http://localhost:5000](http://localhost:5000)

Upload an image of a dummy claim document. The application will compute and display whether the claim is Approved, or Rejected alongside its fraud probability. Look for keywords like "emergency", "surgery", or "altered" in your uploaded files!

---

## 📂 Project Structure Map
```text
mediguard-ai/
├── frontend/
│   ├── index.html        # Main web interface
│   ├── style.css         # Visual styles 
│   └── script.js         # Fetch logic & UI updates
├── backend/
│   ├── server.js         # Express core
│   ├── routes/           # POST /upload endpoint
│   ├── controllers/      # Tesseract OCR & spawn() Python scripts
│   └── models/           # MongoDB Claim Schema
├── ml-model/
│   ├── train.py          # Trains the model and outputs .pkl files
│   ├── predict.py        # Receives JSON arguments, returns JSON prediction
│   └── requirements.txt  # Python Dependencies
├── package.json          # Node dependencies
└── README.md
```
