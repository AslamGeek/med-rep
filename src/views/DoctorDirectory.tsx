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
}

export const DoctorDirectory: React.FC<DoctorDirectoryProps> = ({
  onSelectDoctorForVisit,
}) => {
  const { showToast } = useToast();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Active Filters
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedCamp, setSelectedCamp] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedCallSchedule, setSelectedCallSchedule] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedPrescriber, setSelectedPrescriber] = useState('');

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

  // Combined Filtering Logic
  const filteredDoctors = useMemo(() => {
    return doctors.filter(doc => {
      // Area filter
      if (selectedArea && doc.area !== selectedArea) return false;
      // Camp filter
      if (selectedCamp && doc.camp !== selectedCamp) return false;
      // Specialty filter
      if (selectedSpecialty && !doc.specialties.includes(selectedSpecialty)) return false;
      // Call Schedule filter
      if (selectedCallSchedule && doc.call_schedule !== selectedCallSchedule) return false;
      // Product filter
      if (selectedProduct && !doc.prescribing_products.includes(selectedProduct)) return false;
      // Prescriber filter
      if (selectedPrescriber && doc.prescriber !== selectedPrescriber) return false;

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

        if (!matchName && !matchHospital && !matchPharmacy && !matchArea && !matchCamp && !matchSpecialty && !matchProduct) {
          return false;
        }
      }

      return true;
    });
  }, [
    doctors,
    selectedArea,
    selectedCamp,
    selectedSpecialty,
    selectedCallSchedule,
    selectedProduct,
    selectedPrescriber,
    searchQuery,
  ]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedArea) count++;
    if (selectedCamp) count++;
    if (selectedSpecialty) count++;
    if (selectedCallSchedule) count++;
    if (selectedProduct) count++;
    if (selectedPrescriber) count++;
    return count;
  }, [
    selectedArea,
    selectedCamp,
    selectedSpecialty,
    selectedCallSchedule,
    selectedProduct,
    selectedPrescriber,
  ]);

  const clearAllFilters = () => {
    setSelectedArea('');
    setSelectedCamp('');
    setSelectedSpecialty('');
    setSelectedCallSchedule('');
    setSelectedProduct('');
    setSelectedPrescriber('');
    setSearchQuery('');
  };

  // Apply a saved preset
  const applyPreset = (preset: SavedFilterPreset) => {
    setSelectedArea(preset.filters.area || '');
    setSelectedCamp(preset.filters.camp || '');
    setSelectedSpecialty(preset.filters.specialty || '');
    setSelectedCallSchedule(preset.filters.call_schedule || '');
    setSelectedProduct(preset.filters.product || '');
    setSelectedPrescriber(preset.filters.prescriber || '');
    if (preset.filters.search) setSearchQuery(preset.filters.search);
    showToast(`Applied preset: ${preset.name}`, 'info');
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    try {
      const preset = await savePreset(newPresetName, {
        area: selectedArea || undefined,
        camp: selectedCamp || undefined,
        specialty: selectedSpecialty || undefined,
        call_schedule: selectedCallSchedule || undefined,
        product: selectedProduct || undefined,
        prescriber: selectedPrescriber || undefined,
        search: searchQuery || undefined,
      });

      setSavedPresets(prev => [...prev, preset]);
      setNewPresetName('');
      setIsSavePresetModalOpen(false);
      showToast('Filter preset saved!', 'success');
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
          placeholder="Search by doctor, hospital, product, camp..."
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
              title="Save current filters as a quick preset"
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
          {selectedArea && (
            <span className="badge badge-primary">
              Area: {selectedArea} <X size={11} style={{ cursor: 'pointer' }} onClick={() => setSelectedArea('')} />
            </span>
          )}
          {selectedCamp && (
            <span className="badge badge-primary">
              Camp: {selectedCamp} <X size={11} style={{ cursor: 'pointer' }} onClick={() => setSelectedCamp('')} />
            </span>
          )}
          {selectedSpecialty && (
            <span className="badge badge-primary">
              Specialty: {selectedSpecialty} <X size={11} style={{ cursor: 'pointer' }} onClick={() => setSelectedSpecialty('')} />
            </span>
          )}
          {selectedCallSchedule && (
            <span className="badge badge-primary">
              Schedule: {selectedCallSchedule} <X size={11} style={{ cursor: 'pointer' }} onClick={() => setSelectedCallSchedule('')} />
            </span>
          )}
          {selectedProduct && (
            <span className="badge badge-primary">
              Product: {selectedProduct} <X size={11} style={{ cursor: 'pointer' }} onClick={() => setSelectedProduct('')} />
            </span>
          )}
          {selectedPrescriber && (
            <span className="badge badge-primary">
              Prescriber: {selectedPrescriber} <X size={11} style={{ cursor: 'pointer' }} onClick={() => setSelectedPrescriber('')} />
            </span>
          )}
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
          {filteredDoctors.map(doc => (
            <div
              key={doc.id}
              className="card"
              onClick={() => setSelectedDoctorForDetails(doc)}
              style={{ cursor: 'pointer', margin: 0 }}
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
                  <span className="badge badge-warning" style={{ fontSize: '10px' }}>
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

              {/* Prescribing Products & Schedule */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Calendar size={12} />
                  <span>Call: {doc.call_schedule_custom || doc.call_schedule}</span>
                </div>

                {doc.prescribing_products && doc.prescribing_products.length > 0 && (
                  <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                    {doc.prescribing_products.length} Products Tagged
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FILTER DRAWER MODAL */}
      {isFilterDrawerOpen && (
        <div className="modal-backdrop" onClick={() => setIsFilterDrawerOpen(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Filter Doctors</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Combined multi-condition filtering
                </p>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setIsFilterDrawerOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Camp Filter */}
              <div className="form-group">
                <label className="form-label">Camp</label>
                <select
                  className="form-select"
                  value={selectedCamp}
                  onChange={e => setSelectedCamp(e.target.value)}
                >
                  <option value="">All Camps</option>
                  {camps.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Area Filter */}
              <div className="form-group">
                <label className="form-label">Area</label>
                <select
                  className="form-select"
                  value={selectedArea}
                  onChange={e => setSelectedArea(e.target.value)}
                >
                  <option value="">All Areas</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Specialty Filter */}
              <div className="form-group">
                <label className="form-label">Specialty</label>
                <select
                  className="form-select"
                  value={selectedSpecialty}
                  onChange={e => setSelectedSpecialty(e.target.value)}
                >
                  <option value="">All Specialties</option>
                  {specialties.map(s => (
                    <option key={s.value} value={s.value}>
                      {s.value}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prescriber Status Filter */}
              <div className="form-group">
                <label className="form-label">Prescriber Category</label>
                <select
                  className="form-select"
                  value={selectedPrescriber}
                  onChange={e => setSelectedPrescriber(e.target.value)}
                >
                  <option value="">All Prescriber Categories</option>
                  {prescribers.map(p => (
                    <option key={p.value} value={p.value}>
                      {p.value}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Filter */}
              <div className="form-group">
                <label className="form-label">Prescribing Product</label>
                <select
                  className="form-select"
                  value={selectedProduct}
                  onChange={e => setSelectedProduct(e.target.value)}
                >
                  <option value="">All Products</option>
                  {products.map(pr => (
                    <option key={pr.id} value={pr.name}>
                      {pr.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Call Schedule Filter */}
              <div className="form-group">
                <label className="form-label">Call Schedule</label>
                <select
                  className="form-select"
                  value={selectedCallSchedule}
                  onChange={e => setSelectedCallSchedule(e.target.value)}
                >
                  <option value="">All Schedules</option>
                  {callSchedules.map(cs => (
                    <option key={cs.value} value={cs.value}>
                      {cs.value}
                    </option>
                  ))}
                </select>
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
                onClick={() => setIsFilterDrawerOpen(false)}
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
                  placeholder="e.g. Proddatur Core Physicians"
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Saves: {selectedCamp && `Camp: ${selectedCamp}, `}
                {selectedSpecialty && `Specialty: ${selectedSpecialty}, `}
                {selectedPrescriber && `Prescriber: ${selectedPrescriber}, `}
                {selectedProduct && `Product: ${selectedProduct}`}
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
