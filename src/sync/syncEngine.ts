import { db } from '../db';
import type { SyncInfo, SyncState, Doctor, SettingItem, Product, Camp, Area, Pharmacy } from '../types';
import { DEFAULT_APPS_SCRIPT_URL } from './config';

const SYNC_URL_STORAGE_KEY = 'medrep_apps_script_url';
const LAST_SYNC_TIME_KEY = 'medrep_last_sync_time';

type SyncListener = (info: SyncInfo) => void;

class SyncEngine {
  private listeners: Set<SyncListener> = new Set();
  private isSyncing = false;
  private syncState: SyncState = 'synced';
  private lastError: string | null = null;

  constructor() {
    // Initial status setup
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.syncState = 'offline';
    }

    // Register event listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.checkPendingAndSync();
      });

      window.addEventListener('offline', () => {
        this.syncState = 'offline';
        this.notifyListeners();
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          this.checkPendingAndSync();
        }
      });
    }
  }

  public getScriptUrl(): string {
    return localStorage.getItem(SYNC_URL_STORAGE_KEY) || DEFAULT_APPS_SCRIPT_URL;
  }

  public setScriptUrl(url: string): void {
    if (url && url.trim() && url.trim() !== DEFAULT_APPS_SCRIPT_URL) {
      localStorage.setItem(SYNC_URL_STORAGE_KEY, url.trim());
    } else {
      localStorage.removeItem(SYNC_URL_STORAGE_KEY);
    }
    this.notifyListeners();
  }

  public getLastSyncTime(): string | null {
    return localStorage.getItem(LAST_SYNC_TIME_KEY);
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.getSyncInfo().then(info => listener(info));
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async getSyncInfo(): Promise<SyncInfo> {
    const pendingCount = await db.syncQueue.where('status').equals('pending').count();
    let state: SyncState = this.syncState;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      state = 'offline';
    } else if (this.isSyncing) {
      state = 'syncing';
    } else if (this.lastError) {
      state = 'error';
    } else if (pendingCount > 0) {
      state = 'pending';
    } else {
      state = 'synced';
    }

    return {
      state,
      pendingCount,
      lastSyncedAt: this.getLastSyncTime(),
      lastError: this.lastError,
    };
  }

  private async notifyListeners(): Promise<void> {
    const info = await this.getSyncInfo();
    this.listeners.forEach(listener => listener(info));
  }

  public async checkPendingAndSync(): Promise<void> {
    const scriptUrl = this.getScriptUrl();
    if (!scriptUrl || (typeof navigator !== 'undefined' && !navigator.onLine) || this.isSyncing) {
      await this.notifyListeners();
      return;
    }
    await this.syncNow();
  }

  /**
   * Test connection to Google Apps Script Web App
   */
  public async testConnection(urlToTest?: string): Promise<{ success: boolean; message: string; timestamp?: string }> {
    const targetUrl = urlToTest || this.getScriptUrl();
    if (!targetUrl) {
      return { success: false, message: 'Google Apps Script URL is empty' };
    }

    try {
      const url = new URL(targetUrl);
      url.searchParams.set('action', 'ping');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.status === 'ok') {
        return { success: true, message: 'Connected successfully to Google Apps Script!', timestamp: data.time };
      } else {
        return { success: false, message: data.message || 'Received unexpected response from script' };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Connection failed: ${err.message || String(err)}. Ensure Web App is deployed with access set to "Anyone".`,
      };
    }
  }

  /**
   * Initialize Spreadsheet tabs and headers (Doctors, Visits, Settings, Products)
   */
  public async initializeSheets(): Promise<{ success: boolean; message: string }> {
    const scriptUrl = this.getScriptUrl();
    if (!scriptUrl) {
      return { success: false, message: 'Apps Script URL not set' };
    }

    try {
      const url = new URL(scriptUrl);
      url.searchParams.set('action', 'init');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      const data = await response.json();
      if (data.status === 'ok') {
        return { success: true, message: '4 primary tabs & headers initialized in Google Spreadsheet!' };
      } else {
        return { success: false, message: data.message || 'Initialization failed' };
      }
    } catch (err: any) {
      return { success: false, message: `Init error: ${err.message || String(err)}` };
    }
  }

  /**
   * Full 2-way sync: Push pending offline mutations -> Pull remote data -> Merge into IndexedDB
   */
  public async syncNow(): Promise<{ success: boolean; message: string }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.syncState = 'offline';
      await this.notifyListeners();
      return { success: false, message: 'Device is offline. Changes saved locally in IndexedDB.' };
    }

    const scriptUrl = this.getScriptUrl();
    if (!scriptUrl) {
      this.syncState = 'synced'; // local mode
      await this.notifyListeners();
      return { success: false, message: 'Google Apps Script URL is not configured. Running in offline storage mode.' };
    }

    if (this.isSyncing) {
      return { success: true, message: 'Sync already in progress.' };
    }

    this.isSyncing = true;
    this.syncState = 'syncing';
    this.lastError = null;
    await this.notifyListeners();

    try {
      // 1. Fetch pending items from queue
      const pendingItems = await db.syncQueue.where('status').equals('pending').toArray();

      const doctorsToPush: any[] = [];
      const visitBundlesToPush: any[] = [];

      for (const item of pendingItems) {
        if (item.operation === 'CREATE_DOCTOR' || item.operation === 'UPDATE_DOCTOR') {
          const doc: Doctor = item.payload;
          doctorsToPush.push({
            id: doc.id,
            name: doc.name,
            specialties: doc.specialties,
            gender: doc.gender || 'Male',
            hospital: doc.hospital || '',
            pharmacy: doc.pharmacy || '',
            area: doc.area || '',
            camp: doc.camp || '',
            potential: doc.potential || '',
            stockist: doc.stockist || '',
            prescriber: doc.prescriber || 'Rx',
            op_timing: doc.op_timing || '',
            op_timing_custom: doc.op_timing_custom || '',
            call_schedule: doc.call_schedule || '',
            call_schedule_custom: doc.call_schedule_custom || '',
            prescribing_products: doc.prescribing_products || [],
            notes: doc.notes || '',
            is_active: doc.is_active !== false,
            updated_at: doc.updated_at || new Date().toISOString(),
          });
        } else if (item.operation === 'CREATE_VISIT_BUNDLE') {
          if (item.payload && item.payload.bundle) {
            visitBundlesToPush.push(item.payload.bundle);
          }
        }
      }

      // 2. Push pending mutations to Google Sheets if any exist
      if (pendingItems.length > 0) {
        const postResponse = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'sync',
            doctors: doctorsToPush,
            visit_bundles: visitBundlesToPush,
          }),
        });

        const postResult = await postResponse.json();
        if (postResult.status !== 'ok') {
          throw new Error(postResult.message || 'Push sync failed');
        }

        // Mark visit bundles as synced in Dexie
        const bundleIds = pendingItems
          .filter(item => item.operation === 'CREATE_VISIT_BUNDLE')
          .map(item => item.entity_id);

        if (bundleIds.length > 0) {
          await db.visitBundles.where('id').anyOf(bundleIds).modify({ synced: true });
        }

        const queueIds = pendingItems.map(item => item.id);
        await db.syncQueue.bulkDelete(queueIds);
      }

      // 3. Pull latest spreadsheet data via GET (action=pull)
      const pullUrl = new URL(scriptUrl);
      pullUrl.searchParams.set('action', 'pull');

      const getResponse = await fetch(pullUrl.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!getResponse.ok) {
        throw new Error(`Failed to pull data: HTTP ${getResponse.status}`);
      }

      const pullData = await getResponse.json();
      if (pullData.status === 'ok') {
        await this.mergePulledData(pullData);
      }

      const now = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_TIME_KEY, now);
      this.syncState = 'synced';
      this.lastError = null;
      await this.notifyListeners();

      return {
        success: true,
        message: `Synced successfully! (${pendingItems.length} changes pushed, remote master data updated)`,
      };
    } catch (err: any) {
      console.error('Sync error:', err);
      this.lastError = err.message || String(err);
      this.syncState = 'error';
      await this.notifyListeners();
      return {
        success: false,
        message: `Sync failed: ${this.lastError}`,
      };
    } finally {
      this.isSyncing = false;
      await this.notifyListeners();
    }
  }

  /**
   * Safely merge spreadsheet data into IndexedDB
   */
  private async mergePulledData(data: any): Promise<void> {
    // 1. Settings Matrix: Areas, Specialties, Camps, Potentials, Stockist, OP Timing, Call Schedule
    if (data.settings_matrix && typeof data.settings_matrix === 'object') {
      const matrix = data.settings_matrix;
      const categoryMapping: Record<string, string> = {
        'Areas': 'Area',
        'Specialties': 'Specialty',
        'Camps': 'Camp',
        'Potentials': 'Potential',
        'Stockist': 'Stockist',
        'OP Timing': 'OP Timing',
        'Call Schedule': 'Call Schedule',
      };

      for (const [columnHeader, values] of Object.entries(matrix)) {
        if (!Array.isArray(values) || values.length === 0) continue;
        const cat = categoryMapping[columnHeader] || columnHeader;

        // Clear existing active items for this category to sync fresh matrix values
        await db.settings.where('category').equals(cat).delete();

        const itemsToAdd: SettingItem[] = values
          .filter(v => v && String(v).trim())
          .map((v, idx) => ({
            category: cat,
            value: String(v).trim(),
            order_index: idx + 1,
            active: true,
            updated_at: new Date().toISOString(),
          }));

        if (itemsToAdd.length > 0) {
          await db.settings.bulkAdd(itemsToAdd);
        }

        // Also update areas table if column is Areas
        if (columnHeader === 'Areas') {
          await db.areas.clear();
          const areaItems: Area[] = itemsToAdd.map((item, idx) => ({
            id: `area_${idx + 1}`,
            name: item.value,
            active: true,
          }));
          await db.areas.bulkAdd(areaItems);
        }

        // Also update camps table if column is Camps
        if (columnHeader === 'Camps') {
          await db.camps.clear();
          const campItems: Camp[] = itemsToAdd.map((item, idx) => ({
            id: `camp_${idx + 1}`,
            name: item.value,
            active: true,
          }));
          await db.camps.bulkAdd(campItems);
        }
      }
    }

    // 2. Products Sheet: ProdID, Name, DosageForm
    if (Array.isArray(data.products) && data.products.length > 0) {
      for (const p of data.products) {
        const prodId = p.ProdID || p.prod_id || p.id;
        const prodName = p.Name || p.name;
        const dosageForm = p.DosageForm || p.dosage_form || p.form || '';

        if (!prodId || !prodName) continue;

        const prod: Product = {
          id: String(prodId).trim(),
          name: String(prodName).trim(),
          form: String(dosageForm).trim(),
          active: true,
          updated_at: new Date().toISOString(),
        };
        await db.products.put(prod);
      }
    }

    // 3. Doctors Sheet (Upsert without overwriting pending local edits)
    if (Array.isArray(data.doctors) && data.doctors.length > 0) {
      const pendingDoctorIds = new Set(
        (await db.syncQueue.where('status').equals('pending').toArray())
          .filter(item => item.operation === 'CREATE_DOCTOR' || item.operation === 'UPDATE_DOCTOR')
          .map(item => item.entity_id)
      );

      for (const d of data.doctors) {
        const docId = d.ID || d.id;
        const docName = d.Name || d.name;
        if (!docId || !docName) continue;

        if (pendingDoctorIds.has(String(docId))) {
          // Skip doctor to protect pending offline edits
          continue;
        }

        let specialties: string[] = [];
        const rawSpecs = d.Specialties || d.specialties;
        if (typeof rawSpecs === 'string') {
          try {
            specialties = JSON.parse(rawSpecs);
          } catch {
            specialties = rawSpecs.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        } else if (Array.isArray(rawSpecs)) {
          specialties = rawSpecs;
        }

        let prescribingProducts: string[] = [];
        const rawProds = d['Prescribing Products'] || d.prescribing_products;
        if (typeof rawProds === 'string') {
          try {
            prescribingProducts = JSON.parse(rawProds);
          } catch {
            prescribingProducts = rawProds.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        } else if (Array.isArray(rawProds)) {
          prescribingProducts = rawProds;
        }

        const rawPrescriber = String(d.Prescriber || d.prescriber || 'Rx').trim();
        const prescriber = rawPrescriber.toUpperCase().includes('NRX') ? 'NRx' : 'Rx';

        const doctor: Doctor = {
          id: String(docId),
          name: String(docName).trim(),
          specialties,
          gender: d.Gender || d.gender || 'Male',
          hospital: d.Hospital || d.hospital || '',
          pharmacy: d['Attached Pharmacy'] || d.pharmacy || '',
          area: d.Area || d.area || '',
          camp: d.Camp || d.camp || '',
          potential: d.Potential || d.potential || 'High',
          stockist: d.Stockist || d.stockist || 'Primary',
          prescriber,
          op_timing: d['OP Timing'] || d.op_timing || 'Morning (9:00 AM - 1:00 PM)',
          op_timing_custom: d.op_timing_custom || '',
          call_schedule: d['Call Schedule'] || d.call_schedule || 'Weekly',
          call_schedule_custom: d.call_schedule_custom || '',
          prescribing_products: prescriber === 'Rx' ? prescribingProducts : [],
          notes: d.Notes || d.notes || '',
          is_active: String(d.Active || d.is_active).toUpperCase() !== 'FALSE',
          created_at: d.created_at || new Date().toISOString(),
          updated_at: d['Updated At'] || d.updated_at || new Date().toISOString(),
        };

        await db.doctors.put(doctor);

        // Also track doctor's attached pharmacy in local pharmacies table
        if (doctor.pharmacy && doctor.pharmacy.trim()) {
          const phName = doctor.pharmacy.trim();
          const phId = `ph_${phName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
          const existingPh = await db.pharmacies.get(phId);
          if (!existingPh) {
            const ph: Pharmacy = {
              id: phId,
              name: phName,
              area: doctor.area,
              camp: doctor.camp,
              active: true,
              updated_at: new Date().toISOString(),
            };
            await db.pharmacies.put(ph);
          }
        }
      }
    }
  }
}

export const syncEngine = new SyncEngine();
