/**
 * Google Apps Script for Medical Representative Field App
 * Spreadsheet ID: 1ruBHykbuZGVCi1iBO25rsnHujC2nrpFv1LwtuMYfX6I
 * 
 * Deployment Instructions:
 * 1. Open your Google Spreadsheet: https://docs.google.com/spreadsheets/d/1ruBHykbuZGVCi1iBO25rsnHujC2nrpFv1LwtuMYfX6I/edit
 * 2. Click Extensions > Apps Script
 * 3. Delete any code in Code.gs and paste this entire file
 * 4. Click "Deploy" > "New deployment"
 * 5. Select type: "Web app"
 * 6. Description: "MedRep Field App Sync Engine"
 * 7. Execute as: "Me"
 * 8. Who has access: "Anyone" (allows mobile PWA without OAuth credentials prompt)
 * 9. Click "Deploy", authorize permissions, and copy the Web App URL into the app's Settings!
 */

const SPREADSHEET_ID = '1ruBHykbuZGVCi1iBO25rsnHujC2nrpFv1LwtuMYfX6I';

const TAB_SCHEMAS = {
  'Settings': [
    'category', 'value', 'order_index', 'description', 'active', 'updated_at'
  ],
  'Doctors': [
    'id', 'name', 'specialties', 'gender', 'email', 'hospital', 'pharmacy', 
    'area', 'camp', 'potential', 'stockist', 'prescriber', 'op_timing', 
    'op_timing_custom', 'call_schedule', 'call_schedule_custom', 
    'prescribing_products', 'notes', 'is_active', 'created_at', 'updated_at'
  ],
  'Products': [
    'id', 'name', 'category', 'form', 'unit', 'active', 'updated_at'
  ],
  'Camps': [
    'id', 'name', 'area', 'active', 'updated_at'
  ],
  'Areas': [
    'id', 'name', 'active', 'updated_at'
  ],
  'Pharmacies': [
    'id', 'name', 'area', 'camp', 'contact_person', 'phone', 'active', 'updated_at'
  ],
  'Visit Logs': [
    'bundle_id', 'visit_id', 'date', 'camp', 'entity_type', 'entity_id', 
    'entity_name', 'specialty', 'pharmacy', 'tag', 'synced_at', 'created_at'
  ]
};

// Initial default settings to seed if Settings sheet is empty
const DEFAULT_SETTINGS = [
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

  // Prescriber
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

  // Gender
  { category: 'Gender', value: 'Male', order_index: 1, active: true },
  { category: 'Gender', value: 'Female', order_index: 2, active: true },
  { category: 'Gender', value: 'Other', order_index: 3, active: true }
];

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

/**
 * Ensures all required sheets and column headers exist without modifying existing data.
 */
function ensureAllSheetsExist() {
  const ss = getSpreadsheet();
  const createdTabs = [];

  for (const [tabName, columns] of Object.entries(TAB_SCHEMAS)) {
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.appendRow(columns);
      sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold').setBackground('#f1f5f9');
      sheet.setFrozenRows(1);
      createdTabs.push(tabName);

      // If Settings tab is newly created, seed with default categories
      if (tabName === 'Settings') {
        const now = new Date().toISOString();
        const rows = DEFAULT_SETTINGS.map(s => [
          s.category,
          s.value,
          s.order_index,
          s.description || '',
          s.active !== false ? 'TRUE' : 'FALSE',
          now
        ]);
        if (rows.length > 0) {
          sheet.getRange(2, 1, rows.length, 6).setValues(rows);
        }
      }
    } else {
      // Sheet exists: verify and add any missing headers
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) {
        sheet.appendRow(columns);
        sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold').setBackground('#f1f5f9');
        sheet.setFrozenRows(1);
        if (tabName === 'Settings') {
          const now = new Date().toISOString();
          const rows = DEFAULT_SETTINGS.map(s => [
            s.category, s.value, s.order_index, s.description || '', s.active !== false ? 'TRUE' : 'FALSE', now
          ]);
          if (rows.length > 0) {
            sheet.getRange(2, 1, rows.length, 6).setValues(rows);
          }
        }
      } else {
        const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        const missingHeaders = columns.filter(col => !existingHeaders.includes(col));
        if (missingHeaders.length > 0) {
          const startCol = lastCol + 1;
          sheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]).setFontWeight('bold');
        }
      }
    }
  }

  return { success: true, createdTabs };
}

/**
 * Reads all rows from a sheet and returns as an array of objects
 */
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
    // Skip completely empty rows
    const hasData = row.some(cell => cell !== '' && cell !== null && cell !== undefined);
    if (!hasData) continue;

    const item = {};
    for (let c = 0; c < headers.length; c++) {
      let cellValue = row[c];
      if (cellValue instanceof Date) {
        cellValue = cellValue.toISOString();
      }
      item[headers[c]] = cellValue;
    }
    results.push(item);
  }

  return results;
}

