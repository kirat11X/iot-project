"""
BioPulse ML Model Training Pipeline
------------------------------------
Executes full data loading, resampling, window slicing, and training for Track A & B.
"""
import os
import json
import joblib
import numpy as np
import pandas as pd
from tqdm import tqdm

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler

import warnings
warnings.filterwarnings('ignore')
from sklearn.metrics import classification_report, accuracy_score

# ----------------- Configuration -----------------
SEQ_LEN = 30
STRIDE = 1
FEATURES = 16
N_CLASSES = 4
EPOCHS = 15
BATCH_SIZE = 128
LEARNING_RATE = 0.001
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODELS_DIR = '../models'

import sys
# Ensure preprocess can be imported
sys.path.append(os.path.dirname(__file__))
from preprocess import process_session_csv, FEATURE_COLS
CSV_PATH = '../../biopulse/backend/db/readings.csv'

os.makedirs(MODELS_DIR, exist_ok=True)

# ----------------- Data Loading & Simulation -----------------
def load_datasets():
    """
    Loads and preprocesses the BioPulse readings.csv.
    """
    print(f"Loading and preprocessing dataset from {CSV_PATH}...")
    file_path = os.path.join(os.path.dirname(__file__), CSV_PATH)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Cannot find {file_path}.")
        
    df = process_session_csv(file_path)
    
    # Ensure all features are float32
    for col in FEATURE_COLS:
        df[col] = df[col].astype(np.float32)
        
    df['label'] = df['label'].astype(np.int64)
    return df

# ----------------- Extraction & Preprocessing -----------------
def create_sliding_windows(df, seq_len=30, stride=1):
    """
    Extracts sliding windows of the 16 features.
    """
    windows = []
    labels = []
    
    for start in range(0, len(df) - seq_len, stride):
        window = df[FEATURE_COLS].iloc[start:start+seq_len].values
        label = df['label'].iloc[start:start+seq_len].mode()[0]
        windows.append(window)
        labels.append(label)
        
    return np.array(windows, dtype=np.float32), np.array(labels, dtype=np.int64)

def extract_statistical_features(windows):
    """
    For Track B: Classical ML feature engineering.
    """
    N, S, F = windows.shape
    features = []
    
    for i in range(N):
        win_feats = []
        for f_idx in range(F):
            series = windows[i, :, f_idx]
            win_feats.extend([
                np.mean(series),
                np.std(series),
                np.min(series),
                np.max(series),
                np.polyfit(np.arange(S), series, 1)[0] # slope
            ])
        features.append(win_feats)
        
    return np.array(features, dtype=np.float32)

# ----------------- Models -----------------
class TrackADeepModel(nn.Module):
    """
    Track A: CNN + LSTM Hybrid
    Accepts (batch, seq_len, features) -> permutes internally for Conv1D.
    """
    def __init__(self, in_channels=FEATURES, seq_len=SEQ_LEN, num_classes=N_CLASSES):
        super().__init__()
        
        self.conv_block = nn.Sequential(
            nn.Conv1d(in_channels, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool1d(2),
            nn.Conv1d(32, 64, kernel_size=3, padding=1),
            nn.ReLU()
        )
        
        self.lstm = nn.LSTM(
            input_size=64, 
            hidden_size=64, 
            batch_first=True
        )
        
        self.fc_block = nn.Sequential(
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, num_classes)
        )
        
    def forward(self, x):
        # x expected shape: (B, S, F) -> permute for CNN: (B, F, S)
        x = x.permute(0, 2, 1)
        x = self.conv_block(x) 
        
        # Prepare for LSTM: (B, transformed_S, hidden)
        x = x.permute(0, 2, 1)
        
        lstm_out, (hn, cn) = self.lstm(x)
        last_hidden = lstm_out[:, -1, :] 
        
        return self.fc_block(last_hidden)

