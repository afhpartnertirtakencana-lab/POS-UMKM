/* =========================================================
   POS UMKM — UI helpers (format, toast, modal, icons, auth)
   ========================================================= */

const state = {
  currentUser: null,
  route: "dashboard",
  posCart: [],
  posCustomerId: "",
  posDiscount: 0,
};

/* Safe session storage, same fallback rationale as safeStorage in db.js */
const safeSession = (() => {
  const mem = {};
  try {
    const testKey = "__pos_sess_test__";
    window.sessionStorage.setItem(testKey, "1");
    window.sessionStorage.removeItem(testKey);
    return window.sessionStorage;
  } catch (e) {
    return {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; },
    };
  }
})();

function fmtMoney(n) {
  n = Math.round(Number(n) || 0);
  return DB.data.settings.currency + " " + n.toLocaleString("id-ID");
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(msg, kind = "ok") {
  const wrap = document.getElementById("toast-wrap");
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

function openModal(title, bodyHtml, opts = {}) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal-card ${opts.wide ? "modal-wide" : ""}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${title}</h3>
          <button class="icon-btn" id="modal-close" aria-label="Tutup">${ICON.x}</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
      </div>
    </div>`;
  document.getElementById("modal-close").onclick = closeModal;
  document.getElementById("modal-backdrop").addEventListener("mousedown", (e) => {
    if (e.target.id === "modal-backdrop") closeModal();
  });
}

function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
}

function confirmDialog(msg, onYes) {
  openModal("Konfirmasi", `
    <p class="text-sm mb-4">${escapeHtml(msg)}</p>
    <div class="flex justify-end gap-2">
      <button class="btn btn-ghost" id="cf-no">Batal</button>
      <button class="btn btn-danger" id="cf-yes">Ya, Lanjutkan</button>
    </div>`);
  document.getElementById("cf-no").onclick = closeModal;
  document.getElementById("cf-yes").onclick = () => { closeModal(); onYes(); };
}

const ICON = {
  dashboard: `<svg viewBox="0 0 24 24"><path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z"/></svg>`,
  pos: `<svg viewBox="0 0 24 24"><path d="M3 6h18l-1.5 9h-15L3 6Zm0 0-.7-2H1M8 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm10 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  product: `<svg viewBox="0 0 24 24"><path d="M21 8 12 3 3 8l9 5 9-5Zm0 0v8l-9 5m9-13-9 5m0 0L3 8m9 5v8M3 8v8l9 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  category: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="3" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="3" y="14" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="14" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`,
  supplier: `<svg viewBox="0 0 24 24"><path d="M3 10 12 4l9 6v9a1 1 0 0 1-1 1h-4v-6H8v6H4a1 1 0 0 1-1-1v-9Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  customer: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  purchase: `<svg viewBox="0 0 24 24"><path d="M4 6h16l-1.5 10.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 6Zm2.5-3h11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  stock: `<svg viewBox="0 0 24 24"><path d="M3 7 12 3l9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  cash: `<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`,
  invoice: `<svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6V2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12h6M9 16h6M9 8h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  report: `<svg viewBox="0 0 24 24"><path d="M5 20V10m7 10V4m7 16v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  export: `<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  settings: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.56-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1-1.56V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10a1.7 1.7 0 0 0 1.56 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  users: `<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0M16 8.2a3.2 3.2 0 1 1 3.6 3.17M17.5 14a6.2 6.2 0 0 1 4 5.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  log: `<svg viewBox="0 0 24 24"><path d="M5 3h11l3 3v15H5V3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 10h6M9 13h6M9 16h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  x: `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  plus: `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  edit: `<svg viewBox="0 0 24 24"><path d="m4 20 1-4.2L16 4.8l3.2 3.2L8.2 19 4 20Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  trash: `<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
  search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  print: `<svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6v-7Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  barcode: `<svg viewBox="0 0 24 24"><path d="M3 5v14M7 5v14M10 5v14M13 5v14m2 0V5m4 0v14M21 5v14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  bell: `<svg viewBox="0 0 24 24"><path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" stroke-width="1.6"/></svg>`,
  logout: `<svg viewBox="0 0 24 24"><path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  menu: `<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  wa: `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 8.3c.2-.5.5-.5.8-.5h.6c.2 0 .4 0 .6.5s.7 1.7.8 1.8.1.3 0 .5-.2.3-.4.5-.4.4-.2.7c.2.3.9 1.5 2 2.4 1.4 1.1 2 1.2 2.3 1.1s.5-.5.7-.8.5-.3.8-.2 1.7.8 2 1 .5.3.5.5-.1 1-.6 1.4c-.5.4-1.2.7-2.2.5-1-.2-3-.8-4.7-2.5-1.7-1.7-2.2-3.4-2.3-4.4s.2-1.7.5-2.1Z" fill="currentColor"/></svg>`,
  branch: `<svg viewBox="0 0 24 24"><path d="M6 3v18M6 6h10l-2 2 2 2H6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="18" cy="17" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
  sync: `<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 13.7-5.7L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.7 5.7L4 16m0 4v-4h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  cloud: `<svg viewBox="0 0 24 24"><path d="M7 18a4.5 4.5 0 0 1-.5-8.97A5.5 5.5 0 0 1 17.2 8.1 4 4 0 0 1 17 16H7Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
};

function svgIcon(name, cls = "ic") {
  return `<span class="${cls}">${ICON[name] || ""}</span>`;
}

/* ---------- Auth ---------- */

function login(username, password) {
  const u = DB.data.users.find((u) => u.username === username && u.password === password && u.active !== false);
  if (!u) return false;
  state.currentUser = u;
  safeSession.setItem("pos_session_uid", u.id);
  DB.log(u.id, "Login", `${u.name} masuk ke sistem`);
  return true;
}

function tryRestoreSession() {
  const uid = safeSession.getItem("pos_session_uid");
  if (uid) {
    const u = DB.data.users.find((x) => x.id === uid);
    if (u) state.currentUser = u;
  }
}

function logout() {
  DB.log(state.currentUser.id, "Logout", `${state.currentUser.name} keluar dari sistem`);
  state.currentUser = null;
  safeSession.removeItem("pos_session_uid");
  render();
}

/* ---------- Permissions ---------- */

const MENU = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", roles: ["Owner", "Manager", "Kasir", "Gudang"] },
  { id: "pos", label: "Penjualan (POS)", icon: "pos", roles: ["Owner", "Manager", "Kasir"] },
  { id: "produk", label: "Produk", icon: "product", roles: ["Owner", "Manager", "Gudang"] },
  { id: "kategori", label: "Kategori", icon: "category", roles: ["Owner", "Manager", "Gudang"] },
  { id: "supplier", label: "Supplier", icon: "supplier", roles: ["Owner", "Manager", "Gudang"] },
  { id: "pelanggan", label: "Pelanggan", icon: "customer", roles: ["Owner", "Manager", "Kasir"] },
  { id: "pembelian", label: "Pembelian", icon: "purchase", roles: ["Owner", "Manager", "Gudang"] },
  { id: "stok", label: "Stok", icon: "stock", roles: ["Owner", "Manager", "Gudang"] },
  { id: "kas", label: "Kas & Pengeluaran", icon: "cash", roles: ["Owner", "Manager"] },
  { id: "invoice", label: "Invoice", icon: "invoice", roles: ["Owner", "Manager", "Kasir"] },
  { id: "laporan", label: "Laporan", icon: "report", roles: ["Owner", "Manager"] },
  { id: "export", label: "Export Data", icon: "export", roles: ["Owner", "Manager"] },
  { id: "users", label: "User Management", icon: "users", roles: ["Owner"] },
  { id: "log", label: "Audit Log", icon: "log", roles: ["Owner"] },
  { id: "pengaturan", label: "Pengaturan", icon: "settings", roles: ["Owner", "Manager"] },
];

function menuFor(role) {
  return MENU.filter((m) => m.roles.includes(role));
}

function canAccess(routeId) {
  if (!state.currentUser) return false;
  const m = MENU.find((x) => x.id === routeId);
  if (!m) return true;
  return m.roles.includes(state.currentUser.role);
}
