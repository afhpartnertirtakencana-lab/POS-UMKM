/* =========================================================
   POS UMKM — Data layer (localStorage-backed "database")
   ========================================================= */

const DB_KEY = "pos_umkm_db_v1";

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
  ],
  categories: [
    { id: "c_makanan", name: "Makanan" },
    { id: "c_minuman", name: "Minuman" },
    { id: "c_snack", name: "Snack" },
    { id: "c_rumahtangga", name: "Rumah Tangga" },
    { id: "c_lainnya", name: "Lainnya" },
  ],
  products: [
    {
      id: "p_001", name: "Indomie Goreng", barcode: "8992388101014", categoryId: "c_makanan",
      photo: "", baseUnitId: "un_pcs", warehouseId: "wh_main",
      units: [
        { unitId: "un_pcs", conversion: 1, price: 3500, cost: 2800 },
        { unitId: "un_krt", conversion: 40, price: 130000, cost: 108000 },
      ],
      stock: 240, minStock: 40, expiryDate: "2026-12-01",
    },
    {
      id: "p_002", name: "Aqua Botol 600ml", barcode: "8993675610019", categoryId: "c_minuman",
      photo: "", baseUnitId: "un_pcs", warehouseId: "wh_main",
      units: [
        { unitId: "un_pcs", conversion: 1, price: 4000, cost: 3200 },
        { unitId: "un_box", conversion: 24, price: 90000, cost: 74000 },
      ],
      stock: 96, minStock: 24, expiryDate: "2027-06-01",
    },
    {
      id: "p_003", name: "Chitato Sapi Panggang", barcode: "8996001600123", categoryId: "c_snack",
      photo: "", baseUnitId: "un_pcs", warehouseId: "wh_main",
      units: [{ unitId: "un_pcs", conversion: 1, price: 12000, cost: 9500 }],
      stock: 18, minStock: 20, expiryDate: "2026-09-15",
    },
    {
      id: "p_004", name: "Sabun Cuci Piring Sunlight 750ml", barcode: "8999999530012", categoryId: "c_rumahtangga",
      photo: "", baseUnitId: "un_pcs", warehouseId: "wh_main",
      units: [{ unitId: "un_pcs", conversion: 1, price: 15500, cost: 12800 }],
      stock: 30, minStock: 10, expiryDate: "",
    },
    {
      id: "p_005", name: "Beras Premium 5kg", barcode: "8991002130456", categoryId: "c_makanan",
      photo: "", baseUnitId: "un_kg", warehouseId: "wh_main",
      units: [{ unitId: "un_kg", conversion: 1, price: 68000, cost: 60000 }],
      stock: 25, minStock: 5, expiryDate: "2026-11-20",
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
    const raw = localStorage.getItem(DB_KEY);
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
    return this.data;
  },

  save() {
    localStorage.setItem(DB_KEY, JSON.stringify(this.data));
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
