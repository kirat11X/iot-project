"""
BioPulse FastAPI Inference Server
---------------------------------
Supports /predict/live, /predict/latest, /predict/csv, and /health.
All prediction paths use preprocess.py to engineer the same 16 features used in training.
"""

from fastapi import FastAPI, UploadFile, File
import torch
import torch.nn as nn
import joblib
import json
import uvicorn
import numpy as np
import pandas as pd
from io import StringIO
import os
import sys

sys.path.append(os.path.dirname(__file__))
from preprocess import clean_dataframe, load_and_clean, engineer_features, FEATURE_COLS

BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE_DIR, '../models')
FEATURE_CONFIG_PATH = os.path.join(MODELS_DIR, 'feature_config.json')
DEFAULT_CSV_PATH = os.path.join(BASE_DIR, '../../biopulse/backend/db/readings.csv')

LABEL_NAMES = ['CALM', 'MODERATE', 'STRESSED', 'CRITICAL']
DEFAULT_SEQ_LEN = 30


class TrackADeepModel(nn.Module):
    def __init__(self, in_channels=16, num_classes=4):
        super().__init__()
        self.conv_block = nn.Sequential(
            nn.Conv1d(in_channels, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool1d(2),
            nn.Conv1d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
        )
        self.lstm = nn.LSTM(input_size=64, hidden_size=64, batch_first=True)
        self.fc_block = nn.Sequential(
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, num_classes),
        )

    def forward(self, x):
        x = x.permute(0, 2, 1)
        x = self.conv_block(x)
        x = x.permute(0, 2, 1)
        lstm_out, _ = self.lstm(x)
        return self.fc_block(lstm_out[:, -1, :])


# Model artifacts
try:
    scaler = joblib.load(os.path.join(MODELS_DIR, 'scaler.pkl'))
    rf_model = joblib.load(os.path.join(MODELS_DIR, 'trackB_model.pkl'))
except Exception as exc:
    scaler, rf_model = None, None
    print(f'Warning: Track B artifacts unavailable ({exc}). Run train_pipeline.py and install dependencies.')


def load_feature_config(path):
    if not os.path.exists(path):
        return {'seq_len': DEFAULT_SEQ_LEN, 'features': FEATURE_COLS}

    with open(path, 'r', encoding='utf-8') as handle:
        cfg = json.load(handle)

    return {
        'seq_len': int(cfg.get('seq_len', DEFAULT_SEQ_LEN)),
        'features': cfg.get('features', FEATURE_COLS),
    }


FEATURE_CONFIG = load_feature_config(FEATURE_CONFIG_PATH)
SEQ_LEN = FEATURE_CONFIG['seq_len']
MODEL_FEATURES = FEATURE_CONFIG['features']


device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
cnn_model = TrackADeepModel(in_channels=len(MODEL_FEATURES)).to(device)
TRACK_A_READY = True
try:
    cnn_model.load_state_dict(
        torch.load(
            os.path.join(MODELS_DIR, 'trackA_model.pt'),
            map_location=device,
            weights_only=True,
        )
    )
    cnn_model.eval()
except Exception as exc:
    TRACK_A_READY = False
    print(f'Warning: Track A artifact unavailable ({exc}). Run train_pipeline.py.')

TRACK_B_READY = scaler is not None and rf_model is not None


app = FastAPI(title='BioPulse Core ML API')


def extract_statistical_features(windows):
    n_windows, seq_len, feat_count = windows.shape
    features = []

    for i in range(n_windows):
        win_feats = []
        for f_idx in range(feat_count):
            series = windows[i, :, f_idx]
            win_feats.extend([
                np.mean(series),
                np.std(series),
                np.min(series),
                np.max(series),
                np.polyfit(np.arange(seq_len), series, 1)[0],
            ])
        features.append(win_feats)

    return np.array(features, dtype=np.float32)


def align_probabilities(probabilities, classes=None):
    aligned = np.zeros(len(LABEL_NAMES), dtype=np.float32)

    if classes is None:
        count = min(len(aligned), len(probabilities))
        aligned[:count] = probabilities[:count]
        return aligned

    for idx, cls in enumerate(classes):
        cls_id = int(cls)
        if 0 <= cls_id < len(aligned):
            aligned[cls_id] = float(probabilities[idx])

    return aligned


def build_dataframe_from_live_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError('Payload must be a JSON object.')

    if isinstance(payload.get('readings'), list):
        readings = payload.get('readings', [])
        if not readings:
            raise ValueError('payload.readings is empty.')
        return pd.DataFrame(readings)

    # Accept column-wise list payloads too.
    if payload and all(isinstance(value, list) for value in payload.values()):
        return pd.DataFrame(payload)

    # Fallback: treat as single reading object.
    return pd.DataFrame([payload])


