/**
 * POS UMKM — Google Apps Script Web App (backend untuk Sinkronisasi Google Sheets)
 *
 * CARA PASANG:
 * 1. Buka Google Sheets baru (atau yang sudah ada) untuk menyimpan data POS.
 * 2. Di Sheet tsb: Extensions → Apps Script.
 * 3. Hapus kode default, tempel (paste) seluruh isi file ini.
 * 4. Klik Deploy → New deployment.
 *    - Select type: Web app
 *    - Description: bebas, mis. "POS Sync"
 *    - Execute as: Me
 *    - Who has access: Anyone  (WAJIB "Anyone", bukan "Anyone with Google account",
 *      supaya aplikasi POS di browser bisa mengaksesnya tanpa login Google)
 * 5. Klik Deploy, izinkan akses (Authorize access) saat diminta.
 * 6. Salin "Web app URL" yang muncul — itulah GAS URL yang diisi di aplikasi POS
 *    (menu Pengaturan → Sinkronisasi Google Sheets).
 * 7. Salin juga ID Google Sheets dari alamat sheet-nya, contoh:
 *    https://docs.google.com/spreadsheets/d/  1AbCDefGhIjkLmNoPQRstuVWxyz...  /edit
 *                                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ inilah Sheet ID
 * 8. Di aplikasi POS, klik "Test Koneksi" untuk memastikan semua sudah benar.
 *
 * CATATAN:
 * - Setiap kali Anda mengubah kode ini, Anda harus membuat deployment BARU
 *   (Deploy → Manage deployments → Edit → New version) agar perubahan berlaku
 *   pada Web App URL yang sama.
 * - Sheet-sheet (tab) akan dibuat otomatis oleh skrip ini saat pertama kali
 *   sync (Products, Sales, Purchases, dst) — Anda tidak perlu membuatnya manual.
 */

var SHEET_TABS = ["Users", "Categories", "Units", "Products", "Suppliers", "Customers",
  "Purchases", "Sales", "StockMovements", "Expenses", "CashTransactions",
  "Invoices", "ActivityLogs", "Branches", "Warehouses", "Settings"];

function doGet(e) {
  try {
    var action = e.parameter.action || "pull";
    var sheetId = e.parameter.sheetId;
    if (!sheetId) return jsonOutput({ ok: false, error: "sheetId wajib diisi" });

    if (action === "ping") {
      var ss = SpreadsheetApp.openById(sheetId); // will throw if ID salah / tidak ada akses
      return jsonOutput({ ok: true, message: "Koneksi berhasil ke: " + ss.getName() });
    }

    if (action === "pull") {
      var ss2 = SpreadsheetApp.openById(sheetId);
      var data = {};
      SHEET_TABS.forEach(function (name) {
        var sh = ss2.getSheetByName(name);
        data[name] = sh ? sheetToObjects(sh) : [];
      });
      return jsonOutput({ ok: true, data: data });
    }

    return jsonOutput({ ok: false, error: "Aksi tidak dikenal: " + action });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var sheetId = body.sheetId;
    if (!sheetId) return jsonOutput({ ok: false, error: "sheetId wajib diisi" });

    var ss = SpreadsheetApp.openById(sheetId);
    var tables = body.data || {};
    Object.keys(tables).forEach(function (name) {
      if (SHEET_TABS.indexOf(name) === -1) return;
      writeObjectsToSheet(ss, name, tables[name]);
    });

    return jsonOutput({ ok: true, syncedAt: new Date().toISOString() });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ---------------- Helpers ---------------- */

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects(sh) {
  var values = sh.getDataRange().getValues();
  if (values.length < 1) return [];
  var headers = values[0];
  var rows = values.slice(1);
  var out = [];
  rows.forEach(function (r) {
    var hasContent = r.some(function (c) { return c !== "" && c !== null; });
    if (!hasContent) return;
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = r[i]; });
    out.push(obj);
  });
  return out;
}

function writeObjectsToSheet(ss, name, rows) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clearContents();
  if (!rows || !rows.length) return;

  var headerSet = {};
  rows.forEach(function (r) { Object.keys(r).forEach(function (k) { headerSet[k] = true; }); });
  var headers = Object.keys(headerSet);

  var values = [headers];
  rows.forEach(function (r) {
    var row = headers.map(function (h) {
      var v = r[h];
      if (v === undefined || v === null) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return v;
    });
    values.push(row);
  });

  sh.getRange(1, 1, values.length, headers.length).setValues(values);
  sh.setFrozenRows(1);
}
