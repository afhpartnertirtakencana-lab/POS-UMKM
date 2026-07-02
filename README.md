# POS UMKM — Sistem Kasir & Manajemen Toko

Aplikasi POS (Point of Sale) untuk minimarket & UMKM, sesuai spesifikasi yang
dikirimkan. Berjalan langsung di browser — bisa dipakai di **laptop/PC, HP,
maupun tablet** tanpa instalasi, dan bisa di-"Install" sebagai aplikasi (PWA).

## Cara menjalankan

**Opsi 1 — Paling mudah (coba sekarang):**
Buka `index.html` langsung dua kali klik di file explorer / buka lewat browser.
(Catatan: fitur cetak & PWA install bekerja lebih baik jika di-hosting, lihat Opsi 2.)

**Opsi 2 — Hosting sederhana (direkomendasikan):**
Upload seluruh folder ini ke hosting statis apa pun, contoh gratis:
- Netlify Drop (drag & drop folder ke app.netlify.com/drop)
- Vercel, GitHub Pages, Firebase Hosting
- Atau jalankan server lokal: `npx serve .` lalu buka alamat yang muncul

Setelah online, buka alamatnya di HP/tablet lalu pilih **"Tambah ke Layar
Utama" / "Install App"** dari menu browser agar tampil seperti aplikasi asli
(mode PWA, bisa dipakai offline setelah dibuka sekali).

## Akun demo (lihat juga tombol di halaman login)

| Role    | Username | Password    |
|---------|----------|-------------|
| Owner   | owner    | owner123    |
| Manager | manager  | manager123  |
| Kasir   | kasir    | kasir123    |
| Gudang  | gudang   | gudang123   |

## Modul yang tersedia

Dashboard • POS/Kasir • Produk • Kategori • Supplier • Pelanggan • Pembelian •
Stok (masuk/keluar, opname, notifikasi) • Kas & Pengeluaran • Invoice •
Laporan (penjualan, pembelian, stok, produk terlaris, laba rugi, cash flow) •
Export Data (XLSX/CSV dengan filter) • User Management (role-based) •
Audit Log • Pengaturan (profil toko, pajak, logo, struk, QRIS, cabang/gudang,
backup & restore).

## Cara kerja penyimpanan data

Semua data (produk, transaksi, dll) disimpan di **localStorage milik
browser/perangkat itu sendiri** — tidak ada server database di baliknya.
Artinya:
- Data **tidak otomatis tersinkron** antar perangkat (HP dan laptop akan
  punya data terpisah, kecuali Anda export/import backup-nya).
- Gunakan menu **Pengaturan → Backup & Restore** secara rutin untuk mengunduh
  cadangan `.json`, dan pulihkan di perangkat lain bila perlu.
- Menghapus cache/data browser akan menghapus seluruh data aplikasi.

Jika ke depannya dibutuhkan multi-perangkat real-time (misalnya kasir di toko
fisik dan owner memantau dari HP secara bersamaan), aplikasi ini perlu
disambungkan ke database server (mis. Supabase/Firebase/backend sendiri) —
struktur tabel sudah disiapkan mengikuti skema pada spesifikasi awal
(`users, products, sales, purchases, stock_movements, dst`) sehingga migrasi
ke backend nyata dapat dilakukan tanpa mengubah desain data.

## Catatan tentang fitur "profesional"

- **Barcode scanner**: didukung dalam mode *keyboard-wedge* — scanner USB/Bluetooth
  umum akan mengetik kode lalu Enter di kolom pencarian POS, otomatis
  menambahkan produk ke keranjang. Pemindaian lewat kamera HP belum disertakan.
- **QRIS**: kode QR yang muncul saat checkout adalah **simulasi tampilan**
  untuk keperluan demo/latihan kasir, bukan koneksi ke payment gateway
  sungguhan. Untuk QRIS asli, perlu integrasi ke penyedia (mis. Midtrans,
  Xendit, atau bank) yang memerlukan akun merchant resmi.
- **Invoice via WhatsApp**: membuka `wa.me` dengan teks struk sudah terisi,
  dikirim manual oleh kasir (bukan otomatis lewat WhatsApp Business API).
- **Multi-cabang & multi-gudang**: tersedia sebagai pengelompokan data
  (cabang aktif dipilih di Pengaturan); karena data tersimpan lokal per
  perangkat, sinkronisasi lintas cabang tetap memerlukan backend terpusat
  seperti dijelaskan di atas.

## Struktur folder

```
index.html            Halaman utama
manifest.json          Konfigurasi PWA (install ke HP/tablet)
sw.js                   Service worker (cache offline)
assets/
  db.js                 Struktur & penyimpanan data (localStorage) + data contoh
  ui.js                 Komponen UI: format, toast, modal, ikon, autentikasi
  app.js                Seluruh logika modul & halaman
  styles.css             Desain visual aplikasi
  icon-192.png/512.png   Ikon aplikasi
```