# ----------------- Execution Pipeline -----------------
def run_pipeline():
    print(f"[*] Hardware bounds check constraint: Using device {DEVICE} with batch size {BATCH_SIZE}")
    print("[*] Loading components into memory constraint (float32)...")
    df = load_datasets()
    
    print("[*] Generating Sliding Windows...")
    X_seq, y = create_sliding_windows(df, seq_len=SEQ_LEN, stride=STRIDE)
    
    n_samples, seq, feats = X_seq.shape
    X_flat = X_seq.reshape(-1, feats)
    
    scaler = StandardScaler()
    X_flat_scaled = scaler.fit_transform(X_flat)
    X_seq_scaled = X_flat_scaled.reshape(n_samples, seq, feats).astype(np.float32)
    
    print(f"[*] Sliding windows computed -> Size: {X_seq_scaled.shape}")
    
    from sklearn.model_selection import train_test_split
    X_train_seq, X_test_seq, y_train, y_test = train_test_split(X_seq_scaled, y, test_size=0.2, random_state=42)
    
    print("\n--- Model Training | Track A: Deep Learning ---")
    model_a = TrackADeepModel().to(DEVICE)
    optimizer = optim.Adam(model_a.parameters(), lr=LEARNING_RATE)
    criterion = nn.CrossEntropyLoss()
    
    train_dataset = TensorDataset(torch.from_numpy(X_train_seq), torch.from_numpy(y_train))
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    
    best_loss = float('inf')
    
    for epoch in range(EPOCHS):
        model_a.train()
        epoch_loss = 0
        
        with tqdm(train_loader, desc=f"Epoch {epoch+1}/{EPOCHS}") as pbar:
            for X_batch, y_batch in pbar:
                X_batch, y_batch = X_batch.to(DEVICE), y_batch.to(DEVICE)
                
                optimizer.zero_grad()
                outputs = model_a(X_batch)
                loss = criterion(outputs, y_batch)
                
                loss.backward()
                optimizer.step()
                
                epoch_loss += loss.item()
                pbar.set_postfix({'loss': f"{loss.item():.4f}"})
        
        avg_loss = epoch_loss / len(train_loader)
        
        if avg_loss < best_loss:
            best_loss = avg_loss
            # Checkpoint override
            torch.save(model_a.state_dict(), os.path.join(MODELS_DIR, 'trackA_model.pt'))
            
    # Evaluate Track A
    model_a.eval()
    with torch.no_grad():
        X_test_tensor = torch.from_numpy(X_test_seq).to(DEVICE)
        outputs = model_a(X_test_tensor)
        _, preds = torch.max(outputs, 1)
        y_pred_a = preds.cpu().numpy()
    
    print("\n--- Track A (CNN-LSTM) Accuracy & Report ---")
    print(classification_report(y_test, y_pred_a, target_names=['CALM', 'MODERATE', 'STRESSED', 'CRITICAL'] if len(np.unique(y_test))==4 else None))

                
    print("\n--- Model Training | Track B: Classical ML ---")
    X_train_rf = extract_statistical_features(X_train_seq)
    X_test_rf = extract_statistical_features(X_test_seq)
    
    rf_model = RandomForestClassifier(n_estimators=100, n_jobs=-1, random_state=42)
    with tqdm(total=1, desc="Training Random Forest") as pbar:
        rf_model.fit(X_train_rf, y_train)
        pbar.update(1)
        
    y_pred_b = rf_model.predict(X_test_rf)
    print("\n--- Track B (Random Forest) Accuracy & Report ---")
    print(classification_report(y_test, y_pred_b, target_names=['CALM', 'MODERATE', 'STRESSED', 'CRITICAL'] if len(np.unique(y_test))==4 else None))
    
    print("\n[*] Saving Track B model and configs...")
    joblib.dump(rf_model, os.path.join(MODELS_DIR, 'trackB_model.pkl'))
    joblib.dump(scaler, os.path.join(MODELS_DIR, 'scaler.pkl'))
    
    with open(os.path.join(MODELS_DIR, 'feature_config.json'), 'w') as f:
        json.dump({
            "seq_len": SEQ_LEN,
            "stride": STRIDE,
            "features": FEATURE_COLS,
            "stat_features": ["mean", "std", "min", "max", "slope"]
        }, f)
        
    print("[*] Pipeline Complete! Artifacts isolated inside models/")

if __name__ == "__main__":
    run_pipeline()
