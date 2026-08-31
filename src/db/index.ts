import Dexie, { type Table } from 'dexie';
import type {
  Doctor,
  Product,
  Camp,
  Area,
  Pharmacy,
  SettingItem,
  VisitBundle,
  VisitLogEntry,
  SavedFilterPreset,
  SyncQueueItem,
} from '../types';

export class MedRepDatabase extends Dexie {
  settings!: Table<SettingItem, number>;
  doctors!: Table<Doctor, string>;
  products!: Table<Product, string>;
  camps!: Table<Camp, string>;
  areas!: Table<Area, string>;
  pharmacies!: Table<Pharmacy, string>;
  visitBundles!: Table<VisitBundle, string>;
  visitLogs!: Table<VisitLogEntry, number>;
  savedPresets!: Table<SavedFilterPreset, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('MedRepFieldAppDB');

    this.version(1).stores({
      settings: '++id, category, value, [category+value], active, order_index',
      doctors: 'id, name, area, camp, prescriber, potential, call_schedule, is_active, updated_at, *specialties, *prescribing_products',
      products: 'id, name, form, active',
      camps: 'id, name, area, active',
      areas: 'id, name, active',
      pharmacies: 'id, name, area, camp, active',
      visitBundles: 'id, date, camp, tag, synced, created_at, [date+camp]',
      visitLogs: '++id, bundle_id, visit_id, date, camp, entity_id, entity_type, tag',
      savedPresets: 'id, name, created_at',
      syncQueue: 'id, status, operation, created_at',
    });
  }
}

export const db = new MedRepDatabase();

/**
 * Default offline master data values to seed on first launch if empty
 */
