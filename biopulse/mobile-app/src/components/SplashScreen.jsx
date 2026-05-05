import React, { useEffect, useState } from 'react';
import { BioPulseLogo } from './BioPulseLogo';

export function SplashScreen({ onComplete }) {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const t1 = setTimeout(() => setOpacity(0), 1800);
    const t2 = setTimeout(onComplete, 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#0c0c1d',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16,
      opacity, transition: 'opacity 0.5s ease',
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at center, rgba(108,99,255,0.15) 0%, transparent 70%)',
      }} />
      <div style={{ position: 'relative' }}>
        <BioPulseLogo size="large" />
      </div>
      <p style={{ color: '#918fa1', fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase', marginTop: 16 }}>
        Biometric Intelligence
      </p>
    </div>
  );
}