def prepare_window_from_dataframe(raw_df, student_id='live'):
    if scaler is None:
        raise ValueError('Scaler artifact unavailable. Re-run training and ensure sklearn is installed.')

    cleaned = clean_dataframe(raw_df, student_id=student_id)
    engineered = engineer_features(cleaned)

    if len(engineered) < SEQ_LEN:
        raise ValueError(
            f'Need at least {SEQ_LEN} valid rows after cleaning; got {len(engineered)}.'
        )

    missing_features = [name for name in MODEL_FEATURES if name not in engineered.columns]
    if missing_features:
        raise ValueError(f'Engineered feature mismatch: missing {missing_features}')

    latest = engineered.tail(SEQ_LEN)
    sequence = latest[MODEL_FEATURES].to_numpy(dtype=np.float32)
    scaled = scaler.transform(sequence).astype(np.float32)
    window_seq = np.expand_dims(scaled, axis=0)

    return window_seq, engineered


def run_inference(window_seq):
    probs_a = None
    probs_b = None

    if TRACK_A_READY:
        tensor_input = torch.from_numpy(window_seq).to(device)
        with torch.no_grad():
            logits = cnn_model(tensor_input)
            probs_a = torch.softmax(logits, dim=1).cpu().numpy()[0]
        probs_a = align_probabilities(probs_a)

    if TRACK_B_READY:
        rf_features = extract_statistical_features(window_seq)
        probs_b_raw = rf_model.predict_proba(rf_features)[0]
        probs_b = align_probabilities(probs_b_raw, getattr(rf_model, 'classes_', None))

    if probs_a is None and probs_b is None:
        raise ValueError('No model artifacts available. Run train_pipeline.py first.')

    if probs_a is not None and probs_b is not None:
        final_probs = 0.7 * probs_a + 0.3 * probs_b
        mode = 'ensemble'
    elif probs_a is not None:
        final_probs = probs_a
        mode = 'track_a_only'
    else:
        final_probs = probs_b
        mode = 'track_b_only'

    stress_class = int(np.argmax(final_probs))
    confidence = float(np.max(final_probs))
    stress_index = round(
        float(np.dot(final_probs, np.arange(len(LABEL_NAMES))) / (len(LABEL_NAMES) - 1) * 100.0),
        2,
    )

    return {
        'stress_class': stress_class,
        'stress_label': LABEL_NAMES[stress_class],
        'confidence': round(confidence, 3),
        'stress_index': stress_index,
        'probabilities': {
            LABEL_NAMES[i]: round(float(final_probs[i]), 4)
            for i in range(len(LABEL_NAMES))
        },
        'model_mode': mode,
    }


@app.get('/health')
def health():
    return {
        'status': 'ok',
        'scaler_ready': scaler is not None,
        'track_a_ready': TRACK_A_READY,
        'track_b_ready': TRACK_B_READY,
        'seq_len': SEQ_LEN,
        'feature_count': len(MODEL_FEATURES),
        'feature_config_loaded': os.path.exists(FEATURE_CONFIG_PATH),
    }


@app.post('/predict/live')
def predict_live(reading: dict):
    try:
        if not TRACK_A_READY and not TRACK_B_READY:
            return {'error': 'Models not initialized. Run train_pipeline.py first.'}

        raw_df = build_dataframe_from_live_payload(reading)
        window_seq, engineered = prepare_window_from_dataframe(raw_df)
        result = run_inference(window_seq)
        result['fallback'] = False
        result['rows_used'] = len(engineered)
        return result
    except Exception as exc:
        return {'error': str(exc), 'fallback': True}


@app.get('/predict/latest')
def predict_latest():
    if not TRACK_A_READY and not TRACK_B_READY:
        return {'fallback': True, 'error': 'Models not initialized', 'stress_label': 'WAITING'}

    try:
        df = load_and_clean(DEFAULT_CSV_PATH)
        window_seq, engineered = prepare_window_from_dataframe(df)
        result = run_inference(window_seq)
        result['fallback'] = False
        result['rows_used'] = len(engineered)
        return result
    except Exception as exc:
        return {'fallback': True, 'error': str(exc), 'stress_label': 'WAITING'}


@app.post('/predict/csv')
async def predict_csv(file: UploadFile = File(...)):
    if not TRACK_A_READY and not TRACK_B_READY:
        return {'error': 'Models not initialized. Run train_pipeline.py first.'}

    try:
        content = await file.read()
        df = pd.read_csv(StringIO(content.decode('utf-8')))

        window_seq, engineered = prepare_window_from_dataframe(df, student_id='csv')
        result = run_inference(window_seq)
        result['fallback'] = False
        result['rows_used'] = len(engineered)
        return result
    except Exception as exc:
        return {'error': str(exc), 'fallback': True}


if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8000)
