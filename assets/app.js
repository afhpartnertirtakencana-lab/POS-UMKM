/* =========================================================
   POS UMKM — App router + page renderers
   ========================================================= */

function render() {
  tryRestoreSession();
  const root = document.getElementById("root");
  if (!state.currentUser) {
    root.innerHTML = renderLogin();
    bindLogin();
    return;
  }
  if (!canAccess(state.route)) state.route = "dashboard";
  root.innerHTML = renderShell();
  bindShell();
  renderRoute();
}

/* ---------------------------- LOGIN ---------------------------- */

function renderLogin() {
  const users = DB.data.users.filter((u) => u.active !== false);
  return `
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-brand">
        <div class="brand-mark">MJ</div>
        <div>
          <div class="brand-name">${escapeHtml(DB.data.settings.storeName)}</div>
          <div class="brand-sub">Sistem Kasir &amp; Manajemen Toko</div>
        </div>
      </div>
      <form id="login-form">
        <label class="field-label">Username</label>
        <input class="input" id="login-user" placeholder="mis. kasir" autocomplete="username" required />
        <label class="field-label">Password</label>
        <input class="input" id="login-pass" type="password" placeholder="••••••••" autocomplete="current-password" required />
        <button class="btn btn-primary w-full" type="submit">Masuk</button>
        <div id="login-err" class="login-err"></div>
      </form>
      <div class="login-demo">
        <div class="login-demo-title">Akun demo</div>
        <div class="demo-grid">
          ${users.map((u) => `<button class="demo-chip" data-u="${u.username}" data-p="${u.password}">${u.role}<span>${u.username}</span></button>`).join("")}
        </div>
      </div>
    </div>
  </div>`;
}

function bindLogin() {
  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const u = document.getElementById("login-user").value.trim();
    const p = document.getElementById("login-pass").value;
    if (login(u, p)) {
      render();
    } else {
      document.getElementById("login-err").textContent = "Username atau password salah.";
    }
  });
  document.querySelectorAll(".demo-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("login-user").value = btn.dataset.u;
      document.getElementById("login-pass").value = btn.dataset.p;
    });
  });
}

/* ---------------------------- SHELL ---------------------------- */

function renderShell() {
  const menu = menuFor(state.currentUser.role);
  return `
  <div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <div class="side-brand">
        <div class="brand-mark sm">MJ</div>
        <div>
          <div class="brand-name sm">${escapeHtml(DB.data.settings.storeName)}</div>
          <div class="brand-sub sm">POS UMKM</div>
        </div>
      </div>
      <nav class="side-nav">
        ${menu.map((m) => `
          <a href="#/${m.id}" class="side-link ${state.route === m.id ? "active" : ""}" data-route="${m.id}">
            ${svgIcon(m.icon)} <span>${m.label}</span>
          </a>`).join("")}
      </nav>
      <div class="side-foot">
        <div class="side-user">
          <div class="avatar">${escapeHtml(state.currentUser.name[0])}</div>
          <div>
            <div class="side-user-name">${escapeHtml(state.currentUser.name)}</div>
            <div class="side-user-role">${escapeHtml(state.currentUser.role)}</div>
          </div>
        </div>
        <button class="icon-btn" id="btn-logout" title="Keluar">${svgIcon("logout")}</button>
      </div>
    </aside>
    <div class="backdrop-mobile" id="backdrop-mobile"></div>

    <div class="main-col">
      <header class="topbar">
        <button class="icon-btn only-mobile" id="btn-menu">${svgIcon("menu")}</button>
        <div class="topbar-title" id="topbar-title">${(MENU.find((m) => m.id === state.route) || {}).label || ""}</div>
        <div class="topbar-spacer"></div>
        <div class="branch-pill">${svgIcon("branch")}<span>${escapeHtml((DB.data.branches.find(b=>b.id===DB.data.activeBranchId)||{}).name||"")}</span></div>
        <button class="icon-btn" id="btn-sync" title="Sinkronisasi Google Sheets">
          ${svgIcon("sync")}<span class="sync-dot" id="sync-status-dot"></span>
        </button>
        <button class="icon-btn" id="btn-alerts" title="Notifikasi">${svgIcon("bell")}<span class="dot" id="alert-dot"></span></button>
      </header>
      <main class="content" id="content"></main>
    </div>
  </div>
  <div class="toast-wrap" id="toast-wrap"></div>
  <div id="modal-root"></div>`;
}

function bindShell() {
  document.getElementById("btn-logout").addEventListener("click", () => confirmDialog("Keluar dari sistem?", logout));
  document.querySelectorAll(".side-link").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      state.route = a.dataset.route;
      document.getElementById("sidebar").classList.remove("open");
      document.getElementById("backdrop-mobile").classList.remove("show");
      render();
    });
  });
  const btnMenu = document.getElementById("btn-menu");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("backdrop-mobile");
  if (btnMenu) {
    btnMenu.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      backdrop.classList.toggle("show");
    });
    backdrop.addEventListener("click", () => {
      sidebar.classList.remove("open");
      backdrop.classList.remove("show");
    });
  }
  document.getElementById("btn-alerts").addEventListener("click", showAlertsPanel);
  document.getElementById("btn-sync").addEventListener("click", showSyncPanel);
  updateAlertDot();
  updateSyncIndicator();
}

function getAlerts() {
  const s = DB.data.settings;
  const low = DB.data.products.filter((p) => p.stock <= (p.minStock ?? s.lowStockThreshold));
  const soon = new Date();
  soon.setDate(soon.getDate() + (s.expiryWarningDays || 30));
  const expiring = DB.data.products.filter((p) => p.expiryDate && new Date(p.expiryDate) <= soon);
  const debts = DB.data.suppliers.filter((sp) => sp.debt > 0);
  return { low, expiring, debts };
}

function updateAlertDot() {
  const { low, expiring } = getAlerts();
  const dot = document.getElementById("alert-dot");
  if (!dot) return;
  dot.style.display = low.length + expiring.length > 0 ? "block" : "none";
}

function showAlertsPanel() {
  const { low, expiring, debts } = getAlerts();
  openModal("Notifikasi", `
    <div class="alert-section">
      <h4>Stok Menipis (${low.length})</h4>
      ${low.length ? `<ul class="alert-list">${low.map((p) => `<li><span>${escapeHtml(p.name)}</span><b class="text-danger">${p.stock} tersisa</b></li>`).join("")}</ul>` : `<p class="muted">Tidak ada</p>`}
    </div>
    <div class="alert-section">
      <h4>Mendekati Kadaluarsa (${expiring.length})</h4>
      ${expiring.length ? `<ul class="alert-list">${expiring.map((p) => `<li><span>${escapeHtml(p.name)}</span><b class="text-warn">${fmtDate(p.expiryDate)}</b></li>`).join("")}</ul>` : `<p class="muted">Tidak ada</p>`}
    </div>
    <div class="alert-section">
      <h4>Hutang ke Supplier (${debts.length})</h4>
      ${debts.length ? `<ul class="alert-list">${debts.map((p) => `<li><span>${escapeHtml(p.name)}</span><b class="text-danger">${fmtMoney(p.debt)}</b></li>`).join("")}</ul>` : `<p class="muted">Tidak ada</p>`}
    </div>`, { wide: true });
}

function showSyncPanel() {
  const s = DB.data.settings.sync;
  const configured = syncConfigured();
  const st = s.lastStatus || "";
  const statusText = st.startsWith("ok") ? "Berhasil" : st.startsWith("error") ? "Gagal: " + st.slice(6) : "Belum pernah sync";
  openModal("Sinkronisasi Google Sheets", `
    <div class="row-between"><span>Status</span><b class="${st.startsWith("ok") ? "text-ok" : st.startsWith("error") ? "text-danger" : "muted"}">${escapeHtml(statusText)}</b></div>
    <div class="row-between"><span>Terakhir sync</span><b>${s.lastSync ? fmtDateTime(s.lastSync) : "-"}</b></div>
    <div class="row-between"><span>Auto-sync (15 menit)</span><b>${s.autoSync ? "Aktif" : "Nonaktif"}</b></div>
    ${configured ? "" : `<p class="muted small mt">Sinkronisasi belum dikonfigurasi. Isi Sheet ID &amp; GAS URL di menu Pengaturan → Sinkronisasi Google Sheets.</p>`}
    <div class="flex gap-2 mt" style="flex-wrap:wrap;">
      <button class="btn btn-primary" id="sy-now" ${configured ? "" : "disabled"}>${svgIcon("sync")} Sync Sekarang</button>
      <button class="btn btn-ghost" id="sy-push" ${configured ? "" : "disabled"}>Push saja (Lokal → Sheets)</button>
      <button class="btn btn-ghost" id="sy-pull" ${configured ? "" : "disabled"}>Pull saja (Sheets → Lokal)</button>
      ${configured ? "" : `<button class="btn btn-ghost" id="sy-goto">Buka Pengaturan</button>`}
    </div>
  `, { wide: false });
  const sy = document.getElementById("sy-now");
  if (sy) sy.addEventListener("click", async () => { sy.disabled = true; await syncNow(false); closeModal(); });
  const sp = document.getElementById("sy-push");
  if (sp) sp.addEventListener("click", async () => { sp.disabled = true; await syncPush(false); updateSyncIndicator(); closeModal(); });
  const sl = document.getElementById("sy-pull");
  if (sl) sl.addEventListener("click", async () => { sl.disabled = true; await syncPull(false); updateSyncIndicator(); closeModal(); render(); });
  const gt = document.getElementById("sy-goto");
  if (gt) gt.addEventListener("click", () => { closeModal(); go("pengaturan"); });
}

function renderRoute() {
  const c = document.getElementById("content");
  const routes = {
    dashboard: renderDashboard,
    pos: renderPOS,
    produk: renderProduk,
    kategori: renderKategori,
    supplier: renderSupplier,
    pelanggan: renderPelanggan,
    pembelian: renderPembelian,
    stok: renderStok,
    kas: renderKas,
    invoice: renderInvoice,
    laporan: renderLaporan,
    export: renderExport,
    users: renderUsers,
    log: renderLog,
    pengaturan: renderPengaturan,
  };
  const fn = routes[state.route] || renderDashboard;
  c.innerHTML = fn();
  const after = window["after_" + state.route];
  if (typeof after === "function") after();
}

function go(route) {
  state.route = route;
  render();
}

/* ---------------------------- DASHBOARD ---------------------------- */

function renderDashboard() {
  const todayStr = todayISO();
  const salesToday = DB.data.sales.filter((s) => s.date.slice(0, 10) === todayStr);
  const totalToday = salesToday.reduce((a, s) => a + s.total, 0);
  const trxToday = salesToday.length;
  const profitToday = salesToday.reduce((a, s) => {
    const cost = s.items.reduce((c, it) => {
      const p = DB.data.products.find((p) => p.id === it.productId);
      const u = p?.units.find((u) => u.unitId === it.unitId);
      return c + (u ? u.cost * it.qty : 0);
    }, 0);
    return a + (s.total - cost);
  }, 0);
  const { low, expiring } = getAlerts();

  const last7 = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const salesByDay = last7.map((d) => DB.data.sales.filter((s) => s.date.slice(0, 10) === d).reduce((a, s) => a + s.total, 0));

  const prodQty = {};
  DB.data.sales.forEach((s) => s.items.forEach((it) => {
    prodQty[it.productId] = (prodQty[it.productId] || 0) + it.qty;
  }));
  const topProducts = Object.entries(prodQty)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, qty]) => ({ name: DB.data.products.find((p) => p.id === id)?.name || "?", qty }));

  return `
  <div class="grid-cards">
    <div class="stat-card">
      <div class="stat-label">Penjualan Hari Ini</div>
      <div class="stat-value mono">${fmtMoney(totalToday)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Transaksi Hari Ini</div>
      <div class="stat-value mono">${fmtNum(trxToday)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Estimasi Laba Hari Ini</div>
      <div class="stat-value mono ${profitToday >= 0 ? "text-ok" : "text-danger"}">${fmtMoney(profitToday)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Stok Menipis</div>
      <div class="stat-value mono ${low.length ? "text-danger" : ""}">${low.length}</div>
    </div>
  </div>

  <div class="grid-2col">
    <div class="panel">
      <div class="panel-head"><h3>Grafik Penjualan 7 Hari Terakhir</h3></div>
      <canvas id="chart-sales" height="140"></canvas>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Produk Terlaris</h3></div>
      <canvas id="chart-top" height="140"></canvas>
    </div>
  </div>

  <div class="grid-2col">
    <div class="panel">
      <div class="panel-head"><h3>Stok Menipis</h3></div>
      ${low.length ? `<table class="tbl"><thead><tr><th>Produk</th><th>Stok</th><th>Minimum</th></tr></thead><tbody>
        ${low.slice(0, 8).map((p) => `<tr><td>${escapeHtml(p.name)}</td><td class="mono text-danger">${p.stock}</td><td class="mono">${p.minStock}</td></tr>`).join("")}
      </tbody></table>` : `<p class="muted pad">Semua stok aman.</p>`}
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Segera Kadaluarsa</h3></div>
      ${expiring.length ? `<table class="tbl"><thead><tr><th>Produk</th><th>Tanggal</th></tr></thead><tbody>
        ${expiring.slice(0, 8).map((p) => `<tr><td>${escapeHtml(p.name)}</td><td class="mono text-warn">${fmtDate(p.expiryDate)}</td></tr>`).join("")}
      </tbody></table>` : `<p class="muted pad">Tidak ada produk mendekati kadaluarsa.</p>`}
    </div>
  </div>
  <script>window.__dash = ${JSON.stringify({ last7, salesByDay, topProducts })};</script>
  `;
}

