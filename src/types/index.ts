export type Gender = 'Male' | 'Female' | 'Other';

export interface SettingItem {
  id?: number;
  category: 'Specialty' | 'Potential' | 'Stockist' | 'Prescriber' | 'OP Timing' | 'Call Schedule' | 'Gender' | string;
  value: string;
  order_index: number;
  description?: string;
  active: boolean;
  updated_at?: string;
}

export interface Doctor {
  id: string; // UUID or string
  name: string;
  specialties: string[]; // multi-select from Settings
  gender?: Gender | string;
  email?: string;
  hospital?: string;
  pharmacy?: string; // from Pharmacy master data
  area: string; // from Areas master data
  camp: string; // from Camps master data
  potential: string; // from Settings (e.g. Super Core, Core, High, Medium, Low)
  stockist: string; // from Settings (e.g. Primary, Secondary, Direct, None)
  prescriber: string; // from Settings (e.g. Loyal Prescriber, Regular, Trial, etc.)
  op_timing: string; // from Settings
  op_timing_custom?: string; // if op_timing === 'Other'
  call_schedule: string; // from Settings
  call_schedule_custom?: string; // if call_schedule === 'Other'
  prescribing_products: string[]; // strictly from Products master data
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  category?: string;
  form?: string; // Tablet, Syrup, Injection, Ointment, etc.
  unit?: string; // 10x10, 100ml, etc.
  active: boolean;
  updated_at?: string;
}

export interface Camp {
  id: string;
  name: string;
  area: string;
  active: boolean;
  updated_at?: string;
}

export interface Area {
  id: string;
  name: string;
  active: boolean;
  updated_at?: string;
}

export interface Pharmacy {
  id: string;
  name: string;
  area: string;
  camp: string;
  contact_person?: string;
  phone?: string;
  active: boolean;
  updated_at?: string;
}

export type VisitTag = 'normal' | 'sunday' | 'holiday' | 'leave';

export interface VisitBundle {
  id: string; // UUID of bundle
  date: string; // YYYY-MM-DD
  camp: string;
  tag: VisitTag;
  doctor_ids: string[];
  pharmacy_ids: string[];
  doctor_count: number;
  pharmacy_count: number;
  // Snapshot information so historical views remain intact even if master records change
  doctors_snapshot: {
    id: string;
    name: string;
    specialty: string;
    pharmacy?: string;
  }[];
  pharmacies_snapshot: {
    id: string;
    name: string;
  }[];
  created_at: string;
  synced: boolean;
}

export interface VisitLogEntry {
  id?: number;
  bundle_id: string;
  visit_id: string;
  date: string;
  camp: string;
  entity_type: 'doctor' | 'pharmacy';
  entity_id: string;
  entity_name: string;
  specialty?: string;
  pharmacy?: string;
  tag: VisitTag;
  synced_at?: string;
  created_at: string;
}

export interface SavedFilterPreset {
  id: string;
  name: string;
  filters: {
    area?: string;
    camp?: string;
    specialty?: string;
    call_schedule?: string;
    product?: string;
    prescriber?: string;
    search?: string;
  };
  created_at: string;
}

export type SyncOperationType = 'CREATE_DOCTOR' | 'UPDATE_DOCTOR' | 'CREATE_VISIT_BUNDLE' | 'UPDATE_SETTING';

export interface SyncQueueItem {
  id: string;
  operation: SyncOperationType;
  entity_id: string;
  payload: any;
  status: 'pending' | 'in-flight' | 'failed';
  retry_count: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export type SyncState = 'synced' | 'syncing' | 'offline' | 'pending' | 'error';

export interface SyncInfo {
  state: SyncState;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}
