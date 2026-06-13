/**
 * RolloutOps Pro - Google Apps Script Backend
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open Google Sheets file "Báo cáo tiến độ triển khai.xlsx"
 * 2. Create a new sheet named "Users" with columns: Username | Password | DisplayName | Role
 * 3. Add user accounts to the Users sheet
 * 4. Go to Extensions > Apps Script
 * 5. Paste this entire code into the script editor
 * 6. Click Deploy > New deployment
 * 7. Select Type: Web app
 * 8. Execute as: Me
 * 9. Who has access: Anyone
 * 10. Click Deploy and copy the URL
 * 11. Paste the URL into the PWA config
 * 12. (Optional) Create a Google Drive folder for diagrams, put folder ID in DIAGRAMS_FOLDER_ID below
 */

// ⚠️ DÁN FOLDER ID GOOGLE DRIVE CHỨA SƠ ĐỒ ĐẤU NỐI VÀO ĐÂY:
var DIAGRAMS_FOLDER_ID = '1R9ULCgky45NaZXaIdifZ6-tsVJ65CFdi';

// ============================================================
// CONFIGURATION
// Script chạy trong spreadsheet, tự động lấy spreadsheet hiện tại
// ============================================================

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ============================================================
// HTTP HANDLERS
// ============================================================

function doGet(e) {
  try {
    const action = e.parameter.action;
    let result;

    switch (action) {
      case 'getSites':
        result = getSites();
        break;
      case 'login':
        result = login(e.parameter.username, e.parameter.password);
        break;
      case 'ping':
        result = { success: true, message: 'Server is running', timestamp: new Date().toISOString() };
        break;
      case 'getSectors':
        result = getSectors();
        break;
      case 'getDiagrams':
        result = getDiagrams(e.parameter.site);
        break;
      case 'getConfig':
        result = getConfig(e.parameter.site);
        break;
      default:
        result = { success: false, error: 'Invalid action. Available: getSites, getSectors, login, ping, getDiagrams, getConfig' };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    let result;

    switch (data.action) {
      case 'updateProgress':
        result = updateProgress(data);
        break;
      case 'batchUpdate':
        result = batchUpdate(data);
        break;
      default:
        result = { success: false, error: 'Invalid action. Available: updateProgress, batchUpdate' };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// AUTHENTICATION
// ============================================================

function login(username, password) {
  if (!username || !password) {
    return { success: false, message: 'Username và password không được để trống' };
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Users');

  if (!sheet) {
    return { success: false, message: 'Sheet "Users" không tồn tại. Vui lòng tạo sheet Users với cột: Username | Password | DisplayName' };
  }

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const sheetUser = String(data[i][0]).trim();
    const sheetPass = String(data[i][1]).trim();
    const displayName = String(data[i][2]).trim() || sheetUser;
    const role = data[i][3] ? String(data[i][3]).trim() : (sheetUser.toLowerCase() === 'admin' ? 'admin' : 'view');

    if (sheetUser.toLowerCase() === username.trim().toLowerCase() && sheetPass === password.trim()) {
      return {
        success: true,
        user: {
          username: sheetUser,
          displayName: displayName,
          role: role,
          backendVersion: 'v31'
        }
      };
    }
  }

  return { success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' };
}

// ============================================================
// GET SITES DATA
// ============================================================

function getSites() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Data');

  if (!sheet) {
    // Try the first sheet if "Data" doesn't exist
    const firstSheet = ss.getSheets()[0];
    if (!firstSheet) {
      return { success: false, error: 'No data sheet found' };
    }
    return parseSitesFromSheet(firstSheet);
  }

  return parseSitesFromSheet(sheet);
}

function parseSitesFromSheet(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { success: true, sites: [] };
  }

  const headers = data[0].map(h => String(h).trim());
  
  // Normalize header names to be consistent
  for (let i = 0; i < headers.length; i++) {
    const norm = headers[i].toLowerCase().normalize('NFC').replace(/\s+/g, '');
    if (norm === 'trạngthái' || norm === 'hoànthành' || norm === 'status') {
      headers[i] = 'Status';
    }
  }
  const sites = [];
  // Use Vietnam timezone to match user's local time
  const tz = 'Asia/Ho_Chi_Minh';

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Skip empty rows
    if (!row[0] || String(row[0]).trim() === '') continue;

    const site = {};
    headers.forEach((header, j) => {
      let value = row[j];
      // Convert numbers properly
      if (header === 'Long' || header === 'Lat') {
        value = parseFloat(value) || 0;
      } else if (value instanceof Date) {
        // Format Date using the spreadsheet's timezone (matches what user sees)
        value = Utilities.formatDate(value, tz, 'dd/MM/yyyy HH:mm:ss');
      } else {
        value = value !== null && value !== undefined ? String(value).trim() : '';
      }
      site[header] = value;
    });

    sites.push(site);
  }

  return { success: true, sites: sites, lastUpdated: new Date().toISOString() };
}

// ============================================================
// GET SECTORS DATA
// ============================================================

function getSectors() {
  const sheet = getSpreadsheet().getSheetByName('Map_sector');
  if (!sheet) {
    return { success: true, sectors: [] };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { success: true, sectors: [] };
  }

  const headers = data[0].map(h => String(h).trim());
  const sectors = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] || String(row[0]).trim() === '') continue;

    const sector = {};
    headers.forEach((header, j) => {
      let value = row[j];
      if (['Long', 'Lat', 'Azimuth', 'Tilt cơ', 'Tilt điện',
           'Độ cao so với chân cột', 'Độ cao so với mặt đất'].includes(header)) {
        value = parseFloat(value) || 0;
      } else {
        value = value !== null && value !== undefined ? String(value).trim() : '';
      }
      sector[header] = value;
    });
    sectors.push(sector);
  }

  return { success: true, sectors: sectors };
}

