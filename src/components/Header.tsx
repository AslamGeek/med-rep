import React, { useState, useEffect } from 'react';
import { Sun, Moon, Stethoscope, RefreshCw } from 'lucide-react';
import { syncEngine } from '../sync/syncEngine';
import { useToast } from './Toast';

interface HeaderProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  hidden?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  onToggleTheme,
  hidden = false,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const unsub = syncEngine.subscribe(info => {
      setIsSyncing(info.state === 'syncing');
    });
    return () => unsub();
  }, []);

  const handleManualSync = async () => {
    const result = await syncEngine.syncNow();
    showToast(result.message, result.success ? 'success' : 'error');
  };

  return (
    <header className={`app-header ${hidden ? 'header-hidden' : ''}`} aria-hidden={hidden}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--accent-primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px var(--accent-glow)',
          }}
        >
          <Stethoscope size={18} />
        </div>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '-0.02em', lineHeight: 1.1 }}>MedRep</h1>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          className="btn btn-ghost btn-icon"
          onClick={handleManualSync}
          disabled={isSyncing}
          title="Sync Now"
          aria-label="Sync Now"
          style={{ width: '36px', height: '36px' }}
        >
          <RefreshCw
            size={17}
            style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }}
          />
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Theme"
          style={{ width: '36px', height: '36px' }}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  );
};
