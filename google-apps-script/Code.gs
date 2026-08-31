/**
 * Google Apps Script for Medical Representative Field App
 * Spreadsheet ID: 1ruBHykbuZGVCi1iBO25rsnHujC2nrpFv1LwtuMYfX6I
 * 
 * Deployment Instructions:
 * 1. Open your Google Spreadsheet: https://docs.google.com/spreadsheets/d/1ruBHykbuZGVCi1iBO25rsnHujC2nrpFv1LwtuMYfX6I/edit
 * 2. Click Extensions > Apps Script
 * 3. Replace Code.gs with this code
 * 4. Click "Deploy" > "New deployment"
 * 5. Select type: "Web app"
 * 6. Description: "MedRep 4-Tab Sync Engine"
 * 7. Execute as: "Me"
 * 8. Who has access: "Anyone"
 * 9. Click "Deploy", authorize permissions, and paste the Web App URL into the app's Settings!
 */

const SPREADSHEET_ID = '1ruBHykbuZGVCi1iBO25rsnHujC2nrpFv1LwtuMYfX6I';

const TAB_SCHEMAS = {
  'Settings': [
    'Areas', 'Specialties', 'Camps', 'Potentials', 'Stockist', 'OP Timings', 'Call Schedule'
  ],
  'Doctors': [
    'ID', 'Name', 'Specialties', 'Hospital', 'Attached Pharmacy', 
    'Area', 'Camp', 'Potential', 'Stockist', 'Prescriber', 'OP Timing', 
    'Call Schedule', 'Prescribing Products', 'Notes', 'Active', 'Updated At'
  ],
  'Visits': [
    'Date', 'Day', 'Camp', 'Doctors (count)', 'Pharmacy (count)', 'Doctors', 'Pharmacy'
  ],
  'Products': [
    'ProdID', 'Name', 'DosageForm'
  ]
};

// Initial default settings to seed ONLY if a tab is newly created and empty
const DEFAULT_SETTINGS_MATRIX = {
  'Areas': ['Central Zone', 'North Zone', 'South Zone'],
  'Specialties': [
    'General Physician', 'Cardiologist', 'Dermatologist', 'Orthopedic',
    'Pediatrician', 'Gynecologist', 'ENT Specialist', 'Neurologist',
    'Pulmonologist', 'Gastroenterologist', 'Ophthalmologist', 'General Surgeon'
  ],
  'Camps': ['Proddatur', 'Kadapa', 'Jammalamadugu', 'Mydukur', 'Pulivendula'],
  'Potentials': ['Super Core', 'Core', 'High', 'Medium', 'Low'],
  'Stockist': ['Primary', 'Secondary', 'Direct', 'None'],
  'OP Timings': [
    'Morning (9:00 AM - 1:00 PM)',
    'Evening (5:00 PM - 9:00 PM)',
    'Both (Morning & Evening)',
    'Afternoon (2:00 PM - 5:00 PM)',
    'Other'
  ],
  'Call Schedule': [
    'Daily', 'Weekly', 'Bi-Weekly', 'Twice a Month', 'Monthly', 'Every 10 Days', 'Other'
  ]
};

const DEFAULT_PRODUCTS = [
  ['PROD-001', 'ACN 1000', 'Tabs'],
  ['PROD-002', 'ACN 650', 'Tabs'],
  ['PROD-003', 'ANECHEK', 'Tabs'],
  ['PROD-004', 'ANECHEK-XT', 'Tabs'],
  ['PROD-005', 'API-TOP', 'Drops'],
  ['PROD-006', 'Azithromycin 500mg', 'Tablet'],
  ['PROD-007', 'Pantoprazole DSR', 'Capsule'],
  ['PROD-008', 'Paracetamol 650mg', 'Tablet'],
  ['PROD-009', 'Telmisartan 40mg', 'Tablet'],
  ['PROD-010', 'Metformin 500mg SR', 'Tablet'],
  ['PROD-011', 'Montelukast 10mg', 'Tablet']
];

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
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

