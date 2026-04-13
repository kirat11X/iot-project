import { useState, useCallback } from 'react';
import { useStress } from '../context/useStress';

export function useMLPrediction() {
  const { state } = useStress();
  const [mlResult, setMlResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Calls the backend proxy to get a prediction for the current live payload
  const predictLive = useCallback(async (currentPayload) => {
    if (!currentPayload || state.dataSource !== 'live') return;
    
    try {
      setIsLoading(true);
      const res = await fetch(`http://${state.settings.serverIp}:3001/api/ml/predict/live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentPayload)
      });
      const data = await res.json();
      setMlResult(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setMlResult({ fallback: true });
    } finally {
      setIsLoading(false);
    }
  }, [state.settings.serverIp, state.dataSource]);

  // Upload utility for History batches
  const predictCsv = useCallback(async (csvFile) => {
    const formData = new FormData();
    formData.append('file', csvFile);
    
    try {
      setIsLoading(true);
      const res = await fetch(`http://${state.settings.serverIp}:3001/api/ml/predict/csv`, {
        method: 'POST',
        body: formData
      });
      return await res.json();
    } catch (err) {
      setError(err.message);
      return { fallback: true };
    } finally {
      setIsLoading(false);
    }
  }, [state.settings.serverIp]);

  return { mlResult, isLoading, error, predictLive, predictCsv };
}
