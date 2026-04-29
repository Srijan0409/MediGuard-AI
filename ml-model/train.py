import pandas as pd
import numpy as np
import pickle
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, classification_report

def main():
    print("STEP 1: Generating synthetic training data...")
    np.random.seed(42)
    n = 2000

    # Legitimate claims
    legit = pd.DataFrame({
        'text_length': np.random.randint(300, 2000, n//2),
        'has_critical_keywords': np.random.choice([0,1], n//2, p=[0.4, 0.6]),
        'has_fraud_keywords': np.zeros(n//2, dtype=int),
        'amount_mentioned': np.random.randint(500, 50000, n//2),
        'fraud': np.zeros(n//2, dtype=int)
    })

    # Fraudulent claims
    fraud = pd.DataFrame({
        'text_length': np.random.randint(50, 400, n//2),
        'has_critical_keywords': np.random.choice([0,1], n//2, p=[0.7, 0.3]),
        'has_fraud_keywords': np.random.choice([0,1], n//2, p=[0.2, 0.8]),
        'amount_mentioned': np.random.randint(10000, 500000, n//2),
        'fraud': np.ones(n//2, dtype=int)
    })

    data = pd.concat([legit, fraud]).sample(frac=1, random_state=42).reset_index(drop=True)

    feature_cols = ['text_length', 'has_critical_keywords', 'has_fraud_keywords', 'amount_mentioned']
    X = data[feature_cols]
    y = data['fraud']

    print("STEP 2: Splitting and scaling...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    print("STEP 3: Training model...")
    model = RandomForestClassifier(n_estimators=200, max_depth=10, class_weight='balanced', random_state=42, n_jobs=-1)
    model.fit(X_train_scaled, y_train)

    print("STEP 4: Evaluating...")
    y_pred = model.predict(X_test_scaled)
    y_proba = model.predict_proba(X_test_scaled)[:,1]
    print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    print(f"F1 Score: {f1_score(y_test, y_pred, average='weighted'):.4f}")
    print(f"ROC-AUC:  {roc_auc_score(y_test, y_proba):.4f}")
    print(classification_report(y_test, y_pred))

    print("STEP 5: Saving model, scaler, feature_names...")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(base_dir, 'model.pkl'), 'wb') as f:
        pickle.dump(model, f)
    with open(os.path.join(base_dir, 'scaler.pkl'), 'wb') as f:
        pickle.dump(scaler, f)
    with open(os.path.join(base_dir, 'feature_names.pkl'), 'wb') as f:
        pickle.dump(feature_cols, f)

    print("Done! model.pkl, scaler.pkl, feature_names.pkl saved!")

if __name__ == "__main__":
    main()