export const DEFAULT_MASTER_DATA = {
  settings: [
    // Specialties
    { category: 'Specialty', value: 'General Physician', order_index: 1, active: true },
    { category: 'Specialty', value: 'Cardiologist', order_index: 2, active: true },
    { category: 'Specialty', value: 'Dermatologist', order_index: 3, active: true },
    { category: 'Specialty', value: 'Orthopedic', order_index: 4, active: true },
    { category: 'Specialty', value: 'Pediatrician', order_index: 5, active: true },
    { category: 'Specialty', value: 'Gynecologist', order_index: 6, active: true },
    { category: 'Specialty', value: 'ENT Specialist', order_index: 7, active: true },
    { category: 'Specialty', value: 'Neurologist', order_index: 8, active: true },
    { category: 'Specialty', value: 'Pulmonologist', order_index: 9, active: true },
    { category: 'Specialty', value: 'Gastroenterologist', order_index: 10, active: true },
    { category: 'Specialty', value: 'Ophthalmologist', order_index: 11, active: true },
    { category: 'Specialty', value: 'General Surgeon', order_index: 12, active: true },

    // Potential
    { category: 'Potential', value: 'Super Core', order_index: 1, active: true },
    { category: 'Potential', value: 'Core', order_index: 2, active: true },
    { category: 'Potential', value: 'High', order_index: 3, active: true },
    { category: 'Potential', value: 'Medium', order_index: 4, active: true },
    { category: 'Potential', value: 'Low', order_index: 5, active: true },

    // Stockist
    { category: 'Stockist', value: 'Primary', order_index: 1, active: true },
    { category: 'Stockist', value: 'Secondary', order_index: 2, active: true },
    { category: 'Stockist', value: 'Direct', order_index: 3, active: true },
    { category: 'Stockist', value: 'None', order_index: 4, active: true },

    // Prescriber (Strictly Rx and NRx)
    { category: 'Prescriber', value: 'Rx', order_index: 1, active: true },
    { category: 'Prescriber', value: 'NRx', order_index: 2, active: true },

    // OP Timing
    { category: 'OP Timing', value: 'Morning (9:00 AM - 1:00 PM)', order_index: 1, active: true },
    { category: 'OP Timing', value: 'Evening (5:00 PM - 9:00 PM)', order_index: 2, active: true },
    { category: 'OP Timing', value: 'Both (Morning & Evening)', order_index: 3, active: true },
    { category: 'OP Timing', value: 'Afternoon (2:00 PM - 5:00 PM)', order_index: 4, active: true },
    { category: 'OP Timing', value: 'Other', order_index: 5, active: true },

    // Call Schedule
    { category: 'Call Schedule', value: 'Daily', order_index: 1, active: true },
    { category: 'Call Schedule', value: 'Weekly', order_index: 2, active: true },
    { category: 'Call Schedule', value: 'Bi-Weekly', order_index: 3, active: true },
    { category: 'Call Schedule', value: 'Twice a Month', order_index: 4, active: true },
    { category: 'Call Schedule', value: 'Monthly', order_index: 5, active: true },
    { category: 'Call Schedule', value: 'Every 10 Days', order_index: 6, active: true },
    { category: 'Call Schedule', value: 'Other', order_index: 7, active: true },

    // Areas
    { category: 'Area', value: 'Central Zone', order_index: 1, active: true },
    { category: 'Area', value: 'North Zone', order_index: 2, active: true },
    { category: 'Area', value: 'South Zone', order_index: 3, active: true },

    // Camps
    { category: 'Camp', value: 'Proddatur', order_index: 1, active: true },
    { category: 'Camp', value: 'Kadapa', order_index: 2, active: true },
    { category: 'Camp', value: 'Jammalamadugu', order_index: 3, active: true },
    { category: 'Camp', value: 'Mydukur', order_index: 4, active: true },
    { category: 'Camp', value: 'Pulivendula', order_index: 5, active: true },
  ] as SettingItem[],

  areas: [
    { id: 'area_1', name: 'Central Zone', active: true },
    { id: 'area_2', name: 'North Zone', active: true },
    { id: 'area_3', name: 'South Zone', active: true },
  ] as Area[],

  camps: [
    { id: 'camp_1', name: 'Proddatur', area: 'Central Zone', active: true },
    { id: 'camp_2', name: 'Kadapa', area: 'South Zone', active: true },
    { id: 'camp_3', name: 'Jammalamadugu', area: 'North Zone', active: true },
    { id: 'camp_4', name: 'Mydukur', area: 'Central Zone', active: true },
    { id: 'camp_5', name: 'Pulivendula', area: 'South Zone', active: true },
  ] as Camp[],

  products: [
    { id: 'PROD-001', name: 'ACN 1000', form: 'Tabs', active: true },
    { id: 'PROD-002', name: 'ACN 650', form: 'Tabs', active: true },
    { id: 'PROD-003', name: 'ANECHEK', form: 'Tabs', active: true },
    { id: 'PROD-004', name: 'ANECHEK-XT', form: 'Tabs', active: true },
    { id: 'PROD-005', name: 'API-TOP', form: 'Drops', active: true },
    { id: 'PROD-006', name: 'Azithromycin 500mg', form: 'Tablet', active: true },
    { id: 'PROD-007', name: 'Pantoprazole DSR', form: 'Capsule', active: true },
    { id: 'PROD-008', name: 'Paracetamol 650mg', form: 'Tablet', active: true },
    { id: 'PROD-009', name: 'Telmisartan 40mg', form: 'Tablet', active: true },
    { id: 'PROD-010', name: 'Metformin 500mg SR', form: 'Tablet', active: true },
    { id: 'PROD-011', name: 'Montelukast 10mg', form: 'Tablet', active: true },
  ] as Product[],

  pharmacies: [
    { id: 'ph_1', name: 'Sri Lakshmi Medicals', area: 'Central Zone', camp: 'Proddatur', active: true },
    { id: 'ph_2', name: 'Apollo Pharmacy Gandhi Road', area: 'Central Zone', camp: 'Proddatur', active: true },
    { id: 'ph_3', name: 'MedPlus Main Bazaar', area: 'South Zone', camp: 'Kadapa', active: true },
    { id: 'ph_4', name: 'Sanjivani Chemist', area: 'North Zone', camp: 'Jammalamadugu', active: true },
    { id: 'ph_5', name: 'Balaji Pharma & Surgicals', area: 'Central Zone', camp: 'Mydukur', active: true },
  ] as Pharmacy[],
};

/**
 * Initializes the database with starter master data if tables are empty.
 */
export async function initializeDatabase(): Promise<void> {
  const settingCount = await db.settings.count();
  if (settingCount === 0) {
    await db.settings.bulkAdd(DEFAULT_MASTER_DATA.settings);
  }

  const areaCount = await db.areas.count();
  if (areaCount === 0) {
    await db.areas.bulkAdd(DEFAULT_MASTER_DATA.areas);
  }

  const campCount = await db.camps.count();
  if (campCount === 0) {
    await db.camps.bulkAdd(DEFAULT_MASTER_DATA.camps);
  }

  const productCount = await db.products.count();
  if (productCount === 0) {
    await db.products.bulkAdd(DEFAULT_MASTER_DATA.products);
  }

  const pharmacyCount = await db.pharmacies.count();
  if (pharmacyCount === 0) {
    await db.pharmacies.bulkAdd(DEFAULT_MASTER_DATA.pharmacies);
  }
}
