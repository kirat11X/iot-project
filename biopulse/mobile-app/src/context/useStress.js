import { useContext } from 'react';
import { StressContext } from './stressContext';

export function useStress() {
  return useContext(StressContext);
}
