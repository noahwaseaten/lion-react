function toCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase());
}

const SS_ID = '1C_iBD9Rf8nkE_D0v1rfNlpZg22TpDxZ7mJKs0LeY2DQ';
const HEADERS = ['firstName', 'lastName', 'age', 'count'];

function getSheetByGender(gender) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const name = gender === 'Women' ? 'Sheet2' : 'Sheet1';
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  } else {
    const values = sheet.getDataRange().getValues();
    if (values.length === 0 || values[0].length < HEADERS.length || values[0].slice(0, HEADERS.length).join('|').toLowerCase() !== HEADERS.join('|').toLowerCase()) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }
  }
  return sheet;
}

function readSheet(sheet, genderLabel) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(h => toCamelCase(h.toString().trim()));
  const rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });

    // Fallbacks if headers were missing or renamed in the sheet
    if (!obj.firstName && row[0] != null) obj.firstName = row[0];
    if (!obj.lastName && row[1] != null) obj.lastName = row[1];
    if (obj.count == null && row[3] != null) obj.count = row[3];

    // Normalize types and add gender
    obj.firstName = (obj.firstName || '').toString().trim();
    obj.lastName = (obj.lastName || '').toString().trim();
    obj.age = obj.age == null ? '' : obj.age;
    obj.count = Number(obj.count || 0) || 0;
    obj.gender = genderLabel; // Tag by sheet

    return obj;
  });

  return rows;
}

function doGet(e) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'sheetData';
  const nocache = e && e.parameter && e.parameter.nocache;
  let data = cache.get(cacheKey);
  if (data && !nocache) {
    Logger.log('Returning cached data');
    return ContentService
      .createTextOutput(JSON.stringify(JSON.parse(data)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.openById(SS_ID);
  const menSheet = ss.getSheetByName('Sheet1');
  const womenSheet = ss.getSheetByName('Sheet2');

  const menData = readSheet(menSheet, 'Men');
  const womenData = readSheet(womenSheet, 'Women');

  const allData = [...menData, ...womenData];
  Logger.log('Fetched data:', allData);

  cache.put(cacheKey, JSON.stringify(allData), 300); // 5 minutes

  return ContentService
    .createTextOutput(JSON.stringify(allData))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Missing POST body');
    }
    const payload = JSON.parse(e.postData.contents);
    const data = payload.data || payload;

    const firstName = data.firstName || data.name || '';
    const lastName = data.familyName || data.lastName || '';
    const age = data.age != null ? data.age : '';
    const count = data.count != null ? data.count : data.pushUps || data.pushups || 0;

    const g = (data.gender || '').toString();
    const normalizedGender = /women|female/i.test(g) ? 'Women' : 'Men';

    const sheet = getSheetByGender(normalizedGender);
    const row = [firstName, lastName, age, count];
    sheet.appendRow(row);

    // Invalidate script cache for immediate freshness
    try { CacheService.getScriptCache().remove('sheetData'); } catch (ignore) {}

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'OK' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ERROR', message: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}