// ============================================================
// UPDATE PROGRESS
// ============================================================

function updateProgress(data) {
  if (!data.site) {
    return { success: false, message: 'Site name is required' };
  }

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('Data');
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).trim());

  // Find column indices
  const colIndex = {};
  
  // Robust search for columns
  const findCol = (searchTerms) => {
    for (let i = 0; i < headers.length; i++) {
      const norm = headers[i].toLowerCase().normalize('NFC').replace(/\s+/g, '');
      if (searchTerms.includes(norm)) return i;
    }
    return -1;
  };

  colIndex['Site'] = findCol(['site', 'mãtrạm']);
  colIndex['Phân loại'] = findCol(['phânloại', 'phanloai']);
  colIndex['Tiến độ 4G'] = findCol(['tiếnđộ4g', 'tiendo4g']);
  colIndex['Tiến độ 5G'] = findCol(['tiếnđộ5g', 'tiendo5g']);
  colIndex['Ghi chú (TKTU ONSITE)'] = findCol(['ghichú(tktuonsite)', 'ghichú', 'ghichu']);
  colIndex['User cập nhật'] = findCol(['usercậpnhật', 'usercapnhat']);
  colIndex['Ngày cập nhật'] = findCol(['ngàycậpnhật', 'ngaycapnhat']);
  
  let statusColIndex = findCol(['trạngthái', 'trangthai', 'hoànthành', 'hoanthanh', 'status']);

  // Find the row by Site name
  let targetRow = -1;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][colIndex['Site']]).trim() === data.site.trim()) {
      targetRow = i + 1; // 1-indexed for Sheets API
      break;
    }
  }

  if (targetRow === -1) {
    return { success: false, message: 'Không tìm thấy trạm: ' + data.site };
  }

  // Update cells
  const updates = [];

  if (data.progress4G !== undefined && colIndex['Tiến độ 4G'] >= 0) {
    sheet.getRange(targetRow, colIndex['Tiến độ 4G'] + 1).setValue(data.progress4G);
  }

  if (data.progress5G !== undefined && colIndex['Tiến độ 5G'] >= 0) {
    sheet.getRange(targetRow, colIndex['Tiến độ 5G'] + 1).setValue(data.progress5G);
  }

  if (data.note !== undefined && colIndex['Ghi chú (TKTU ONSITE)'] >= 0) {
    sheet.getRange(targetRow, colIndex['Ghi chú (TKTU ONSITE)'] + 1).setValue(data.note);
  }

  if (data.username && colIndex['User cập nhật'] >= 0) {
    sheet.getRange(targetRow, colIndex['User cập nhật'] + 1).setValue(data.username);
  }

  if (colIndex['Ngày cập nhật'] >= 0) {
    const tz = 'Asia/Ho_Chi_Minh';
    const now = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm:ss');
    const cell = sheet.getRange(targetRow, colIndex['Ngày cập nhật'] + 1);
    cell.setNumberFormat('@'); // Force plain text to prevent auto-conversion to Date
    cell.setValue(now);
  }

  // Calculate and update Status
  // statusColIndex is already determined securely
  if (statusColIndex >= 0 && colIndex['Phân loại'] >= 0) {
    const classification = String(sheet.getRange(targetRow, colIndex['Phân loại'] + 1).getValue()).trim();
    
    let p4g = data.progress4G !== undefined ? data.progress4G : (colIndex['Tiến độ 4G'] >= 0 ? String(sheet.getRange(targetRow, colIndex['Tiến độ 4G'] + 1).getValue()) : '');
    let p5g = data.progress5G !== undefined ? data.progress5G : (colIndex['Tiến độ 5G'] >= 0 ? String(sheet.getRange(targetRow, colIndex['Tiến độ 5G'] + 1).getValue()) : '');
    
    p4g = p4g.trim() === '' ? 'Chưa thực hiện' : p4g.trim();
    p5g = p5g.trim() === '' ? 'Chưa thực hiện' : p5g.trim();

    let trangThai = 'Chưa thực hiện';
    if (classification === '5G_4G Z') {
      if (p4g === 'Hoàn thành' && p5g === 'Hoàn thành') trangThai = 'Hoàn thành';
      else if (p4g === 'Đang thực hiện' || p5g === 'Đang thực hiện' || p4g === 'Hoàn thành' || p5g === 'Hoàn thành') trangThai = 'Đang thực hiện';
    } else if (classification === '5G Z') {
      if (p5g === 'Hoàn thành') trangThai = 'Hoàn thành';
      else if (p5g === 'Đang thực hiện') trangThai = 'Đang thực hiện';
    } else if (classification === '4G Z') {
      if (p4g === 'Hoàn thành') trangThai = 'Hoàn thành';
      else if (p4g === 'Đang thực hiện') trangThai = 'Đang thực hiện';
    }

    sheet.getRange(targetRow, statusColIndex + 1).setValue(trangThai);
  }



  return {
    success: true,
    message: 'Cập nhật thành công trạm ' + data.site,
    timestamp: Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss')
  };
}

