import React from 'react';
import { X, Edit, MapPin, Building2, Pill, Calendar, Clock, Award, Shield, User, FileText, CheckCircle2 } from 'lucide-react';
import type { Doctor } from '../types';

interface DoctorDetailModalProps {
  doctor: Doctor | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (doctor: Doctor) => void;
  onLogVisit?: (doctor: Doctor) => void;
}

export const DoctorDetailModal: React.FC<DoctorDetailModalProps> = ({
  doctor,
  isOpen,
  onClose,
  onEdit,
  onLogVisit,
}) => {
  if (!isOpen || !doctor) return null;

  const isRx = doctor.prescriber === 'Rx' || (doctor.prescriber && doctor.prescriber.toUpperCase().includes('RX') && !doctor.prescriber.toUpperCase().includes('NRX'));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'var(--accent-glow)',
                color: 'var(--accent-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '700' }}>{doctor.name}</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {doctor.specialties.join(', ')}
              </p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Key tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
            <span className="badge badge-primary">
              <MapPin size={11} /> {doctor.camp} {doctor.area ? `· ${doctor.area}` : ''}
            </span>
            <span className="badge badge-success">
              <Award size={11} /> {doctor.potential} Potential
            </span>
            <span className={`badge ${isRx ? 'badge-primary' : 'badge-neutral'}`} style={{ fontWeight: '700' }}>
              <Shield size={11} /> {isRx ? 'Rx Prescriber' : 'NRx Prescriber'}
            </span>
          </div>

          {/* Location & Clinic Info */}
          <div className="card" style={{ marginBottom: '12px' }}>
            <h4 style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Hospital & Pharmacy
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={15} color="var(--accent-text)" />
                <span>{doctor.hospital || 'Hospital not specified'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Pill size={15} color="var(--accent-text)" />
                <span>{doctor.pharmacy ? `Attached to ${doctor.pharmacy}` : 'No attached pharmacy'}</span>
              </div>
            </div>
          </div>

          {/* Timings & Schedules */}
          <div className="card" style={{ marginBottom: '12px' }}>
            <h4 style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Availability & Schedules
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '2px' }}>
                  <Clock size={12} /> OP Timing
                </div>
                <div style={{ fontWeight: '500' }}>
                  {doctor.op_timing_custom || doctor.op_timing || 'Not specified'}
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '2px' }}>
                  <Calendar size={12} /> Call Schedule
                </div>
                <div style={{ fontWeight: '500' }}>
                  {doctor.call_schedule_custom || doctor.call_schedule || 'Not specified'}
                </div>
              </div>
            </div>
          </div>

          {/* Prescribing Products (Only for Rx doctors) */}
          {isRx && (
            <div className="card" style={{ marginBottom: '12px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Prescribing Products ({doctor.prescribing_products?.length || 0})
              </h4>
              {doctor.prescribing_products && doctor.prescribing_products.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {doctor.prescribing_products.map((prod, i) => (
                    <span key={i} className="badge badge-neutral" style={{ fontSize: '12px', padding: '4px 8px' }}>
                      <CheckCircle2 size={12} color="var(--success-text)" /> {prod}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No products tagged.</p>
              )}
            </div>
          )}

          {/* Notes */}
          {doctor.notes && (
            <div className="card" style={{ marginBottom: '12px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                <FileText size={12} style={{ display: 'inline', marginRight: '4px' }} /> Notes
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {doctor.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              onClose();
              onEdit(doctor);
            }}
            style={{ flex: 1 }}
          >
            <Edit size={16} />
            <span>Edit Doctor</span>
          </button>

          {onLogVisit && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onLogVisit(doctor);
              }}
              style={{ flex: 1.2 }}
            >
              <Calendar size={16} />
              <span>Log Visit</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
