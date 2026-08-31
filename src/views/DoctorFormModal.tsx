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

  // Form State
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [gender, setGender] = useState('Male');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const [hospital, setHospital] = useState('');
  const [pharmacy, setPharmacy] = useState('');
  const [area, setArea] = useState('');
  const [camp, setCamp] = useState('');

  const [potential, setPotential] = useState('');
  const [stockist, setStockist] = useState('');
  const [prescriber, setPrescriber] = useState('');

  const [opTiming, setOpTiming] = useState('');
  const [opTimingCustom, setOpTimingCustom] = useState('');
  const [callSchedule, setCallSchedule] = useState('');
  const [callScheduleCustom, setCallScheduleCustom] = useState('');

  const [prescribingProducts, setPrescribingProducts] = useState<string[]>([]);

  // Master Data Options
  const [specialtyOptions, setSpecialtyOptions] = useState<SettingItem[]>([]);
  const [potentialOptions, setPotentialOptions] = useState<SettingItem[]>([]);
  const [stockistOptions, setStockistOptions] = useState<SettingItem[]>([]);
  const [prescriberOptions, setPrescriberOptions] = useState<SettingItem[]>([]);
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
      const [spec, pot, stk, pres, op, cs, prods, cmps, ars, phs] = await Promise.all([
        getSettingValues('Specialty'),
        getSettingValues('Potential'),
        getSettingValues('Stockist'),
        getSettingValues('Prescriber'),
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
      setPrescriberOptions(pres);
      setOpTimingOptions(op);
      setCallScheduleOptions(cs);
      setAllProducts(prods);
      setAllCamps(cmps);
      setAllAreas(ars);
      setAllPharmacies(phs);

      // Set initial defaults for new doctor
      if (!doctorToEdit) {
        if (ars.length > 0 && !area) setArea(ars[0].name);
        if (cmps.length > 0 && !camp) setCamp(cmps[0].name);
        if (pot.length > 0 && !potential) setPotential(pot[0].value);
        if (stk.length > 0 && !stockist) setStockist(stk[0].value);
        if (pres.length > 0 && !prescriber) setPrescriber(pres[0].value);
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
      setGender(doctorToEdit.gender || 'Male');
      setEmail(doctorToEdit.email || '');
      setHospital(doctorToEdit.hospital || '');
      setPharmacy(doctorToEdit.pharmacy || '');
      setArea(doctorToEdit.area || '');
      setCamp(doctorToEdit.camp || '');
      setPotential(doctorToEdit.potential || '');
      setStockist(doctorToEdit.stockist || '');
      setPrescriber(doctorToEdit.prescriber || '');
      setOpTiming(doctorToEdit.op_timing || '');
      setOpTimingCustom(doctorToEdit.op_timing_custom || '');
      setCallSchedule(doctorToEdit.call_schedule || '');
      setCallScheduleCustom(doctorToEdit.call_schedule_custom || '');
      setPrescribingProducts(doctorToEdit.prescribing_products || []);
      setNotes(doctorToEdit.notes || '');
    } else {
      setName('');
      setSpecialties([]);
      setGender('Male');
      setEmail('');
      setHospital('');
      setPharmacy('');
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
    // Reject numbers and inappropriate special characters (allow letters, dots, hyphens, spaces, apostrophes)
    const validNameRegex = /^[A-Za-z\s.'-]+$/;
    if (!validNameRegex.test(val.trim())) {
      setNameError('Name cannot contain numbers or symbols (e.g. Dr. Ramesh Kumar)');
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
        gender,
        email,
        hospital,
        pharmacy,
        area: area || (allAreas[0]?.name ?? ''),
        camp: camp || (allCamps[0]?.name ?? ''),
        potential: potential || (potentialOptions[0]?.value ?? ''),
        stockist: stockist || (stockistOptions[0]?.value ?? ''),
        prescriber: prescriber || (prescriberOptions[0]?.value ?? ''),
        op_timing: opTiming || (opTimingOptions[0]?.value ?? ''),
        op_timing_custom: opTiming.toLowerCase().includes('other') ? opTimingCustom : '',
        call_schedule: callSchedule || (callScheduleOptions[0]?.value ?? ''),
        call_schedule_custom: callSchedule.toLowerCase().includes('other') ? callScheduleCustom : '',
        prescribing_products: prescribingProducts,
        notes,
      });

      showToast(
        doctorToEdit ? `Updated ${saved.name}` : `Added ${saved.name} (Saved locally)`,
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

  // Filter camps based on area if area selected
  const availableCamps = area
    ? allCamps.filter(c => c.area === area || !c.area)
    : allCamps;

  // Filter pharmacies based on camp if camp selected
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
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Instant offline save · Syncs with Google Sheets
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form id="doctor-form" onSubmit={handleSubmit} className="modal-body">
          {/* 1. BASIC INFORMATION */}
          <div style={{ marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label">
                Doctor Name <span style={{ color: 'var(--danger-text)' }}>*</span>
              </label>
              <input
                type="text"
                className={`form-input ${nameError ? 'is-invalid' : ''}`}
                placeholder="e.g. Dr. Ramesh Kumar"
                value={name}
                onChange={handleNameChange}
                required
                autoComplete="off"
              />
              {nameError ? (
                <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={12} />
                  <span>{nameError}</span>
                </div>
              ) : (
                <span className="form-hint">No numbers or illegal symbols allowed</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                Specialty <span style={{ color: 'var(--danger-text)' }}>*</span> (Tap to select)
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label">Gender (Optional)</label>
                <select
                  className="form-select"
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Email (Optional)</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="doctor@hospital.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 2. LOCATION & PHARMACY */}
          <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-text)', marginBottom: '10px' }}>
              LOCATION & ATTACHMENT
            </h3>

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
            </div>

            <div className="form-group">
              <label className="form-label">Hospital / Clinic</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Government Hospital, Care Clinic"
                value={hospital}
                onChange={e => setHospital(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Attached Pharmacy (From Master Data)</label>
              <select
                className="form-select"
                value={pharmacy}
                onChange={e => setPharmacy(e.target.value)}
              >
                <option value="">Select Attached Pharmacy (Optional)</option>
                {availablePharmacies.map(p => (
                  <option key={p.id} value={p.name}>
                    {p.name} ({p.camp})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. CLASSIFICATION */}
          <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-text)', marginBottom: '10px' }}>
              CLASSIFICATION & VALUE
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
            </div>

            <div className="form-group">
              <label className="form-label">Prescriber Status</label>
              <select
                className="form-select"
                value={prescriber}
                onChange={e => setPrescriber(e.target.value)}
              >
                {prescriberOptions.map(p => (
                  <option key={p.value} value={p.value}>
                    {p.value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. AVAILABILITY & TIMINGS */}
          <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-text)', marginBottom: '10px' }}>
              AVAILABILITY & TIMINGS
            </h3>

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
                  placeholder="e.g. Tuesday & Friday 4 PM - 7 PM"
                  value={opTimingCustom}
                  onChange={e => setOpTimingCustom(e.target.value)}
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
                  placeholder="e.g. 1st and 3rd Saturday"
                  value={callScheduleCustom}
                  onChange={e => setCallScheduleCustom(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* 5. PRESCRIBING PRODUCTS */}
          <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-text)', marginBottom: '6px' }}>
              PRESCRIBING PRODUCTS
            </h3>
            <span className="form-hint" style={{ display: 'block', marginBottom: '8px' }}>
              Multi-select from predefined company products
            </span>
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
          </div>

          {/* 6. NOTES */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            <div className="form-group">
              <label className="form-label">Doctor Notes / Preferences (Optional)</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="e.g. Prefers meeting before 10 AM, interested in diabetic products"
                value={notes}
                onChange={e => setNotes(e.target.value)}
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
