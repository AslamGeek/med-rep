import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  MapPin,
  Search,
  CheckSquare,
  Square,
  Clock,
  X,
  ChevronUp,
  ChevronDown,
  Send,
  Building2,
} from 'lucide-react';
import type { Camp, Pharmacy, VisitTag } from '../types';
import {
  getCamps,
  getPharmacies,
  getDoctorsWithVisitMeta,
  createVisitBundle,
  formatDateDDMMYYYY,
  type DoctorWithVisitMeta,
} from '../db/repository';
import { useToast } from '../components/Toast';

interface VisitLoggerProps {
  onVisitLoggedSuccessfully: (bundleId: string) => void;
  preSelectedDoctorId?: string | null;
}

export const VisitLogger: React.FC<VisitLoggerProps> = ({
  onVisitLoggedSuccessfully,
  preSelectedDoctorId,
}) => {
  const { showToast } = useToast();

  // Helper to check if date is Sunday
  const checkIsSunday = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getDay() === 0;
  };

  // Date setup: YYYY-MM-DD for today
  const todayISO = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Form Controls
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [selectedCamp, setSelectedCamp] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<VisitTag>(() => {
    return checkIsSunday(todayISO) ? 'sunday' : 'normal';
  });

  // Master Data
  const [camps, setCamps] = useState<Camp[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [doctors, setDoctors] = useState<DoctorWithVisitMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // In-camp search query
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Doctor IDs for visit bundle
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<Set<string>>(new Set());

  // Live Preview drawer state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-detect Sunday on date changes
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    if (checkIsSunday(newDate)) {
      setSelectedTag('sunday');
      setSelectedDoctorIds(new Set());
    } else if (selectedTag === 'sunday') {
      setSelectedTag('normal');
    }
  };

  const isSunday = selectedTag === 'sunday' || checkIsSunday(selectedDate);
  const isLeave = selectedTag === 'leave';
  const isRestricted = isSunday || isLeave;

  // Load Camps
  useEffect(() => {
    async function loadCamps() {
      const campList = await getCamps();
      setCamps(campList);
      if (campList.length > 0 && !selectedCamp) {
        setSelectedCamp(campList[0].name);
      }
    }
    loadCamps();
  }, []);

  // Load Doctors and Pharmacies for the selected camp
  const loadCampData = useCallback(async () => {
    if (!selectedCamp) return;
    setIsLoading(true);
    try {
      const [docs, phs] = await Promise.all([
        getDoctorsWithVisitMeta(selectedCamp),
        getPharmacies(selectedCamp),
      ]);
      setDoctors(docs);
      setPharmacies(phs);

      // Handle preselected doctor if passed
      if (preSelectedDoctorId) {
        const matchingDoc = docs.find(d => d.id === preSelectedDoctorId);
        if (matchingDoc) {
          setSelectedDoctorIds(new Set([matchingDoc.id]));
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error loading camp doctors: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCamp, preSelectedDoctorId, showToast]);

  useEffect(() => {
    loadCampData();
  }, [loadCampData]);

  // Filtered doctors for in-camp search
  const filteredDoctors = useMemo(() => {
    if (!searchQuery.trim()) return doctors;
    const q = searchQuery.toLowerCase().trim();
    return doctors.filter(d => {
      return (
        d.name.toLowerCase().includes(q) ||
        d.specialties.some(s => s.toLowerCase().includes(q)) ||
        (d.pharmacy && d.pharmacy.toLowerCase().includes(q)) ||
        (d.hospital && d.hospital.toLowerCase().includes(q))
      );
    });
  }, [doctors, searchQuery]);

  // Toggle Doctor selection
  const toggleDoctor = (id: string) => {
    if (isRestricted) return;
    setSelectedDoctorIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select All / Clear All
  const handleSelectAll = () => {
    if (isRestricted) return;
    setSelectedDoctorIds(new Set(filteredDoctors.map(d => d.id)));
  };

  const handleClearAll = () => {
    setSelectedDoctorIds(new Set());
  };

  // One-tap quick tag toggler
  const handleTagToggle = (tag: VisitTag) => {
    if (tag === 'sunday') {
      // Sunday is governed by date, but if toggled, enforce restrictions
      setSelectedTag(prev => (prev === 'sunday' ? 'normal' : 'sunday'));
      setSelectedDoctorIds(new Set());
    } else if (tag === 'leave') {
      setSelectedTag(prev => (prev === 'leave' ? 'normal' : 'leave'));
      setSelectedDoctorIds(new Set());
    } else {
      setSelectedTag(prev => (prev === tag ? 'normal' : tag));
    }
  };

  // Selected doctors list for preview & deriving linked pharmacies
  const selectedDoctorsList = useMemo(() => {
    return doctors.filter(d => selectedDoctorIds.has(d.id));
  }, [doctors, selectedDoctorIds]);

  // Automatically derive linked pharmacies from selected doctors (unique)
  const derivedPharmacies = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    selectedDoctorsList.forEach(doc => {
      if (doc.pharmacy && doc.pharmacy.trim()) {
        const phName = doc.pharmacy.trim();
        const key = phName.toLowerCase();
        if (!map.has(key)) {
          const matched = pharmacies.find(p => p.name.toLowerCase() === key);
          map.set(key, {
            id: matched?.id || `ph_${key.replace(/[^a-z0-9]/g, '_')}`,
            name: matched?.name || phName,
          });
        }
      }
    });
    return Array.from(map.values());
  }, [selectedDoctorsList, pharmacies]);

  // Save the entire visit bundle
  const handleSaveVisitBundle = async () => {
    if (!selectedCamp) {
      showToast('Please select a camp', 'error');
      return;
    }

    if (selectedDate < todayISO) {
      showToast('Date cannot be in the past', 'error');
      return;
    }

    if (isRestricted) {
      // For Sunday or Leave, save empty visit day bundle
      setIsSaving(true);
      try {
        const bundle = await createVisitBundle({
          date: selectedDate,
          camp: selectedCamp,
          tag: selectedTag,
          doctorIds: [],
          pharmacyIds: [],
        });

        showToast(
          `Logged ${selectedTag.toUpperCase()} for ${selectedCamp}`,
          'success'
        );

        setSelectedDoctorIds(new Set());
        setIsPreviewOpen(false);
        onVisitLoggedSuccessfully(bundle.id);
      } catch (err: any) {
        showToast('Error saving bundle: ' + err.message, 'error');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (selectedDoctorIds.size === 0 && selectedTag === 'normal') {
      showToast('Please select at least one doctor to log a visit', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const bundle = await createVisitBundle({
        date: selectedDate,
        camp: selectedCamp,
        tag: selectedTag,
        doctorIds: Array.from(selectedDoctorIds),
        pharmacyIds: derivedPharmacies.map(p => p.id),
      });

      showToast(
        `Bundle saved: ${bundle.doctor_count} doctors · ${bundle.pharmacy_count} linked pharmacies`,
        'success'
      );

      // Reset selection
      setSelectedDoctorIds(new Set());
      setIsPreviewOpen(false);
      setSelectedTag('normal');

      // Reload metadata so days since last visit updates immediately
      loadCampData();

      onVisitLoggedSuccessfully(bundle.id);
    } catch (err: any) {
      showToast('Error saving visit bundle: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="main-content" style={{ paddingBottom: '140px' }}>
      {/* 1. TOP CONTROLS: CAMP, DATE & ONE-TAP TAGS */}
      <div className="card" style={{ marginBottom: '14px', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', marginBottom: '12px' }}>
          {/* Camp Selector */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} color="var(--accent-text)" /> Camp
            </label>
            <select
              className="form-select"
              value={selectedCamp}
              onChange={e => {
                setSelectedCamp(e.target.value);
                setSelectedDoctorIds(new Set());
              }}
            >
              {camps.map(c => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector (Today & Future Only) */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} color="var(--accent-text)" /> Date
            </label>
            <input
              type="date"
              className="form-input"
              value={selectedDate}
              min={todayISO}
              onChange={e => handleDateChange(e.target.value)}
            />
          </div>
        </div>

        {/* One-Tap Quick Tags (Sunday, Holiday, Leave) */}
        <div>
          <span className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '11px' }}>
            Day Type
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className={`pill-item ${selectedTag === 'sunday' ? 'selected' : ''}`}
              onClick={() => handleTagToggle('sunday')}
              style={{ flex: 1, textAlign: 'center', padding: '6px 4px' }}
            >
              Sunday
            </button>
            <button
              type="button"
              className={`pill-item ${selectedTag === 'holiday' ? 'selected' : ''}`}
              onClick={() => handleTagToggle('holiday')}
              style={{ flex: 1, textAlign: 'center', padding: '6px 4px' }}
            >
              Holiday
            </button>
            <button
              type="button"
              className={`pill-item ${selectedTag === 'leave' ? 'selected' : ''}`}
              onClick={() => handleTagToggle('leave')}
              style={{ flex: 1, textAlign: 'center', padding: '6px 4px' }}
            >
              Leave
            </button>
          </div>
        </div>
      </div>

      {/* 2. VISIT LOGGING RESTRICTIONS (SUNDAY / LEAVE) OR DOCTOR SELECTION */}
      {isSunday ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '36px 16px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-muted)',
            marginBottom: '14px',
          }}
        >
          <Calendar size={28} style={{ margin: '0 auto 10px', color: 'var(--accent-text)' }} />
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Sunday
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Visit logging is disabled on Sundays.
          </p>
        </div>
      ) : isLeave ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '36px 16px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-muted)',
            marginBottom: '14px',
          }}
        >
          <Calendar size={28} style={{ margin: '0 auto 10px', color: 'var(--warning-text)' }} />
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Leave
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Visit logging is disabled during leave.
          </p>
        </div>
      ) : (
        <>
          {/* In-Camp Search Bar */}
          <div className="search-wrapper" style={{ marginBottom: '8px' }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
                <X size={15} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {selectedDoctorIds.size} of {filteredDoctors.length} doctors selected
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="btn btn-ghost"
                onClick={handleSelectAll}
                style={{ minHeight: '32px', padding: '4px 10px', fontSize: '12px' }}
              >
                Select All
              </button>
              <button
                className="btn btn-ghost"
                onClick={handleClearAll}
                style={{ minHeight: '32px', padding: '4px 10px', fontSize: '12px' }}
              >
                Clear All
              </button>
            </div>
          </div>

          {/* DOCTORS CHECKLIST */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
              Loading {selectedCamp} records...
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-muted)' }}>
              No doctors found in <strong>{selectedCamp}</strong>.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredDoctors.map(doc => {
                const isSelected = selectedDoctorIds.has(doc.id);
                const isOverdue = doc.daysSinceLastVisit === null || doc.daysSinceLastVisit >= 14;

                return (
                  <div
                    key={doc.id}
                    className="card"
                    onClick={() => toggleDoctor(doc.id)}
                    style={{
                      cursor: 'pointer',
                      margin: 0,
                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-card)',
                      background: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card-solid)',
                      borderWidth: isSelected ? '1.5px' : '1px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      {/* Checkbox Icon */}
                      <div style={{ color: isSelected ? 'var(--accent-text)' : 'var(--text-muted)', paddingTop: '2px' }}>
                        {isSelected ? <CheckSquare size={22} /> : <Square size={22} />}
                      </div>

                      {/* Doctor Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <h4 className="card-title" style={{ fontSize: '15px' }}>{doc.name}</h4>
                          <span className="badge badge-primary" style={{ fontSize: '10px' }}>
                            {doc.potential}
                          </span>
                        </div>

                        <p style={{ fontSize: '12px', color: 'var(--accent-text)', marginBottom: '4px' }}>
                          {doc.specialties.join(', ')}
                        </p>

                        {doc.pharmacy && (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Attached Pharmacy: <strong>{doc.pharmacy}</strong>
                          </p>
                        )}

                        {/* Last Visited & Days Elapsed */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={11} color="var(--text-muted)" />
                            Last visited: <strong>{doc.lastVisitedFormatted}</strong>
                          </span>
                          <span>·</span>
                          <span
                            style={{
                              color: isOverdue ? 'var(--warning-text)' : 'var(--success-text)',
                              fontWeight: '600',
                            }}
                          >
                            {doc.daysSinceFormatted}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 3. LIVE SELECTION PREVIEW BAR & DRAWER */}
      <div className="live-preview-bar">
        {/* Collapsed Bar / Summary */}
        <div
          style={{
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)',
          }}
        >
          <div
            onClick={() => setIsPreviewOpen(!isPreviewOpen)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--accent-glow)',
                color: 'var(--accent-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {isRestricted ? 0 : selectedDoctorIds.size}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600' }}>
                <span>{selectedCamp || 'Select Camp'}</span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {formatDateDDMMYYYY(selectedDate)}
                </span>
                {selectedTag !== 'normal' && (
                  <span className="badge badge-warning" style={{ textTransform: 'capitalize', fontSize: '10px' }}>
                    {selectedTag}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {isRestricted
                  ? `${selectedTag.toUpperCase()} selected`
                  : `${selectedDoctorIds.size} doctors · ${derivedPharmacies.length} linked pharmacies`}
              </p>
            </div>

            {isPreviewOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </div>

          {/* Save Button */}
          <button
            className="btn btn-primary"
            onClick={handleSaveVisitBundle}
            disabled={isSaving || (!isRestricted && selectedDoctorIds.size === 0)}
            style={{ minHeight: '38px', padding: '6px 14px', fontSize: '13px' }}
          >
            <Send size={15} />
            <span>{isSaving ? 'Saving...' : 'Save Bundle'}</span>
          </button>
        </div>

        {/* Expanded Preview Drawer */}
        {isPreviewOpen && (
          <div
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '12px 14px',
              background: 'var(--bg-primary)',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Bundle Summary
              </h4>
              <button
                className="btn btn-ghost"
                onClick={() => setIsPreviewOpen(false)}
                style={{ padding: '2px 6px', minHeight: '24px', fontSize: '11px' }}
              >
                Close Preview
              </button>
            </div>

            {isRestricted ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Logging {selectedTag.toUpperCase()} day bundle for {selectedCamp}.
              </p>
            ) : (
              <>
                {/* Selected Doctors List */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-text)', marginBottom: '4px' }}>
                    Selected Doctors ({selectedDoctorsList.length})
                  </div>
                  {selectedDoctorsList.length === 0 ? (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No doctors selected yet</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {selectedDoctorsList.map((doc, idx) => (
                        <div
                          key={doc.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--bg-secondary)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                          }}
                        >
                          <span>
                            <strong>{idx + 1}.</strong> {doc.name}
                            <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
                              ({doc.specialties.join(', ')})
                            </span>
                          </span>
                          <button
                            onClick={() => toggleDoctor(doc.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger-text)', cursor: 'pointer' }}
                            aria-label="Remove doctor from bundle"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Automatically Derived Linked Pharmacies List */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-text)', marginBottom: '4px' }}>
                    Linked Pharmacies ({derivedPharmacies.length})
                  </div>
                  {derivedPharmacies.length === 0 ? (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      No attached pharmacies linked to selected doctors
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {derivedPharmacies.map((ph, idx) => (
                        <div
                          key={ph.id || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--bg-secondary)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Building2 size={13} color="var(--accent-text)" />
                            <strong>{idx + 1}.</strong> {ph.name}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            Auto-linked
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
