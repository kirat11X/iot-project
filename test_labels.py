import pandas as pd
from ml_model.src.preprocess import process_session_csv

df = process_session_csv('biopulse/backend/db/readings.csv')
print("Label counts:")
print(df['label'].value_counts())
