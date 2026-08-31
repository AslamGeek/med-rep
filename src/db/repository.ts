import { db } from './index';
import type {
  Doctor,
  SettingItem,
  Product,
  Camp,
  Area,
  Pharmacy,
  VisitBundle,
  VisitLogEntry,
  SavedFilterPreset,
  SyncQueueItem,
  VisitTag,
} from '../types';

/**
 * Generate a clean standard ID
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// -------------------------------------------------------------
// Doctor Operations
// -------------------------------------------------------------

export interface DoctorFilterOptions {
  search?: string;
  area?: string;
  camp?: string;
  specialty?: string;
  callSchedule?: string;
  product?: string;
  prescriber?: string;
  potential?: string;
}

export interface DoctorWithVisitMeta extends Doctor {
  lastVisitedDate: string | null; // YYYY-MM-DD
  daysSinceLastVisit: number | null;
  lastVisitedFormatted: string; // "DD/MM/YYYY" or "Never"
  daysSinceFormatted: string; // "Today", "Yesterday", "4 days ago", "Never"
}

export async function getDoctors(filters?: DoctorFilterOptions): Promise<Doctor[]> {
  let collection = db.doctors.toCollection();

  let docs = await collection.toArray();
  // Filter active doctors primarily
  docs = docs.filter(d => d.is_active !== false);

  if (!filters) return docs;

  return docs.filter(d => {
    if (filters.area && d.area !== filters.area) return false;
    if (filters.camp && d.camp !== filters.camp) return false;
    if (filters.specialty && !d.specialties.includes(filters.specialty)) return false;
    if (filters.callSchedule && d.call_schedule !== filters.callSchedule) return false;
    if (filters.product && !d.prescribing_products.includes(filters.product)) return false;
    if (filters.prescriber && d.prescriber !== filters.prescriber) return false;
    if (filters.potential && d.potential !== filters.potential) return false;

    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      const matchName = d.name.toLowerCase().includes(q);
      const matchHospital = d.hospital?.toLowerCase().includes(q) || false;
      const matchPharmacy = d.pharmacy?.toLowerCase().includes(q) || false;
      const matchArea = d.area.toLowerCase().includes(q);
      const matchCamp = d.camp.toLowerCase().includes(q);
      const matchSpecialty = d.specialties.some(s => s.toLowerCase().includes(q));
      const matchProduct = d.prescribing_products.some(p => p.toLowerCase().includes(q));
      if (!matchName && !matchHospital && !matchPharmacy && !matchArea && !matchCamp && !matchSpecialty && !matchProduct) {
        return false;
      }
    }

    return true;
  });
}

export async function getDoctorById(id: string): Promise<Doctor | undefined> {
  return await db.doctors.get(id);
}

/**
 * Format ISO date string YYYY-MM-DD to DD/MM/YYYY
 */
export function formatDateDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Calculate human-friendly days since date relative to today
 */
export function getDaysDifference(dateStr: string): number {
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffTime = now.getTime() - target.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function formatDaysSince(days: number | null): string {
  if (days === null) return 'Never';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 0) return `In ${Math.abs(days)} days`;
  return `${days} days ago`;
}

/**
 * Retrieves doctors in a camp with last visited date and days elapsed
 */
export async function getDoctorsWithVisitMeta(campName: string, searchQuery?: string): Promise<DoctorWithVisitMeta[]> {
  const docs = await getDoctors({ camp: campName, search: searchQuery });

  // Get all visit logs for doctors in this camp to find most recent visit per doctor
  const docIds = docs.map(d => d.id);
  const logs = await db.visitLogs
    .where('entity_id')
    .anyOf(docIds)
    .filter(log => log.entity_type === 'doctor')
    .toArray();

  // Map latest date per doctor ID
  const latestVisitMap = new Map<string, string>();
  logs.forEach(log => {
    const current = latestVisitMap.get(log.entity_id);
    if (!current || log.date > current) {
      latestVisitMap.set(log.entity_id, log.date);
    }
  });

  return docs.map(doc => {
    const lastDate = latestVisitMap.get(doc.id) || null;
    let days: number | null = null;
    let daysSinceFormatted = 'Never';
    let lastVisitedFormatted = 'Never';

    if (lastDate) {
      days = getDaysDifference(lastDate);
      daysSinceFormatted = formatDaysSince(days);
      lastVisitedFormatted = formatDateDDMMYYYY(lastDate);
    }

    return {
      ...doc,
      lastVisitedDate: lastDate,
      daysSinceLastVisit: days,
      lastVisitedFormatted,
      daysSinceFormatted,
    };
  });
}