function after_dashboard() {
  const d = window.__dash;
  if (!d) return;
  if (typeof Chart === "undefined") {
    document.querySelectorAll(".panel canvas").forEach((c) => {
      c.replaceWith(Object.assign(document.createElement("p"), { className: "muted pad", textContent: "Grafik tidak tersedia (koneksi internet diperlukan untuk memuat pustaka grafik)." }));
    });
    return;
  }
  const ctx1 = document.getElementById("chart-sales");
  if (ctx1) {
    new Chart(ctx1, {
      type: "line",
      data: {
        labels: d.last7.map((x) => x.slice(5)),
        datasets: [{ label: "Penjualan", data: d.salesByDay, borderColor: "#1f7a5c", backgroundColor: "rgba(31,122,92,.12)", fill: true, tension: 0.35, pointRadius: 3 }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => "Rp" + (v/1000) + "rb" } } } },
    });
  }
  const ctx2 = document.getElementById("chart-top");
  if (ctx2) {
    new Chart(ctx2, {
      type: "bar",
      data: { labels: d.topProducts.map((p) => p.name), datasets: [{ label: "Qty Terjual", data: d.topProducts.map((p) => p.qty), backgroundColor: "#d98e2b", borderRadius: 6 }] },
      options: { plugins: { legend: { display: false } }, indexAxis: "y" },
    });
  }
}

/* ---------------------------- POS / KASIR ---------------------------- */

function unitLabel(unitId) {
  return DB.data.units.find((u) => u.id === unitId)?.name || "";
}

function productUnitPrice(product, unitId) {
  return product.units.find((u) => u.unitId === unitId);
}

function renderPOS() {
  const q = state.posSearch || "";
  const list = DB.data.products.filter((p) =>
    !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.barcode || "").includes(q)
  );
  const cart = state.posCart;
  const subtotal = cart.reduce((a, it) => a + it.price * it.qty - it.discount, 0);
  const tax = Math.round(subtotal * (DB.data.settings.taxPercent || 0) / 100);
  const total = Math.max(0, subtotal + tax - (state.posDiscount || 0));

  return `
  <div class="pos-grid">
    <div class="pos-left panel">
      <div class="pos-search-row">
        <div class="search-box">
          ${svgIcon("search")}
          <input id="pos-search" class="input-flat" placeholder="Cari produk atau scan barcode..." value="${escapeHtml(q)}" autofocus />
        </div>
        <span class="hint">${svgIcon("barcode")} Scanner otomatis terdeteksi</span>
      </div>
      <div class="pos-product-grid">
        ${list.map((p) => {
          const u = productUnitPrice(p, p.baseUnitId);
          const low = p.stock <= p.minStock;
          return `
          <button class="pos-prod-card" data-id="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>
            <div class="pos-prod-img">${p.photo ? `<img src="${p.photo}"/>` : escapeHtml(p.name[0])}</div>
            <div class="pos-prod-name">${escapeHtml(p.name)}</div>
            <div class="pos-prod-price mono">${fmtMoney(u.price)}</div>
            <div class="pos-prod-stock ${low ? "text-danger" : ""}">Stok: ${p.stock}</div>
          </button>`;
        }).join("") || `<p class="muted pad">Produk tidak ditemukan.</p>`}
      </div>
    </div>

    <div class="pos-right panel">
      <div class="panel-head"><h3>Keranjang</h3><span class="muted">${cart.length} item</span></div>
      <div class="pos-cart-list">
        ${cart.length ? cart.map((it, idx) => `
          <div class="cart-row">
            <div class="cart-row-main">
              <div class="cart-row-name">${escapeHtml(it.name)}</div>
              <div class="cart-row-sub muted">${fmtMoney(it.price)} / ${unitLabel(it.unitId)}</div>
              <div class="cart-row-disc">
                <span class="muted small">Diskon</span>
                <input type="number" min="0" class="input-inline mono cart-disc-input" data-idx="${idx}" value="${it.discount || 0}" />
              </div>
            </div>
            <div class="cart-row-qty">
              <button class="qty-btn" data-act="dec" data-idx="${idx}">−</button>
              <span class="mono">${it.qty}</span>
              <button class="qty-btn" data-act="inc" data-idx="${idx}">+</button>
            </div>
            <div class="cart-row-total mono">${fmtMoney(it.price * it.qty - it.discount)}</div>
            <button class="icon-btn sm" data-act="rm" data-idx="${idx}">${svgIcon("trash")}</button>
          </div>`).join("") : `<p class="muted pad">Keranjang kosong. Pilih produk di sebelah kiri.</p>`}
      </div>

      <div class="pos-summary">
        <div class="field-label">Pelanggan (opsional)</div>
        <select class="input" id="pos-customer">
          <option value="">— Umum —</option>
          ${DB.data.customers.map((c) => `<option value="${c.id}" ${state.posCustomerId === c.id ? "selected" : ""}>${escapeHtml(c.name)} (${c.points} poin)</option>`).join("")}
        </select>

        <div class="row-between">
          <span>Subtotal</span><span class="mono">${fmtMoney(subtotal)}</span>
        </div>
        <div class="row-between">
          <span>Diskon Total</span>
          <input type="number" min="0" id="pos-disc" class="input-inline mono" value="${state.posDiscount || 0}" />
        </div>
        <div class="row-between">
          <span>Pajak (${DB.data.settings.taxPercent || 0}%)</span><span class="mono">${fmtMoney(tax)}</span>
        </div>
        <div class="row-between total-row">
          <span>Total</span><span class="mono">${fmtMoney(total)}</span>
        </div>

        <button class="btn btn-primary w-full" id="pos-checkout" ${cart.length ? "" : "disabled"}>Bayar</button>
        <button class="btn btn-ghost w-full" id="pos-clear" ${cart.length ? "" : "disabled"}>Kosongkan Keranjang</button>
      </div>
    </div>
  </div>`;
}

function after_pos() {
  const search = document.getElementById("pos-search");
  search.addEventListener("input", (e) => { state.posSearch = e.target.value; softRenderPOS(); });
  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      // barcode scanner behavior: exact barcode match -> add directly
      const p = DB.data.products.find((p) => p.barcode === e.target.value.trim());
      if (p) { addToCart(p); state.posSearch = ""; render(); }
    }
  });
  document.querySelectorAll(".pos-prod-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = DB.data.products.find((p) => p.id === btn.dataset.id);
      if (p) addToCart(p);
    });
  });
  document.querySelectorAll(".qty-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = +btn.dataset.idx;
      const it = state.posCart[idx];
      if (btn.dataset.act === "inc") it.qty++;
      else it.qty = Math.max(1, it.qty - 1);
      softRenderPOS();
    });
  });
  document.querySelectorAll('[data-act="rm"]').forEach((btn) => {
    btn.addEventListener("click", () => { state.posCart.splice(+btn.dataset.idx, 1); softRenderPOS(); });
  });
  document.querySelectorAll(".cart-disc-input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = +inp.dataset.idx;
      state.posCart[idx].discount = +e.target.value || 0;
      softRenderPOS(true);
    });
  });
  const custSel = document.getElementById("pos-customer");
  if (custSel) custSel.addEventListener("change", (e) => { state.posCustomerId = e.target.value; });
  const discInp = document.getElementById("pos-disc");
  if (discInp) discInp.addEventListener("input", (e) => { state.posDiscount = +e.target.value || 0; softRenderPOS(true); });
  const clearBtn = document.getElementById("pos-clear");
  if (clearBtn) clearBtn.addEventListener("click", () => confirmDialog("Kosongkan keranjang?", () => { state.posCart = []; softRenderPOS(); }));
  const checkoutBtn = document.getElementById("pos-checkout");
  if (checkoutBtn) checkoutBtn.addEventListener("click", openCheckoutModal);
  search.focus();
}

function softRenderPOS(keepFocus) {
  document.getElementById("content").innerHTML = renderPOS();
  after_pos();
  if (!keepFocus) document.getElementById("pos-search").focus();
}

function addToCart(product) {
  if (product.stock <= 0) { toast("Stok habis", "danger"); return; }
  const u = productUnitPrice(product, product.baseUnitId);
  const existing = state.posCart.find((it) => it.productId === product.id && it.unitId === product.baseUnitId);
  if (existing) existing.qty++;
  else state.posCart.push({ productId: product.id, name: product.name, unitId: product.baseUnitId, price: u.price, qty: 1, discount: 0 });
  softRenderPOS();
}

function openCheckoutModal() {
  const cart = state.posCart;
  const subtotal = cart.reduce((a, it) => a + it.price * it.qty - it.discount, 0);
  const tax = Math.round(subtotal * (DB.data.settings.taxPercent || 0) / 100);
  const total = Math.max(0, subtotal + tax - (state.posDiscount || 0));
  openModal("Pembayaran", `
    <div class="pay-total">Total Tagihan<br/><span class="mono big">${fmtMoney(total)}</span></div>
    <div class="field-label">Metode Pembayaran</div>
    <div class="pay-methods" id="pay-methods">
      <button class="pay-chip active" data-m="Tunai">💵 Tunai</button>
      <button class="pay-chip" data-m="QRIS">📱 QRIS</button>
      <button class="pay-chip" data-m="Debit">💳 Debit/Kredit</button>
      <button class="pay-chip" data-m="Transfer">🏦 Transfer</button>
    </div>
    <div id="pay-cash-area">
      <div class="field-label">Uang Diterima</div>
      <input type="number" class="input mono" id="pay-cash" value="${total}" />
      <div class="row-between"><span>Kembalian</span><span class="mono" id="pay-change">${fmtMoney(0)}</span></div>
    </div>
    <div id="pay-qris-area" style="display:none" class="qris-box">
      <div id="qris-canvas-wrap"></div>
      <p class="muted small">Pindai kode QR untuk membayar via QRIS (simulasi demo).</p>
    </div>
    <button class="btn btn-primary w-full" id="pay-confirm">Selesaikan Transaksi</button>
  `, { wide: false });

  let method = "Tunai";
  const cashInput = document.getElementById("pay-cash");
  const changeEl = document.getElementById("pay-change");
  const updateChange = () => { changeEl.textContent = fmtMoney(Math.max(0, (+cashInput.value || 0) - total)); };
  cashInput.addEventListener("input", updateChange);
  updateChange();

  document.querySelectorAll(".pay-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".pay-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      method = chip.dataset.m;
      document.getElementById("pay-cash-area").style.display = method === "Tunai" ? "" : "none";
      const qArea = document.getElementById("pay-qris-area");
      qArea.style.display = method === "QRIS" ? "" : "none";
      if (method === "QRIS") {
        const wrap = document.getElementById("qris-canvas-wrap");
        if (typeof QRCode === "undefined") {
          wrap.innerHTML = `<p class="muted small">Kode QR butuh koneksi internet untuk memuat pustaka QR.</p>`;
        } else {
          wrap.innerHTML = `<canvas id="qris-canvas"></canvas>`;
          QRCode.toCanvas(document.getElementById("qris-canvas"), `QRIS-DEMO|${DB.data.settings.storeName}|${total}`, { width: 180 });
        }
      }
    });
  });

  document.getElementById("pay-confirm").addEventListener("click", () => {
    const cashPaid = method === "Tunai" ? (+cashInput.value || 0) : total;
    if (method === "Tunai" && cashPaid < total) { toast("Uang diterima kurang dari total", "danger"); return; }
    finalizeSale(method, total, subtotal, tax, cashPaid);
  });
}

