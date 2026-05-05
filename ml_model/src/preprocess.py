import pandas as pd
import numpy as np

# ── Column names matching your actual CSV header ──────────────
RAW_COLS = ['timestamp', 'heart_rate', 'hrv', 'gsr_pct',
            'temperature', 'humidity', 'ibi_ms']

# These are the ONLY features fed into the model
FEATURE_COLS = [
    'hr_mean_30s', 'hr_std_30s', 'hr_delta', 'hr_max_30s',
    'gsr_mean_30s', 'gsr_std_30s', 'gsr_delta', 'gsr_peak_count',
    'hrv_mean_30s', 'hrv_drop',
    'heat_index', 'temp_delta', 'humidity_delta',
    'gsr_hr_product', 'hrv_temp_ratio',
    'session_progress'
]

RENAME_MAP = {
    'timestamp_ms': 'timestamp',
    'temp_c': 'temperature',
    'humidity_pct': 'humidity',
    'gsr_conductivity_pct': 'gsr_pct',
    'gsr': 'gsr_pct',
    'raw_hr': 'heart_rate',
}


def _normalize_columns(df):
    normalized = df.copy()
    normalized.columns = (
        normalized.columns
        .str.lower()
        .str.replace(' ', '_')
        .str.replace('%', 'pct')
    )
    return normalized.rename(columns={k: v for k, v in RENAME_MAP.items() if k in normalized.columns})


def clean_dataframe(df, student_id='unknown'):
    cleaned = _normalize_columns(df)

    missing = [col for col in RAW_COLS if col not in cleaned.columns]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    for col in RAW_COLS:
        cleaned[col] = pd.to_numeric(cleaned[col], errors='coerce')

    cleaned['student_id'] = student_id

    # Range filtering removes obvious sensor dropouts and malformed rows.
    cleaned = cleaned[cleaned['heart_rate'].between(40, 200)]
    cleaned = cleaned[cleaned['gsr_pct'].between(0.5, 99.5)]
    cleaned = cleaned[cleaned['temperature'].between(10, 50)]
    cleaned = cleaned[cleaned['humidity'].between(10, 99)]

    cleaned['hrv'] = cleaned['hrv'].replace(0, np.nan)
    median_hrv = cleaned['hrv'].median()
    if pd.isna(median_hrv):
        median_hrv = 40.0
    cleaned['hrv'] = cleaned['hrv'].fillna(median_hrv)
    cleaned['hrv'] = cleaned['hrv'].clip(5, 200)

    cleaned = cleaned.sort_values('timestamp').drop_duplicates(
        subset='timestamp'
    ).reset_index(drop=True)

    return cleaned

def load_and_clean(filepath, student_id='unknown'):
    df = pd.read_csv(filepath, on_bad_lines='skip')
    return clean_dataframe(df, student_id=student_id)


def _infer_sample_interval_seconds(df, default_seconds=2.0):
    if 'timestamp' not in df.columns or len(df) < 2:
        return default_seconds

    diffs = df['timestamp'].diff().dropna()
    diffs = diffs[diffs > 0]
    if diffs.empty:
        return default_seconds

    median_diff = float(diffs.median())
    if median_diff > 10:
        return median_diff / 1000.0
    return median_diff


