export type PrescriberType = 'Rx' | 'NRx';

export interface SettingItem {
  id?: number;
  category: 'Specialty' | 'Potential' | 'Stockist' | 'Prescriber' | 'OP Timings' | 'Call Schedule' | 'Area' | 'Camp' | string;
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
  hospital?: string;
  pharmacy?: string; // from doctor linked pharmacy / master data
  area: string; // from Areas master data
  camp: string; // from Camps master data
  potential: string; // from Settings (e.g. Super Core, Core, High, Medium, Low)
  stockist: string; // from Settings (e.g. Primary, Secondary, Direct, None)
  prescriber: 'Rx' | 'NRx' | string; // strictly 'Rx' or 'NRx'
  op_timing: string; // from Settings
  op_timing_custom?: string; // if op_timing === 'Other'
  call_schedule: string; // from Settings
  call_schedule_custom?: string; // if call_schedule === 'Other'
  prescribing_products: string[]; // strictly from Products master data (only for Rx doctors)
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string; // e.g. PROD-001
  name: string; // e.g. ACN 1000
  form?: string; // DosageForm: Tabs, Drops, Syrup, Injection, etc.
  category?: string;
  unit?: string;
  active: boolean;
  updated_at?: string;
}

export interface Camp {
  id: string;
  name: string;
  area?: string;
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
  area?: string;
  camp?: string;
  contact_person?: string;
  phone?: string;
  active: boolean;
  updated_at?: string;
}

export type VisitTag = 'normal' | 'sunday' | 'holiday';

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
    areas?: string[];
    camps?: string[];
    specialties?: string[];
    call_schedules?: string[];
    products?: string[];
    prescribers?: string[];
    potential?: string;
    search?: string;
    // Legacy support
    area?: string;
    camp?: string;
    specialty?: string;
    call_schedule?: string;
    product?: string;
    prescriber?: string;
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
