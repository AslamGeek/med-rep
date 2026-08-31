import React from 'react';
import { Sun, Moon, Stethoscope } from 'lucide-react';

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
