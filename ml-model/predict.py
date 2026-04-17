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

        if not os.path.exists(model_path) or not os.path.exists(scaler_path):
            raise Exception("Model or Scaler not found. Run train.py first.")
            
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
            
        with open(scaler_path, 'rb') as f:
            scaler = pickle.load(f)

        # Expected features: np.array([[text_length, has_critical_keywords, has_fraud_keywords, amount_mentioned]])
        feat_array = np.array([[
            features.get('text_length', 1000),
            features.get('has_critical_keywords', 0),
            features.get('has_fraud_keywords', 0),
            features.get('amount_mentioned', 10000)
        ]])
        
        # Preprocess using trained scaler
        feat_scaled = scaler.transform(feat_array)
        
        # Predict
        prediction = model.predict(feat_scaled)[0]
        prob = model.predict_proba(feat_scaled)[0][1] # Probability of being fraud
        
        # Format the output logic matching Node.js expectation
        result = {
            "fraud": int(prediction),
            "probability": float(prob)
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
