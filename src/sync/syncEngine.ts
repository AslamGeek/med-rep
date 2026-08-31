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
    if (!navigator.onLine) {
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

    if (!navigator.onLine) {
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
    if (!scriptUrl || !navigator.onLine || this.isSyncing) {
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
        message: `Connection failed: ${err.message || String(err)}. Make sure the Apps Script is deployed as Web App with access set to "Anyone".`,
      };
    }
  }

  /**
   * Initialize Spreadsheet tabs and headers
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
        return { success: true, message: 'All 7 tabs & headers initialized in Google Spreadsheet!' };
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
    if (!navigator.onLine) {
      this.syncState = 'offline';
      await this.notifyListeners();
      return { success: false, message: 'Device is offline. Changes are saved locally and will sync once connected.' };
    }

    const scriptUrl = this.getScriptUrl();
    if (!scriptUrl) {
      this.syncState = 'synced'; // local mode
      await this.notifyListeners();
      return { success: false, message: 'Google Apps Script URL is not configured. Data is saved in local IndexedDB.' };
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

      const doctorsToPush: Doctor[] = [];
      const visitsToPush: any[] = [];
      const settingsToPush: SettingItem[] = [];

      for (const item of pendingItems) {
        if (item.operation === 'CREATE_DOCTOR' || item.operation === 'UPDATE_DOCTOR') {
          const doc = item.payload;
          const formattedDoc = {
            ...doc,
            specialties: Array.isArray(doc.specialties) ? doc.specialties.join(', ') : (doc.specialties || ''),
            prescribing_products: Array.isArray(doc.prescribing_products) ? doc.prescribing_products.join(', ') : (doc.prescribing_products || ''),
          };
          doctorsToPush.push(formattedDoc);
        } else if (item.operation === 'CREATE_VISIT_BUNDLE') {
          if (item.payload.logs && Array.isArray(item.payload.logs)) {
            visitsToPush.push(...item.payload.logs);
          }
        } else if (item.operation === 'UPDATE_SETTING') {
          settingsToPush.push(item.payload);
        }
      }

      // 2. If there are pending changes, push to Google Sheets via POST
      if (pendingItems.length > 0) {
        const postResponse = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Apps Script accepts text/plain to avoid CORS preflight issues
          body: JSON.stringify({
            action: 'sync',
            doctors: doctorsToPush,
            visits: visitsToPush,
            settings: settingsToPush,
          }),
        });

        const postResult = await postResponse.json();
        if (postResult.status !== 'ok') {
          throw new Error(postResult.message || 'Push sync failed');
        }

        // Mark visit bundles as synced in Dexie and remove queue items
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
    // 1. Settings
    if (Array.isArray(data.settings) && data.settings.length > 0) {
      for (const s of data.settings) {
        if (!s.category || !s.value) continue;
        const existing = await db.settings
          .where('[category+value]')
          .equals([s.category, s.value])
          .first();

        const item: SettingItem = {
          category: s.category,
          value: s.value,
          order_index: Number(s.order_index) || 0,
          description: s.description || '',
          active: String(s.active).toUpperCase() !== 'FALSE',
          updated_at: s.updated_at || new Date().toISOString(),
        };

        if (existing && existing.id) {
          item.id = existing.id;
          await db.settings.put(item);
        } else {
          await db.settings.add(item);
        }
      }
    }

    // 2. Products
    if (Array.isArray(data.products) && data.products.length > 0) {
      for (const p of data.products) {
        if (!p.id || !p.name) continue;
        const prod: Product = {
          id: String(p.id),
          name: String(p.name),
          category: p.category || '',
          form: p.form || '',
          unit: p.unit || '',
          active: String(p.active).toUpperCase() !== 'FALSE',
          updated_at: p.updated_at,
        };
        await db.products.put(prod);
      }
    }

    // 3. Camps
    if (Array.isArray(data.camps) && data.camps.length > 0) {
      for (const c of data.camps) {
        if (!c.id || !c.name) continue;
        const camp: Camp = {
          id: String(c.id),
          name: String(c.name),
          area: c.area || '',
          active: String(c.active).toUpperCase() !== 'FALSE',
          updated_at: c.updated_at,
        };
        await db.camps.put(camp);
      }
    }

    // 4. Areas
    if (Array.isArray(data.areas) && data.areas.length > 0) {
      for (const a of data.areas) {
        if (!a.id || !a.name) continue;
        const area: Area = {
          id: String(a.id),
          name: String(a.name),
          active: String(a.active).toUpperCase() !== 'FALSE',
          updated_at: a.updated_at,
        };
        await db.areas.put(area);
      }
    }

    // 5. Pharmacies
    if (Array.isArray(data.pharmacies) && data.pharmacies.length > 0) {
      for (const ph of data.pharmacies) {
        if (!ph.id || !ph.name) continue;
        const pharmacy: Pharmacy = {
          id: String(ph.id),
          name: String(ph.name),
          area: ph.area || '',
          camp: ph.camp || '',
          contact_person: ph.contact_person || '',
          phone: ph.phone || '',
          active: String(ph.active).toUpperCase() !== 'FALSE',
          updated_at: ph.updated_at,
        };
        await db.pharmacies.put(pharmacy);
      }
    }

    // 6. Doctors (Only overwrite if doctor does not have pending local edits in sync queue)
    if (Array.isArray(data.doctors) && data.doctors.length > 0) {
      const pendingDoctorIds = new Set(
        (await db.syncQueue.where('status').equals('pending').toArray())
          .filter(item => item.operation === 'CREATE_DOCTOR' || item.operation === 'UPDATE_DOCTOR')
          .map(item => item.entity_id)
      );

      for (const d of data.doctors) {
        if (!d.id || !d.name) continue;
        if (pendingDoctorIds.has(String(d.id))) {
          // Skip doctor to protect pending offline edits
          continue;
        }

        let specialties: string[] = [];
        if (typeof d.specialties === 'string') {
          try {
            specialties = JSON.parse(d.specialties);
          } catch {
            specialties = d.specialties.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        } else if (Array.isArray(d.specialties)) {
          specialties = d.specialties;
        }

        let prescribingProducts: string[] = [];
        if (typeof d.prescribing_products === 'string') {
          try {
            prescribingProducts = JSON.parse(d.prescribing_products);
          } catch {
            prescribingProducts = d.prescribing_products.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        } else if (Array.isArray(d.prescribing_products)) {
          prescribingProducts = d.prescribing_products;
        }

        const doctor: Doctor = {
          id: String(d.id),
          name: String(d.name),
          specialties,
          gender: d.gender || 'Male',
          email: d.email || '',
          hospital: d.hospital || '',
          pharmacy: d.pharmacy || '',
          area: d.area || '',
          camp: d.camp || '',
          potential: d.potential || 'High',
          stockist: d.stockist || 'Primary',
          prescriber: d.prescriber || 'Regular Prescriber',
          op_timing: d.op_timing || 'Morning (9:00 AM - 1:00 PM)',
          op_timing_custom: d.op_timing_custom || '',
          call_schedule: d.call_schedule || 'Weekly',
          call_schedule_custom: d.call_schedule_custom || '',
          prescribing_products: prescribingProducts,
          notes: d.notes || '',
          is_active: String(d.is_active).toUpperCase() !== 'FALSE',
          created_at: d.created_at || new Date().toISOString(),
          updated_at: d.updated_at || new Date().toISOString(),
        };

        await db.doctors.put(doctor);
      }
    }
  }
}

export const syncEngine = new SyncEngine();
