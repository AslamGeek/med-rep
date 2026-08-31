import React from 'react';
import { Users, ClipboardCheck, SlidersHorizontal } from 'lucide-react';

export type NavTab = 'directory' | 'visits' | 'settings';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  hasPending?: boolean;
  hidden?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  hasPending = false,
  hidden = false,
}) => {
  return (
    <nav className={`bottom-nav ${hidden ? 'bottom-nav-hidden' : ''}`} aria-label="Main Navigation">
      <div className="bottom-nav-inner" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <button
          className={`nav-item ${activeTab === 'directory' ? 'active' : ''}`}
          onClick={() => onSelectTab('directory')}
          aria-label="Doctor Directory"
        >
          <Users size={20} />
          <span>Directory</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'visits' ? 'active' : ''}`}
          onClick={() => onSelectTab('visits')}
          aria-label="Visits"
        >
          <ClipboardCheck size={20} />
          <span>Visits</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
          aria-label="Settings and Synchronization"
        >
          <SlidersHorizontal size={20} />
          <span>Settings</span>
          {hasPending && (
            <span
              className="status-dot"
              style={{
                position: 'absolute',
                top: '10px',
                right: '30%',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--warning-text)',
              }}
            />
          )}
        </button>
      </div>
    </nav>
  );
};
