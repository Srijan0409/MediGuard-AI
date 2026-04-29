import pandas as pd
import numpy as np
import pickle
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, confusion_matrix, classification_report

def main():
    print("STEP 1: Loading data...")
    # Get the directory of the current script to ensure relative paths work
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    train_labels = pd.read_csv(os.path.join(base_dir, 'Train-1542865627584.csv'))
    beneficiary = pd.read_csv(os.path.join(base_dir, 'Train_Beneficiarydata-1542865627584.csv'))
    inpatient = pd.read_csv(os.path.join(base_dir, 'Train_Inpatientdata-1542865627584.csv'))

    print("STEP 2: Merging data...")
    # Merge inpatient with train_labels on 'Provider'
    merged_data = pd.merge(inpatient, train_labels, on='Provider', how='inner')
    # Merge result with beneficiary on 'BeneID'
    merged_data = pd.merge(merged_data, beneficiary, on='BeneID', how='inner')
    
    # Convert PotentialFraud: Yes=1, No=0
    merged_data['fraud'] = merged_data['PotentialFraud'].apply(lambda x: 1 if x == 'Yes' else 0)

    print("STEP 3: Feature Engineering...")
    # Convert date columns to datetime
    date_columns = ['ClaimStartDt', 'ClaimEndDt', 'AdmissionDt', 'DischargeDt', 'DOB']
    for col in date_columns:
        merged_data[col] = pd.to_datetime(merged_data[col], errors='coerce')
    
    # ClaimDuration = ClaimEndDt - ClaimStartDt (in days)
    merged_data['ClaimDuration'] = (merged_data['ClaimEndDt'] - merged_data['ClaimStartDt']).dt.days
    
    # HospitalStay = DischargeDt - AdmissionDt (in days)
    merged_data['HospitalStay'] = (merged_data['DischargeDt'] - merged_data['AdmissionDt']).dt.days
    
    # NumDiagnosisCodes = count of non-null values in ClmDiagnosisCode_1 to _10
    diag_cols = [f'ClmDiagnosisCode_{i}' for i in range(1, 11)]
    merged_data['NumDiagnosisCodes'] = merged_data[diag_cols].notnull().sum(axis=1)
    
    # NumProcedureCodes = count of non-null values in ClmProcedureCode_1 to _6
    proc_cols = [f'ClmProcedureCode_{i}' for i in range(1, 7)]
    merged_data['NumProcedureCodes'] = merged_data[proc_cols].notnull().sum(axis=1)
    
    # HasOperatingPhysician = 1 if OperatingPhysician is not null, else 0
    merged_data['HasOperatingPhysician'] = merged_data['OperatingPhysician'].notnull().astype(int)
    
    # HasOtherPhysician = 1 if OtherPhysician is not null, else 0
    merged_data['HasOtherPhysician'] = merged_data['OtherPhysician'].notnull().astype(int)
    
    # PatientAge = calculated from DOB (year only, approximate)
    # Extract year from ClaimStartDt and subtract DOB year
    merged_data['PatientAge'] = merged_data['ClaimStartDt'].dt.year - merged_data['DOB'].dt.year
    
    # IsDeceased = 1 if DOD is not null, else 0
    merged_data['IsDeceased'] = merged_data['DOD'].notnull().astype(int)
    
    # TotalChronicConds = sum of all ChronicCond_* columns (remap 2->0, 1->1 first)
    chronic_cols = [col for col in merged_data.columns if col.startswith('ChronicCond_')]
    for col in chronic_cols:
        merged_data[col] = merged_data[col].replace(2, 0)
    merged_data['TotalChronicConds'] = merged_data[chronic_cols].sum(axis=1)

    print("STEP 4: Aggregating by Provider...")
    agg_funcs = {
        'ClaimDuration': 'mean',
        'HospitalStay': 'mean',
        'NumDiagnosisCodes': 'mean',
        'NumProcedureCodes': 'mean',
        'InscClaimAmtReimbursed': 'mean',
        'DeductibleAmtPaid': 'mean',
        'PatientAge': 'mean',
        'TotalChronicConds': 'mean',
        'IPAnnualReimbursementAmt': 'mean',
        'OPAnnualReimbursementAmt': 'mean',
        'HasOperatingPhysician': 'sum',
        'HasOtherPhysician': 'sum',
        'IsDeceased': 'sum',
        'BeneID': 'count', # This will become ClaimCount
        'fraud': 'max' # Target y (same for all claims of a provider)
    }
    
    provider_data = merged_data.groupby('Provider').agg(agg_funcs).reset_index()
    provider_data.rename(columns={'BeneID': 'ClaimCount'}, inplace=True)
    
    feature_cols = [
        'ClaimDuration', 'HospitalStay', 'NumDiagnosisCodes',
        'NumProcedureCodes', 'InscClaimAmtReimbursed', 'DeductibleAmtPaid',
        'PatientAge', 'TotalChronicConds', 'IPAnnualReimbursementAmt',
        'OPAnnualReimbursementAmt', 'HasOperatingPhysician', 
        'HasOtherPhysician', 'IsDeceased', 'ClaimCount'
    ]
    
    X = provider_data[feature_cols].copy()
    y = provider_data['fraud']

    print("STEP 5: Preprocessing...")
    # Fill all NaN with 0
    X = X.fillna(0)
    
    # Train/test split: 80/20, stratified, random_state=42
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, stratify=y, random_state=42)
    
    # StandardScaler on X
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    print("STEP 6 & 7: Handling Class Imbalance & Training Model...")
    # RandomForestClassifier with class_weight='balanced'
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train_scaled, y_train)

    print("STEP 8: Evaluating Model...")
    y_pred = model.predict(X_test_scaled)
    y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
    
    print("\n--- Model Evaluation ---")
    print(f"Accuracy:        {accuracy_score(y_test, y_pred):.4f}")
    print(f"F1 Score (wgt):  {f1_score(y_test, y_pred, average='weighted'):.4f}")
    print(f"ROC-AUC Score:   {roc_auc_score(y_test, y_pred_proba):.4f}")
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    print("STEP 9: Saving Model, Scaler, and Feature Names...")
    model_path = os.path.join(base_dir, 'model.pkl')
    scaler_path = os.path.join(base_dir, 'scaler.pkl')
    features_path = os.path.join(base_dir, 'feature_names.pkl')
    
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)
    with open(features_path, 'wb') as f:
        pickle.dump(feature_cols, f)
        
    print(f"\nConfirmation: Files saved successfully!")
    print(f"- Model:        {model_path}")
    print(f"- Scaler:       {scaler_path}")
    print(f"- Feature List: {features_path}")

if __name__ == "__main__":
    main()