def engineer_features(df, window_seconds=30, sample_rate=None):
    """
    window_seconds: rolling window duration in seconds.
    sample_rate: optional Hz override. If omitted, inferred from timestamp spacing.
    """
    if sample_rate is not None and sample_rate > 0:
        sample_interval_seconds = 1.0 / sample_rate
    else:
        sample_interval_seconds = _infer_sample_interval_seconds(df)
    w = max(int(round(window_seconds / max(sample_interval_seconds, 0.1))), 5)

    df = df.copy()

    # ── Heart Rate ────────────────────────────────────────────
    df['hr_mean_30s'] = df['heart_rate'].rolling(w, min_periods=1).mean()
    df['hr_std_30s']  = df['heart_rate'].rolling(w, min_periods=1).std().fillna(0)
    df['hr_delta']    = df['heart_rate'].diff().fillna(0)
    df['hr_max_30s']  = df['heart_rate'].rolling(w, min_periods=1).max()

    # ── GSR ───────────────────────────────────────────────────
    df['gsr_mean_30s']   = df['gsr_pct'].rolling(w, min_periods=1).mean()
    df['gsr_std_30s']    = df['gsr_pct'].rolling(w, min_periods=1).std().fillna(0)
    df['gsr_delta']      = df['gsr_pct'].diff().fillna(0)

    # Count spikes: GSR jumped more than 5% in one step
    df['gsr_spike']      = (df['gsr_delta'].abs() > 5.0).astype(int)
    df['gsr_peak_count'] = df['gsr_spike'].rolling(w, min_periods=1).sum()

    # ── HRV ───────────────────────────────────────────────────
    df['hrv_mean_30s'] = df['hrv'].rolling(w, min_periods=1).mean()
    # HRV drops = stress rising (clip upward movement, keep drops)
    df['hrv_drop']     = df['hrv'].diff().clip(upper=0).abs().fillna(0)

    # ── Environmental ─────────────────────────────────────────
    # Heat index (simplified — Steadman formula approximation)
    df['heat_index'] = (
        df['temperature'] +
        0.33 * (df['humidity'] / 100 * 6.105 *
        np.exp(17.27 * df['temperature'] /
               (df['temperature'] + 237.3))) - 4.0
    )
    df['temp_delta']     = df['temperature'].diff().fillna(0)
    df['humidity_delta'] = df['humidity'].diff().fillna(0)

    # ── Cross-signal interactions ─────────────────────────────
    # High GSR% AND high HR together = strong stress signal
    df['gsr_hr_product'] = (df['gsr_pct'] * df['heart_rate']) / 100.0

    # Low HRV in hot room means more stress than low HRV in cool room
    df['hrv_temp_ratio'] = df['hrv'] / (df['temperature'] + 1.0)

    # ── Session progress (0.0 = start, 1.0 = end) ─────────────
    ts_range = df['timestamp'].max() - df['timestamp'].min()
    df['session_progress'] = (
        (df['timestamp'] - df['timestamp'].min()) /
        (ts_range + 1)
    )

    # Drop rows where rolling windows don't have enough data yet
    df = df.dropna(subset=FEATURE_COLS).reset_index(drop=True)

    return df


def add_pseudo_labels(df):
    """
    Generate training labels using rule-based stress formula.
    Use this until you have manually labeled ground truth.
    
    Label map:
        0 = CALM       (stress_index 0-35)
        1 = MODERATE   (stress_index 36-65)
        2 = STRESSED   (stress_index 66-85)
        3 = CRITICAL   (stress_index 86-100)
    """
    # Normalize each signal to 0-1 range based on observed ranges
    hr_norm  = ((df['heart_rate'] - 40)  / (200 - 40)).clip(0, 1)
    gsr_norm = (df['gsr_pct']            / 12.0).clip(0, 1)
    hrv_inv  = 1.0 - ((df['hrv'] - 5)   / (200 - 5)).clip(0, 1)

    stress = (0.35 * hr_norm + 0.45 * gsr_norm + 0.20 * hrv_inv) * 100

    df['stress_index'] = stress.round(1)
    df['label'] = pd.cut(
        stress,
        bins=[-1, 35, 65, 85, 101],
        labels=[0, 1, 2, 3]
    ).astype(int)

    return df


def process_session_csv(filepath, student_id='S01'):
    """Full pipeline: raw CSV → training-ready features + labels"""
    df = load_and_clean(filepath, student_id)
    df = engineer_features(df)
    df = add_pseudo_labels(df)

    print(f"Session: {filepath}")
    print(f"  Rows after cleaning:    {len(df)}")
    print(f"  Label distribution:")
    print(df['label'].value_counts().sort_index()
            .rename({0:'CALM', 1:'MODERATE', 2:'STRESSED', 3:'CRITICAL'}))
    print()

    return df
