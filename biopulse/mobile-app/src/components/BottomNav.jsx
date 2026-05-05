import React from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, History, BarChart2, Settings } from 'lucide-react';

const tabs = [
  { to: '/', icon: Activity, label: 'Live' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/analysis', icon: BarChart2, label: 'Analysis' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '12px 16px 20px',
      background: 'rgba(12,12,29,0.9)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(70,69,85,0.2)',
      borderRadius: '2rem 2rem 0 0',
      boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
    }}>
      {tabs.map(tab => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} style={{ textDecoration: 'none' }}>
          {({ isActive }) => (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: isActive ? '8px 20px' : '8px 12px',
              borderRadius: 16,
              background: isActive ? '#1e1e2f' : 'transparent',
              boxShadow: isActive ? '0 0 15px rgba(108,99,255,0.2)' : 'none',
              color: isActive ? '#c4c0ff' : '#c7c4d8',
              opacity: isActive ? 1 : 0.6,
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              minWidth: 64,
            }}>
              <tab.icon style={{ width: 20, height: 20, marginBottom: 3 }} />
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'Inter, sans-serif' }}>
                {tab.label}
              </span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