/**
 * Save / Update doctor and enqueue sync mutation
 */
export async function saveDoctor(doctor: Partial<Doctor> & { name: string }): Promise<Doctor> {
  const now = new Date().toISOString();
  const isNew = !doctor.id;
  const id = doctor.id || generateId('doc');

  const fullDoctor: Doctor = {
    id,
    name: doctor.name.trim(),
    specialties: doctor.specialties || [],
    gender: doctor.gender || 'Male',
    email: doctor.email?.trim() || '',
    hospital: doctor.hospital?.trim() || '',
    pharmacy: doctor.pharmacy || '',
    area: doctor.area || '',
    camp: doctor.camp || '',
    potential: doctor.potential || 'High',
    stockist: doctor.stockist || 'Primary',
    prescriber: doctor.prescriber || 'Regular Prescriber',
    op_timing: doctor.op_timing || 'Morning (9:00 AM - 1:00 PM)',
    op_timing_custom: doctor.op_timing_custom?.trim() || '',
    call_schedule: doctor.call_schedule || 'Weekly',
    call_schedule_custom: doctor.call_schedule_custom?.trim() || '',
    prescribing_products: doctor.prescribing_products || [],
    notes: doctor.notes?.trim() || '',
    is_active: doctor.is_active !== false,
    created_at: doctor.created_at || now,
    updated_at: now,
  };

  await db.doctors.put(fullDoctor);

  // Enqueue sync queue item
  const queueItem: SyncQueueItem = {
    id: generateId('sq'),
    operation: isNew ? 'CREATE_DOCTOR' : 'UPDATE_DOCTOR',
    entity_id: id,
    payload: fullDoctor,
    status: 'pending',
    retry_count: 0,
    created_at: now,
    updated_at: now,
  };
  await db.syncQueue.put(queueItem);

  return fullDoctor;
}

// -------------------------------------------------------------
// Visit Bundle Operations
// -------------------------------------------------------------

export interface CreateVisitBundleParams {
  date: string; // YYYY-MM-DD
  camp: string;
  tag: VisitTag;
  doctorIds: string[];
  pharmacyIds: string[];
}

export async function createVisitBundle(params: CreateVisitBundleParams): Promise<VisitBundle> {
  const now = new Date().toISOString();
  const bundleId = generateId('bundle');

  // Fetch doctors and pharmacies snapshot
  const doctors = await db.doctors.where('id').anyOf(params.doctorIds).toArray();
  const pharmacies = await db.pharmacies.where('id').anyOf(params.pharmacyIds).toArray();

  const doctorsSnapshot = doctors.map(d => ({
    id: d.id,
    name: d.name,
    specialty: d.specialties.join(', '),
    pharmacy: d.pharmacy,
  }));

  const pharmaciesSnapshot = pharmacies.map(p => ({
    id: p.id,
    name: p.name,
  }));

  const bundle: VisitBundle = {
    id: bundleId,
    date: params.date,
    camp: params.camp,
    tag: params.tag,
    doctor_ids: params.doctorIds,
    pharmacy_ids: params.pharmacyIds,
    doctor_count: params.doctorIds.length,
    pharmacy_count: params.pharmacyIds.length,
    doctors_snapshot: doctorsSnapshot,
    pharmacies_snapshot: pharmaciesSnapshot,
    created_at: now,
    synced: false,
  };

  await db.visitBundles.put(bundle);

  // Create individual visit log records
  const logEntries: VisitLogEntry[] = [];

  doctorsSnapshot.forEach(doc => {
    logEntries.push({
      bundle_id: bundleId,
      visit_id: generateId('vis'),
      date: params.date,
      camp: params.camp,
      entity_type: 'doctor',
      entity_id: doc.id,
      entity_name: doc.name,
      specialty: doc.specialty,
      pharmacy: doc.pharmacy || '',
      tag: params.tag,
      created_at: now,
    });
  });

  pharmaciesSnapshot.forEach(ph => {
    logEntries.push({
      bundle_id: bundleId,
      visit_id: generateId('vis'),
      date: params.date,
      camp: params.camp,
      entity_type: 'pharmacy',
      entity_id: ph.id,
      entity_name: ph.name,
      tag: params.tag,
      created_at: now,
    });
  });

  if (logEntries.length > 0) {
    await db.visitLogs.bulkAdd(logEntries);
  }

  // Enqueue in sync queue
  const queueItem: SyncQueueItem = {
    id: generateId('sq'),
    operation: 'CREATE_VISIT_BUNDLE',
    entity_id: bundleId,
    payload: {
      bundle,
      logs: logEntries,
    },
    status: 'pending',
    retry_count: 0,
    created_at: now,
    updated_at: now,
  };
  await db.syncQueue.put(queueItem);

  return bundle;
}

