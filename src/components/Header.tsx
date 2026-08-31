import React, { useState, useEffect } from 'react';
import { RefreshCw, WifiOff, CheckCircle2, AlertTriangle, CloudUpload, Sun, Moon, Stethoscope } from 'lucide-react';
import { syncEngine } from '../sync/syncEngine';
import type { SyncInfo } from '../types';
import { useToast } from './Toast';

interface HeaderProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({ theme, onToggleTheme }) => {
  const [syncInfo, setSyncInfo] = useState<SyncInfo>({
    state: 'synced',
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null,
  });
  const [isRotating, setIsRotating] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe(info => {
      setSyncInfo(info);
    });
    return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
    setIsRotating(true);
    const result = await syncEngine.syncNow();
    setIsRotating(false);

    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, syncInfo.state === 'offline' ? 'info' : 'error');
    }
  };

  const getStatusBadge = () => {
    switch (syncInfo.state) {
      case 'syncing':
        return (
          <span className="badge badge-primary" style={{ cursor: 'pointer' }} onClick={handleManualSync}>
            <RefreshCw size={12} className="spin-animation" />
            <span>Syncing</span>
          </span>
        );
      case 'pending':
        return (
          <span className="badge badge-warning" style={{ cursor: 'pointer' }} onClick={handleManualSync} title="Click to sync now">
            <CloudUpload size={12} />
            <span>{syncInfo.pendingCount} Pending</span>
          </span>
        );
      case 'offline':
        return (
          <span className="badge badge-neutral" style={{ cursor: 'default' }} title="Offline mode - changes saved locally in IndexedDB">
            <WifiOff size={12} />
            <span>Offline</span>
          </span>
        );
      case 'error':
        return (
          <span className="badge badge-danger" style={{ cursor: 'pointer' }} onClick={handleManualSync} title={syncInfo.lastError || 'Sync error - tap to retry'}>
            <AlertTriangle size={12} />
            <span>Sync Error</span>
          </span>
        );
      case 'synced':
      default:
        return (
          <span className="badge badge-success" style={{ cursor: 'pointer' }} onClick={handleManualSync} title="All changes synced">
            <CheckCircle2 size={12} />
            <span>Synced</span>
          </span>
        );
    }
  };

  return (
    <header className="app-header">
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
          }}
        >
          <Stethoscope size={18} />
        </div>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '-0.02em', lineHeight: 1.1 }}>MedRep</h1>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500' }}>FIELD COMPANION</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {getStatusBadge()}

        <button
          className="btn btn-ghost btn-icon"
          onClick={handleManualSync}
          disabled={syncInfo.state === 'syncing'}
          title="Force Sync"
          aria-label="Force Sync"
          style={{ width: '34px', height: '34px' }}
        >
          <RefreshCw size={15} style={{ animation: (isRotating || syncInfo.state === 'syncing') ? 'spin 1s linear infinite' : 'none' }} />
        </button>

        <button
          className="btn btn-ghost btn-icon"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Theme"
          style={{ width: '34px', height: '34px' }}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </header>
  );
};
