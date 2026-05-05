import pickle
import numpy as np
with open('data4/archive/WESAD/S2/S2.pkl', 'rb') as f:
    data = pickle.load(f, encoding='latin1')
print(data.keys())
print(data['signal']['wrist'].keys())
print('eda shape:', data['signal']['wrist']['EDA'].shape)
print('temp shape:', data['signal']['wrist']['TEMP'].shape)
print('bvp shape:', data['signal']['wrist']['BVP'].shape)
print('labels shape:', data['label'].shape)
print('labels unique:', np.unique(data['label']))
