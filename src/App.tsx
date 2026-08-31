import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav, type NavTab } from './components/BottomNav';
import { ToastProvider } from './components/Toast';
import { DoctorDirectory } from './views/DoctorDirectory';
import { VisitLogger } from './views/VisitLogger';
import { VisitHistory } from './views/VisitHistory';
import { SettingsView } from './views/SettingsView';
import { initializeDatabase } from './db';
import { syncEngine } from './sync/syncEngine';
import type { Doctor } from './types';

export const App: React.FC = () => {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('medrep_theme') as 'dark' | 'light') || 'dark';
  });

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<NavTab>('directory');
  const [preSelectedDoctorId, setPreSelectedDoctorId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isDbReady, setIsDbReady] = useState(false);

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('medrep_theme', theme);
  }, [theme]);

  // Initialize IndexedDB and sync listeners
  useEffect(() => {
    async function setup() {
      await initializeDatabase();
      setIsDbReady(true);
      // Run background sync check
      syncEngine.checkPendingAndSync();
    }
    setup();

    const unsub = syncEngine.subscribe(info => {
      setPendingCount(info.pendingCount);
    });

    return () => unsub();
  }, []);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleSelectDoctorForVisit = (doctor: Doctor) => {
    setPreSelectedDoctorId(doctor.id);
    setActiveTab('logger');
  };

  const handleVisitLoggedSuccessfully = (_bundleId: string) => {
    setPreSelectedDoctorId(null);
  };

  if (!isDbReady) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
          fontSize: '14px',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Initializing offline storage...
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="app-container">
        <Header theme={theme} onToggleTheme={toggleTheme} />

        <main style={{ flex: 1 }}>
          {activeTab === 'directory' && (
            <DoctorDirectory onSelectDoctorForVisit={handleSelectDoctorForVisit} />
          )}

          {activeTab === 'logger' && (
            <VisitLogger
              onVisitLoggedSuccessfully={handleVisitLoggedSuccessfully}
              preSelectedDoctorId={preSelectedDoctorId}
            />
          )}

          {activeTab === 'history' && <VisitHistory />}

          {activeTab === 'settings' && (
            <SettingsView theme={theme} onToggleTheme={toggleTheme} />
          )}
        </main>

        <BottomNav
          activeTab={activeTab}
          onSelectTab={tab => {
            if (tab !== 'logger') {
              setPreSelectedDoctorId(null);
            }
            setActiveTab(tab);
          }}
          pendingCount={pendingCount}
        />
      </div>
    </ToastProvider>
  );
};
