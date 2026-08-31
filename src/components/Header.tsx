import React, { useState } from 'react';
import { Search, Sun, Moon, Stethoscope, RefreshCw } from 'lucide-react';
import { syncEngine } from '../sync/syncEngine';
import { useToast } from './Toast';

interface HeaderProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenSearch?: () => void;
  hidden?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  onToggleTheme,
  onOpenSearch,
  hidden = false,
}) => {
  const [isRotating, setIsRotating] = useState(false);
  const { showToast } = useToast();

  const handleManualSync = async () => {
    setIsRotating(true);
    const result = await syncEngine.syncNow();
    setIsRotating(false);

    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  return (
    <header className={`app-header ${hidden ? 'header-hidden' : ''}`}>
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
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {onOpenSearch && (
          <button
            className="btn btn-ghost btn-icon"
            onClick={onOpenSearch}
            title="Search and Filters"
            aria-label="Search and Filters"
            style={{ width: '36px', height: '36px' }}
          >
            <Search size={17} />
          </button>
        )}

        <button
          className="btn btn-ghost btn-icon"
          onClick={handleManualSync}
          disabled={isRotating}
          title="Sync Now"
          aria-label="Sync Now"
          style={{ width: '36px', height: '36px' }}
        >
          <RefreshCw
            size={16}
            style={{ animation: isRotating ? 'spin 1s linear infinite' : 'none' }}
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

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </header>
  );
};
