import React, { useState, useEffect } from 'react';
import { ClipboardCheck, History } from 'lucide-react';
import { VisitLogger } from './VisitLogger';
import { VisitHistory } from './VisitHistory';

interface VisitsViewProps {
  onVisitLoggedSuccessfully: (bundleId: string) => void;
  preSelectedDoctorId?: string | null;
}

export const VisitsView: React.FC<VisitsViewProps> = ({
  onVisitLoggedSuccessfully,
  preSelectedDoctorId,
}) => {
  const [subTab, setSubTab] = useState<'log' | 'history'>('log');

  useEffect(() => {
    if (preSelectedDoctorId) {
      setSubTab('log');
    }
  }, [preSelectedDoctorId]);

  const handleVisitLogged = (bundleId: string) => {
    onVisitLoggedSuccessfully(bundleId);
  };


  return (
    <div>
      {/* Top Segmented Sub-Navigation */}
      <div style={{ padding: '12px 16px 0', maxWidth: '680px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-secondary)',
            borderRadius: '10px',
            padding: '4px',
            border: '1px solid var(--border-card)',
            gap: '4px',
          }}
        >
          <button
            type="button"
            className={`btn ${subTab === 'log' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSubTab('log')}
            style={{
              flex: 1,
              minHeight: '36px',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '8px',
            }}
          >
            <ClipboardCheck size={16} />
            <span>Log Visits</span>
          </button>

          <button
            type="button"
            className={`btn ${subTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSubTab('history')}
            style={{
              flex: 1,
              minHeight: '36px',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '8px',
            }}
          >
            <History size={16} />
            <span>Visit History</span>
          </button>
        </div>
      </div>

      {/* Sub-view Content */}
      {subTab === 'log' ? (
        <VisitLogger
          onVisitLoggedSuccessfully={handleVisitLogged}
          preSelectedDoctorId={preSelectedDoctorId}
        />
      ) : (
        <VisitHistory />
      )}
    </div>
  );
};
