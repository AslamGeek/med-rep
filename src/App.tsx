import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav, type NavTab } from './components/BottomNav';
import { ToastProvider } from './components/Toast';
import { DoctorDirectory } from './views/DoctorDirectory';
import { VisitsView } from './views/VisitsView';
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
  const [hasPendingSync, setHasPendingSync] = useState<boolean>(false);
  const [isDbReady, setIsDbReady] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('medrep_theme', theme);
  }, [theme]);

  // Track scroll direction for top header show/hide behavior
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          if (currentScrollY <= 15) {
            // Near the very top: always show header
            setIsHeaderHidden(false);
          } else if (currentScrollY > lastScrollY && currentScrollY - lastScrollY > 8) {
            // Scrolling down: smoothly hide header
            setIsHeaderHidden(true);
          } else if (lastScrollY - currentScrollY > 4) {
            // Scrolling slightly upward: immediately restore header
            setIsHeaderHidden(false);
          }

          lastScrollY = Math.max(0, currentScrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Initialize IndexedDB and sync listeners
  useEffect(() => {
    async function setup() {
      await initializeDatabase();
      setIsDbReady(true);
      // Show cached data immediately (isDbReady above unblocks render),
      // then trigger a full background sync (push pending + pull + reconcile)
      // on every app open — not just when there happen to be pending items.
      syncEngine.syncNow();
    }
    setup();

    const unsub = syncEngine.subscribe(info => {
      setHasPendingSync(info.pendingCount > 0);
    });

    return () => unsub();
  }, []);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleSelectDoctorForVisit = (doctor: Doctor) => {
    setPreSelectedDoctorId(doctor.id);
    setActiveTab('visits');
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
        <Header theme={theme} onToggleTheme={toggleTheme} hidden={isHeaderHidden} />

        <main style={{ flex: 1 }}>
          {activeTab === 'directory' && (
            <DoctorDirectory onSelectDoctorForVisit={handleSelectDoctorForVisit} />
          )}

          {activeTab === 'visits' && (
            <VisitsView
              onVisitLoggedSuccessfully={handleVisitLoggedSuccessfully}
              preSelectedDoctorId={preSelectedDoctorId}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView theme={theme} onToggleTheme={toggleTheme} />
          )}
        </main>

        <BottomNav
          activeTab={activeTab}
          onSelectTab={tab => {
            if (tab !== 'visits') {
              setPreSelectedDoctorId(null);
            }
            setActiveTab(tab);
          }}
          hasPending={hasPendingSync}
        />
      </div>
    </ToastProvider>
  );
};