/**
 * Ensures all 4 primary sheets exist non-destructively.
 * - Leaves existing sheets, headers, and data completely intact.
 * - Creates only missing tabs with defined headers.
 * - Never creates Camps, Areas, or Pharmacies tabs.
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

      // Seed Settings sheet matrix only if newly created
      if (tabName === 'Settings') {
        const maxRows = Math.max(...Object.values(DEFAULT_SETTINGS_MATRIX).map(arr => arr.length));
        const matrixRows = [];
        for (let r = 0; r < maxRows; r++) {
          const row = columns.map(col => DEFAULT_SETTINGS_MATRIX[col]?.[r] || '');
          matrixRows.push(row);
        }
        if (matrixRows.length > 0) {
          sheet.getRange(2, 1, matrixRows.length, columns.length).setValues(matrixRows);
        }
      }

      // Seed Products sheet only if newly created
      if (tabName === 'Products' && DEFAULT_PRODUCTS.length > 0) {
        sheet.getRange(2, 1, DEFAULT_PRODUCTS.length, 3).setValues(DEFAULT_PRODUCTS);
      }
    } else {
      // If sheet exists but is completely empty (no columns), add headers
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) {
        sheet.appendRow(columns);
        sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold').setBackground('#f1f5f9');
        sheet.setFrozenRows(1);

        if (tabName === 'Settings') {
          const maxRows = Math.max(...Object.values(DEFAULT_SETTINGS_MATRIX).map(arr => arr.length));
          const matrixRows = [];
          for (let r = 0; r < maxRows; r++) {
            const row = columns.map(col => DEFAULT_SETTINGS_MATRIX[col]?.[r] || '');
            matrixRows.push(row);
          }
          if (matrixRows.length > 0) {
            sheet.getRange(2, 1, matrixRows.length, columns.length).setValues(matrixRows);
          }
        }
        if (tabName === 'Products' && DEFAULT_PRODUCTS.length > 0) {
          sheet.getRange(2, 1, DEFAULT_PRODUCTS.length, 3).setValues(DEFAULT_PRODUCTS);
        }
      }
      // If sheet already has data or headers, DO NOT touch or replace anything!
    }
  }

  return { success: true, createdTabs };
}

/**
 * Reads Settings matrix columns and returns clean structured category values
 */
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

  headers.forEach(h => {
    if (h) matrix[h] = [];
  });

  for (let r = 1; r < values.length; r++) {
    for (let c = 0; c < headers.length; c++) {
      const headerKey = headers[c];
      if (!headerKey) continue;
      const cellVal = values[r][c];
      if (cellVal !== '' && cellVal !== null && cellVal !== undefined) {
        matrix[headerKey].push(String(cellVal).trim());
      }
    }
  }

  return matrix;
}

