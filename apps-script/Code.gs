/**
 * Pinner - backend Google Apps Script.
 * Incolla questo file nell'editor Apps Script di un Google Sheet
 * (Estensioni > Apps Script) e distribuiscilo come Web App.
 * Vedi README.md per i passaggi.
 */

// Cambia questo valore: lo stesso va inserito nelle impostazioni dell'app.
const SECRET = 'CAMBIA-QUESTO-SEGRETO';

const SHEET_ICONS = 'Icons';
const SHEET_ENTRIES = 'Entries';
const ICON_HEADERS = ['id', 'emoji', 'label', 'color', 'counter'];
const ENTRY_HEADERS = ['date', 'iconId', 'count'];

function doGet() {
  return json_({ ok: true, msg: 'Pinner API attiva' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const req = JSON.parse(e.postData.contents);
    if (req.token !== SECRET) return json_({ ok: false, error: 'Token non valido' });

    switch (req.action) {
      case 'getAll':
        return json_({ ok: true, icons: readIcons_(), entries: readEntries_() });
      case 'saveIcons':
        writeIcons_(req.icons || []);
        return json_({ ok: true });
      case 'setDay':
        setDay_(req.date, req.icons || []);
        return json_({ ok: true });
      default:
        return json_({ ok: false, error: 'Azione sconosciuta: ' + req.action });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.setFrozenRows(1);
  }
  // Riscrive sempre l'intestazione: aggiunge le colonne nuove a fogli creati da versioni precedenti.
  sh.getRange(1, 1, 1, headers.length).setNumberFormat('@').setValues([headers]).setFontWeight('bold');
  // Tutto come testo, per evitare che le date vengano convertite.
  sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');
  return sh;
}

function readRows_(sh, cols) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, cols).getValues();
}

function readIcons_() {
  const sh = sheet_(SHEET_ICONS, ICON_HEADERS);
  return readRows_(sh, 5)
    .filter(r => r[0] !== '')
    .map(r => ({ id: String(r[0]), emoji: String(r[1]), label: String(r[2]), color: String(r[3]), counter: String(r[4]) === '1' }));
}

function writeIcons_(icons) {
  const sh = sheet_(SHEET_ICONS, ICON_HEADERS);
  clearBody_(sh, 5);
  if (icons.length) {
    const rows = icons.map(i => [i.id, i.emoji, i.label, i.color, i.counter ? '1' : '0']);
    sh.getRange(2, 1, rows.length, 5).setValues(rows);
  }
}

function dateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v);
}

function readEntries_() {
  const sh = sheet_(SHEET_ENTRIES, ENTRY_HEADERS);
  return readRows_(sh, 3)
    .filter(r => r[0] !== '' && r[1] !== '')
    .map(r => [dateStr_(r[0]), String(r[1]), Number(r[2]) || 1]); // count vuoto (righe vecchie) = 1
}

// entries: array di [iconId, quantità]
function setDay_(date, entries) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Data non valida');
  const sh = sheet_(SHEET_ENTRIES, ENTRY_HEADERS);
  const rows = readEntries_().filter(r => r[0] !== date);
  entries.forEach(e => rows.push([date, e[0], e[1]]));
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  clearBody_(sh, 3);
  if (rows.length) sh.getRange(2, 1, rows.length, 3).setValues(rows);
}

function clearBody_(sh, cols) {
  const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, cols).clearContent();
}
