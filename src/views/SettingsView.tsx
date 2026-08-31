import React, { useState, useEffect } from 'react';
import {
  Cloud,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Database,
  Sun,
  Moon,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import { syncEngine } from '../sync/syncEngine';
import type { SyncInfo, SettingItem, Product, Camp, Area, Pharmacy } from '../types';
import {
  getAllSettings,
  getProducts,
  getCamps,
  getAreas,
  getPharmacies,
} from '../db/repository';
import { useToast } from '../components/Toast';

interface SettingsViewProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  theme,
  onToggleTheme,
}) => {
  const { showToast } = useToast();

  const [scriptUrl, setScriptUrl] = useState('');
  const [syncInfo, setSyncInfo] = useState<SyncInfo>({
    state: 'synced',
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null,
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);

  // Master Data Cache Viewer
  const [activeMasterTab, setActiveMasterTab] = useState<string>('specialties');
  const [masterSettings, setMasterSettings] = useState<SettingItem[]>([]);
  const [masterProducts, setMasterProducts] = useState<Product[]>([]);
  const [masterCamps, setMasterCamps] = useState<Camp[]>([]);
  const [masterAreas, setMasterAreas] = useState<Area[]>([]);
  const [masterPharmacies, setMasterPharmacies] = useState<Pharmacy[]>([]);

  useEffect(() => {
    setScriptUrl(syncEngine.getScriptUrl());
    const unsub = syncEngine.subscribe(info => {
      setSyncInfo(info);
    });

    loadMasterData();

    return () => unsub();
  }, []);

  const loadMasterData = async () => {
    const [settings, prods, cmps, ars, phs] = await Promise.all([
      getAllSettings(),
      getProducts(),
      getCamps(),
      getAreas(),
      getPharmacies(),
    ]);
    setMasterSettings(settings);
    setMasterProducts(prods);
    setMasterCamps(cmps);
    setMasterAreas(ars);
    setMasterPharmacies(phs);
  };

  const handleSaveUrl = () => {
    syncEngine.setScriptUrl(scriptUrl);
    showToast('Google Apps Script URL saved!', 'success');
  };

  const handleTestConnection = async () => {
    if (!scriptUrl.trim()) {
      showToast('Please enter a Google Apps Script URL first', 'error');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await syncEngine.testConnection(scriptUrl);
      setTestResult(result);
      if (result.success) {
        showToast('Connected successfully to Google Apps Script!', 'success');
      } else {
        showToast(result.message, 'error');
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncEngine.syncNow();
      if (result.success) {
        showToast(result.message, 'success');
        await loadMasterData();
      } else {
        showToast(result.message, 'error');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInitializeSheets = async () => {
    setIsSyncing(true);
    try {
      const result = await syncEngine.initializeSheets();
      if (result.success) {
        showToast(result.message, 'success');
      } else {
        showToast(result.message, 'error');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const appsScriptCodeSnippet = `/**
 * Google Apps Script for Medical Representative Field App
 * Spreadsheet ID: 1ruBHykbuZGVCi1iBO25rsnHujC2nrpFv1LwtuMYfX6I
 * 4 Primary Tabs: Settings (Matrix), Doctors, Visits (1 row per bundle), Products
 */

const SPREADSHEET_ID = '1ruBHykbuZGVCi1iBO25rsnHujC2nrpFv1LwtuMYfX6I';

const TAB_SCHEMAS = {
  'Settings': ['Areas', 'Specialties', 'Camps', 'Potentials', 'Stockist', 'OP Timing', 'Call Schedule'],
  'Doctors': ['ID', 'Name', 'Specialties', 'Gender', 'Hospital', 'Attached Pharmacy', 'Area', 'Camp', 'Potential', 'Stockist', 'Prescriber', 'OP Timing', 'Call Schedule', 'Prescribing Products', 'Notes', 'Active', 'Updated At'],
  'Visits': ['Date', 'Day', 'Camp', 'Doctors (count)', 'Pharmacy (count)', 'Doctors', 'Pharmacy'],
  'Products': ['ProdID', 'Name', 'DosageForm']
};

function getSpreadsheet() {
  try { return SpreadsheetApp.openById(SPREADSHEET_ID); }
  catch(e) { return SpreadsheetApp.getActiveSpreadsheet(); }
}

function getDayName(dateStr) {
  if (!dateStr) return '';
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return days[d.getDay()] || '';
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : days[d.getDay()];
}

function ensureAllSheetsExist() {
  const ss = getSpreadsheet();
  for (const [tabName, columns] of Object.entries(TAB_SCHEMAS)) {
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.appendRow(columns);
      sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold').setBackground('#f1f5f9');
      sheet.setFrozenRows(1);
    }
  }
}

function readSettingsMatrix() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Settings');
  if (!sheet) return {};
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return {};
  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => String(h).trim());
  const matrix = {};
  headers.forEach(h => { matrix[h] = []; });
  for (let r = 1; r < values.length; r++) {
    for (let c = 0; c < headers.length; c++) {
      const v = values[r][c];
      if (v !== '' && v !== null && v !== undefined) matrix[headers[c]].push(String(v).trim());
    }
  }
  return matrix;
}

function readSheetData(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];
  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => String(h).trim());
  const results = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row.some(c => c !== '' && c !== null)) continue;
    const item = {};
    for (let c = 0; c < headers.length; c++) {
      let cell = row[c];
      if (cell instanceof Date) cell = cell.toISOString();
      item[headers[c]] = cell;
    }
    results.push(item);
  }
  return results;
}

function doGet(e) {
  try {
    ensureAllSheetsExist();
    const action = (e && e.parameter && e.parameter.action) || 'ping';
    if (action === 'ping') return createJsonResponse({ status: 'ok', time: new Date().toISOString() });
    if (action === 'pull') {
      return createJsonResponse({
        status: 'ok',
        timestamp: new Date().toISOString(),
        settings_matrix: readSettingsMatrix(),
        doctors: readSheetData('Doctors'),
        products: readSheetData('Products'),
        visits: readSheetData('Visits')
      });
    }
    return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    ensureAllSheetsExist();
    const payload = JSON.parse(e.postData.contents);
    const ss = getSpreadsheet();
    const now = new Date().toISOString();
    const results = { doctors_synced: 0, visits_logged: 0 };
    
    // Upsert doctors
    if (Array.isArray(payload.doctors) && payload.doctors.length > 0) {
      const docSheet = ss.getSheetByName('Doctors');
      const schema = TAB_SCHEMAS['Doctors'];
      const existingValues = docSheet.getDataRange().getValues();
      const existingIdToRowMap = {};
      for (let r = 1; r < existingValues.length; r++) {
        const id = String(existingValues[r][0]);
        if (id) existingIdToRowMap[id] = r + 1;
      }
      payload.doctors.forEach(doc => {
        const rowData = [
          doc.id || '',
          doc.name || '',
          Array.isArray(doc.specialties) ? doc.specialties.join(', ') : (doc.specialties || ''),
          doc.gender || 'Male',
          doc.hospital || '',
          doc.pharmacy || '',
          doc.area || '',
          doc.camp || '',
          doc.potential || '',
          doc.stockist || '',
          doc.prescriber || 'Rx',
          doc.op_timing_custom || doc.op_timing || '',
          doc.call_schedule_custom || doc.call_schedule || '',
          doc.prescriber === 'Rx' && Array.isArray(doc.prescribing_products) ? doc.prescribing_products.join(', ') : (doc.prescribing_products || ''),
          doc.notes || '',
          doc.is_active !== false ? 'TRUE' : 'FALSE',
          doc.updated_at || now
        ];
        const docId = String(doc.id);
        if (existingIdToRowMap[docId]) {
          docSheet.getRange(existingIdToRowMap[docId], 1, 1, schema.length).setValues([rowData]);
        } else {
          docSheet.appendRow(rowData);
          existingIdToRowMap[docId] = docSheet.getLastRow();
        }
        results.doctors_synced++;
      });
    }

    // Append 1-row-per-bundle visit logs
    if (Array.isArray(payload.visit_bundles) && payload.visit_bundles.length > 0) {
      const visitSheet = ss.getSheetByName('Visits');
      const schema = TAB_SCHEMAS['Visits'];
      const rowsToAppend = [];
      payload.visit_bundles.forEach(bundle => {
        const dayName = bundle.day || getDayName(bundle.date);
        const isHolidayOrSunday = bundle.tag === 'sunday' || bundle.tag === 'holiday';
        let doctorsCell = isHolidayOrSunday 
          ? (bundle.tag === 'sunday' ? 'Sunday (No Visits)' : 'Holiday (No Visits)')
          : (Array.isArray(bundle.doctors_snapshot) && bundle.doctors_snapshot.length > 0
              ? bundle.doctors_snapshot.map(d => d.name + (d.specialty ? ' (' + d.specialty + ')' : '')).join('\\n')
              : '-');
        let pharmacyCell = isHolidayOrSunday
          ? '-'
          : (Array.isArray(bundle.pharmacies_snapshot) && bundle.pharmacies_snapshot.length > 0
              ? bundle.pharmacies_snapshot.map(p => p.name).join('\\n')
              : '-');
        rowsToAppend.push([
          bundle.date || '',
          dayName,
          bundle.camp || '',
          isHolidayOrSunday ? 0 : (bundle.doctor_count || 0),
          isHolidayOrSunday ? 0 : (bundle.pharmacy_count || 0),
          doctorsCell,
          pharmacyCell
        ]);
      });
      if (rowsToAppend.length > 0) {
        visitSheet.getRange(visitSheet.getLastRow() + 1, 1, rowsToAppend.length, schema.length).setValues(rowsToAppend);
        results.visits_logged = rowsToAppend.length;
      }
    }

    return createJsonResponse({ status: 'ok', timestamp: now, results: results });
  } catch(err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}`;

  const copyAppsScript = () => {
    navigator.clipboard.writeText(appsScriptCodeSnippet);
    setIsCopied(true);
    showToast('Apps Script code copied to clipboard!', 'success');
    setTimeout(() => setIsCopied(false), 3000);
  };

  const getSettingsByCategory = (category: string) => {
    return masterSettings.filter(s => s.category.toLowerCase() === category.toLowerCase());
  };

  return (
    <div className="main-content">
      <div style={{ marginBottom: '14px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.02em' }}>Settings & Sync</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Manage synchronization, Google Sheets connector, and offline cache
        </p>
      </div>

      {/* 1. GOOGLE APPS SCRIPT SYNC CONFIGURATION */}
      <div className="card" style={{ background: 'var(--bg-secondary)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cloud size={18} color="var(--accent-text)" />
            <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Google Sheets Sync</h3>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => setIsCodeModalOpen(true)}
            style={{ padding: '4px 8px', minHeight: '28px', fontSize: '11px' }}
          >
            <FileCode size={13} />
            <span>View Apps Script</span>
          </button>
        </div>

        <div className="form-group" style={{ marginBottom: '10px' }}>
          <label className="form-label">Google Apps Script Web App URL</label>
          <input
            type="url"
            className="form-input"
            value={scriptUrl}
            onChange={e => setScriptUrl(e.target.value)}
          />
          <span className="form-hint">
            Connected to 4-Tab Spreadsheet: <code style={{ fontFamily: 'var(--font-mono)' }}>1ruBHykbuZGVCi1iBO25rsnHujC2nrpFv1LwtuMYfX6I</code>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            className="btn btn-primary"
            onClick={handleSaveUrl}
            style={{ flex: 1 }}
          >
            Save URL
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleTestConnection}
            disabled={isTesting || !scriptUrl}
            style={{ flex: 1 }}
          >
            <RefreshCw size={14} style={{ animation: isTesting ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
          </button>
        </div>

        {testResult && (
          <div
            className={`toast toast-${testResult.success ? 'success' : 'error'}`}
            style={{ position: 'static', transform: 'none', width: '100%', marginBottom: '10px' }}
          >
            {testResult.success ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}
            <span style={{ fontSize: '12px' }}>{testResult.message}</span>
          </div>
        )}

        {/* Sync Status Info */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Sync Status:</span>
            <strong style={{ textTransform: 'capitalize', color: syncInfo.state === 'synced' ? 'var(--success-text)' : syncInfo.state === 'pending' ? 'var(--warning-text)' : 'inherit' }}>
              {syncInfo.state}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Last Synced:</span>
            <span>{syncInfo.lastSyncedAt ? new Date(syncInfo.lastSyncedAt).toLocaleString() : 'Never'}</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button
              className="btn btn-primary"
              onClick={handleManualSync}
              disabled={isSyncing}
              style={{ flex: 1 }}
            >
              <RefreshCw size={15} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleInitializeSheets}
              title="Ensure 4 primary tabs exist in Google Sheets"
              style={{ flex: 1 }}
            >
              Initialize 4 Tabs
            </button>
          </div>
        </div>
      </div>

      {/* 2. MASTER DATA VIEWER (CACHED LOCALLY IN INDEXEDDB) */}
      <div className="card" style={{ background: 'var(--bg-secondary)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Database size={18} color="var(--accent-text)" />
          <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Master Data (Offline Cache)</h3>
        </div>

        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Dynamic master data matrix and products cached locally for 100% offline field use.
        </p>

        {/* Master tabs */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '10px' }}>
          {[
            { id: 'specialties', label: 'Specialties', count: getSettingsByCategory('Specialty').length },
            { id: 'camps', label: 'Camps', count: masterCamps.length },
            { id: 'areas', label: 'Areas', count: masterAreas.length },
            { id: 'products', label: 'Products', count: masterProducts.length },
            { id: 'pharmacies', label: 'Pharmacies', count: masterPharmacies.length },
            { id: 'timings', label: 'OP Timings', count: getSettingsByCategory('OP Timing').length },
            { id: 'schedules', label: 'Call Schedules', count: getSettingsByCategory('Call Schedule').length },
            { id: 'potential', label: 'Potential', count: getSettingsByCategory('Potential').length },
            { id: 'prescriber', label: 'Prescriber', count: getSettingsByCategory('Prescriber').length },
            { id: 'stockist', label: 'Stockist', count: getSettingsByCategory('Stockist').length },
          ].map(tab => (
            <button
              key={tab.id}
              className={`pill-item ${activeMasterTab === tab.id ? 'selected' : ''}`}
              onClick={() => setActiveMasterTab(tab.id)}
              style={{ fontSize: '11px', padding: '4px 8px', flexShrink: 0 }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Tab Content Display */}
        <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'var(--bg-primary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          {activeMasterTab === 'specialties' && (
            <div className="pill-grid">
              {getSettingsByCategory('Specialty').map((s, i) => (
                <span key={i} className="badge badge-primary">{s.value}</span>
              ))}
            </div>
          )}

          {activeMasterTab === 'camps' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
              {masterCamps.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{c.name}</strong>
                  <span style={{ color: 'var(--text-muted)' }}>{c.area}</span>
                </div>
              ))}
            </div>
          )}

          {activeMasterTab === 'areas' && (
            <div className="pill-grid">
              {masterAreas.map(a => (
                <span key={a.id} className="badge badge-neutral">{a.name}</span>
              ))}
            </div>
          )}

          {activeMasterTab === 'products' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
              {masterProducts.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{p.name}</strong></span>
                  <span className="badge badge-neutral">{p.form || p.category || 'Product'}</span>
                </div>
              ))}
            </div>
          )}

          {activeMasterTab === 'pharmacies' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
              {masterPharmacies.map(ph => (
                <div key={ph.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{ph.name}</strong></span>
                  <span style={{ color: 'var(--text-muted)' }}>{ph.camp}</span>
                </div>
              ))}
            </div>
          )}

          {activeMasterTab === 'timings' && (
            <div className="pill-grid">
              {getSettingsByCategory('OP Timing').map((s, i) => (
                <span key={i} className="badge badge-neutral">{s.value}</span>
              ))}
            </div>
          )}

          {activeMasterTab === 'schedules' && (
            <div className="pill-grid">
              {getSettingsByCategory('Call Schedule').map((s, i) => (
                <span key={i} className="badge badge-neutral">{s.value}</span>
              ))}
            </div>
          )}

          {activeMasterTab === 'potential' && (
            <div className="pill-grid">
              {getSettingsByCategory('Potential').map((s, i) => (
                <span key={i} className="badge badge-success">{s.value}</span>
              ))}
            </div>
          )}

          {activeMasterTab === 'prescriber' && (
            <div className="pill-grid">
              {getSettingsByCategory('Prescriber').map((s, i) => (
                <span key={i} className="badge badge-warning">{s.value}</span>
              ))}
            </div>
          )}

          {activeMasterTab === 'stockist' && (
            <div className="pill-grid">
              {getSettingsByCategory('Stockist').map((s, i) => (
                <span key={i} className="badge badge-neutral">{s.value}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. APP PREFERENCES & THEME */}
      <div className="card" style={{ background: 'var(--bg-secondary)', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '10px' }}>App Appearance</h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600' }}>Theme Mode</div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Currently: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </p>
          </div>

          <button className="btn btn-secondary" onClick={onToggleTheme}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
          </button>
        </div>
      </div>

      {/* APPS SCRIPT CODE MODAL */}
      {isCodeModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCodeModalOpen(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '92vh' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Google Apps Script (Code.gs)</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Deploy to spreadsheet 1ruBHykbuZGVCi1iBO25rsnHujC2nrpFv1LwtuMYfX6I
                </p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsCodeModalOpen(false)}>
                <Check size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ fontSize: '12px' }}>
              <div className="card" style={{ background: 'var(--bg-primary)', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: 'var(--accent-text)' }}>
                  3-Step Deployment Guide (4-Tab Schema):
                </h4>
                <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px', lineHeight: 1.4 }}>
                  <li>Open spreadsheet: <a href="https://docs.google.com/spreadsheets/d/1ruBHykbuZGVCi1iBO25rsnHujC2nrpFv1LwtuMYfX6I/edit" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)' }}>Spreadsheet Link</a></li>
                  <li>Click <strong>Extensions &gt; Apps Script</strong> and paste the code below into <code style={{ fontFamily: 'var(--font-mono)' }}>Code.gs</code>.</li>
                  <li>Click <strong>Deploy &gt; New deployment &gt; Web app</strong>. Set <em>Execute as: "Me"</em> and <em>Who has access: "Anyone"</em>, then copy the Web App URL into this app's settings.</li>
                </ol>
              </div>

              <div style={{ position: 'relative' }}>
                <pre style={{
                  background: 'var(--bg-input)',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  overflowX: 'auto',
                  maxHeight: '300px',
                  border: '1px solid var(--border-card)'
                }}>
                  {appsScriptCodeSnippet}
                </pre>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsCodeModalOpen(false)} style={{ flex: 1 }}>
                Close
              </button>
              <button className="btn btn-primary" onClick={copyAppsScript} style={{ flex: 2 }}>
                {isCopied ? <Check size={16} /> : <Copy size={16} />}
                <span>{isCopied ? 'Copied!' : 'Copy Code.gs Script'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