function finalizeSale(method, total, subtotal, tax, cashPaid) {
  const sale = {
    id: uid("sale"),
    invoiceNo: "INV" + Date.now().toString().slice(-8),
    date: nowISO(),
    cashierId: state.currentUser.id,
    customerId: state.posCustomerId || null,
    branchId: DB.data.activeBranchId,
    items: state.posCart.map((it) => ({ ...it })),
    subtotal, discount: state.posDiscount || 0, tax, total,
    payments: [{ method, amount: total }],
    cashPaid, change: method === "Tunai" ? cashPaid - total : 0,
  };
  DB.data.sales.push(sale);

  sale.items.forEach((it) => {
    const p = DB.data.products.find((p) => p.id === it.productId);
    if (!p) return;
    const conv = p.units.find((u) => u.unitId === it.unitId)?.conversion || 1;
    p.stock -= it.qty * conv;
    DB.data.stockMovements.unshift({ id: uid("mv"), date: nowISO(), productId: p.id, type: "out", qty: it.qty * conv, ref: sale.invoiceNo, warehouseId: p.warehouseId, note: "Penjualan POS" });
  });

  if (sale.customerId) {
    const cust = DB.data.customers.find((c) => c.id === sale.customerId);
    if (cust) cust.points += Math.floor(total / 10000);
  }

  DB.data.cashTransactions.unshift({ id: uid("ct"), date: nowISO(), type: "in", amount: total, category: "Penjualan", note: sale.invoiceNo });
  DB.data.invoices.unshift({ id: uid("iv"), type: "sale", refId: sale.id, invoiceNo: sale.invoiceNo, date: sale.date, total });

  DB.save();
  DB.log(state.currentUser.id, "Transaksi POS", `${sale.invoiceNo} - ${fmtMoney(total)}`);

  state.posCart = [];
  state.posDiscount = 0;
  state.posCustomerId = "";
  closeModal();
  toast("Transaksi berhasil!");
  openReceiptModal(sale);
}

function openReceiptModal(sale) {
  openModal("Struk Transaksi", buildReceiptHTML(sale) + `
    <div class="flex justify-end gap-2 mt-3">
      <button class="btn btn-ghost" id="rc-wa">${svgIcon("wa")} WhatsApp</button>
      <button class="btn btn-primary" id="rc-print">${svgIcon("print")} Cetak</button>
    </div>`);
  document.getElementById("rc-print").addEventListener("click", () => printHTML(buildReceiptHTML(sale, true)));
  document.getElementById("rc-wa").addEventListener("click", () => sendReceiptWA(sale));
}

function buildReceiptHTML(sale, forPrint) {
  const s = DB.data.settings;
  const cust = DB.data.customers.find((c) => c.id === sale.customerId);
  const cashier = DB.data.users.find((u) => u.id === sale.cashierId);
  return `
  <div class="receipt ${forPrint ? "receipt-" + s.receiptWidth : ""}">
    ${s.logo ? `<img src="${s.logo}" class="receipt-logo"/>` : ""}
    <div class="receipt-center bold">${escapeHtml(s.storeName)}</div>
    <div class="receipt-center small">${escapeHtml(s.address)}</div>
    <div class="receipt-center small">${escapeHtml(s.phone)}</div>
    <div class="receipt-sep"></div>
    <div class="receipt-row"><span>${sale.invoiceNo}</span><span>${fmtDateTime(sale.date)}</span></div>
    <div class="receipt-row"><span>Kasir: ${escapeHtml(cashier?.name || "-")}</span></div>
    ${cust ? `<div class="receipt-row"><span>Plgn: ${escapeHtml(cust.name)}</span></div>` : ""}
    <div class="receipt-sep"></div>
    ${sale.items.map((it) => `
      <div class="receipt-item">
        <div>${escapeHtml(it.name)}</div>
        <div class="receipt-row small"><span>${it.qty} x ${fmtMoney(it.price)}</span><span>${fmtMoney(it.qty * it.price - it.discount)}</span></div>
      </div>`).join("")}
    <div class="receipt-sep"></div>
    <div class="receipt-row"><span>Subtotal</span><span>${fmtMoney(sale.subtotal)}</span></div>
    ${sale.discount ? `<div class="receipt-row"><span>Diskon</span><span>-${fmtMoney(sale.discount)}</span></div>` : ""}
    ${sale.tax ? `<div class="receipt-row"><span>Pajak</span><span>${fmtMoney(sale.tax)}</span></div>` : ""}
    <div class="receipt-row bold"><span>TOTAL</span><span>${fmtMoney(sale.total)}</span></div>
    <div class="receipt-row"><span>${sale.payments[0].method}</span><span>${fmtMoney(sale.payments[0].amount)}</span></div>
    ${sale.change ? `<div class="receipt-row"><span>Kembali</span><span>${fmtMoney(sale.change)}</span></div>` : ""}
    <div class="receipt-sep"></div>
    <div class="receipt-center small">${escapeHtml(s.receiptFooter)}</div>
  </div>`;
}

function printHTML(innerHtml) {
  const cssHref = new URL("assets/styles.css", document.baseURI).href;
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) { toast("Izinkan pop-up untuk mencetak struk", "danger"); return; }
  w.document.write(`<html><head><title>Cetak</title>
    <link rel="stylesheet" href="${cssHref}"></head>
    <body onload="window.print();setTimeout(()=>window.close(),300)">${innerHtml}</body></html>`);
  w.document.close();
}

function sendReceiptWA(sale) {
  const cust = DB.data.customers.find((c) => c.id === sale.customerId);
  let text = `Struk ${DB.data.settings.storeName}\n${sale.invoiceNo} - ${fmtDateTime(sale.date)}\n\n`;
  sale.items.forEach((it) => text += `${it.name} x${it.qty} = ${fmtMoney(it.qty * it.price)}\n`);
  text += `\nTotal: ${fmtMoney(sale.total)}\nTerima kasih!`;
  const phone = (cust?.phone || "").replace(/[^0-9]/g, "");
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
}

/* ---------------------------- PRODUK ---------------------------- */

