import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  Plus,
  Bookmark,
  X,
  MapPin,
  Building2,
  Pill,
  Calendar,
  Check,
} from 'lucide-react';
import type { Doctor, SettingItem, Product, Camp, Area, SavedFilterPreset } from '../types';
import {
  getDoctors,
  getSettingValues,
  getProducts,
  getCamps,
  getAreas,
  getSavedPresets,
  savePreset,
  deletePreset,
} from '../db/repository';
import { DoctorFormModal } from './DoctorFormModal';
import { DoctorDetailModal } from './DoctorDetailModal';
import { useToast } from '../components/Toast';

interface DoctorDirectoryProps {
  onSelectDoctorForVisit?: (doctor: Doctor) => void;
  isFilterDrawerOpenExternal?: boolean;
  onCloseExternalFilterDrawer?: () => void;
}

export const DoctorDirectory: React.FC<DoctorDirectoryProps> = ({
  onSelectDoctorForVisit,
  isFilterDrawerOpenExternal,
  onCloseExternalFilterDrawer,
}) => {
  const { showToast } = useToast();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Active Multi-Select Filters
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedCamps, setSelectedCamps] = useState<string[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedCallSchedules, setSelectedCallSchedules] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedPrescribers, setSelectedPrescribers] = useState<string[]>([]);

  // Filter Drawer & Preset Dialog State
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isSavePresetModalOpen, setIsSavePresetModalOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState<SavedFilterPreset[]>([]);

  // Modals for Add/Edit and Details
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [selectedDoctorForDetails, setSelectedDoctorForDetails] = useState<Doctor | null>(null);

  // Master options for filters
  const [areas, setAreas] = useState<Area[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [specialties, setSpecialties] = useState<SettingItem[]>([]);
  const [callSchedules, setCallSchedules] = useState<SettingItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [prescribers, setPrescribers] = useState<SettingItem[]>([]);

  // Sync external open state if provided from header search icon
  useEffect(() => {
    if (isFilterDrawerOpenExternal) {
      setIsFilterDrawerOpen(true);
    }
  }, [isFilterDrawerOpenExternal]);

  const handleCloseFilterDrawer = () => {
    setIsFilterDrawerOpen(false);
    if (onCloseExternalFilterDrawer) {
      onCloseExternalFilterDrawer();
    }
  };

  // Helper for Rx determination
  const isDoctorRx = (doc: Doctor): boolean => {
    if (!doc.prescriber) return false;
    const p = doc.prescriber.toUpperCase();
    return (
      doc.prescriber === 'Rx' ||
      (p.includes('RX') && !p.includes('NRX') && !doc.prescriber.toLowerCase().includes('non'))
    );
  };

  // Load all doctors & filter options
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [docs, ars, cmps, specs, cs, prods, pres, presets] = await Promise.all([
        getDoctors(),
        getAreas(),
        getCamps(),
        getSettingValues('Specialty'),
        getSettingValues('Call Schedule'),
        getProducts(),
        getSettingValues('Prescriber'),
        getSavedPresets(),
      ]);

      setDoctors(docs);
      setAreas(ars);
      setCamps(cmps);
      setSpecialties(specs);
      setCallSchedules(cs);
      setProducts(prods);
      setPrescribers(pres);
      setSavedPresets(presets);
    } catch (err: any) {
      console.error(err);
      showToast('Error loading doctors: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Combined Multi-Filter Logic
  const filteredDoctors = useMemo(() => {
    return doctors.filter(doc => {
      // Area filter
      if (selectedAreas.length > 0 && !selectedAreas.includes(doc.area)) return false;
      // Camp filter
      if (selectedCamps.length > 0 && !selectedCamps.includes(doc.camp)) return false;
      // Specialty filter (matches if doctor has any of selected specialties)
      if (
        selectedSpecialties.length > 0 &&
        !doc.specialties.some(s => selectedSpecialties.includes(s))
      ) {
        return false;
      }
      // Call Schedule filter
      if (selectedCallSchedules.length > 0 && !selectedCallSchedules.includes(doc.call_schedule)) {
        return false;
      }
      // Product filter (matches if doctor prescribes any of selected products)
      if (
        selectedProducts.length > 0 &&
        !doc.prescribing_products.some(p => selectedProducts.includes(p))
      ) {
        return false;
      }
      // Prescriber filter
      if (selectedPrescribers.length > 0 && !selectedPrescribers.includes(doc.prescriber)) {
        return false;
      }

      // Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = doc.name.toLowerCase().includes(q);
        const matchHospital = doc.hospital?.toLowerCase().includes(q) || false;
        const matchPharmacy = doc.pharmacy?.toLowerCase().includes(q) || false;
        const matchArea = doc.area.toLowerCase().includes(q);
        const matchCamp = doc.camp.toLowerCase().includes(q);
        const matchSpecialty = doc.specialties.some(s => s.toLowerCase().includes(q));
        const matchProduct = doc.prescribing_products.some(p => p.toLowerCase().includes(q));

        if (
          !matchName &&
          !matchHospital &&
          !matchPharmacy &&
          !matchArea &&
          !matchCamp &&
          !matchSpecialty &&
          !matchProduct
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    doctors,
    selectedAreas,
    selectedCamps,
    selectedSpecialties,
    selectedCallSchedules,
    selectedProducts,
    selectedPrescribers,
    searchQuery,
  ]);

  const activeFilterCount = useMemo(() => {
    return (
      selectedAreas.length +
      selectedCamps.length +
      selectedSpecialties.length +
      selectedCallSchedules.length +
      selectedProducts.length +
      selectedPrescribers.length
    );
  }, [
    selectedAreas,
    selectedCamps,
    selectedSpecialties,
    selectedCallSchedules,
    selectedProducts,
    selectedPrescribers,
  ]);

  const clearAllFilters = () => {
    setSelectedAreas([]);
    setSelectedCamps([]);
    setSelectedSpecialties([]);
    setSelectedCallSchedules([]);
    setSelectedProducts([]);
    setSelectedPrescribers([]);
    setSearchQuery('');
  };

  // Toggle helper for multi-select arrays
  const toggleItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  // Apply a saved preset
  const applyPreset = (preset: SavedFilterPreset) => {
    const f = preset.filters;
    if (f.areas) setSelectedAreas(f.areas);
    else if (f.area) setSelectedAreas([f.area]);
    else setSelectedAreas([]);

    if (f.camps) setSelectedCamps(f.camps);
    else if (f.camp) setSelectedCamps([f.camp]);
    else setSelectedCamps([]);

    if (f.specialties) setSelectedSpecialties(f.specialties);
    else if (f.specialty) setSelectedSpecialties([f.specialty]);
    else setSelectedSpecialties([]);

    if (f.call_schedules) setSelectedCallSchedules(f.call_schedules);
    else if (f.call_schedule) setSelectedCallSchedules([f.call_schedule]);
    else setSelectedCallSchedules([]);

    if (f.products) setSelectedProducts(f.products);
    else if (f.product) setSelectedProducts([f.product]);
    else setSelectedProducts([]);

    if (f.prescribers) setSelectedPrescribers(f.prescribers);
    else if (f.prescriber) setSelectedPrescribers([f.prescriber]);
    else setSelectedPrescribers([]);

    if (f.search) setSearchQuery(f.search);
    showToast(`Applied preset: ${preset.name}`, 'info');
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    try {
      const preset = await savePreset(newPresetName, {
        areas: selectedAreas.length > 0 ? selectedAreas : undefined,
        camps: selectedCamps.length > 0 ? selectedCamps : undefined,
        specialties: selectedSpecialties.length > 0 ? selectedSpecialties : undefined,
        call_schedules: selectedCallSchedules.length > 0 ? selectedCallSchedules : undefined,
        products: selectedProducts.length > 0 ? selectedProducts : undefined,
        prescribers: selectedPrescribers.length > 0 ? selectedPrescribers : undefined,
        search: searchQuery || undefined,
      });

      setSavedPresets(prev => [...prev, preset]);
      setNewPresetName('');
      setIsSavePresetModalOpen(false);
      showToast('Filter preset saved', 'success');
    } catch (err: any) {
      showToast('Failed to save preset: ' + err.message, 'error');
    }
  };

  const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deletePreset(id);
      setSavedPresets(prev => prev.filter(p => p.id !== id));
      showToast('Preset deleted', 'info');
    } catch (err: any) {
      showToast('Error deleting preset', 'error');
    }
  };

  return (
    <div className="main-content">
      {/* Top Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.02em' }}>Doctor Directory</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {filteredDoctors.length} {filteredDoctors.length === 1 ? 'doctor' : 'doctors'} found
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingDoctor(null);
            setIsFormOpen(true);
          }}
          style={{ padding: '8px 14px' }}
        >
          <Plus size={16} />
          <span>Add Doctor</span>
        </button>
      </div>

      {/* Search Bar & Filter Button */}
      <div className="search-wrapper">
        <Search size={17} className="search-icon" />
        <input
          type="text"
          className="search-input"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filter Quick Pills & Presets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '8px' }}>
        <button
          className={`btn ${activeFilterCount > 0 ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setIsFilterDrawerOpen(true)}
          style={{ minHeight: '36px', padding: '6px 12px', fontSize: '12px', flexShrink: 0 }}
        >
          <Filter size={14} />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span
              style={{
                background: '#ffffff',
                color: 'var(--accent-primary)',
                borderRadius: '9999px',
                padding: '0 5px',
                fontSize: '10px',
                fontWeight: '700',
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <>
            <button
              className="btn btn-ghost"
              onClick={clearAllFilters}
              style={{ minHeight: '36px', padding: '6px 10px', fontSize: '12px', flexShrink: 0 }}
            >
              <X size={13} />
              <span>Clear</span>
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setIsSavePresetModalOpen(true)}
              style={{ minHeight: '36px', padding: '6px 10px', fontSize: '12px', flexShrink: 0 }}
            >
              <Bookmark size={13} />
              <span>Save Preset</span>
            </button>
          </>
        )}

        {/* Saved Presets Pills */}
        {savedPresets.map(preset => (
          <div
            key={preset.id}
            onClick={() => applyPreset(preset)}
            className="pill-item"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              fontSize: '11px',
              padding: '5px 10px',
            }}
          >
            <Bookmark size={11} color="var(--accent-text)" />
            <span>{preset.name}</span>
            <button
              onClick={e => handleDeletePreset(preset.id, e)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 2px' }}
              aria-label="Delete preset"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* Active Filter Badges */}
      {activeFilterCount > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {selectedAreas.map(a => (
            <span key={a} className="badge badge-primary">
              Area: {a} <X size={11} style={{ cursor: 'pointer' }} onClick={() => toggleItem(selectedAreas, setSelectedAreas, a)} />
            </span>
          ))}
          {selectedCamps.map(c => (
            <span key={c} className="badge badge-primary">
              Camp: {c} <X size={11} style={{ cursor: 'pointer' }} onClick={() => toggleItem(selectedCamps, setSelectedCamps, c)} />
            </span>
          ))}
          {selectedSpecialties.map(s => (
            <span key={s} className="badge badge-primary">
              Specialty: {s} <X size={11} style={{ cursor: 'pointer' }} onClick={() => toggleItem(selectedSpecialties, setSelectedSpecialties, s)} />
            </span>
          ))}
          {selectedPrescribers.map(p => (
            <span key={p} className="badge badge-primary">
              Prescriber: {p} <X size={11} style={{ cursor: 'pointer' }} onClick={() => toggleItem(selectedPrescribers, setSelectedPrescribers, p)} />
            </span>
          ))}
          {selectedProducts.map(pr => (
            <span key={pr} className="badge badge-primary">
              Product: {pr} <X size={11} style={{ cursor: 'pointer' }} onClick={() => toggleItem(selectedProducts, setSelectedProducts, pr)} />
            </span>
          ))}
          {selectedCallSchedules.map(cs => (
            <span key={cs} className="badge badge-primary">
              Schedule: {cs} <X size={11} style={{ cursor: 'pointer' }} onClick={() => toggleItem(selectedCallSchedules, setSelectedCallSchedules, cs)} />
            </span>
          ))}
        </div>
      )}

      {/* Doctors List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '14px' }}>Loading doctors...</p>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div
          className="card"
          style={{ textAlign: 'center', padding: '36px 16px', background: 'var(--bg-secondary)', marginTop: '8px' }}
        >
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
            <Search size={24} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>No doctors found</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {doctors.length === 0
              ? 'No doctors registered yet. Add your first doctor to get started.'
              : 'Try clearing your filters or search keywords.'}
          </p>
          {doctors.length === 0 ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingDoctor(null);
                setIsFormOpen(true);
              }}
            >
              <Plus size={16} />
              <span>Add First Doctor</span>
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={clearAllFilters}>
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredDoctors.map(doc => {
            const rx = isDoctorRx(doc);

            return (
              <div
                key={doc.id}
                className={`card ${rx ? 'card-rx-highlight' : ''}`}
                onClick={() => setSelectedDoctorForDetails(doc)}
                style={{
                  cursor: 'pointer',
                  margin: 0,
                  borderLeft: rx ? '4px solid var(--accent-primary)' : '1px solid var(--border-card)',
                  background: rx ? 'var(--bg-card-rx)' : 'var(--bg-card-solid)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                  <div>
                    <h3 className="card-title">{doc.name}</h3>
                    <p style={{ fontSize: '12px', color: 'var(--accent-text)', fontWeight: '500' }}>
                      {doc.specialties.join(', ')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <span className="badge badge-success" style={{ fontSize: '10px' }}>
                      {doc.potential}
                    </span>
                    <span
                      className={`badge ${rx ? 'badge-primary' : 'badge-neutral'}`}
                      style={{ fontSize: '10px', fontWeight: rx ? '700' : '500' }}
                    >
                      {doc.prescriber}
                    </span>
                  </div>
                </div>

                {/* Location & Pharmacy */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <MapPin size={12} color="var(--text-muted)" />
                    <strong>{doc.camp}</strong> {doc.area ? `(${doc.area})` : ''}
                  </span>

                  {doc.hospital && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Building2 size={12} color="var(--text-muted)" />
                      {doc.hospital}
                    </span>
                  )}

                  {doc.pharmacy && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Pill size={12} color="var(--text-muted)" />
                      {doc.pharmacy}
                    </span>
                  )}
                </div>

                {/* Prescribing Products (Display directly on card only for Rx doctors) */}
                {rx && doc.prescribing_products && doc.prescribing_products.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px', paddingTop: '4px' }}>
                    {doc.prescribing_products.map((prod, i) => (
                      <span
                        key={i}
                        className="badge badge-primary"
                        style={{ fontSize: '10px', padding: '2px 6px' }}
                      >
                        {prod}
                      </span>
                    ))}
                  </div>
                )}

                {/* Schedule info */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Calendar size={12} />
                    <span>Call: {doc.call_schedule_custom || doc.call_schedule}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MULTI-SELECT FILTER DRAWER MODAL */}
      {isFilterDrawerOpen && (
        <div className="modal-backdrop" onClick={handleCloseFilterDrawer}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '88vh' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Filter Doctors</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Multi-select filters (Tap items to toggle)
                </p>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={handleCloseFilterDrawer}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Prescriber Category */}
              <div>
                <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                  Prescriber Status
                </label>
                <div className="pill-grid">
                  {prescribers.map(p => {
                    const isSelected = selectedPrescribers.includes(p.value);
                    return (
                      <button
                        key={p.value}
                        type="button"
                        className={`pill-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleItem(selectedPrescribers, setSelectedPrescribers, p.value)}
                      >
                        {p.value}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Specialty Filter */}
              <div>
                <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                  Specialty
                </label>
                <div className="pill-grid">
                  {specialties.map(s => {
                    const isSelected = selectedSpecialties.includes(s.value);
                    return (
                      <button
                        key={s.value}
                        type="button"
                        className={`pill-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleItem(selectedSpecialties, setSelectedSpecialties, s.value)}
                      >
                        {s.value}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Camp Filter */}
              <div>
                <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                  Camp
                </label>
                <div className="pill-grid">
                  {camps.map(c => {
                    const isSelected = selectedCamps.includes(c.name);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`pill-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleItem(selectedCamps, setSelectedCamps, c.name)}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Area Filter */}
              <div>
                <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                  Area
                </label>
                <div className="pill-grid">
                  {areas.map(a => {
                    const isSelected = selectedAreas.includes(a.name);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={`pill-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleItem(selectedAreas, setSelectedAreas, a.name)}
                      >
                        {a.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Product Filter */}
              <div>
                <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                  Prescribing Product
                </label>
                <div className="pill-grid">
                  {products.map(pr => {
                    const isSelected = selectedProducts.includes(pr.name);
                    return (
                      <button
                        key={pr.id}
                        type="button"
                        className={`pill-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleItem(selectedProducts, setSelectedProducts, pr.name)}
                      >
                        {pr.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Call Schedule Filter */}
              <div>
                <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                  Call Schedule
                </label>
                <div className="pill-grid">
                  {callSchedules.map(cs => {
                    const isSelected = selectedCallSchedules.includes(cs.value);
                    return (
                      <button
                        key={cs.value}
                        type="button"
                        className={`pill-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleItem(selectedCallSchedules, setSelectedCallSchedules, cs.value)}
                      >
                        {cs.value}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearAllFilters}
                style={{ flex: 1 }}
              >
                Clear All
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCloseFilterDrawer}
                style={{ flex: 2 }}
              >
                <Check size={16} />
                <span>Apply Filters ({activeFilterCount})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE PRESET MODAL */}
      {isSavePresetModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsSavePresetModalOpen(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Save Filter Preset</h3>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setIsSavePresetModalOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePreset} className="modal-body">
              <div className="form-group">
                <label className="form-label">Preset Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {activeFilterCount > 0
                  ? `Saves ${activeFilterCount} active filter selections`
                  : 'No active filters selected'}
              </div>
            </form>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsSavePresetModalOpen(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSavePreset}
                disabled={!newPresetName.trim()}
                className="btn btn-primary"
                style={{ flex: 2 }}
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT DOCTOR MODAL */}
      <DoctorFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingDoctor(null);
        }}
        doctorToEdit={editingDoctor}
        onSaved={savedDoc => {
          setDoctors(prev => {
            const index = prev.findIndex(d => d.id === savedDoc.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = savedDoc;
              return updated;
            }
            return [savedDoc, ...prev];
          });
        }}
      />

      {/* DOCTOR DETAILS MODAL */}
      <DoctorDetailModal
        doctor={selectedDoctorForDetails}
        isOpen={!!selectedDoctorForDetails}
        onClose={() => setSelectedDoctorForDetails(null)}
        onEdit={doc => {
          setSelectedDoctorForDetails(null);
          setEditingDoctor(doc);
          setIsFormOpen(true);
        }}
        onLogVisit={doc => {
          setSelectedDoctorForDetails(null);
          if (onSelectDoctorForVisit) {
            onSelectDoctorForVisit(doc);
          }
        }}
      />
    </div>
  );
};