// ============================================================
// BATCH UPDATE (for offline sync)
// ============================================================

function batchUpdate(data) {
  if (!data.updates || !Array.isArray(data.updates)) {
    return { success: false, message: 'Invalid batch update data' };
  }

  const results = [];
  for (const update of data.updates) {
    update.action = 'updateProgress';
    const result = updateProgress(update);
    results.push({ site: update.site, ...result });
  }

  const successCount = results.filter(r => r.success).length;
  return {
    success: true,
    message: `Đã cập nhật ${successCount}/${results.length} trạm`,
    results: results
  };
}

// ============================================================
// GET DIAGRAMS FROM GOOGLE DRIVE
// ============================================================

function getDiagrams(siteName) {
  if (!siteName) {
    return { success: false, error: 'Site name is required' };
  }
  if (!DIAGRAMS_FOLDER_ID) {
    return { success: true, diagrams: [], message: 'Diagrams folder not configured' };
  }

  try {
    var folder = DriveApp.getFolderById(DIAGRAMS_FOLDER_ID);
    // Search for files whose name starts with the station code
    var searchQuery = 'title contains "' + siteName.replace(/"/g, '') + '"';
    var files = folder.searchFiles(searchQuery);
    var diagrams = [];

    while (files.hasNext()) {
      var file = files.next();
      var fileName = file.getName();
      // Match if filename starts with exact sitename, avoiding partial matches like CMU0166 matching CMU0166-11
      // We check that the character following the site name is not alphanumeric and not a hyphen.
      // E.g., allowed: CMU0166.jpg, CMU0166_2.pdf, CMU0166 (1).png
      // Not allowed: CMU0166-11.jpg, CMU0166A.jpg
      var regex = new RegExp('^' + siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-zA-Z0-9\\-])', 'i');
      if (regex.test(fileName)) {
        diagrams.push({
          name: fileName,
          id: file.getId(),
          mimeType: file.getMimeType(),
          url: file.getUrl(),
          size: file.getSize()
        });
      }
    }

    // Sort by name
    diagrams.sort(function(a, b) { return a.name.localeCompare(b.name); });

    return { success: true, diagrams: diagrams };
  } catch (e) {
    return { success: false, error: 'Error accessing Drive folder: ' + e.message };
  }
}

