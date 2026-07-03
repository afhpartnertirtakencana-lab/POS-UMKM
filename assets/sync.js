/* =========================================================
   POS UMKM — Google Sheets Sync
   Talks to a Google Apps Script Web App deployed by the user
   (see google-apps-script/Code.gs for the server-side code).
   ========================================================= */

const SYNC_TABLES = [
  "Users", "Categories", "Units", "Products", "Suppliers", "Customers",
  "Purchases", "Sales", "StockMovements", "Expenses", "CashTransactions",
  "Invoices", "ActivityLogs", "Branches", "Warehouses", "Settings",
];

// Fields that hold nested objects/arrays and must be JSON-encoded as text
// when stored in a spreadsheet cell, then decoded again after pulling.
const SYNC_JSON_FIELDS = {
  Products: ["units"],
  Purchases: ["items"],
  Sales: ["items", "payments"],
};

const DB_ARRAY_KEY = {
  Users: "users", Categories: "categories", Units: "units", Products: "products",
  Suppliers: "suppliers", Customers: "customers", Purchases: "purchases", Sales: "sales",
  StockMovements: "stockMovements", Expenses: "expenses", CashTransactions: "cashTransactions",
  Invoices: "invoices", ActivityLogs: "activityLogs", Branches: "branches", Warehouses: "warehouses",
};

let autoSyncTimer = null;
const AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

function syncConfigured() {
  const s = DB.data.settings.sync || {};
  return !!(s.sheetId && s.gasUrl);
}

/* ---------- Build outgoing payload ---------- */

function buildSyncPayload() {
  const data = {};
  Object.entries(DB_ARRAY_KEY).forEach(([sheetName, key]) => {
    const jsonFields = SYNC_JSON_FIELDS[sheetName] || [];
    data[sheetName] = (DB.data[key] || []).map((row) => {
      const clone = { ...row };
      jsonFields.forEach((f) => { clone[f] = JSON.stringify(clone[f] ?? null); });
      return clone;
    });
  });
  // Settings is a single object, not an array — store as one row.
  const { sync, ...settingsWithoutSync } = DB.data.settings;
  data.Settings = [{ ...settingsWithoutSync, activeBranchId: DB.data.activeBranchId }];
  return data;
}

/* ---------- Apply incoming payload ---------- */

function applyPulledData(remote) {
  Object.entries(DB_ARRAY_KEY).forEach(([sheetName, key]) => {
    const rows = remote[sheetName];
    if (!Array.isArray(rows)) return;
    const jsonFields = SYNC_JSON_FIELDS[sheetName] || [];
    DB.data[key] = rows.map((row) => {
      const clone = { ...row };
      jsonFields.forEach((f) => {
        if (typeof clone[f] === "string" && clone[f]) {
          try { clone[f] = JSON.parse(clone[f]); } catch (e) { /* leave as-is */ }
        }
      });
      // Numbers may arrive as text from the sheet; coerce known numeric-ish fields back.
      return clone;
    });
  });
  if (Array.isArray(remote.Settings) && remote.Settings[0]) {
    const incoming = remote.Settings[0];
    const keepSync = DB.data.settings.sync;
    const { activeBranchId, ...rest } = incoming;
    DB.data.settings = { ...DB.data.settings, ...rest, sync: keepSync };
    if (activeBranchId) DB.data.activeBranchId = activeBranchId;
  }
  DB.save();
}

/* ---------- Network calls ----------
   Uses Content-Type: text/plain to avoid a CORS preflight request, since
   Apps Script web apps don't implement doOptions(). The server still reads
   the JSON body fine via e.postData.contents. */

async function gasRequest(gasUrl, params, body) {
  const url = new URL(gasUrl);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  const opts = body
    ? { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) }
    : { method: "GET" };
  const res = await fetch(url.toString(), opts);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Respon tidak dikenal dari Google Apps Script");
  return json;
}

async function testSyncConnection() {
  const s = DB.data.settings.sync;
  if (!s.gasUrl || !s.sheetId) throw new Error("Isi dulu Sheet ID dan GAS URL");
  return gasRequest(s.gasUrl, { action: "ping", sheetId: s.sheetId });
}

async function syncPush(silent) {
  const s = DB.data.settings.sync;
  if (!syncConfigured()) { if (!silent) toast("Isi dulu Sheet ID dan GAS URL di Pengaturan", "danger"); return false; }
  try {
    if (!silent) toast("Mengirim data ke Google Sheets...");
    await gasRequest(s.gasUrl, {}, { sheetId: s.sheetId, data: buildSyncPayload() });
    markSyncSuccess("push");
    if (!silent) toast("Data berhasil dikirim ke Google Sheets");
    return true;
  } catch (err) {
    markSyncFailure(err);
    if (!silent) toast("Gagal sync: " + err.message, "danger");
    return false;
  }
}

async function syncPull(silent) {
  const s = DB.data.settings.sync;
  if (!syncConfigured()) { if (!silent) toast("Isi dulu Sheet ID dan GAS URL di Pengaturan", "danger"); return false; }
  try {
    if (!silent) toast("Mengambil data dari Google Sheets...");
    const json = await gasRequest(s.gasUrl, { action: "pull", sheetId: s.sheetId });
    applyPulledData(json.data || {});
    markSyncSuccess("pull");
    if (!silent) toast("Data berhasil diperbarui dari Google Sheets");
    return true;
  } catch (err) {
    markSyncFailure(err);
    if (!silent) toast("Gagal sync: " + err.message, "danger");
    return false;
  }
}

/** Full sync: push local state up first (so this device's edits aren't lost),
 *  then pull to confirm the merged state. Used by both the manual button and
 *  the 15-minute auto-sync timer. */
async function syncNow(silent) {
  if (!syncConfigured()) { if (!silent) toast("Isi dulu Sheet ID dan GAS URL di Pengaturan", "danger"); return; }
  const pushed = await syncPush(true);
  if (!pushed) { if (!silent) toast("Sinkronisasi gagal, periksa koneksi & pengaturan GAS URL", "danger"); return; }
  const pulled = await syncPull(true);
  if (pulled) {
    if (!silent) toast("Sinkronisasi selesai");
    render();
  } else if (!silent) {
    toast("Sebagian sinkronisasi gagal saat mengambil data", "danger");
  }
}

function markSyncSuccess(mode) {
  DB.data.settings.sync.lastSync = nowISO();
  DB.data.settings.sync.lastStatus = "ok:" + mode;
  DB.save();
  updateSyncIndicator();
}

function markSyncFailure(err) {
  DB.data.settings.sync.lastStatus = "error:" + (err?.message || err);
  DB.save();
  updateSyncIndicator();
}

function updateSyncIndicator() {
  const el = document.getElementById("sync-status-dot");
  if (!el) return;
  const st = DB.data.settings.sync.lastStatus || "";
  el.className = "sync-dot " + (st.startsWith("ok") ? "sync-ok" : st.startsWith("error") ? "sync-error" : "sync-idle");
}

/* ---------- Auto-sync timer ---------- */

function startAutoSync() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  autoSyncTimer = setInterval(() => {
    if (DB.data.settings.sync.autoSync && syncConfigured()) syncNow(true);
  }, AUTO_SYNC_INTERVAL_MS);
}