/**
 * Reads tabular data from sheet preserving existing sheet structure
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
    const hasData = row.some(cell => cell !== '' && cell !== null && cell !== undefined);
    if (!hasData) continue;

    const item = {};
    for (let c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
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
 * Handles GET requests
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
        settings_matrix: readSettingsMatrix(),
        doctors: readSheetData('Doctors'),
        products: readSheetData('Products'),
        visits: readSheetData('Visits')
      };
      return createJsonResponse(payload);
    }

    return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString(), stack: err.stack });
  }
}

/**
 * Handles POST requests (syncing doctors, appending human-readable visit bundles)
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
        visits_logged: 0
      };

      // 1. Sync Doctors (Upsert by ID in Doctors sheet)
      if (Array.isArray(payload.doctors) && payload.doctors.length > 0) {
        const docSheet = ss.getSheetByName('Doctors');
        const existingValues = docSheet.getDataRange().getValues();
        const headers = existingValues.length > 0 ? existingValues[0].map(h => String(h).trim()) : TAB_SCHEMAS['Doctors'];
        
        // Map column header name to 0-based column index
        const colMap = {};
        headers.forEach((h, idx) => {
          colMap[h.toLowerCase()] = idx;
        });

        const idColIdx = colMap['id'] !== undefined ? colMap['id'] : 0;
        const existingIdToRowMap = {};

        for (let r = 1; r < existingValues.length; r++) {
          const rowId = String(existingValues[r][idColIdx]);
          if (rowId) {
            existingIdToRowMap[rowId] = r + 1; // 1-based row index
          }
        }

        payload.doctors.forEach(doc => {
          const specialtiesStr = Array.isArray(doc.specialties) 
            ? doc.specialties.join(', ') 
            : (doc.specialties || '');

          const prescribingProdsStr = (doc.prescriber === 'Rx' && Array.isArray(doc.prescribing_products))
            ? doc.prescribing_products.join(', ')
            : (doc.prescribing_products || '');

          // Build row matching existing sheet headers dynamically
          const rowData = new Array(headers.length).fill('');
          
          const fieldMap = {
            'id': doc.id || '',
            'name': doc.name || '',
            'specialties': specialtiesStr,
            'hospital': doc.hospital || '',
            'attached pharmacy': doc.pharmacy || '',
            'pharmacy': doc.pharmacy || '',
            'area': doc.area || '',
            'camp': doc.camp || '',
            'potential': doc.potential || '',
            'stockist': doc.stockist || '',
            'prescriber': doc.prescriber || 'NRx',
            'op timing': doc.op_timing_custom || doc.op_timing || '',
            'op timings': doc.op_timing_custom || doc.op_timing || '',
            'call schedule': doc.call_schedule_custom || doc.call_schedule || '',
            'prescribing products': prescribingProdsStr,
            'notes': doc.notes || '',
            'active': doc.is_active !== false ? 'TRUE' : 'FALSE',
            'updated at': doc.updated_at || now
          };

          headers.forEach((h, colIdx) => {
            const key = h.toLowerCase();
            if (fieldMap[key] !== undefined) {
              rowData[colIdx] = fieldMap[key];
            }
          });

          const docId = String(doc.id);
          if (existingIdToRowMap[docId]) {
            docSheet.getRange(existingIdToRowMap[docId], 1, 1, headers.length).setValues([rowData]);
          } else {
            docSheet.appendRow(rowData);
            existingIdToRowMap[docId] = docSheet.getLastRow();
          }
          results.doctors_synced++;
        });
      }

      // 2. Append Visit Bundles (1 Human-Readable Row Per Bundle)
      if (Array.isArray(payload.visit_bundles) && payload.visit_bundles.length > 0) {
        const visitSheet = ss.getSheetByName('Visits');
        const existingValues = visitSheet.getDataRange().getValues();
        const headers = existingValues.length > 0 ? existingValues[0].map(h => String(h).trim()) : TAB_SCHEMAS['Visits'];
        const rowsToAppend = [];

        payload.visit_bundles.forEach(bundle => {
          const dayName = bundle.day || getDayName(bundle.date);
          const isHolidayOrSunday = bundle.tag === 'sunday' || bundle.tag === 'holiday';

          // Format multi-line doctors list
          let doctorsCell = '';
          if (isHolidayOrSunday) {
            doctorsCell = bundle.tag === 'sunday' ? 'Sunday (No Visits)' : 'Holiday (No Visits)';
          } else if (Array.isArray(bundle.doctors_snapshot) && bundle.doctors_snapshot.length > 0) {
            doctorsCell = bundle.doctors_snapshot
              .map(d => `${d.name}${d.specialty ? ` (${d.specialty})` : ''}`)
              .join('\n');
          } else {
            doctorsCell = '-';
          }

          // Format multi-line pharmacies list
          let pharmacyCell = '';
          if (isHolidayOrSunday) {
            pharmacyCell = '-';
          } else if (Array.isArray(bundle.pharmacies_snapshot) && bundle.pharmacies_snapshot.length > 0) {
            pharmacyCell = bundle.pharmacies_snapshot.map(p => p.name).join('\n');
          } else {
            pharmacyCell = '-';
          }

          const fieldMap = {
            'date': bundle.date || '',
            'day': dayName,
            'camp': bundle.camp || '',
            'doctors (count)': isHolidayOrSunday ? 0 : (bundle.doctor_count || 0),
            'pharmacy (count)': isHolidayOrSunday ? 0 : (bundle.pharmacy_count || 0),
            'doctors': doctorsCell,
            'pharmacy': pharmacyCell
          };

          const rowData = new Array(headers.length).fill('');
          headers.forEach((h, colIdx) => {
            const key = h.toLowerCase();
            if (fieldMap[key] !== undefined) {
              rowData[colIdx] = fieldMap[key];
            }
          });

          rowsToAppend.push(rowData);
        });

        if (rowsToAppend.length > 0) {
          const startRow = visitSheet.getLastRow() + 1;
          visitSheet.getRange(startRow, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
          results.visits_logged = rowsToAppend.length;
        }
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