function renderProduk() {
  const q = (state.produkSearch || "").toLowerCase();
  const catFilter = state.produkCat || "";
  const list = DB.data.products.filter((p) =>
    (!q || p.name.toLowerCase().includes(q) || (p.barcode || "").includes(q)) &&
    (!catFilter || p.categoryId === catFilter)
  );
  return `
  <div class="panel">
    <div class="panel-head">
      <h3>Daftar Produk (${list.length})</h3>
      <div class="panel-actions">
        <input id="pr-search" class="input sm" placeholder="Cari nama / barcode" value="${escapeHtml(state.produkSearch || "")}" />
        <select id="pr-cat" class="input sm">
          <option value="">Semua Kategori</option>
          ${DB.data.categories.map((c) => `<option value="${c.id}" ${catFilter === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
        </select>
        <button class="btn btn-ghost sm" id="pr-import">Import Excel</button>
        <button class="btn btn-ghost sm" id="pr-export">Export Excel</button>
        <button class="btn btn-primary sm" id="pr-add">${svgIcon("plus")} Tambah Produk</button>
        <input type="file" id="pr-file" accept=".xlsx,.csv" style="display:none" />
      </div>
    </div>
    <div class="table-scroll">
    <table class="tbl">
      <thead><tr><th></th><th>Nama</th><th>Barcode</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Exp.</th><th></th></tr></thead>
      <tbody>
        ${list.map((p) => {
          const u = productUnitPrice(p, p.baseUnitId);
          const cat = DB.data.categories.find((c) => c.id === p.categoryId);
          const low = p.stock <= p.minStock;
          return `<tr>
            <td>${p.photo ? `<img class="thumb" src="${p.photo}"/>` : `<div class="thumb ph">${escapeHtml(p.name[0])}</div>`}</td>
            <td>${escapeHtml(p.name)}</td>
            <td class="mono small">${escapeHtml(p.barcode || "-")}</td>
            <td>${escapeHtml(cat?.name || "-")}</td>
            <td class="mono">${fmtMoney(u.price)}</td>
            <td class="mono ${low ? "text-danger" : ""}">${p.stock} ${unitLabel(p.baseUnitId)}</td>
            <td class="small">${p.expiryDate ? fmtDate(p.expiryDate) : "-"}</td>
            <td class="row-actions">
              <button class="icon-btn sm" data-act="edit" data-id="${p.id}">${svgIcon("edit")}</button>
              <button class="icon-btn sm" data-act="del" data-id="${p.id}">${svgIcon("trash")}</button>
            </td>
          </tr>`;
        }).join("") || `<tr><td colspan="8" class="muted pad">Belum ada produk.</td></tr>`}
      </tbody>
    </table>
    </div>
  </div>`;
}

function after_produk() {
  document.getElementById("pr-search").addEventListener("input", (e) => { state.produkSearch = e.target.value; go("produk"); });
  document.getElementById("pr-cat").addEventListener("change", (e) => { state.produkCat = e.target.value; go("produk"); });
  document.getElementById("pr-add").addEventListener("click", () => openProductForm());
  document.querySelectorAll('[data-act="edit"]').forEach((b) => b.addEventListener("click", () => openProductForm(b.dataset.id)));
  document.querySelectorAll('[data-act="del"]').forEach((b) => b.addEventListener("click", () => {
    confirmDialog("Hapus produk ini?", () => {
      DB.data.products = DB.data.products.filter((p) => p.id !== b.dataset.id);
      DB.save(); DB.log(state.currentUser.id, "Hapus Produk", b.dataset.id);
      toast("Produk dihapus"); go("produk");
    });
  }));
  document.getElementById("pr-export").addEventListener("click", () => {
    const rows = DB.data.products.map((p) => ({
      Nama: p.name, Barcode: p.barcode, Kategori: DB.data.categories.find((c) => c.id === p.categoryId)?.name || "",
      Satuan: unitLabel(p.baseUnitId), Harga: productUnitPrice(p, p.baseUnitId).price, HargaModal: productUnitPrice(p, p.baseUnitId).cost,
      Stok: p.stock, StokMinimum: p.minStock, Kadaluarsa: p.expiryDate,
    }));
    exportXLSX(rows, "Produk", "data-produk.xlsx");
  });
  document.getElementById("pr-import").addEventListener("click", () => document.getElementById("pr-file").click());
  document.getElementById("pr-file").addEventListener("change", (e) => importProductsExcel(e.target.files[0]));
}

function importProductsExcel(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const wb = XLSX.read(e.target.result, { type: "array" });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    let count = 0;
    rows.forEach((r) => {
      const name = r.Nama || r.name;
      if (!name) return;
      let cat = DB.data.categories.find((c) => c.name === (r.Kategori || ""));
      if (!cat && r.Kategori) { cat = { id: uid("c"), name: r.Kategori }; DB.data.categories.push(cat); }
      let unit = DB.data.units.find((u) => u.name === (r.Satuan || "Pcs")) || DB.data.units[0];
      DB.data.products.push({
        id: uid("p"), name, barcode: String(r.Barcode || ""), categoryId: cat?.id || DB.data.categories[0].id,
        photo: "", baseUnitId: unit.id, warehouseId: DB.data.warehouses[0].id,
        units: [{ unitId: unit.id, conversion: 1, price: +r.Harga || 0, cost: +r.HargaModal || 0 }],
        stock: +r.Stok || 0, minStock: +r.StokMinimum || 5, expiryDate: r.Kadaluarsa || "",
      });
      count++;
    });
    DB.save(); DB.log(state.currentUser.id, "Import Produk", `${count} produk diimpor`);
    toast(`${count} produk berhasil diimpor`); go("produk");
  };
  reader.readAsArrayBuffer(file);
}

function openProductForm(id) {
  const p = id ? DB.data.products.find((p) => p.id === id) : null;
  const units = (p?.units || [{ unitId: DB.data.units[0].id, conversion: 1, price: 0, cost: 0 }]);
  openModal(p ? "Edit Produk" : "Tambah Produk", `
    <form id="prod-form">
      <div class="form-grid">
        <div>
          <label class="field-label">Nama Produk</label>
          <input class="input" name="name" required value="${escapeHtml(p?.name || "")}" />
        </div>
        <div>
          <label class="field-label">Barcode</label>
          <input class="input" name="barcode" value="${escapeHtml(p?.barcode || "")}" />
        </div>
        <div>
          <label class="field-label">Kategori</label>
          <select class="input" name="categoryId">
            ${DB.data.categories.map((c) => `<option value="${c.id}" ${p?.categoryId === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="field-label">Gudang</label>
          <select class="input" name="warehouseId">
            ${DB.data.warehouses.map((w) => `<option value="${w.id}" ${p?.warehouseId === w.id ? "selected" : ""}>${escapeHtml(w.name)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="field-label">Stok Saat Ini</label>
          <input class="input mono" type="number" name="stock" value="${p?.stock ?? 0}" />
        </div>
        <div>
          <label class="field-label">Stok Minimum</label>
          <input class="input mono" type="number" name="minStock" value="${p?.minStock ?? 5}" />
        </div>
        <div>
          <label class="field-label">Tanggal Kadaluarsa</label>
          <input class="input" type="date" name="expiryDate" value="${p?.expiryDate || ""}" />
        </div>
        <div>
          <label class="field-label">Foto Produk</label>
          <input class="input" type="file" name="photo" accept="image/*" />
        </div>
      </div>

      <label class="field-label mt">Satuan &amp; Harga (multi-satuan)</label>
      <div id="unit-rows">
        ${units.map((u, i) => unitRowHtml(u, i)).join("")}
      </div>
      <button type="button" class="btn btn-ghost sm" id="add-unit-row">${svgIcon("plus")} Tambah Satuan</button>

      <div class="flex justify-end gap-2 mt">
        <button type="button" class="btn btn-ghost" id="prod-cancel">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </div>
    </form>`, { wide: true });

  document.getElementById("prod-cancel").addEventListener("click", closeModal);
  document.getElementById("add-unit-row").addEventListener("click", () => {
    const div = document.createElement("div");
    div.innerHTML = unitRowHtml({ unitId: DB.data.units[0].id, conversion: 1, price: 0, cost: 0 }, document.querySelectorAll(".unit-row").length);
    document.getElementById("unit-rows").appendChild(div.firstElementChild);
    bindUnitRowRemovers();
  });
  bindUnitRowRemovers();

  document.getElementById("prod-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const unitRows = [...document.querySelectorAll(".unit-row")].map((row) => ({
      unitId: row.querySelector('[name="u-unit"]').value,
      conversion: +row.querySelector('[name="u-conv"]').value || 1,
      price: +row.querySelector('[name="u-price"]').value || 0,
      cost: +row.querySelector('[name="u-cost"]').value || 0,
    }));
    const finish = (photoData) => {
      const payload = {
        name: fd.get("name"), barcode: fd.get("barcode"), categoryId: fd.get("categoryId"),
        warehouseId: fd.get("warehouseId"), stock: +fd.get("stock") || 0, minStock: +fd.get("minStock") || 0,
        expiryDate: fd.get("expiryDate") || "", units: unitRows, baseUnitId: unitRows[0].unitId,
      };
      if (photoData) payload.photo = photoData;
      if (p) Object.assign(p, payload);
      else DB.data.products.push({ id: uid("p"), photo: "", ...payload });
      DB.save();
      DB.log(state.currentUser.id, p ? "Edit Produk" : "Tambah Produk", payload.name);
      toast("Produk disimpan");
      closeModal();
      go("produk");
    };
    const file = fd.get("photo");
    if (file && file.size) {
      const r = new FileReader();
      r.onload = (ev) => finish(ev.target.result);
      r.readAsDataURL(file);
    } else finish(null);
  });
}

function unitRowHtml(u, i) {
  return `<div class="unit-row" data-i="${i}">
    <select name="u-unit" class="input sm">${DB.data.units.map((un) => `<option value="${un.id}" ${u.unitId === un.id ? "selected" : ""}>${escapeHtml(un.name)}</option>`).join("")}</select>
    <input name="u-conv" type="number" min="1" class="input sm mono" placeholder="Konversi" value="${u.conversion}" title="Jumlah satuan dasar" />
    <input name="u-price" type="number" min="0" class="input sm mono" placeholder="Harga Jual" value="${u.price}" />
    <input name="u-cost" type="number" min="0" class="input sm mono" placeholder="Harga Modal" value="${u.cost}" />
    <button type="button" class="icon-btn sm unit-remove">${svgIcon("x")}</button>
  </div>`;
}

function bindUnitRowRemovers() {
  document.querySelectorAll(".unit-remove").forEach((b) => {
    b.onclick = () => { if (document.querySelectorAll(".unit-row").length > 1) b.closest(".unit-row").remove(); };
  });
}

/* ---------------------------- KATEGORI ---------------------------- */

function renderKategori() {
  return `
  <div class="panel">
    <div class="panel-head">
      <h3>Kategori Produk (${DB.data.categories.length})</h3>
      <button class="btn btn-primary sm" id="cat-add">${svgIcon("plus")} Tambah Kategori</button>
    </div>
    <div class="table-scroll"><table class="tbl">
      <thead><tr><th>Nama Kategori</th><th>Jumlah Produk</th><th></th></tr></thead>
      <tbody>
        ${DB.data.categories.map((c) => `<tr>
          <td>${escapeHtml(c.name)}</td>
          <td class="mono">${DB.data.products.filter((p) => p.categoryId === c.id).length}</td>
          <td class="row-actions">
            <button class="icon-btn sm" data-act="edit" data-id="${c.id}">${svgIcon("edit")}</button>
            <button class="icon-btn sm" data-act="del" data-id="${c.id}">${svgIcon("trash")}</button>
          </td>
        </tr>`).join("")}
      </tbody>
    </table></div>
  </div>`;
}

function after_kategori() {
  document.getElementById("cat-add").addEventListener("click", () => openCatForm());
  document.querySelectorAll('[data-act="edit"]').forEach((b) => b.addEventListener("click", () => openCatForm(b.dataset.id)));
  document.querySelectorAll('[data-act="del"]').forEach((b) => b.addEventListener("click", () => {
    if (DB.data.products.some((p) => p.categoryId === b.dataset.id)) { toast("Kategori masih dipakai produk", "danger"); return; }
    confirmDialog("Hapus kategori ini?", () => {
      DB.data.categories = DB.data.categories.filter((c) => c.id !== b.dataset.id);
      DB.save(); toast("Kategori dihapus"); go("kategori");
    });
  }));
}

function openCatForm(id) {
  const c = id ? DB.data.categories.find((c) => c.id === id) : null;
  openModal(c ? "Edit Kategori" : "Tambah Kategori", `
    <form id="cat-form">
      <label class="field-label">Nama Kategori</label>
      <input class="input" name="name" required value="${escapeHtml(c?.name || "")}" />
      <div class="flex justify-end gap-2 mt">
        <button type="button" class="btn btn-ghost" id="cat-cancel">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </div>
    </form>`);
  document.getElementById("cat-cancel").addEventListener("click", closeModal);
  document.getElementById("cat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = new FormData(e.target).get("name");
    if (c) c.name = name; else DB.data.categories.push({ id: uid("c"), name });
    DB.save(); toast("Kategori disimpan"); closeModal(); go("kategori");
  });
}

/* ---------------------------- SUPPLIER ---------------------------- */

function renderSupplier() {
  return `
  <div class="panel">
    <div class="panel-head">
      <h3>Data Supplier (${DB.data.suppliers.length})</h3>
      <div class="panel-actions">
        <button class="btn btn-ghost sm" id="sup-export">Export Excel</button>
        <button class="btn btn-primary sm" id="sup-add">${svgIcon("plus")} Tambah Supplier</button>
      </div>
    </div>
    <div class="table-scroll"><table class="tbl">
      <thead><tr><th>Nama Supplier</th><th>Telepon</th><th>Alamat</th><th>Hutang</th><th>Riwayat</th><th></th></tr></thead>
      <tbody>
        ${DB.data.suppliers.map((s) => `<tr>
          <td>${escapeHtml(s.name)}</td>
          <td class="mono small">${escapeHtml(s.phone)}</td>
          <td class="small">${escapeHtml(s.address)}</td>
          <td class="mono ${s.debt > 0 ? "text-danger" : ""}">${fmtMoney(s.debt)}</td>
          <td><button class="btn btn-ghost xs" data-act="hist" data-id="${s.id}">Lihat</button></td>
          <td class="row-actions">
            <button class="icon-btn sm" data-act="edit" data-id="${s.id}">${svgIcon("edit")}</button>
            <button class="icon-btn sm" data-act="del" data-id="${s.id}">${svgIcon("trash")}</button>
          </td>
        </tr>`).join("") || `<tr><td colspan="6" class="muted pad">Belum ada supplier.</td></tr>`}
      </tbody>
    </table></div>
  </div>`;
}

function after_supplier() {
  document.getElementById("sup-add").addEventListener("click", () => openSupplierForm());
  document.getElementById("sup-export").addEventListener("click", () => {
    exportXLSX(DB.data.suppliers.map((s) => ({ Nama: s.name, Telepon: s.phone, Alamat: s.address, Hutang: s.debt })), "Supplier", "data-supplier.xlsx");
  });
  document.querySelectorAll('[data-act="edit"]').forEach((b) => b.addEventListener("click", () => openSupplierForm(b.dataset.id)));
  document.querySelectorAll('[data-act="hist"]').forEach((b) => b.addEventListener("click", () => showSupplierHistory(b.dataset.id)));
  document.querySelectorAll('[data-act="del"]').forEach((b) => b.addEventListener("click", () => {
    confirmDialog("Hapus supplier ini?", () => {
      DB.data.suppliers = DB.data.suppliers.filter((s) => s.id !== b.dataset.id);
      DB.save(); toast("Supplier dihapus"); go("supplier");
    });
  }));
}

function openSupplierForm(id) {
  const s = id ? DB.data.suppliers.find((s) => s.id === id) : null;
  openModal(s ? "Edit Supplier" : "Tambah Supplier", `
    <form id="sup-form">
      <label class="field-label">Nama Supplier</label>
      <input class="input" name="name" required value="${escapeHtml(s?.name || "")}" />
      <label class="field-label">Telepon</label>
      <input class="input" name="phone" value="${escapeHtml(s?.phone || "")}" />
      <label class="field-label">Alamat</label>
      <input class="input" name="address" value="${escapeHtml(s?.address || "")}" />
      <label class="field-label">Hutang Awal</label>
      <input class="input mono" type="number" name="debt" value="${s?.debt || 0}" />
      <div class="flex justify-end gap-2 mt">
        <button type="button" class="btn btn-ghost" id="sup-cancel">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </div>
    </form>`);
  document.getElementById("sup-cancel").addEventListener("click", closeModal);
  document.getElementById("sup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = { name: fd.get("name"), phone: fd.get("phone"), address: fd.get("address"), debt: +fd.get("debt") || 0 };
    if (s) Object.assign(s, payload); else DB.data.suppliers.push({ id: uid("sup"), ...payload });
    DB.save(); toast("Supplier disimpan"); closeModal(); go("supplier");
  });
}

function showSupplierHistory(id) {
  const s = DB.data.suppliers.find((s) => s.id === id);
  const purchases = DB.data.purchases.filter((p) => p.supplierId === id);
  openModal(`Riwayat Pembelian — ${escapeHtml(s.name)}`, `
    <table class="tbl">
      <thead><tr><th>No. Faktur</th><th>Tanggal</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>
        ${purchases.map((p) => `<tr><td>${escapeHtml(p.invoiceNo)}</td><td>${fmtDate(p.date)}</td><td class="mono">${fmtMoney(p.total)}</td><td>${p.status}</td></tr>`).join("") || `<tr><td colspan="4" class="muted pad">Belum ada transaksi.</td></tr>`}
      </tbody>
    </table>`, { wide: true });
}

/* ---------------------------- PELANGGAN ---------------------------- */

function renderPelanggan() {
  return `
  <div class="panel">
    <div class="panel-head">
      <h3>Data Pelanggan / Member (${DB.data.customers.length})</h3>
      <button class="btn btn-primary sm" id="cust-add">${svgIcon("plus")} Tambah Pelanggan</button>
    </div>
    <div class="table-scroll"><table class="tbl">
      <thead><tr><th>Nama</th><th>Telepon</th><th>Member Sejak</th><th>Poin Reward</th><th>Riwayat</th><th></th></tr></thead>
      <tbody>
        ${DB.data.customers.map((c) => `<tr>
          <td>${escapeHtml(c.name)}</td>
          <td class="mono small">${escapeHtml(c.phone)}</td>
          <td class="small">${fmtDate(c.memberSince)}</td>
          <td class="mono text-ok">${c.points}</td>
          <td><button class="btn btn-ghost xs" data-act="hist" data-id="${c.id}">Lihat</button></td>
          <td class="row-actions">
            <button class="icon-btn sm" data-act="edit" data-id="${c.id}">${svgIcon("edit")}</button>
            <button class="icon-btn sm" data-act="del" data-id="${c.id}">${svgIcon("trash")}</button>
          </td>
        </tr>`).join("") || `<tr><td colspan="6" class="muted pad">Belum ada pelanggan.</td></tr>`}
      </tbody>
    </table></div>
  </div>`;
}

function after_pelanggan() {
  document.getElementById("cust-add").addEventListener("click", () => openCustForm());
  document.querySelectorAll('[data-act="edit"]').forEach((b) => b.addEventListener("click", () => openCustForm(b.dataset.id)));
  document.querySelectorAll('[data-act="hist"]').forEach((b) => b.addEventListener("click", () => showCustHistory(b.dataset.id)));
  document.querySelectorAll('[data-act="del"]').forEach((b) => b.addEventListener("click", () => {
    confirmDialog("Hapus pelanggan ini?", () => {
      DB.data.customers = DB.data.customers.filter((c) => c.id !== b.dataset.id);
      DB.save(); toast("Pelanggan dihapus"); go("pelanggan");
    });
  }));
}

function openCustForm(id) {
  const c = id ? DB.data.customers.find((c) => c.id === id) : null;
  openModal(c ? "Edit Pelanggan" : "Tambah Pelanggan", `
    <form id="cust-form">
      <label class="field-label">Nama Pelanggan</label>
      <input class="input" name="name" required value="${escapeHtml(c?.name || "")}" />
      <label class="field-label">Telepon (untuk WhatsApp)</label>
      <input class="input" name="phone" value="${escapeHtml(c?.phone || "")}" />
      <label class="field-label">Poin Reward</label>
      <input class="input mono" type="number" name="points" value="${c?.points || 0}" />
      <div class="flex justify-end gap-2 mt">
        <button type="button" class="btn btn-ghost" id="cust-cancel">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </div>
    </form>`);
  document.getElementById("cust-cancel").addEventListener("click", closeModal);
  document.getElementById("cust-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = { name: fd.get("name"), phone: fd.get("phone"), points: +fd.get("points") || 0 };
    if (c) Object.assign(c, payload); else DB.data.customers.push({ id: uid("cust"), memberSince: todayISO(), ...payload });
    DB.save(); toast("Pelanggan disimpan"); closeModal(); go("pelanggan");
  });
}

function showCustHistory(id) {
  const c = DB.data.customers.find((c) => c.id === id);
  const sales = DB.data.sales.filter((s) => s.customerId === id);
  openModal(`Riwayat Transaksi — ${escapeHtml(c.name)}`, `
    <table class="tbl">
      <thead><tr><th>No. Invoice</th><th>Tanggal</th><th>Total</th></tr></thead>
      <tbody>
        ${sales.map((s) => `<tr><td>${escapeHtml(s.invoiceNo)}</td><td>${fmtDateTime(s.date)}</td><td class="mono">${fmtMoney(s.total)}</td></tr>`).join("") || `<tr><td colspan="3" class="muted pad">Belum ada transaksi.</td></tr>`}
      </tbody>
    </table>`, { wide: true });
}

/* ---------------------------- PEMBELIAN ---------------------------- */

let purchaseDraftItems = [];

function renderPembelian() {
  const purchases = [...DB.data.purchases].reverse();
  return `
  <div class="panel">
    <div class="panel-head">
      <h3>Transaksi Pembelian (${purchases.length})</h3>
      <div class="panel-actions">
        <button class="btn btn-ghost sm" id="pb-export">Export Excel</button>
        <button class="btn btn-primary sm" id="pb-add">${svgIcon("plus")} Input Faktur Pembelian</button>
      </div>
    </div>
    <div class="table-scroll"><table class="tbl">
      <thead><tr><th>No. Faktur</th><th>Tanggal</th><th>Supplier</th><th>Total</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${purchases.map((p) => `<tr>
          <td>${escapeHtml(p.invoiceNo)}</td>
          <td>${fmtDate(p.date)}</td>
          <td>${escapeHtml(DB.data.suppliers.find((s) => s.id === p.supplierId)?.name || "-")}</td>
          <td class="mono">${fmtMoney(p.total)}</td>
          <td><span class="badge ${p.status === "Lunas" ? "badge-ok" : "badge-warn"}">${p.status}</span></td>
          <td class="row-actions"><button class="icon-btn sm" data-act="view" data-id="${p.id}">${svgIcon("invoice")}</button></td>
        </tr>`).join("") || `<tr><td colspan="6" class="muted pad">Belum ada transaksi pembelian.</td></tr>`}
      </tbody>
    </table></div>
  </div>`;
}

function after_pembelian() {
  document.getElementById("pb-add").addEventListener("click", openPurchaseForm);
  document.getElementById("pb-export").addEventListener("click", () => {
    exportXLSX(DB.data.purchases.map((p) => ({
      NoFaktur: p.invoiceNo, Tanggal: p.date.slice(0, 10),
      Supplier: DB.data.suppliers.find((s) => s.id === p.supplierId)?.name || "",
      Total: p.total, Status: p.status,
    })), "Pembelian", "data-pembelian.xlsx");
  });
  document.querySelectorAll('[data-act="view"]').forEach((b) => b.addEventListener("click", () => viewPurchase(b.dataset.id)));
}

function viewPurchase(id) {
  const p = DB.data.purchases.find((p) => p.id === id);
  const sup = DB.data.suppliers.find((s) => s.id === p.supplierId);
  openModal(`Faktur ${p.invoiceNo}`, `
    <div class="row-between"><span>Supplier</span><b>${escapeHtml(sup?.name || "-")}</b></div>
    <div class="row-between"><span>Tanggal</span><b>${fmtDate(p.date)}</b></div>
    <table class="tbl mt">
      <thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
      <tbody>${p.items.map((it) => `<tr><td>${escapeHtml(DB.data.products.find((pr) => pr.id === it.productId)?.name || "")}</td><td class="mono">${it.qty} ${unitLabel(it.unitId)}</td><td class="mono">${fmtMoney(it.cost)}</td><td class="mono">${fmtMoney(it.qty * it.cost)}</td></tr>`).join("")}</tbody>
    </table>
    <div class="row-between total-row"><span>Total</span><span class="mono">${fmtMoney(p.total)}</span></div>
  `, { wide: true });
}

function openPurchaseForm() {
  purchaseDraftItems = [];
  openModal("Input Faktur Pembelian", `
    <form id="pur-form">
      <div class="form-grid">
        <div>
          <label class="field-label">Supplier</label>
          <select class="input" name="supplierId" required>${DB.data.suppliers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}</select>
        </div>
        <div>
          <label class="field-label">No. Faktur</label>
          <input class="input" name="invoiceNo" value="PB${Date.now().toString().slice(-8)}" />
        </div>
        <div>
          <label class="field-label">Gudang Penerimaan</label>
          <select class="input" name="warehouseId">${DB.data.warehouses.map((w) => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join("")}</select>
        </div>
        <div>
          <label class="field-label">Status Pembayaran</label>
          <select class="input" name="status"><option>Lunas</option><option>Belum Lunas</option></select>
        </div>
      </div>

      <label class="field-label mt">Item Barang</label>
      <div class="purchase-item-row purchase-item-head">
        <span>Produk</span><span>Qty</span><span>Harga Modal</span><span>Subtotal</span><span></span>
      </div>
      <div id="pur-items"></div>
      <button type="button" class="btn btn-ghost sm" id="pur-add-item">${svgIcon("plus")} Tambah Item</button>

      <div class="row-between total-row mt"><span>Total Faktur</span><span class="mono" id="pur-total">Rp 0</span></div>

      <div class="flex justify-end gap-2 mt">
        <button type="button" class="btn btn-ghost" id="pur-cancel">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan &amp; Update Stok</button>
      </div>
    </form>`, { wide: true });

  document.getElementById("pur-cancel").addEventListener("click", closeModal);
  document.getElementById("pur-add-item").addEventListener("click", addPurchaseItemRow);
  addPurchaseItemRow();

  document.getElementById("pur-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const items = [...document.querySelectorAll(".pur-item-row")].map((row) => ({
      productId: row.querySelector('[name="pi-prod"]').value,
      unitId: DB.data.products.find((p) => p.id === row.querySelector('[name="pi-prod"]').value)?.baseUnitId,
      qty: +row.querySelector('[name="pi-qty"]').value || 0,
      cost: +row.querySelector('[name="pi-cost"]').value || 0,
    })).filter((it) => it.productId && it.qty > 0);
    if (!items.length) { toast("Tambahkan minimal 1 item", "danger"); return; }
    const total = items.reduce((a, it) => a + it.qty * it.cost, 0);
    const status = fd.get("status");
    const purchase = {
      id: uid("pur"), invoiceNo: fd.get("invoiceNo"), date: nowISO(), supplierId: fd.get("supplierId"),
      warehouseId: fd.get("warehouseId"), items, total, status,
    };
    DB.data.purchases.push(purchase);
    items.forEach((it) => {
      const p = DB.data.products.find((p) => p.id === it.productId);
      const conv = p.units.find((u) => u.unitId === it.unitId)?.conversion || 1;
      p.stock += it.qty * conv;
      DB.data.stockMovements.unshift({ id: uid("mv"), date: nowISO(), productId: p.id, type: "in", qty: it.qty * conv, ref: purchase.invoiceNo, warehouseId: purchase.warehouseId, note: "Pembelian" });
    });
    if (status === "Belum Lunas") {
      const sup = DB.data.suppliers.find((s) => s.id === purchase.supplierId);
      if (sup) sup.debt += total;
    }
    DB.data.cashTransactions.unshift({ id: uid("ct"), date: nowISO(), type: "out", amount: status === "Lunas" ? total : 0, category: "Pembelian", note: purchase.invoiceNo });
    DB.data.invoices.unshift({ id: uid("iv"), type: "purchase", refId: purchase.id, invoiceNo: purchase.invoiceNo, date: purchase.date, total });
    DB.save();
    DB.log(state.currentUser.id, "Input Pembelian", `${purchase.invoiceNo} - ${fmtMoney(total)}`);
    toast("Pembelian disimpan, stok diperbarui");
    closeModal(); go("pembelian");
  });
}

function addPurchaseItemRow() {
  const wrap = document.getElementById("pur-items");
  const div = document.createElement("div");
  div.innerHTML = `<div class="pur-item-row purchase-item-row">
    <select name="pi-prod" class="input sm">${DB.data.products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}</select>
    <input name="pi-qty" type="number" min="1" class="input sm mono" value="1" />
    <input name="pi-cost" type="number" min="0" class="input sm mono" value="0" />
    <span class="pi-subtotal mono">Rp 0</span>
    <button type="button" class="icon-btn sm pi-remove">${svgIcon("x")}</button>
  </div>`;
  const row = div.firstElementChild;
  wrap.appendChild(row);
  const qtyInp = row.querySelector('[name="pi-qty"]');
  const costInp = row.querySelector('[name="pi-cost"]');
  const prodSel = row.querySelector('[name="pi-prod"]');
  const sub = row.querySelector(".pi-subtotal");
  const recalc = () => {
    sub.textContent = fmtMoney((+qtyInp.value || 0) * (+costInp.value || 0));
    const total = [...document.querySelectorAll(".pur-item-row")].reduce((a, r) => a + (+r.querySelector('[name="pi-qty"]').value || 0) * (+r.querySelector('[name="pi-cost"]').value || 0), 0);
    document.getElementById("pur-total").textContent = fmtMoney(total);
  };
  prodSel.addEventListener("change", () => {
    const p = DB.data.products.find((p) => p.id === prodSel.value);
    if (p) costInp.value = productUnitPrice(p, p.baseUnitId)?.cost || 0;
    recalc();
  });
  [qtyInp, costInp].forEach((el) => el.addEventListener("input", recalc));
  row.querySelector(".pi-remove").addEventListener("click", () => { row.remove(); recalc(); });
  prodSel.dispatchEvent(new Event("change"));
}

/* ---------------------------- STOK ---------------------------- */

function renderStok() {
  const tab = state.stokTab || "movement";
  const { low, expiring } = getAlerts();
  return `
  <div class="tabs">
    <button class="tab ${tab === "movement" ? "active" : ""}" data-tab="movement">Stok Masuk/Keluar</button>
    <button class="tab ${tab === "opname" ? "active" : ""}" data-tab="opname">Stock Opname</button>
    <button class="tab ${tab === "alert" ? "active" : ""}" data-tab="alert">Notifikasi Stok</button>
  </div>
  <div class="panel">
    ${tab === "movement" ? renderStokMovementTab() : tab === "opname" ? renderStokOpnameTab() : renderStokAlertTab(low, expiring)}
  </div>`;
}

function renderStokMovementTab() {
  const moves = DB.data.stockMovements.slice(0, 100);
  return `
  <div class="panel-head">
    <h3>Riwayat Stok Masuk / Keluar</h3>
    <button class="btn btn-primary sm" id="mv-add">${svgIcon("plus")} Input Manual</button>
  </div>
  <div class="table-scroll"><table class="tbl">
    <thead><tr><th>Tanggal</th><th>Produk</th><th>Tipe</th><th>Qty</th><th>Referensi</th><th>Catatan</th></tr></thead>
    <tbody>
      ${moves.map((m) => `<tr>
        <td class="small">${fmtDateTime(m.date)}</td>
        <td>${escapeHtml(DB.data.products.find((p) => p.id === m.productId)?.name || "-")}</td>
        <td><span class="badge ${m.type === "in" ? "badge-ok" : m.type === "out" ? "badge-danger" : "badge-warn"}">${m.type === "in" ? "Masuk" : m.type === "out" ? "Keluar" : "Opname"}</span></td>
        <td class="mono">${m.qty}</td>
        <td class="small">${escapeHtml(m.ref || "-")}</td>
        <td class="small">${escapeHtml(m.note || "-")}</td>
      </tr>`).join("") || `<tr><td colspan="6" class="muted pad">Belum ada pergerakan stok.</td></tr>`}
    </tbody>
  </table></div>`;
}

function renderStokOpnameTab() {
  return `
  <div class="panel-head"><h3>Stock Opname (Cocokkan Stok Fisik)</h3></div>
  <div class="table-scroll"><table class="tbl">
    <thead><tr><th>Produk</th><th>Stok Sistem</th><th>Stok Fisik</th><th>Selisih</th><th></th></tr></thead>
    <tbody>
      ${DB.data.products.map((p) => `<tr data-pid="${p.id}">
        <td>${escapeHtml(p.name)}</td>
        <td class="mono">${p.stock}</td>
        <td><input type="number" class="input sm mono opname-input" data-id="${p.id}" value="${p.stock}" /></td>
        <td class="mono opname-diff" data-diff="${p.id}">0</td>
        <td><button class="btn btn-ghost xs opname-save" data-id="${p.id}">Simpan</button></td>
      </tr>`).join("")}
    </tbody>
  </table></div>`;
}

function renderStokAlertTab(low, expiring) {
  return `
  <div class="grid-2col">
    <div>
      <h3 class="mb">Stok Menipis (${low.length})</h3>
      <table class="tbl"><thead><tr><th>Produk</th><th>Stok</th><th>Minimum</th></tr></thead><tbody>
        ${low.map((p) => `<tr><td>${escapeHtml(p.name)}</td><td class="mono text-danger">${p.stock}</td><td class="mono">${p.minStock}</td></tr>`).join("") || `<tr><td colspan="3" class="muted pad">Tidak ada</td></tr>`}
      </tbody></table>
    </div>
    <div>
      <h3 class="mb">Mendekati Kadaluarsa (${expiring.length})</h3>
      <table class="tbl"><thead><tr><th>Produk</th><th>Tanggal</th></tr></thead><tbody>
        ${expiring.map((p) => `<tr><td>${escapeHtml(p.name)}</td><td class="mono text-warn">${fmtDate(p.expiryDate)}</td></tr>`).join("") || `<tr><td colspan="2" class="muted pad">Tidak ada</td></tr>`}
      </tbody></table>
    </div>
  </div>`;
}

function after_stok() {
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => { state.stokTab = t.dataset.tab; go("stok"); }));
  const addBtn = document.getElementById("mv-add");
  if (addBtn) addBtn.addEventListener("click", openStockMoveForm);
  document.querySelectorAll(".opname-input").forEach((inp) => {
    inp.addEventListener("input", () => {
      const p = DB.data.products.find((p) => p.id === inp.dataset.id);
      document.querySelector(`[data-diff="${inp.dataset.id}"]`).textContent = (+inp.value || 0) - p.stock;
    });
  });
  document.querySelectorAll(".opname-save").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = DB.data.products.find((p) => p.id === btn.dataset.id);
      const inp = document.querySelector(`.opname-input[data-id="${btn.dataset.id}"]`);
      const newVal = +inp.value || 0;
      const diff = newVal - p.stock;
      if (diff === 0) { toast("Tidak ada selisih"); return; }
      p.stock = newVal;
      DB.data.stockMovements.unshift({ id: uid("mv"), date: nowISO(), productId: p.id, type: "opname", qty: diff, ref: "OPNAME", warehouseId: p.warehouseId, note: "Stock opname" });
      DB.save(); DB.log(state.currentUser.id, "Stock Opname", `${p.name}: selisih ${diff}`);
      toast("Stok disesuaikan"); go("stok");
    });
  });
}

function openStockMoveForm() {
  openModal("Input Stok Manual", `
    <form id="mv-form">
      <label class="field-label">Produk</label>
      <select class="input" name="productId">${DB.data.products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}</select>
      <label class="field-label">Tipe</label>
      <select class="input" name="type"><option value="in">Stok Masuk</option><option value="out">Stok Keluar</option></select>
      <label class="field-label">Jumlah</label>
      <input class="input mono" type="number" min="1" name="qty" value="1" />
      <label class="field-label">Catatan</label>
      <input class="input" name="note" placeholder="mis. Barang rusak, retur, dsb." />
      <div class="flex justify-end gap-2 mt">
        <button type="button" class="btn btn-ghost" id="mv-cancel">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </div>
    </form>`);
  document.getElementById("mv-cancel").addEventListener("click", closeModal);
  document.getElementById("mv-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const p = DB.data.products.find((p) => p.id === fd.get("productId"));
    const qty = +fd.get("qty") || 0;
    const type = fd.get("type");
    p.stock += type === "in" ? qty : -qty;
    DB.data.stockMovements.unshift({ id: uid("mv"), date: nowISO(), productId: p.id, type, qty, ref: "MANUAL", warehouseId: p.warehouseId, note: fd.get("note") });
    DB.save(); DB.log(state.currentUser.id, "Input Stok Manual", `${p.name} ${type} ${qty}`);
    toast("Stok diperbarui"); closeModal(); go("stok");
  });
}

/* ---------------------------- KAS & PENGELUARAN ---------------------------- */

const EXPENSE_CATEGORIES = ["Sewa", "Listrik & Air", "Gaji Karyawan", "Transportasi", "Perlengkapan", "Lainnya"];

function renderKas() {
  const tx = DB.data.cashTransactions;
  const balance = tx.reduce((a, t) => a + (t.type === "in" ? t.amount : -t.amount), 0);
  const totalIn = tx.filter((t) => t.type === "in").reduce((a, t) => a + t.amount, 0);
  const totalOut = tx.filter((t) => t.type === "out").reduce((a, t) => a + t.amount, 0);
  return `
  <div class="grid-cards">
    <div class="stat-card"><div class="stat-label">Saldo Kas</div><div class="stat-value mono">${fmtMoney(balance)}</div></div>
    <div class="stat-card"><div class="stat-label">Total Kas Masuk</div><div class="stat-value mono text-ok">${fmtMoney(totalIn)}</div></div>
    <div class="stat-card"><div class="stat-label">Total Kas Keluar</div><div class="stat-value mono text-danger">${fmtMoney(totalOut)}</div></div>
  </div>
  <div class="panel">
    <div class="panel-head">
      <h3>Riwayat Kas</h3>
      <div class="panel-actions">
        <button class="btn btn-ghost sm" id="kas-out">${svgIcon("plus")} Kas Keluar</button>
        <button class="btn btn-primary sm" id="kas-in">${svgIcon("plus")} Kas Masuk</button>
      </div>
    </div>
    <div class="table-scroll"><table class="tbl">
      <thead><tr><th>Tanggal</th><th>Tipe</th><th>Kategori</th><th>Catatan</th><th>Jumlah</th></tr></thead>
      <tbody>
        ${tx.slice(0, 150).map((t) => `<tr>
          <td class="small">${fmtDateTime(t.date)}</td>
          <td><span class="badge ${t.type === "in" ? "badge-ok" : "badge-danger"}">${t.type === "in" ? "Masuk" : "Keluar"}</span></td>
          <td>${escapeHtml(t.category)}</td>
          <td class="small">${escapeHtml(t.note || "-")}</td>
          <td class="mono ${t.type === "in" ? "text-ok" : "text-danger"}">${t.type === "in" ? "+" : "-"}${fmtMoney(t.amount)}</td>
        </tr>`).join("") || `<tr><td colspan="5" class="muted pad">Belum ada transaksi kas.</td></tr>`}
      </tbody>
    </table></div>
  </div>`;
}

function after_kas() {
  document.getElementById("kas-in").addEventListener("click", () => openKasForm("in"));
  document.getElementById("kas-out").addEventListener("click", () => openKasForm("out"));
}

function openKasForm(type) {
  openModal(type === "in" ? "Kas Masuk" : "Kas Keluar / Pengeluaran", `
    <form id="kas-form">
      <label class="field-label">Kategori</label>
      <select class="input" name="category">
        ${type === "in" ? `<option>Setoran Modal</option><option>Penjualan</option><option>Lainnya</option>` : EXPENSE_CATEGORIES.map((c) => `<option>${c}</option>`).join("")}
      </select>
      <label class="field-label">Jumlah</label>
      <input class="input mono" type="number" min="0" name="amount" required />
      <label class="field-label">Catatan</label>
      <input class="input" name="note" />
      <div class="flex justify-end gap-2 mt">
        <button type="button" class="btn btn-ghost" id="kas-cancel">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </div>
    </form>`);
  document.getElementById("kas-cancel").addEventListener("click", closeModal);
  document.getElementById("kas-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const amount = +fd.get("amount") || 0;
    DB.data.cashTransactions.unshift({ id: uid("ct"), date: nowISO(), type, amount, category: fd.get("category"), note: fd.get("note") });
    if (type === "out") DB.data.expenses.unshift({ id: uid("ex"), date: nowISO(), category: fd.get("category"), amount, note: fd.get("note") });
    DB.save(); DB.log(state.currentUser.id, type === "in" ? "Kas Masuk" : "Kas Keluar", `${fd.get("category")} - ${fmtMoney(amount)}`);
    toast("Kas dicatat"); closeModal(); go("kas");
  });
}

/* ---------------------------- INVOICE ---------------------------- */

function renderInvoice() {
  const list = [...DB.data.invoices];
  return `
  <div class="panel">
    <div class="panel-head"><h3>Daftar Invoice (${list.length})</h3></div>
    <div class="table-scroll"><table class="tbl">
      <thead><tr><th>No. Invoice</th><th>Tipe</th><th>Tanggal</th><th>Total</th><th></th></tr></thead>
      <tbody>
        ${list.map((iv) => `<tr>
          <td>${escapeHtml(iv.invoiceNo)}</td>
          <td><span class="badge ${iv.type === "sale" ? "badge-ok" : "badge-warn"}">${iv.type === "sale" ? "Penjualan" : "Pembelian"}</span></td>
          <td class="small">${fmtDateTime(iv.date)}</td>
          <td class="mono">${fmtMoney(iv.total)}</td>
          <td class="row-actions">
            <button class="icon-btn sm" data-act="view" data-id="${iv.id}">${svgIcon("invoice")}</button>
            <button class="icon-btn sm" data-act="pdf" data-id="${iv.id}">PDF</button>
          </td>
        </tr>`).join("") || `<tr><td colspan="5" class="muted pad">Belum ada invoice.</td></tr>`}
      </tbody>
    </table></div>
  </div>`;
}

function after_invoice() {
  document.querySelectorAll('[data-act="view"]').forEach((b) => b.addEventListener("click", () => {
    const iv = DB.data.invoices.find((i) => i.id === b.dataset.id);
    if (iv.type === "sale") openReceiptModal(DB.data.sales.find((s) => s.id === iv.refId));
    else viewPurchase(iv.refId);
  }));
  document.querySelectorAll('[data-act="pdf"]').forEach((b) => b.addEventListener("click", () => {
    const iv = DB.data.invoices.find((i) => i.id === b.dataset.id);
    exportInvoicePDF(iv);
  }));
}

function exportInvoicePDF(iv) {
  if (typeof window.jspdf === "undefined") { toast("Fitur PDF butuh koneksi internet untuk memuat pustaka PDF", "danger"); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const s = DB.data.settings;
  doc.setFontSize(14); doc.text(s.storeName, 14, 16);
  doc.setFontSize(9); doc.text(s.address + " | " + s.phone, 14, 22);
  doc.setFontSize(11); doc.text(`Invoice: ${iv.invoiceNo}`, 14, 32);
  doc.text(`Tanggal: ${fmtDateTime(iv.date)}`, 14, 38);
  let rows = [];
  if (iv.type === "sale") {
    const sale = DB.data.sales.find((s2) => s2.id === iv.refId);
    rows = sale.items.map((it) => [it.name, `${it.qty} ${unitLabel(it.unitId)}`, fmtMoney(it.price), fmtMoney(it.qty * it.price - it.discount)]);
  } else {
    const p = DB.data.purchases.find((p2) => p2.id === iv.refId);
    rows = p.items.map((it) => [DB.data.products.find((pr) => pr.id === it.productId)?.name || "", `${it.qty} ${unitLabel(it.unitId)}`, fmtMoney(it.cost), fmtMoney(it.qty * it.cost)]);
  }
  doc.autoTable({ startY: 44, head: [["Item", "Qty", "Harga", "Subtotal"]], body: rows });
  const y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(12); doc.text(`TOTAL: ${fmtMoney(iv.total)}`, 14, y);
  doc.save(`${iv.invoiceNo}.pdf`);
}

/* ---------------------------- LAPORAN ---------------------------- */

function dateInRange(iso, from, to) {
  const d = iso.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
}

function renderLaporan() {
  const tab = state.laporanTab || "penjualan";
  const from = state.lapFrom || todayISO().slice(0, 8) + "01";
  const to = state.lapTo || todayISO();
  const tabs = [
    ["penjualan", "Penjualan"], ["pembelian", "Pembelian"], ["stok", "Stok"],
    ["produk", "Produk Terlaris"], ["labarugi", "Laba Rugi"], ["cashflow", "Cash Flow"],
  ];
  return `
  <div class="panel">
    <div class="panel-head">
      <h3>Laporan</h3>
      <div class="panel-actions">
        <input type="date" class="input sm" id="lap-from" value="${from}" />
        <span class="muted">s/d</span>
        <input type="date" class="input sm" id="lap-to" value="${to}" />
      </div>
    </div>
    <div class="tabs">
      ${tabs.map(([id, label]) => `<button class="tab ${tab === id ? "active" : ""}" data-tab="${id}">${label}</button>`).join("")}
    </div>
    <div id="lap-body">${renderLaporanBody(tab, from, to)}</div>
  </div>`;
}

function renderLaporanBody(tab, from, to) {
  if (tab === "penjualan") {
    const sales = DB.data.sales.filter((s) => dateInRange(s.date, from, to));
    const total = sales.reduce((a, s) => a + s.total, 0);
    return `
    <div class="row-between total-row"><span>Total Penjualan (${sales.length} transaksi)</span><span class="mono">${fmtMoney(total)}</span></div>
    <table class="tbl mt"><thead><tr><th>Invoice</th><th>Tanggal</th><th>Kasir</th><th>Total</th></tr></thead><tbody>
      ${sales.map((s) => `<tr><td>${escapeHtml(s.invoiceNo)}</td><td class="small">${fmtDateTime(s.date)}</td><td>${escapeHtml(DB.data.users.find((u) => u.id === s.cashierId)?.name || "-")}</td><td class="mono">${fmtMoney(s.total)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted pad">Tidak ada data.</td></tr>`}
    </tbody></table>`;
  }
  if (tab === "pembelian") {
    const purchases = DB.data.purchases.filter((p) => dateInRange(p.date, from, to));
    const total = purchases.reduce((a, p) => a + p.total, 0);
    return `
    <div class="row-between total-row"><span>Total Pembelian (${purchases.length} transaksi)</span><span class="mono">${fmtMoney(total)}</span></div>
    <table class="tbl mt"><thead><tr><th>Faktur</th><th>Tanggal</th><th>Supplier</th><th>Total</th></tr></thead><tbody>
      ${purchases.map((p) => `<tr><td>${escapeHtml(p.invoiceNo)}</td><td class="small">${fmtDate(p.date)}</td><td>${escapeHtml(DB.data.suppliers.find((s) => s.id === p.supplierId)?.name || "-")}</td><td class="mono">${fmtMoney(p.total)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted pad">Tidak ada data.</td></tr>`}
    </tbody></table>`;
  }
  if (tab === "stok") {
    const moves = DB.data.stockMovements.filter((m) => dateInRange(m.date, from, to));
    return `<table class="tbl"><thead><tr><th>Tanggal</th><th>Produk</th><th>Tipe</th><th>Qty</th></tr></thead><tbody>
      ${moves.map((m) => `<tr><td class="small">${fmtDateTime(m.date)}</td><td>${escapeHtml(DB.data.products.find((p) => p.id === m.productId)?.name || "-")}</td><td>${m.type}</td><td class="mono">${m.qty}</td></tr>`).join("") || `<tr><td colspan="4" class="muted pad">Tidak ada data.</td></tr>`}
    </tbody></table>`;
  }
  if (tab === "produk") {
    const sales = DB.data.sales.filter((s) => dateInRange(s.date, from, to));
    const qtyMap = {};
    sales.forEach((s) => s.items.forEach((it) => { qtyMap[it.productId] = (qtyMap[it.productId] || 0) + it.qty; }));
    const rows = Object.entries(qtyMap).sort((a, b) => b[1] - a[1]);
    return `<table class="tbl"><thead><tr><th>Produk</th><th>Qty Terjual</th></tr></thead><tbody>
      ${rows.map(([id, qty]) => `<tr><td>${escapeHtml(DB.data.products.find((p) => p.id === id)?.name || "-")}</td><td class="mono">${qty}</td></tr>`).join("") || `<tr><td colspan="2" class="muted pad">Tidak ada data.</td></tr>`}
    </tbody></table>`;
  }
  if (tab === "labarugi") {
    const sales = DB.data.sales.filter((s) => dateInRange(s.date, from, to));
    const revenue = sales.reduce((a, s) => a + s.total, 0);
    const cogs = sales.reduce((a, s) => a + s.items.reduce((c, it) => {
      const p = DB.data.products.find((p) => p.id === it.productId);
      const u = p?.units.find((u) => u.unitId === it.unitId);
      return c + (u ? u.cost * it.qty : 0);
    }, 0), 0);
    const expenses = DB.data.expenses.filter((e) => dateInRange(e.date, from, to)).reduce((a, e) => a + e.amount, 0);
    const gross = revenue - cogs;
    const net = gross - expenses;
    return `
    <table class="tbl">
      <tbody>
        <tr><td>Pendapatan Penjualan</td><td class="mono">${fmtMoney(revenue)}</td></tr>
        <tr><td>Harga Pokok Penjualan (HPP)</td><td class="mono text-danger">-${fmtMoney(cogs)}</td></tr>
        <tr class="total-row"><td>Laba Kotor</td><td class="mono">${fmtMoney(gross)}</td></tr>
        <tr><td>Beban Operasional</td><td class="mono text-danger">-${fmtMoney(expenses)}</td></tr>
        <tr class="total-row"><td>Laba Bersih</td><td class="mono ${net >= 0 ? "text-ok" : "text-danger"}">${fmtMoney(net)}</td></tr>
      </tbody>
    </table>`;
  }
  if (tab === "cashflow") {
    const tx = DB.data.cashTransactions.filter((t) => dateInRange(t.date, from, to));
    const inflow = tx.filter((t) => t.type === "in").reduce((a, t) => a + t.amount, 0);
    const outflow = tx.filter((t) => t.type === "out").reduce((a, t) => a + t.amount, 0);
    return `
    <div class="grid-cards">
      <div class="stat-card"><div class="stat-label">Arus Kas Masuk</div><div class="stat-value mono text-ok">${fmtMoney(inflow)}</div></div>
      <div class="stat-card"><div class="stat-label">Arus Kas Keluar</div><div class="stat-value mono text-danger">${fmtMoney(outflow)}</div></div>
      <div class="stat-card"><div class="stat-label">Arus Kas Bersih</div><div class="stat-value mono">${fmtMoney(inflow - outflow)}</div></div>
    </div>
    <table class="tbl mt"><thead><tr><th>Tanggal</th><th>Tipe</th><th>Kategori</th><th>Jumlah</th></tr></thead><tbody>
      ${tx.map((t) => `<tr><td class="small">${fmtDateTime(t.date)}</td><td>${t.type === "in" ? "Masuk" : "Keluar"}</td><td>${escapeHtml(t.category)}</td><td class="mono">${fmtMoney(t.amount)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted pad">Tidak ada data.</td></tr>`}
    </tbody></table>`;
  }
  return "";
}

function after_laporan() {
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => { state.laporanTab = t.dataset.tab; go("laporan"); }));
  document.getElementById("lap-from").addEventListener("change", (e) => { state.lapFrom = e.target.value; go("laporan"); });
  document.getElementById("lap-to").addEventListener("change", (e) => { state.lapTo = e.target.value; go("laporan"); });
}

/* ---------------------------- EXPORT DATA ---------------------------- */

function renderExport() {
  return `
  <div class="panel">
    <div class="panel-head"><h3>Export Data</h3></div>
    <div class="form-grid">
      <div>
        <label class="field-label">Dari Tanggal</label>
        <input type="date" class="input" id="ex-from" />
      </div>
      <div>
        <label class="field-label">Sampai Tanggal</label>
        <input type="date" class="input" id="ex-to" />
      </div>
      <div>
        <label class="field-label">Kategori Produk</label>
        <select class="input" id="ex-cat"><option value="">Semua</option>${DB.data.categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}</select>
      </div>
      <div>
        <label class="field-label">Supplier</label>
        <select class="input" id="ex-sup"><option value="">Semua</option>${DB.data.suppliers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}</select>
      </div>
      <div>
        <label class="field-label">Kasir</label>
        <select class="input" id="ex-kasir"><option value="">Semua</option>${DB.data.users.filter(u=>u.role==="Kasir").map((u) => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join("")}</select>
      </div>
    </div>
    <div class="export-btn-grid">
      <button class="btn btn-ghost" id="ex-sales-xlsx">Export Penjualan (XLSX)</button>
      <button class="btn btn-ghost" id="ex-sales-csv">Export Penjualan (CSV)</button>
      <button class="btn btn-ghost" id="ex-purchase-xlsx">Export Pembelian (XLSX)</button>
      <button class="btn btn-ghost" id="ex-stock-xlsx">Export Stok (XLSX)</button>
      <button class="btn btn-ghost" id="ex-product-xlsx">Export Produk (XLSX)</button>
    </div>
  </div>`;
}

function exFilters() {
  return {
    from: document.getElementById("ex-from").value,
    to: document.getElementById("ex-to").value,
    cat: document.getElementById("ex-cat").value,
    sup: document.getElementById("ex-sup").value,
    kasir: document.getElementById("ex-kasir").value,
  };
}

function after_export() {
  document.getElementById("ex-sales-xlsx").addEventListener("click", () => doExportSales("xlsx"));
  document.getElementById("ex-sales-csv").addEventListener("click", () => doExportSales("csv"));
  document.getElementById("ex-purchase-xlsx").addEventListener("click", () => {
    const f = exFilters();
    let rows = DB.data.purchases.filter((p) => dateInRange(p.date, f.from, f.to) && (!f.sup || p.supplierId === f.sup));
    exportXLSX(rows.map((p) => ({ Faktur: p.invoiceNo, Tanggal: p.date.slice(0, 10), Supplier: DB.data.suppliers.find((s) => s.id === p.supplierId)?.name, Total: p.total, Status: p.status })), "Pembelian", "export-pembelian.xlsx");
  });
  document.getElementById("ex-stock-xlsx").addEventListener("click", () => {
    const f = exFilters();
    let rows = DB.data.stockMovements.filter((m) => dateInRange(m.date, f.from, f.to));
    exportXLSX(rows.map((m) => ({ Tanggal: m.date.slice(0, 10), Produk: DB.data.products.find((p) => p.id === m.productId)?.name, Tipe: m.type, Qty: m.qty, Referensi: m.ref })), "Stok", "export-stok.xlsx");
  });
  document.getElementById("ex-product-xlsx").addEventListener("click", () => {
    const f = exFilters();
    let rows = DB.data.products.filter((p) => !f.cat || p.categoryId === f.cat);
    exportXLSX(rows.map((p) => ({ Nama: p.name, Barcode: p.barcode, Kategori: DB.data.categories.find((c) => c.id === p.categoryId)?.name, Stok: p.stock, Harga: productUnitPrice(p, p.baseUnitId).price })), "Produk", "export-produk.xlsx");
  });
}

function doExportSales(fmt) {
  const f = exFilters();
  let rows = DB.data.sales.filter((s) => dateInRange(s.date, f.from, f.to) && (!f.kasir || s.cashierId === f.kasir));
  const data = rows.map((s) => ({
    Invoice: s.invoiceNo, Tanggal: s.date.slice(0, 10), Kasir: DB.data.users.find((u) => u.id === s.cashierId)?.name,
    Pelanggan: DB.data.customers.find((c) => c.id === s.customerId)?.name || "Umum", Total: s.total, Metode: s.payments[0]?.method,
  }));
  if (fmt === "xlsx") exportXLSX(data, "Penjualan", "export-penjualan.xlsx");
  else exportCSV(data, "export-penjualan.csv");
}

function exportXLSX(rows, sheetName, filename) {
  if (typeof XLSX === "undefined") { toast("Fitur export butuh koneksi internet untuk memuat pustaka Excel", "danger"); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
  toast("File berhasil diunduh");
}

function exportCSV(rows, filename) {
  if (typeof XLSX === "undefined") { toast("Fitur export butuh koneksi internet untuk memuat pustaka Excel", "danger"); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  toast("File berhasil diunduh");
}

/* ---------------------------- USER MANAGEMENT ---------------------------- */

function renderUsers() {
  return `
  <div class="panel">
    <div class="panel-head">
      <h3>Manajemen Pengguna (${DB.data.users.length})</h3>
      <button class="btn btn-primary sm" id="usr-add">${svgIcon("plus")} Tambah Pengguna</button>
    </div>
    <div class="table-scroll"><table class="tbl">
      <thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${DB.data.users.map((u) => `<tr>
          <td>${escapeHtml(u.name)}</td>
          <td class="mono">${escapeHtml(u.username)}</td>
          <td><span class="badge badge-role">${u.role}</span></td>
          <td><span class="badge ${u.active !== false ? "badge-ok" : "badge-danger"}">${u.active !== false ? "Aktif" : "Nonaktif"}</span></td>
          <td class="row-actions">
            <button class="icon-btn sm" data-act="edit" data-id="${u.id}">${svgIcon("edit")}</button>
            ${u.id !== state.currentUser.id ? `<button class="icon-btn sm" data-act="del" data-id="${u.id}">${svgIcon("trash")}</button>` : ""}
          </td>
        </tr>`).join("")}
      </tbody>
    </table></div>
  </div>`;
}

function after_users() {
  document.getElementById("usr-add").addEventListener("click", () => openUserForm());
  document.querySelectorAll('[data-act="edit"]').forEach((b) => b.addEventListener("click", () => openUserForm(b.dataset.id)));
  document.querySelectorAll('[data-act="del"]').forEach((b) => b.addEventListener("click", () => {
    confirmDialog("Hapus pengguna ini?", () => {
      DB.data.users = DB.data.users.filter((u) => u.id !== b.dataset.id);
      DB.save(); toast("Pengguna dihapus"); go("users");
    });
  }));
}

function openUserForm(id) {
  const u = id ? DB.data.users.find((u) => u.id === id) : null;
  openModal(u ? "Edit Pengguna" : "Tambah Pengguna", `
    <form id="usr-form">
      <label class="field-label">Nama Lengkap</label>
      <input class="input" name="name" required value="${escapeHtml(u?.name || "")}" />
      <label class="field-label">Username</label>
      <input class="input" name="username" required value="${escapeHtml(u?.username || "")}" />
      <label class="field-label">Password</label>
      <input class="input" name="password" required value="${escapeHtml(u?.password || "")}" />
      <label class="field-label">Role</label>
      <select class="input" name="role">${DB.data.roles.map((r) => `<option ${u?.role === r ? "selected" : ""}>${r}</option>`).join("")}</select>
      <label class="field-label">Status</label>
      <select class="input" name="active"><option value="true" ${u?.active !== false ? "selected" : ""}>Aktif</option><option value="false" ${u?.active === false ? "selected" : ""}>Nonaktif</option></select>
      <div class="flex justify-end gap-2 mt">
        <button type="button" class="btn btn-ghost" id="usr-cancel">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </div>
    </form>`);
  document.getElementById("usr-cancel").addEventListener("click", closeModal);
  document.getElementById("usr-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = { name: fd.get("name"), username: fd.get("username"), password: fd.get("password"), role: fd.get("role"), active: fd.get("active") === "true" };
    if (u) Object.assign(u, payload); else DB.data.users.push({ id: uid("u"), ...payload });
    DB.save(); DB.log(state.currentUser.id, u ? "Edit Pengguna" : "Tambah Pengguna", payload.username);
    toast("Pengguna disimpan"); closeModal(); go("users");
  });
}

/* ---------------------------- AUDIT LOG ---------------------------- */

function renderLog() {
  return `
  <div class="panel">
    <div class="panel-head"><h3>Audit Log (${DB.data.activityLogs.length})</h3></div>
    <div class="table-scroll"><table class="tbl">
      <thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Detail</th></tr></thead>
      <tbody>
        ${DB.data.activityLogs.slice(0, 300).map((l) => `<tr>
          <td class="small">${fmtDateTime(l.date)}</td>
          <td>${escapeHtml(DB.data.users.find((u) => u.id === l.userId)?.name || "-")}</td>
          <td>${escapeHtml(l.action)}</td>
          <td class="small">${escapeHtml(l.detail)}</td>
        </tr>`).join("") || `<tr><td colspan="4" class="muted pad">Belum ada aktivitas.</td></tr>`}
      </tbody>
    </table></div>
  </div>`;
}

/* ---------------------------- PENGATURAN ---------------------------- */

function renderPengaturan() {
  const s = DB.data.settings;
  return `
  <div class="grid-2col">
    <div class="panel">
      <div class="panel-head"><h3>Profil Toko</h3></div>
      <form id="set-form">
        <label class="field-label">Nama Toko</label>
        <input class="input" name="storeName" value="${escapeHtml(s.storeName)}" />
        <label class="field-label">Alamat</label>
        <input class="input" name="address" value="${escapeHtml(s.address)}" />
        <label class="field-label">Telepon</label>
        <input class="input" name="phone" value="${escapeHtml(s.phone)}" />
        <label class="field-label">NPWP (opsional)</label>
        <input class="input" name="npwp" value="${escapeHtml(s.npwp || "")}" />
        <label class="field-label">Pajak (%)</label>
        <input class="input mono" type="number" name="taxPercent" value="${s.taxPercent}" />
        <label class="field-label">Logo Toko</label>
        <input class="input" type="file" name="logo" accept="image/*" />
        ${s.logo ? `<img src="${s.logo}" class="settings-logo-preview"/>` : ""}
        <label class="field-label">Catatan Kaki Struk</label>
        <input class="input" name="receiptFooter" value="${escapeHtml(s.receiptFooter)}" />
        <label class="field-label">Lebar Kertas Struk</label>
        <select class="input" name="receiptWidth"><option value="58" ${s.receiptWidth==="58"?"selected":""}>58mm</option><option value="80" ${s.receiptWidth==="80"?"selected":""}>80mm</option></select>
        <label class="field-label">Gambar QRIS (statis)</label>
        <input class="input" type="file" name="qrisImage" accept="image/*" />
        ${s.qrisImage ? `<img src="${s.qrisImage}" class="settings-logo-preview"/>` : ""}
        <label class="field-label">Batas Notifikasi Stok Minimum (default)</label>
        <input class="input mono" type="number" name="lowStockThreshold" value="${s.lowStockThreshold}" />
        <label class="field-label">Peringatan Kadaluarsa (hari sebelumnya)</label>
        <input class="input mono" type="number" name="expiryWarningDays" value="${s.expiryWarningDays}" />
        <button class="btn btn-primary w-full mt" type="submit">Simpan Pengaturan</button>
      </form>
    </div>

    <div>
      <div class="panel mb">
        <div class="panel-head"><h3>Cabang &amp; Gudang</h3></div>
        <label class="field-label">Cabang Aktif</label>
        <select class="input" id="active-branch">${DB.data.branches.map((b) => `<option value="${b.id}" ${DB.data.activeBranchId === b.id ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}</select>
        <button class="btn btn-ghost sm mt" id="add-branch">${svgIcon("plus")} Tambah Cabang</button>
        <label class="field-label mt">Daftar Gudang</label>
        <ul class="simple-list">${DB.data.warehouses.map((w) => `<li>${escapeHtml(w.name)}</li>`).join("")}</ul>
        <button class="btn btn-ghost sm" id="add-warehouse">${svgIcon("plus")} Tambah Gudang</button>
      </div>

      <div class="panel mb">
        <div class="panel-head"><h3>Sinkronisasi Google Sheets</h3></div>
        <p class="muted small">Hubungkan aplikasi ke Google Sheets sebagai backup &amp; laporan online. Perlu deploy Google Apps Script terlebih dahulu — lihat <code>google-apps-script/Code.gs</code> &amp; <code>PANDUAN_GOOGLE_SHEETS.md</code> di dalam paket unduhan.</p>
        <form id="sync-form">
          <label class="field-label">ID Google Sheets</label>
          <input class="input" name="sheetId" placeholder="Contoh: 1AbCDefGhIjkLmNoPQRstuVWxyz..." value="${escapeHtml(DB.data.settings.sync.sheetId)}" />
          <label class="field-label">GAS Web App URL</label>
          <input class="input" name="gasUrl" placeholder="https://script.google.com/macros/s/xxxx/exec" value="${escapeHtml(DB.data.settings.sync.gasUrl)}" />
          <label class="field-label check-row">
            <input type="checkbox" name="autoSync" ${DB.data.settings.sync.autoSync ? "checked" : ""} /> Aktifkan Auto-Sync setiap 15 menit
          </label>
          <div class="flex gap-2 mt" style="flex-wrap:wrap;">
            <button type="submit" class="btn btn-primary">Simpan Pengaturan Sync</button>
            <button type="button" class="btn btn-ghost" id="sync-test">Test Koneksi</button>
            <button type="button" class="btn btn-ghost" id="sync-now-btn">${svgIcon("sync")} Sync Sekarang</button>
          </div>
        </form>
        <div class="row-between mt small">
          <span class="muted">Terakhir sync</span>
          <span>${DB.data.settings.sync.lastSync ? fmtDateTime(DB.data.settings.sync.lastSync) : "-"}</span>
        </div>
      </div>

      <div class="panel mb">
        <div class="panel-head"><h3>Backup &amp; Restore Data</h3></div>
        <p class="muted small">Semua data tersimpan di perangkat ini (localStorage). Unduh cadangan secara berkala.</p>
        <button class="btn btn-ghost w-full" id="backup-btn">Unduh Backup (.json)</button>
        <label class="btn btn-ghost w-full mt" style="text-align:center;display:block;cursor:pointer;">
          Pulihkan dari Backup
          <input type="file" id="restore-file" accept=".json" style="display:none" />
        </label>
        <button class="btn btn-danger w-full mt" id="wipe-btn">Hapus Semua Data Transaksi</button>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Fitur Profesional</h3></div>
        <ul class="feature-list">
          <li>✅ Barcode scanner (mode keyboard-wedge) — aktif di halaman POS</li>
          <li>✅ QRIS — QR ditampilkan otomatis saat memilih metode QRIS</li>
          <li>✅ Multi cabang &amp; multi gudang</li>
          <li>✅ Audit log aktivitas pengguna</li>
          <li>✅ Backup / restore data</li>
          <li>✅ Sinkronisasi Google Sheets (auto 15 menit + manual)</li>
          <li>✅ PWA — bisa di-"Install" ke HP/Tablet, bisa dipakai offline</li>
          <li>✅ Invoice via WhatsApp (wa.me)</li>
        </ul>
      </div>
    </div>
  </div>`;
}

function after_pengaturan() {
  document.getElementById("set-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const apply = (logoData, qrisData) => {
      Object.assign(DB.data.settings, {
        storeName: fd.get("storeName"), address: fd.get("address"), phone: fd.get("phone"), npwp: fd.get("npwp"),
        taxPercent: +fd.get("taxPercent") || 0, receiptFooter: fd.get("receiptFooter"), receiptWidth: fd.get("receiptWidth"),
        lowStockThreshold: +fd.get("lowStockThreshold") || 5, expiryWarningDays: +fd.get("expiryWarningDays") || 30,
      });
      if (logoData) DB.data.settings.logo = logoData;
      if (qrisData) DB.data.settings.qrisImage = qrisData;
      DB.save(); toast("Pengaturan disimpan"); go("pengaturan");
    };
    const logoFile = fd.get("logo"), qrisFile = fd.get("qrisImage");
    const readOrNull = (file) => new Promise((res) => {
      if (file && file.size) { const r = new FileReader(); r.onload = (ev) => res(ev.target.result); r.readAsDataURL(file); }
      else res(null);
    });
    Promise.all([readOrNull(logoFile), readOrNull(qrisFile)]).then(([l, q]) => apply(l, q));
  });

  document.getElementById("active-branch").addEventListener("change", (e) => { DB.data.activeBranchId = e.target.value; DB.save(); go("pengaturan"); });
  document.getElementById("add-branch").addEventListener("click", () => {
    const name = prompt("Nama cabang baru:");
    if (name) { DB.data.branches.push({ id: uid("br"), name }); DB.save(); go("pengaturan"); }
  });
  document.getElementById("add-warehouse").addEventListener("click", () => {
    const name = prompt("Nama gudang baru:");
    if (name) { DB.data.warehouses.push({ id: uid("wh"), name, branchId: DB.data.activeBranchId }); DB.save(); go("pengaturan"); }
  });

  document.getElementById("sync-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    Object.assign(DB.data.settings.sync, {
      sheetId: (fd.get("sheetId") || "").trim(),
      gasUrl: (fd.get("gasUrl") || "").trim(),
      autoSync: fd.get("autoSync") === "on",
    });
    DB.save();
    startAutoSync();
    DB.log(state.currentUser.id, "Update Pengaturan Sync", DB.data.settings.sync.autoSync ? "Auto-sync diaktifkan" : "Auto-sync dinonaktifkan");
    toast("Pengaturan sinkronisasi disimpan");
    go("pengaturan");
  });
  document.getElementById("sync-test").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const fd = new FormData(document.getElementById("sync-form"));
    const sheetId = (fd.get("sheetId") || "").trim(), gasUrl = (fd.get("gasUrl") || "").trim();
    if (!sheetId || !gasUrl) { toast("Isi Sheet ID dan GAS URL dahulu", "danger"); return; }
    btn.disabled = true; btn.textContent = "Menguji...";
    const prevSync = { ...DB.data.settings.sync };
    DB.data.settings.sync.sheetId = sheetId; DB.data.settings.sync.gasUrl = gasUrl;
    try {
      await testSyncConnection();
      toast("Koneksi berhasil! Sheet dan GAS URL valid.");
    } catch (err) {
      toast("Koneksi gagal: " + err.message, "danger");
    } finally {
      Object.assign(DB.data.settings.sync, prevSync, { sheetId, gasUrl });
      btn.disabled = false; btn.textContent = "Test Koneksi";
    }
  });
  document.getElementById("sync-now-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    await syncNow(false);
    btn.disabled = false;
    go("pengaturan");
  });

  document.getElementById("backup-btn").addEventListener("click", () => {
    const blob = new Blob([DB.exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backup-pos-${todayISO()}.json`;
    a.click();
  });
  document.getElementById("restore-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    confirmDialog("Memulihkan backup akan menimpa seluruh data saat ini. Lanjutkan?", () => {
      const r = new FileReader();
      r.onload = (ev) => { DB.importJSON(ev.target.result); toast("Data berhasil dipulihkan"); render(); };
      r.readAsText(file);
    });
  });
  document.getElementById("wipe-btn").addEventListener("click", () => {
    confirmDialog("Ini akan menghapus SEMUA data transaksi (produk & pengaturan tetap ada). Lanjutkan?", () => {
      DB.wipe(); toast("Data transaksi dihapus"); render();
    });
  });
}