export async function getVisitBundles(campFilter?: string, dateFilter?: string): Promise<VisitBundle[]> {
  let bundles = await db.visitBundles.toArray();

  // Sort latest first (by date descending, then created_at descending)
  bundles.sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return b.created_at.localeCompare(a.created_at);
  });

  if (campFilter && campFilter !== 'all') {
    bundles = bundles.filter(b => b.camp.toLowerCase() === campFilter.toLowerCase());
  }

  if (dateFilter) {
    bundles = bundles.filter(b => b.date === dateFilter);
  }

  return bundles;
}

// -------------------------------------------------------------
// Settings & Master Data Lookups
// -------------------------------------------------------------

export async function getSettingValues(category: string): Promise<SettingItem[]> {
  const items = await db.settings
    .where('category')
    .equals(category)
    .filter(item => item.active !== false)
    .sortBy('order_index');
  return items;
}

export async function getAllSettings(): Promise<SettingItem[]> {
  return await db.settings.toArray();
}

export async function getProducts(): Promise<Product[]> {
  return await db.products.filter(p => p.active !== false).toArray();
}

export async function getCamps(): Promise<Camp[]> {
  return await db.camps.filter(c => c.active !== false).toArray();
}

export async function getAreas(): Promise<Area[]> {
  return await db.areas.filter(a => a.active !== false).toArray();
}

export async function getPharmacies(campFilter?: string): Promise<Pharmacy[]> {
  let pharmacies = await db.pharmacies.filter(p => p.active !== false).toArray();
  if (campFilter) {
    pharmacies = pharmacies.filter(p => p.camp.toLowerCase() === campFilter.toLowerCase());
  }
  return pharmacies;
}

// -------------------------------------------------------------
// Saved Filter Presets
// -------------------------------------------------------------

export async function getSavedPresets(): Promise<SavedFilterPreset[]> {
  return await db.savedPresets.toArray();
}

export async function savePreset(name: string, filters: SavedFilterPreset['filters']): Promise<SavedFilterPreset> {
  const preset: SavedFilterPreset = {
    id: generateId('preset'),
    name: name.trim(),
    filters,
    created_at: new Date().toISOString(),
  };
  await db.savedPresets.put(preset);
  return preset;
}

export async function deletePreset(id: string): Promise<void> {
  await db.savedPresets.delete(id);
}

// -------------------------------------------------------------
// Sync Queue Helpers
// -------------------------------------------------------------

export async function getPendingSyncCount(): Promise<number> {
  return await db.syncQueue.where('status').equals('pending').count();
}

export async function getSyncQueueItems(): Promise<SyncQueueItem[]> {
  return await db.syncQueue.toArray();
}

export async function clearSyncQueue(): Promise<void> {
  await db.syncQueue.clear();
}
