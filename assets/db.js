/* =========================================================
   POS UMKM — Data layer (localStorage-backed "database")
   ========================================================= */

const DB_KEY = "pos_umkm_db_v1";

/* Safe storage: some environments (sandboxed previews, file:// with strict
   privacy settings, private browsing) throw when touching localStorage.
   Fall back to an in-memory store so the app still runs (data just won't
   persist across reloads in that case). */
const safeStorage = (() => {
  const mem = {};
  try {
    const testKey = "__pos_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (e) {
    console.warn("localStorage tidak tersedia, menggunakan penyimpanan sementara di memori.", e);
    return {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; },
    };
  }
})();

function uid(prefix) {
  return (prefix ? prefix + "_" : "") + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowISO() {
  return new Date().toISOString();
}

const DEFAULT_DB = {
  settings: {
    storeName: "Toko Makmur Jaya",
    address: "Jl. Melati No. 12, Jakarta",
    phone: "0812-3456-7890",
    npwp: "",
    taxPercent: 0,
    logo: "",
    receiptFooter: "Terima kasih telah berbelanja!",
    currency: "Rp",
    receiptWidth: "58", // 58mm or 80mm thermal
    qrisImage: "",
    lowStockThreshold: 5,
    expiryWarningDays: 30,
    sync: {
      sheetId: "",
      gasUrl: "",
      autoSync: false,
      lastSync: "",
      lastStatus: "",
    },
  },
  branches: [{ id: "br_main", name: "Cabang Utama" }],
  warehouses: [{ id: "wh_main", name: "Gudang Utama", branchId: "br_main" }],
  activeBranchId: "br_main",
  roles: ["Owner", "Manager", "Kasir", "Gudang"],
  users: [
    { id: "u_owner", name: "Budi Santoso", username: "owner", password: "owner123", role: "Owner", active: true },
    { id: "u_mgr", name: "Siti Aminah", username: "manager", password: "manager123", role: "Manager", active: true },
    { id: "u_kasir", name: "Andi Wijaya", username: "kasir", password: "kasir123", role: "Kasir", active: true },
    { id: "u_gudang", name: "Dedi Kurniawan", username: "gudang", password: "gudang123", role: "Gudang", active: true },
  ],
  units: [
    { id: "un_pcs", name: "Pcs" },
    { id: "un_box", name: "Box" },
    { id: "un_krt", name: "Karton" },
    { id: "un_kg", name: "Kg" },
    { id: "un_ltr", name: "Liter" },
    { id: "un_set", name: "Set" },
    { id: "un_psg", name: "Pasang" },
  ],
  categories: [
    { id: "c_mesin", name: "Mesin" },
    { id: "c_body", name: "Body & Rangka" },
    { id: "c_kelistrikan", name: "Kelistrikan" },
    { id: "c_oli", name: "Oli & Pelumas" },
    { id: "c_aksesoris", name: "Aksesoris" },
  ],
  products: [
    {
      id: "p_001", name: "Piston Kit Vespa Excel 150cc", barcode: "8991122301014", categoryId: "c_mesin",
      photo: "", baseUnitId: "un_set", warehouseId: "wh_main",
      units: [{ unitId: "un_set", conversion: 1, price: 285000, cost: 235000 }],
      stock: 14, minStock: 5, expiryDate: "",
    },
    {
      id: "p_002", name: "Karburator PWK 28mm Vespa", barcode: "8991122302011", categoryId: "c_mesin",
      photo: "", baseUnitId: "un_pcs", warehouseId: "wh_main",
      units: [{ unitId: "un_pcs", conversion: 1, price: 450000, cost: 375000 }],
      stock: 6, minStock: 3, expiryDate: "",
    },
    {
      id: "p_003", name: "Kabel Gas Vespa Excel/Super", barcode: "8991122303028", categoryId: "c_mesin",
      photo: "", baseUnitId: "un_pcs", warehouseId: "wh_main",
      units: [{ unitId: "un_pcs", conversion: 1, price: 35000, cost: 26000 }],
      stock: 22, minStock: 8, expiryDate: "",
    },
    {
      id: "p_004", name: "Kampas Rem Depan Vespa Matic", barcode: "8991122304035", categoryId: "c_body",
      photo: "", baseUnitId: "un_set", warehouseId: "wh_main",
      units: [{ unitId: "un_set", conversion: 1, price: 65000, cost: 48000 }],
      stock: 18, minStock: 6, expiryDate: "",
    },
    {
      id: "p_005", name: "Ban Luar Vespa Matic Ring 12", barcode: "8991122305042", categoryId: "c_body",
      photo: "", baseUnitId: "un_pcs", warehouseId: "wh_main",
      units: [{ unitId: "un_pcs", conversion: 1, price: 320000, cost: 265000 }],
      stock: 10, minStock: 4, expiryDate: "",
    },
    {
      id: "p_006", name: "Spion Vespa Original (sepasang)", barcode: "8991122306059", categoryId: "c_aksesoris",
      photo: "", baseUnitId: "un_psg", warehouseId: "wh_main",
      units: [{ unitId: "un_psg", conversion: 1, price: 95000, cost: 72000 }],
      stock: 12, minStock: 4, expiryDate: "",
    },
    {
      id: "p_007", name: "Aki GS Astra Vespa Matic 12V", barcode: "8991122307066", categoryId: "c_kelistrikan",
      photo: "", baseUnitId: "un_pcs", warehouseId: "wh_main",
      units: [{ unitId: "un_pcs", conversion: 1, price: 215000, cost: 178000 }],
      stock: 8, minStock: 3, expiryDate: "",
    },
    {
      id: "p_008", name: "Busi NGK CPR8EA-9 Vespa", barcode: "8991122308073", categoryId: "c_kelistrikan",
      photo: "", baseUnitId: "un_pcs", warehouseId: "wh_main",
      units: [
        { unitId: "un_pcs", conversion: 1, price: 28000, cost: 21000 },
        { unitId: "un_box", conversion: 10, price: 260000, cost: 205000 },
      ],
      stock: 45, minStock: 15, expiryDate: "",
    },
    {
      id: "p_009", name: "Lampu LED Headlamp Vespa Matic", barcode: "8991122309080", categoryId: "c_kelistrikan",
      photo: "", baseUnitId: "un_pcs", warehouseId: "wh_main",
      units: [{ unitId: "un_pcs", conversion: 1, price: 125000, cost: 95000 }],
      stock: 9, minStock: 4, expiryDate: "",
    },
    {
      id: "p_010", name: "Oli Mesin Matic Federal 800ml", barcode: "8991122310096", categoryId: "c_oli",
      photo: "", baseUnitId: "un_pcs", warehouseId: "wh_main",
      units: [
        { unitId: "un_pcs", conversion: 1, price: 48000, cost: 39000 },
        { unitId: "un_krt", conversion: 12, price: 540000, cost: 452000 },
      ],
      stock: 36, minStock: 12, expiryDate: "2028-01-01",
    },

  ],
  suppliers: [
    { id: "sup_001", name: "PT Sumber Makmur Distribusi", phone: "021-5551234", address: "Jl. Industri Raya No. 5", debt: 1300000 },
    { id: "sup_002", name: "CV Aneka Snack Nusantara", phone: "021-5559876", address: "Jl. Gudang No. 8", debt: 0 },
  ],
  customers: [
    { id: "cust_001", name: "Ibu Rina", phone: "0813-1111-2222", points: 120, memberSince: "2025-02-10" },
    { id: "cust_002", name: "Pak Joko", phone: "0813-3333-4444", points: 45, memberSince: "2025-06-21" },
  ],
  purchases: [],
  sales: [],
  stockMovements: [],
  expenses: [],
  cashTransactions: [],
  invoices: [],
  activityLogs: [],
  _seeded: true,
};

const DB = {
  data: null,

  load() {
    const raw = safeStorage.getItem(DB_KEY);
    if (raw) {
      try {
        this.data = JSON.parse(raw);
      } catch (e) {
        console.error("DB parse error, resetting", e);
        this.data = structuredClone(DEFAULT_DB);
      }
    } else {
      this.data = structuredClone(DEFAULT_DB);
      this.save();
    }
    this.migrate();
    return this.data;
  },

  migrate() {
    // Fill in fields that may be missing from data saved by an older version.
    if (!this.data.settings) this.data.settings = structuredClone(DEFAULT_DB.settings);
    if (!this.data.settings.sync) {
      this.data.settings.sync = structuredClone(DEFAULT_DB.settings.sync);
      this.save();
    }
  },

  save() {
    safeStorage.setItem(DB_KEY, JSON.stringify(this.data));
  },

  reset() {
    this.data = structuredClone(DEFAULT_DB);
    this.save();
  },

  wipe() {
    const settings = this.data.settings;
    this.data = structuredClone(DEFAULT_DB);
    this.data.settings = settings;
    this.data.products = [];
    this.data.categories = DEFAULT_DB.categories;
    this.data.units = DEFAULT_DB.units;
    this.data.suppliers = [];
    this.data.customers = [];
    this.data.sales = [];
    this.data.purchases = [];
    this.data.stockMovements = [];
    this.data.expenses = [];
    this.data.cashTransactions = [];
    this.data.activityLogs = [];
    this.save();
  },

  log(userId, action, detail) {
    this.data.activityLogs.unshift({
      id: uid("log"), date: nowISO(), userId, action, detail: detail || "",
    });
    if (this.data.activityLogs.length > 2000) this.data.activityLogs.length = 2000;
    this.save();
  },

  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  },

  importJSON(json) {
    const parsed = JSON.parse(json);
    this.data = parsed;
    this.save();
  },
};

DB.load();
