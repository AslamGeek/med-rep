import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import type { Doctor, SettingItem, Product, Camp, Area, Pharmacy } from '../types';
import {
  getSettingValues,
  getProducts,
  getCamps,
  getAreas,
  getPharmacies,
  saveDoctor,
} from '../db/repository';
import { useToast } from '../components/Toast';

interface DoctorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorToEdit?: Doctor | null;
  onSaved: (doctor: Doctor) => void;
}

export const DoctorFormModal: React.FC<DoctorFormModalProps> = ({
  isOpen,
  onClose,
  doctorToEdit,
  onSaved,
}) => {
  const { showToast } = useToast();

  // Form State - Mandatory Fields
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [camp, setCamp] = useState('');
  const [prescriber, setPrescriber] = useState<'Rx' | 'NRx'>('NRx');
  const [prescribingProducts, setPrescribingProducts] = useState<string[]>([]);

  // Form State - Optional Fields
  const [hospital, setHospital] = useState('');
  const [pharmacy, setPharmacy] = useState('');
  const [area, setArea] = useState('');
  const [potential, setPotential] = useState('');
  const [stockist, setStockist] = useState('');
  const [opTiming, setOpTiming] = useState('');
  const [opTimingCustom, setOpTimingCustom] = useState('');
  const [callSchedule, setCallSchedule] = useState('');
  const [callScheduleCustom, setCallScheduleCustom] = useState('');
  const [notes, setNotes] = useState('');

  // Master Data Options
  const [specialtyOptions, setSpecialtyOptions] = useState<SettingItem[]>([]);
  const [potentialOptions, setPotentialOptions] = useState<SettingItem[]>([]);
  const [stockistOptions, setStockistOptions] = useState<SettingItem[]>([]);
  const [opTimingOptions, setOpTimingOptions] = useState<SettingItem[]>([]);
  const [callScheduleOptions, setCallScheduleOptions] = useState<SettingItem[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allCamps, setAllCamps] = useState<Camp[]>([]);
  const [allAreas, setAllAreas] = useState<Area[]>([]);
  const [allPharmacies, setAllPharmacies] = useState<Pharmacy[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  // Load master data options
  useEffect(() => {
    async function loadOptions() {
      const [spec, pot, stk, op, cs, prods, cmps, ars, phs] = await Promise.all([
        getSettingValues('Specialty'),
        getSettingValues('Potential'),
        getSettingValues('Stockist'),
        getSettingValues('OP Timing'),
        getSettingValues('Call Schedule'),
        getProducts(),
        getCamps(),
        getAreas(),
        getPharmacies(),
      ]);

      setSpecialtyOptions(spec);
      setPotentialOptions(pot);
      setStockistOptions(stk);
      setOpTimingOptions(op);
      setCallScheduleOptions(cs);
      setAllProducts(prods);
      setAllCamps(cmps);
      setAllAreas(ars);
      setAllPharmacies(phs);

      // Set initial defaults for new doctor
      if (!doctorToEdit) {
        if (cmps.length > 0 && !camp) setCamp(cmps[0].name);
        if (ars.length > 0 && !area) setArea(ars[0].name);
        if (pot.length > 0 && !potential) setPotential(pot[0].value);
        if (stk.length > 0 && !stockist) setStockist(stk[0].value);
        if (op.length > 0 && !opTiming) setOpTiming(op[0].value);
        if (cs.length > 0 && !callSchedule) setCallSchedule(cs[0].value);
      }
    }

    if (isOpen) {
      loadOptions();
    }
  }, [isOpen]);

  // Fill form if editing
  useEffect(() => {
    if (doctorToEdit) {
      setName(doctorToEdit.name || '');
      setSpecialties(doctorToEdit.specialties || []);
      setHospital(doctorToEdit.hospital || '');
      setPharmacy(doctorToEdit.pharmacy || '');
      setArea(doctorToEdit.area || '');
      setCamp(doctorToEdit.camp || '');
      setPotential(doctorToEdit.potential || '');
      setStockist(doctorToEdit.stockist || '');
      setPrescriber(doctorToEdit.prescriber === 'Rx' ? 'Rx' : 'NRx');
      setOpTiming(doctorToEdit.op_timing || '');
      setOpTimingCustom(doctorToEdit.op_timing_custom || '');
      setCallSchedule(doctorToEdit.call_schedule || '');
      setCallScheduleCustom(doctorToEdit.call_schedule_custom || '');
      setPrescribingProducts(doctorToEdit.prescribing_products || []);
      setNotes(doctorToEdit.notes || '');
    } else {
      setName('');
      setSpecialties([]);
      setHospital('');
      setPharmacy('');
      setPrescriber('NRx');
      setOpTimingCustom('');
      setCallScheduleCustom('');
      setPrescribingProducts([]);
      setNotes('');
    }
    setNameError('');
  }, [doctorToEdit, isOpen]);

  if (!isOpen) return null;

  // Validation
  const validateName = (val: string): boolean => {
    if (!val.trim()) {
      setNameError('Doctor name is required');
      return false;
    }
    const validNameRegex = /^[A-Za-z\s.'-]+$/;
    if (!validNameRegex.test(val.trim())) {
      setNameError('Name cannot contain numbers or symbols');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (val) validateName(val);
    else setNameError('');
  };

  const toggleSpecialty = (spec: string) => {
    if (specialties.includes(spec)) {
      setSpecialties(specialties.filter(s => s !== spec));
    } else {
      setSpecialties([...specialties, spec]);
    }
  };

  const toggleProduct = (prodName: string) => {
    if (prescribingProducts.includes(prodName)) {
      setPrescribingProducts(prescribingProducts.filter(p => p !== prodName));
    } else {
      setPrescribingProducts([...prescribingProducts, prodName]);
    }
  };

  const handlePrescriberChange = (newVal: 'Rx' | 'NRx') => {
    setPrescriber(newVal);
    if (newVal === 'NRx') {
      setPrescribingProducts([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateName(name)) {
      return;
    }

    if (specialties.length === 0) {
      showToast('Please select at least one specialty', 'error');
      return;
    }

    if (!camp) {
      showToast('Please select a camp', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveDoctor({
        id: doctorToEdit?.id,
        name,
        specialties,
        hospital,
        pharmacy,
        area: area || (allAreas[0]?.name ?? ''),
        camp: camp || (allCamps[0]?.name ?? ''),
        potential: potential || (potentialOptions[0]?.value ?? ''),
        stockist: stockist || (stockistOptions[0]?.value ?? ''),
        prescriber,
        op_timing: opTiming || (opTimingOptions[0]?.value ?? ''),
        op_timing_custom: opTiming.toLowerCase().includes('other') ? opTimingCustom : '',
        call_schedule: callSchedule || (callScheduleOptions[0]?.value ?? ''),
        call_schedule_custom: callSchedule.toLowerCase().includes('other') ? callScheduleCustom : '',
        prescribing_products: prescriber === 'Rx' ? prescribingProducts : [],
        notes,
      });

      showToast(
        doctorToEdit ? `Updated ${saved.name}` : `Added ${saved.name}`,
        'success'
      );
      onSaved(saved);
      onClose();
    } catch (err: any) {
      showToast(`Error saving doctor: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const availableCamps = area
    ? allCamps.filter(c => c.area === area || !c.area)
    : allCamps;

  const availablePharmacies = camp
    ? allPharmacies.filter(p => p.camp === camp)
    : allPharmacies;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '700' }}>
              {doctorToEdit ? 'Edit Doctor' : 'Add New Doctor'}
            </h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form id="doctor-form" onSubmit={handleSubmit} className="modal-body">
          {/* ============================================================== */}
          {/* 1. MANDATORY FIELDS (FIRST FOR QUICK SAVING)                   */}
          {/* ============================================================== */}
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-text)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Required Information
            </h3>

            {/* Doctor Name */}
            <div className="form-group">
              <label className="form-label">
                Doctor Name <span style={{ color: 'var(--danger-text)' }}>*</span>
              </label>
              <input
                type="text"
                className={`form-input ${nameError ? 'is-invalid' : ''}`}
                value={name}
                onChange={handleNameChange}
                placeholder="Dr. Full Name"
                required
                autoComplete="off"
              />
              {nameError && (
                <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={12} />
                  <span>{nameError}</span>
                </div>
              )}
            </div>

            {/* Camp */}
            <div className="form-group">
              <label className="form-label">
                Camp <span style={{ color: 'var(--danger-text)' }}>*</span>
              </label>
              <select
                className="form-select"
                value={camp}
                onChange={e => setCamp(e.target.value)}
                required
              >
                <option value="">Select Camp</option>
                {availableCamps.map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Specialty */}
            <div className="form-group">
              <label className="form-label">
                Specialty <span style={{ color: 'var(--danger-text)' }}>*</span>
              </label>
              <div className="pill-grid">
                {specialtyOptions.map(spec => {
                  const isSelected = specialties.includes(spec.value);
                  return (
                    <button
                      key={spec.value}
                      type="button"
                      className={`pill-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSpecialty(spec.value)}
                    >
                      {spec.value}
                    </button>
                  );
                })}
              </div>
              {specialties.length === 0 && (
                <span className="form-error">Please select at least 1 specialty</span>
              )}
            </div>

            {/* Prescriber: Strictly NRx (Default) or Rx */}
            <div className="form-group">
              <label className="form-label">
                Prescriber Status <span style={{ color: 'var(--danger-text)' }}>*</span>
              </label>
              <div className="pill-grid">
                {(['NRx', 'Rx'] as const).map(p => {
                  const isSelected = prescriber === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`pill-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handlePrescriberChange(p)}
                      style={{ flex: 1, textAlign: 'center', padding: '8px 12px', fontWeight: isSelected ? '700' : '500' }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prescribing Products: Visible ONLY when Prescriber = Rx */}
            {prescriber === 'Rx' && (
              <div className="form-group" style={{ marginTop: '10px' }}>
                <label className="form-label">
                  Prescribing Products (from Products Master)
                </label>
                {allProducts.length === 0 ? (
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No products in catalog</p>
                ) : (
                  <div className="pill-grid">
                    {allProducts.map(prod => {
                      const isSelected = prescribingProducts.includes(prod.name);
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          className={`pill-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleProduct(prod.name)}
                        >
                          {prod.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* 2. OPTIONAL & ADDITIONAL DETAILS                               */}
          {/* ============================================================== */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Optional & Additional Details
            </h3>

            {/* Hospital & Attached Pharmacy */}
            <div className="form-group">
              <label className="form-label">Hospital / Clinic</label>
              <input
                type="text"
                className="form-input"
                value={hospital}
                onChange={e => setHospital(e.target.value)}
                placeholder="Clinic / Hospital name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Attached Pharmacy</label>
              <select
                className="form-select"
                value={pharmacy}
                onChange={e => setPharmacy(e.target.value)}
              >
                <option value="">Select Attached Pharmacy</option>
                {availablePharmacies.map(p => (
                  <option key={p.id} value={p.name}>
                    {p.name} ({p.camp})
                  </option>
                ))}
              </select>
            </div>

            {/* Area, Potential, Stockist */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label">Area</label>
                <select
                  className="form-select"
                  value={area}
                  onChange={e => setArea(e.target.value)}
                >
                  {allAreas.map(a => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Potential</label>
                <select
                  className="form-select"
                  value={potential}
                  onChange={e => setPotential(e.target.value)}
                >
                  {potentialOptions.map(p => (
                    <option key={p.value} value={p.value}>
                      {p.value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Stockist</label>
              <select
                className="form-select"
                value={stockist}
                onChange={e => setStockist(e.target.value)}
              >
                {stockistOptions.map(s => (
                  <option key={s.value} value={s.value}>
                    {s.value}
                  </option>
                ))}
              </select>
            </div>

            {/* OP Timing & Call Schedule */}
            <div className="form-group">
              <label className="form-label">OP Timing</label>
              <select
                className="form-select"
                value={opTiming}
                onChange={e => setOpTiming(e.target.value)}
              >
                {opTimingOptions.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.value}
                  </option>
                ))}
              </select>
            </div>

            {opTiming.toLowerCase().includes('other') && (
              <div className="form-group">
                <label className="form-label">Custom OP Timing</label>
                <input
                  type="text"
                  className="form-input"
                  value={opTimingCustom}
                  onChange={e => setOpTimingCustom(e.target.value)}
                  placeholder="e.g. 11:00 AM - 3:00 PM"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Call Schedule</label>
              <select
                className="form-select"
                value={callSchedule}
                onChange={e => setCallSchedule(e.target.value)}
              >
                {callScheduleOptions.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.value}
                  </option>
                ))}
              </select>
            </div>

            {callSchedule.toLowerCase().includes('other') && (
              <div className="form-group">
                <label className="form-label">Custom Call Schedule</label>
                <input
                  type="text"
                  className="form-input"
                  value={callScheduleCustom}
                  onChange={e => setCallScheduleCustom(e.target.value)}
                  placeholder="e.g. Every Friday"
                />
              </div>
            )}

            {/* Doctor Notes */}
            <div className="form-group">
              <label className="form-label">Doctor Notes</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Preferences, key details, or visit instructions..."
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="doctor-form"
            className="btn btn-primary"
            disabled={isSaving || !!nameError || !name.trim()}
            style={{ flex: 2 }}
          >
            <Check size={18} />
            <span>{isSaving ? 'Saving...' : doctorToEdit ? 'Update Doctor' : 'Save Doctor'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
