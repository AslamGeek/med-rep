import React from 'react';
import { Users, ClipboardCheck, History, SlidersHorizontal } from 'lucide-react';

export type NavTab = 'directory' | 'logger' | 'history' | 'settings';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  pendingCount = 0,
}) => {
  return (
    <nav className="bottom-nav" aria-label="Main Navigation">
      <div className="bottom-nav-inner">
        <button
          className={`nav-item ${activeTab === 'directory' ? 'active' : ''}`}
          onClick={() => onSelectTab('directory')}
          aria-label="Doctor Directory"
        >
          <Users size={20} />
          <span>Directory</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'logger' ? 'active' : ''}`}
          onClick={() => onSelectTab('logger')}
          aria-label="Log Visits"
        >
          <ClipboardCheck size={20} />
          <span>Log Visits</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => onSelectTab('history')}
          aria-label="Visit History"
        >
          <History size={20} />
          <span>History</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
          aria-label="Settings and Synchronization"
        >
          <SlidersHorizontal size={20} />
          <span>Settings</span>
          {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
        </button>
      </div>
    </nav>
  );
};
