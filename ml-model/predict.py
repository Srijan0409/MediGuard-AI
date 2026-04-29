import sys
import json
import pickle
import numpy as np
import os

def main():
    try:
        # Get the directory of the script to load relative files
        base_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Accept one argument: sys.argv[1] as JSON string
        if len(sys.argv) < 2:
            raise ValueError("No input JSON string provided as argument.")
            
        input_json_str = sys.argv[1]
        input_data = json.loads(input_json_str)
        
        # Load model.pkl, scaler.pkl, feature_names.pkl
        model_path = os.path.join(base_dir, 'model.pkl')
        scaler_path = os.path.join(base_dir, 'scaler.pkl')
        features_path = os.path.join(base_dir, 'feature_names.pkl')
        
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
            
        with open(scaler_path, 'rb') as f:
            scaler = pickle.load(f)
            
        with open(features_path, 'rb') as f:
            feature_names = pickle.load(f)
            
        # Use feature_names.pkl to build the array in correct order
        # Fill missing keys with 0
        features_array = []
        for feature in feature_names:
            val = input_data.get(feature, 0)
            features_array.append(float(val) if val is not None else 0.0)
            
        # Reshape for prediction (1 sample, n features)
        X_new = np.array(features_array).reshape(1, -1)
        
        # Scale using scaler
        X_new_scaled = scaler.transform(X_new)
        
        # Predict using model
        prediction = model.predict(X_new_scaled)[0]
        probability = model.predict_proba(X_new_scaled)[0][1]
        
        # Determine risk_level
        if probability < 0.3:
            risk_level = "Low"
        elif probability < 0.6:
            risk_level = "Medium"
        else:
            risk_level = "High"
            
        # Get top 3 feature importances as top_reasons list
        importances = model.feature_importances_
        # Get indices of top 3 features
        top_indices = np.argsort(importances)[::-1][:3]
        top_reasons = [feature_names[i] for i in top_indices]
        
        # Print ONLY this JSON to stdout
        output = {
            "fraud": int(prediction),
            "probability": round(float(probability), 2),
            "risk_level": risk_level,
            "top_reasons": top_reasons
        }
        
        # Ensure no other print statements exist here
        print(json.dumps(output))
        
    except Exception as e:
        # Wrap everything in try/except, on error print error json and sys.exit(1)
        error_output = { "error": str(e) }
        print(json.dumps(error_output))
        sys.exit(1)

if __name__ == "__main__":
    main()