/**
 * Handles GET requests:
 * - action=ping (health check)
 * - action=init (ensures tabs and headers exist)
 * - action=pull (fetches all data)
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || 'ping';

    if (action === 'ping') {
      return createJsonResponse({ status: 'ok', time: new Date().toISOString() });
    }

    if (action === 'init') {
      const initResult = ensureAllSheetsExist();
      return createJsonResponse({ status: 'ok', action: 'init', result: initResult });
    }

    if (action === 'pull') {
      ensureAllSheetsExist();
      const payload = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        settings: readSheetData('Settings'),
        doctors: readSheetData('Doctors'),
        products: readSheetData('Products'),
        camps: readSheetData('Camps'),
        areas: readSheetData('Areas'),
        pharmacies: readSheetData('Pharmacies'),
        visit_logs: readSheetData('Visit Logs')
      };
      return createJsonResponse(payload);
    }

    return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString(), stack: err.stack });
  }
}

/**
 * Handles POST requests (pushing new visits, adding/updating doctors, etc.)
 */
function doPost(e) {
  try {
    ensureAllSheetsExist();
    const contents = e.postData && e.postData.contents;
    if (!contents) {
      return createJsonResponse({ status: 'error', message: 'Empty POST body' });
    }

    const payload = JSON.parse(contents);
    const action = payload.action || 'sync';

    if (action === 'sync') {
      const ss = getSpreadsheet();
      const now = new Date().toISOString();
      const results = {
        doctors_synced: 0,
        visits_logged: 0,
        settings_synced: 0
      };

      // 1. Sync Doctors (Insert or Update by id)
      if (Array.isArray(payload.doctors) && payload.doctors.length > 0) {
        const docSheet = ss.getSheetByName('Doctors');
        const schema = TAB_SCHEMAS['Doctors'];
        const existingDocs = readSheetData('Doctors');
        const existingIdToRowMap = {};

        // Find row indices in sheet (1-based row index in spreadsheet)
        const docValues = docSheet.getDataRange().getValues();
        const idColIndex = schema.indexOf('id');
        for (let r = 1; r < docValues.length; r++) {
          const rowId = String(docValues[r][idColIndex]);
          if (rowId) {
            existingIdToRowMap[rowId] = r + 1; // 1-based index
          }
        }

        payload.doctors.forEach(doc => {
          const rowData = schema.map(col => {
            let val = doc[col];
            if (val === undefined || val === null) val = '';
            if (Array.isArray(val)) {
              val = val.join(', ');
            } else if (typeof val === 'object' && val !== null) {
              val = JSON.stringify(val);
            }
            if (col === 'updated_at' && !val) val = now;
            return val;
          });

          const docId = String(doc.id);
          if (existingIdToRowMap[docId]) {
            // Update existing row
            const targetRow = existingIdToRowMap[docId];
            docSheet.getRange(targetRow, 1, 1, schema.length).setValues([rowData]);
          } else {
            // Append new row
            docSheet.appendRow(rowData);
            existingIdToRowMap[docId] = docSheet.getLastRow();
          }
          results.doctors_synced++;
        });
      }

      // 2. Append Visit Logs (Never overwrite historical logs)
      if (Array.isArray(payload.visits) && payload.visits.length > 0) {
        const visitSheet = ss.getSheetByName('Visit Logs');
        const schema = TAB_SCHEMAS['Visit Logs'];
        const rowsToAppend = [];

        payload.visits.forEach(v => {
          const rowData = schema.map(col => {
            let val = v[col];
            if (val === undefined || val === null) val = '';
            if (col === 'synced_at') val = now;
            if (col === 'created_at' && !val) val = now;
            return val;
          });
          rowsToAppend.push(rowData);
        });

        if (rowsToAppend.length > 0) {
          const startRow = visitSheet.getLastRow() + 1;
          visitSheet.getRange(startRow, 1, rowsToAppend.length, schema.length).setValues(rowsToAppend);
          results.visits_logged = rowsToAppend.length;
        }
      }

      // 3. Sync Settings / Master data if provided
      if (Array.isArray(payload.settings) && payload.settings.length > 0) {
        const setSheet = ss.getSheetByName('Settings');
        const schema = TAB_SCHEMAS['Settings'];
        const setValues = setSheet.getDataRange().getValues();
        const keyToRowMap = {};

        for (let r = 1; r < setValues.length; r++) {
          const cat = String(setValues[r][0]);
          const val = String(setValues[r][1]);
          keyToRowMap[`${cat}::${val}`] = r + 1;
        }

        payload.settings.forEach(s => {
          const key = `${s.category}::${s.value}`;
          const rowData = [
            s.category || '',
            s.value || '',
            s.order_index || 0,
            s.description || '',
            s.active !== false ? 'TRUE' : 'FALSE',
            now
          ];

          if (keyToRowMap[key]) {
            setSheet.getRange(keyToRowMap[key], 1, 1, 6).setValues([rowData]);
          } else {
            setSheet.appendRow(rowData);
            keyToRowMap[key] = setSheet.getLastRow();
          }
          results.settings_synced++;
        });
      }

      return createJsonResponse({
        status: 'ok',
        timestamp: now,
        results: results
      });
    }

    return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString(), stack: err.stack });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
