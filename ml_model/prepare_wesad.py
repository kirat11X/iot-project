import os
import glob
import pickle
import numpy as np
import pandas as pd
from scipy import stats

# WESAD Labels: 1=Baseline, 2=Stress, 3=Amusement, 4=Meditation
# Map to our 4-class stress index: 0=Calm, 1=Moderate, 2=Stressed, 3=Critical
# Let's map Baseline & Meditation -> 0 (Calm), Amusement -> 1 (Moderate), Stress -> 2 (Stressed)
LABEL_MAP = {1: 0, 2: 2, 3: 1, 4: 0}

DATA_DIR = 'data4/archive/WESAD'
OUTPUT_FILE = 'data4/processed_wesad.csv'

def process_subject(pkl_path):
    print(f"Processing {pkl_path}...")
    with open(pkl_path, 'rb') as f:
        data = pickle.load(f, encoding='latin1')
    
    # Dimensions from earlier test
    # eda: 4Hz, temp: 4Hz, bvp: 64Hz, label: 700Hz
    # We need to map everything down to 1Hz
    
    # 1. Labels (700Hz -> 1Hz)
    raw_labels = data['label']
    num_secs = len(raw_labels) // 700
    
    # We'll truncate all arrays to num_secs exactly
    raw_labels = raw_labels[:num_secs * 700]
    # Reshape and take mode (most common label in that second)
    labels_1hz = stats.mode(raw_labels.reshape(-1, 700), axis=1, keepdims=False)[0]
    
    # 2. EDA (4Hz -> 1Hz)
    eda_4hz = data['signal']['wrist']['EDA'].flatten()
    eda_4hz = eda_4hz[:num_secs * 4]
    eda_1hz = eda_4hz.reshape(-1, 4).mean(axis=1)
    
    # 3. TEMP (4Hz -> 1Hz)
    temp_4hz = data['signal']['wrist']['TEMP'].flatten()
    temp_4hz = temp_4hz[:num_secs * 4]
    temp_1hz = temp_4hz.reshape(-1, 4).mean(axis=1)
    
    # 4. BVP (64Hz -> 1Hz) -> treat as proxy for HR/Heart variations
    # BVP typically oscillates. We can take the standard deviation per second as a proxy measure of HR/amplitude.
    # Alternatively, just taking mean would average out the oscillation. Let's take std deviation per second.
    bvp_64hz = data['signal']['wrist']['BVP'].flatten()
    bvp_64hz = bvp_64hz[:num_secs * 64]
    bvp_1hz = bvp_64hz.reshape(-1, 64).std(axis=1) # std represents pulse amplitude
    
    # Only keep valid labels according to our map
    df = pd.DataFrame({
        'eda': eda_1hz,
        'hr': bvp_1hz, # treating BVP std as our HR feature analog for training
        'temp': temp_1hz,
        'raw_label': labels_1hz
    })
    
    # Filter to only rows with mapped labels
    valid_rows = df['raw_label'].isin(LABEL_MAP.keys())
    df = df[valid_rows]
    df['label'] = df['raw_label'].map(LABEL_MAP)
    df = df.drop(columns=['raw_label'])
    
    return df

if __name__ == '__main__':
    all_dfs = []
    subject_dirs = [d for d in os.listdir(DATA_DIR) if d.startswith('S') and os.path.isdir(os.path.join(DATA_DIR, d))]
    for s in subject_dirs:
        pkl_file = os.path.join(DATA_DIR, s, f"{s}.pkl")
        if os.path.exists(pkl_file):
            try:
                df = process_subject(pkl_file)
                all_dfs.append(df)
            except Exception as e:
                print(f"Error processing {s}: {e}")
                
    if all_dfs:
        final_df = pd.concat(all_dfs, ignore_index=True)
        print(f"Successfully processed {len(all_dfs)} subjects.")
        print(f"Final dataframe shape: {final_df.shape}")
        print("Label distribution:\n", final_df['label'].value_counts())
        final_df.to_csv(OUTPUT_FILE, index=False)
        print(f"Saved to {OUTPUT_FILE}")
    else:
        print("No data processed.")
