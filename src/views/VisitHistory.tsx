import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  CheckCircle2,
  CloudUpload,
} from 'lucide-react';
import type { VisitBundle, Camp } from '../types';
import { getVisitBundles, getCamps, formatDateDDMMYYYY } from '../db/repository';
import { useToast } from '../components/Toast';

export const VisitHistory: React.FC = () => {
  const { showToast } = useToast();

  const [bundles, setBundles] = useState<VisitBundle[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedCampFilter, setSelectedCampFilter] = useState('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Set of expanded bundle IDs (lazy accordion expansion)
  const [expandedBundleIds, setExpandedBundleIds] = useState<Set<string>>(new Set());

  // Load bundles and camps
  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const [bundleList, campList] = await Promise.all([
        getVisitBundles(selectedCampFilter, selectedDateFilter),
        getCamps(),
      ]);
      setBundles(bundleList);
      setCamps(campList);
    } catch (err: any) {
      console.error(err);
      showToast('Error loading visit history: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCampFilter, selectedDateFilter, showToast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const toggleExpand = (bundleId: string) => {
    setExpandedBundleIds(prev => {
      const next = new Set(prev);
      if (next.has(bundleId)) {
        next.delete(bundleId);
      } else {
        next.add(bundleId);
      }
      return next;
    });
  };

  // Filtered bundles by search query
  const filteredBundles = useMemo(() => {
    if (!searchQuery.trim()) return bundles;
    const q = searchQuery.toLowerCase().trim();

    return bundles.filter(bundle => {
      const matchCamp = bundle.camp.toLowerCase().includes(q);
      const matchDate = bundle.date.includes(q) || formatDateDDMMYYYY(bundle.date).includes(q);
      const matchDoctor = bundle.doctors_snapshot.some(d =>
        d.name.toLowerCase().includes(q) || (d.specialty && d.specialty.toLowerCase().includes(q))
      );
      const matchPharmacy = bundle.pharmacies_snapshot.some(p =>
        p.name.toLowerCase().includes(q)
      );
      return matchCamp || matchDate || matchDoctor || matchPharmacy;
    });
  }, [bundles, searchQuery]);

  // Format date to friendly title e.g. "31 Aug 2026"
  const formatFriendlyDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return formatDateDDMMYYYY(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="main-content">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.02em' }}>Visit History</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {filteredBundles.length} {filteredBundles.length === 1 ? 'bundle' : 'bundles'} logged
          </p>
        </div>
      </div>

      {/* Filter Controls: Camp & Date */}
      <div className="card" style={{ marginBottom: '12px', padding: '12px', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '10px' }}>Filter by Camp</label>
            <select
              className="form-select"
              style={{ minHeight: '38px', padding: '6px 10px', fontSize: '13px' }}
              value={selectedCampFilter}
              onChange={e => setSelectedCampFilter(e.target.value)}
            >
              <option value="all">All Camps</option>
              {camps.map(c => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '10px' }}>Filter by Date</label>
            <input
              type="date"
              className="form-input"
              style={{ minHeight: '38px', padding: '6px 10px', fontSize: '13px' }}
              value={selectedDateFilter}
              onChange={e => setSelectedDateFilter(e.target.value)}
            />
          </div>
        </div>

        {/* Search within history */}
        <div className="search-wrapper" style={{ margin: 0 }}>
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="search-input"
            style={{ minHeight: '38px', padding: '6px 12px 6px 36px', fontSize: '13px' }}
            placeholder="Search doctors, pharmacies, or camps in history..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        {(selectedCampFilter !== 'all' || selectedDateFilter || searchQuery) && (
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setSelectedCampFilter('all');
                setSelectedDateFilter('');
                setSearchQuery('');
              }}
              style={{ padding: '2px 8px', minHeight: '26px', fontSize: '11px' }}
            >
              <X size={12} /> Clear History Filters
            </button>
          </div>
        )}
      </div>

      {/* History Bundles List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          Loading visit history...
        </div>
      ) : filteredBundles.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px 16px', background: 'var(--bg-secondary)' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <History size={24} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>No visit logs found</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Visits logged in the "Log Visits" tab will appear here grouped by Date and Camp.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredBundles.map(bundle => {
            const isExpanded = expandedBundleIds.has(bundle.id);

            return (
              <div
                key={bundle.id}
                className="card"
                style={{
                  margin: 0,
                  border: '1px solid var(--border-card)',
                  background: 'var(--bg-card-solid)',
                  padding: 0,
                  overflow: 'hidden',
                }}
              >
                {/* Bundle Header Card */}
                <div
                  onClick={() => toggleExpand(bundle.id)}
                  style={{
                    padding: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {formatFriendlyDate(bundle.date)}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>·</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--accent-text)' }}>
                        {bundle.camp}
                      </span>

                      {bundle.tag && bundle.tag !== 'normal' && (
                        <span className="badge badge-warning" style={{ fontSize: '10px', textTransform: 'capitalize' }}>
                          {bundle.tag}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <span>
                        <strong>{bundle.doctor_count}</strong> {bundle.doctor_count === 1 ? 'doctor' : 'doctors'}
                      </span>
                      <span>·</span>
                      <span>
                        <strong>{bundle.pharmacy_count}</strong> {bundle.pharmacy_count === 1 ? 'pharmacy' : 'pharmacies'}
                      </span>
                      <span>·</span>
                      <span style={{ color: 'var(--accent-text)', fontSize: '11px', fontWeight: '600' }}>
                        {isExpanded ? 'Hide details' : 'View details'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {bundle.synced ? (
                      <span title="Synced with Google Sheets" style={{ color: 'var(--success-text)' }}>
                        <CheckCircle2 size={16} />
                      </span>
                    ) : (
                      <span title="Pending sync with Google Sheets" style={{ color: 'var(--warning-text)' }}>
                        <CloudUpload size={16} />
                      </span>
                    )}
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ width: '28px', height: '28px' }}
                      aria-label={isExpanded ? 'Collapse bundle' : 'Expand bundle'}
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Accordion Details */}
                {isExpanded && (
                  <div
                    style={{
                      padding: '12px 14px 14px',
                      background: 'var(--bg-primary)',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    {/* Doctor list in this bundle */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Visited Doctors ({bundle.doctors_snapshot.length})
                      </div>
                      {bundle.doctors_snapshot.length === 0 ? (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No doctors recorded in this bundle.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {bundle.doctors_snapshot.map((doc, idx) => (
                            <div
                              key={doc.id || idx}
                              style={{
                                padding: '6px 10px',
                                background: 'var(--bg-secondary)',
                                borderRadius: '6px',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div>
                                <strong>{idx + 1}. {doc.name}</strong>
                                <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                                  ({doc.specialty || 'General'})
                                </span>
                              </div>
                              {doc.pharmacy && (
                                <span style={{ fontSize: '11px', color: 'var(--accent-text)' }}>
                                  {doc.pharmacy}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pharmacy list in this bundle */}
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Visited Pharmacies ({bundle.pharmacies_snapshot.length})
                      </div>
                      {bundle.pharmacies_snapshot.length === 0 ? (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No pharmacies recorded in this bundle.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {bundle.pharmacies_snapshot.map((ph, idx) => (
                            <div
                              key={ph.id || idx}
                              style={{
                                padding: '6px 10px',
                                background: 'var(--bg-secondary)',
                                borderRadius: '6px',
                                fontSize: '12px',
                              }}
                            >
                              <strong>{idx + 1}. {ph.name}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
