import sys
import json
import pickle
import numpy as np
import os

# To hide verbose outputs from sklearn
import warnings
warnings.filterwarnings('ignore')

def main():
    try:
        # Load features from JSON argument
        input_data = sys.argv[1]
        features = json.loads(input_data)
        
        # Paths relative to the script directory
        script_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(script_dir, 'model.pkl')
        scaler_path = os.path.join(script_dir, 'scaler.pkl')

        features_path = os.path.join(script_dir, 'feature_names.pkl')
        if not os.path.exists(model_path) or not os.path.exists(scaler_path) or not os.path.exists(features_path):
            raise Exception("Model, Scaler, or Features not found. Run train.py first.")
            
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
            
        with open(scaler_path, 'rb') as f:
            scaler = pickle.load(f)
            
        with open(features_path, 'rb') as f:
            feature_names = pickle.load(f)

        # Build feature array dynamically based on trained feature names
        feat_list = []
        for fn in feature_names:
            feat_list.append(features.get(fn, 0))
        
        feat_array = np.array([feat_list])
        
        # Preprocess using trained scaler
        feat_scaled = scaler.transform(feat_array)
        
        # Predict
        prediction = model.predict(feat_scaled)[0]
        prob = model.predict_proba(feat_scaled)[0][1] # Probability of being fraud
        
        # Determine risk level and top reasons
        risk_level = "Low"
        if prob > 0.7:
            risk_level = "High"
        elif prob > 0.4:
            risk_level = "Medium"
            
        reasons = []
        if features.get('has_fraud_keywords'):
            reasons.append("Suspicious phrasing detected.")
        if features.get('amount_mentioned', 0) > 20000:
            reasons.append("High claim amount.")
        if features.get('text_length', 1000) < 300:
            reasons.append("Claim text unusually short.")
        if not reasons:
            reasons.append("Standard documentation pattern.")
            
        # Format the output logic matching Node.js expectation
        result = {
            "fraud": int(prediction),
            "probability": float(prob),
            "risk_level": risk_level,
            "top_reasons": reasons
        }
        
        # This will be captured by Node.js child_process.stdout
        print(json.dumps(result))
        sys.stdout.flush()

    except Exception as e:
        error_result = {
            "error": str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == '__main__':
    main()
