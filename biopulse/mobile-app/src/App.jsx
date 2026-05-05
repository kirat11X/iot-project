import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { StressProvider } from './context/StressContext';
import { useStress } from './context/useStress';
import { useESP32Data } from './hooks/useESP32Data';
import { useMockData } from './hooks/useMockData';
import { LiveMonitor } from './screens/LiveMonitor';
import { History } from './screens/History';
import { Analysis } from './screens/Analysis';
import { Settings } from './screens/Settings';
import { BottomNav } from './components/BottomNav';
import { SplashScreen } from './components/SplashScreen';

function DataLayer() {
  const { state } = useStress();

  useMockData(state.dataSource === 'mock');
  useESP32Data(state.dataSource === 'live');

  return null;
}

function Pages() {
  const location = useLocation();

  return (
    <div key={location.pathname} className="route-fade-enter">
      <Routes location={location}>
        <Route path="/" element={<LiveMonitor />} />
        <Route path="/history" element={<History />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const [splash, setSplash] = useState(true);

  return (
    <StressProvider>
      <BrowserRouter>
        <DataLayer />
        <div style={{ minHeight: '100dvh', background: '#0c0c1d', color: '#e3e0f8', overflowX: 'hidden', maxWidth: 480, margin: '0 auto' }}>
          {splash
            ? <SplashScreen onComplete={() => setSplash(false)} />
            : (
              <>
                <Pages />
                <BottomNav />
              </>
            )
          }
        </div>
      </BrowserRouter>
    </StressProvider>
  );
}