// ============================================================
// GET CONFIG FILE
// ============================================================

function getConfig(siteName) {
  if (!siteName) return { success: false, error: 'Missing site parameter' };
  
  // Look for a sheet named 'Config' (or fallback names)
  var sheet = getSpreadsheet().getSheetByName('Config') || getSpreadsheet().getSheetByName('Map_config');
  if (!sheet) {
    return { success: false, error: 'Không tìm thấy sheet "Config"' };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: true, url: '' };

  const headers = data[0].map(h => String(h).trim());
  const siteIdx = headers.indexOf('Site');
  const urlIdx = headers.indexOf('URL');
  
  if (siteIdx === -1 || urlIdx === -1) {
    return { success: false, error: 'Thiếu cột Site hoặc URL trong sheet Config' };
  }

  for (let i = 1; i < data.length; i++) {
    const rowSite = String(data[i][siteIdx]).trim();
    if (rowSite.toUpperCase() === siteName.toUpperCase()) {
      return { success: true, url: String(data[i][urlIdx]).trim() };
    }
  }

  return { success: true, url: '' };
}

// ============================================================
// UTILITY: Test function (run in Apps Script editor)
// ============================================================

function testGetSites() {
  const result = getSites();
  Logger.log(JSON.stringify(result, null, 2));
}

function testLogin() {
  const result = login('admin', 'admin123');
  Logger.log(JSON.stringify(result, null, 2));
}

// ============================================================
// FIX: Convert Date objects in date columns to text strings
// Run this once to fix existing data with wrong timezone
// ============================================================

function fixDateColumns() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Data');
  if (!sheet) return;
  
  const tz = ss.getSpreadsheetTimeZone();
  Logger.log('Spreadsheet timezone: ' + tz);
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  
  const dateCols = ['Ngày cập nhật', 'Kế hoạch ngày'];
  
  dateCols.forEach(colName => {
    const colIdx = headers.indexOf(colName);
    if (colIdx < 0) return;
    
    let fixed = 0;
    for (let i = 1; i < data.length; i++) {
      const val = data[i][colIdx];
      if (val instanceof Date) {
        const formatted = Utilities.formatDate(val, tz, 
          colName === 'Kế hoạch ngày' ? 'dd/MM/yyyy' : 'dd/MM/yyyy HH:mm:ss');
        const cell = sheet.getRange(i + 1, colIdx + 1);
        cell.setNumberFormat('@');
        cell.setValue(formatted);
        fixed++;
      }
    }
    Logger.log(`${colName}: Fixed ${fixed} cells`);
  });
  
  Logger.log('Done! All date columns converted to text.');
}
