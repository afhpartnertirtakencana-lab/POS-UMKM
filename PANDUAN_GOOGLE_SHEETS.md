# Panduan Sinkronisasi Google Sheets

Fitur ini menghubungkan aplikasi POS ke Google Sheets, sehingga data (produk,
penjualan, pembelian, stok, dll) bisa otomatis ter-backup dan bisa dilihat /
dilaporkan lewat Google Sheets biasa. Auto-sync berjalan setiap **15 menit**,
dan bisa juga di-sync manual kapan saja lewat ikon 🔄 di pojok kanan atas
(muncul di semua menu) atau tombol "Sync Sekarang" di menu Pengaturan.

## Langkah 1 — Siapkan Google Sheets

1. Buka [sheets.google.com](https://sheets.google.com) → buat spreadsheet baru,
   beri nama misalnya "Data POS Toko Saya".
2. Lihat alamat (URL) di address bar, formatnya seperti ini:
   ```
   https://docs.google.com/spreadsheets/d/1AbCDefGhIjkLmNoPQRstuVWxyz.../edit
   ```
   Bagian tengah yang panjang (antara `/d/` dan `/edit`) adalah **Sheet ID** —
   salin ini, akan dipakai nanti.

## Langkah 2 — Pasang Google Apps Script

1. Masih di spreadsheet tadi, klik menu **Extensions → Apps Script**.
2. Hapus semua kode contoh (`function myFunction() {...}`) yang sudah ada.
3. Buka file `google-apps-script/Code.gs` dari paket aplikasi ini, salin
   **seluruh isinya**, dan tempel ke editor Apps Script tadi.
4. Klik ikon simpan (💾) atau `Ctrl+S`.
5. Klik tombol **Deploy → New deployment** (di kanan atas).
6. Klik ikon gerigi ⚙️ di sebelah "Select type", pilih **Web app**.
7. Isi:
   - **Description**: bebas, misalnya "POS Sync"
   - **Execute as**: `Me (email Anda)`
   - **Who has access**: **`Anyone`** ← ini WAJIB, bukan "Anyone with Google account"
8. Klik **Deploy**.
9. Google akan minta izin akses (Authorize access) — pilih akun Google Anda,
   klik "Advanced"/"Lanjutan" lalu "Go to (nama proyek) (unsafe)" jika muncul
   peringatan, ini normal karena skrip belum diverifikasi Google (skrip milik
   Anda sendiri, aman).
10. Setelah berhasil, akan muncul **Web app URL** seperti:
    ```
    https://script.google.com/macros/s/AKfycb.../exec
    ```
    Salin URL ini — inilah **GAS URL**.

## Langkah 3 — Hubungkan di Aplikasi POS

1. Login ke aplikasi POS (role Owner atau Manager).
2. Buka menu **Pengaturan → Sinkronisasi Google Sheets**.
3. Tempel **Sheet ID** dan **GAS Web App URL** ke kolom yang tersedia.
4. Klik **Simpan Pengaturan Sync**.
5. Klik **Test Koneksi** — kalau muncul "Koneksi berhasil", berarti sudah tersambung.
6. Centang **Aktifkan Auto-Sync setiap 15 menit** bila ingin backup otomatis berkala.
7. Klik **Sync Sekarang** untuk sinkronisasi pertama kali.

Setelah itu, buka kembali Google Sheets Anda — akan muncul banyak tab baru
(Products, Sales, Purchases, dst) berisi data dari aplikasi POS.

## Cara kerja sinkronisasi

- **Push** = kirim data dari aplikasi (perangkat ini) → ke Google Sheets.
- **Pull** = ambil data dari Google Sheets → ke aplikasi (perangkat ini),
  menimpa data lokal dengan data di Sheets.
- **Sync Sekarang / Auto-sync** = Push dahulu, lalu Pull — supaya perubahan di
  perangkat ini ikut terkirim sebelum mengambil versi gabungan terbaru.
- Tombol sync (ikon 🔄) ada di topbar setiap menu, jadi bisa disinkronkan dari
  halaman mana pun tanpa perlu pindah ke menu Pengaturan.

## Batasan yang perlu diketahui

- **Bukan real-time multi-user.** Ini bukan database bersama yang otomatis
  langsung sinkron detik itu juga antar kasir. Kalau dua perangkat mengubah
  data yang sama persis di jendela waktu yang sama sebelum sempat sync,
  perubahan yang di-*push* paling akhir yang akan tersimpan (data yang lebih
  awal bisa tertimpa). Untuk toko dengan beberapa kasir aktif bersamaan,
  biasakan sync manual setelah transaksi penting, atau pertimbangkan interval
  auto-sync lebih pendek dengan mengubah `AUTO_SYNC_INTERVAL_MS` di
  `assets/sync.js`.
- **Field kompleks** (misalnya daftar item dalam satu transaksi) disimpan
  sebagai teks JSON di dalam satu sel Google Sheets — ini normal, dan
  aplikasi akan membacanya kembali dengan benar saat pull. Jangan mengubah isi
  sel tersebut secara manual di Google Sheets kecuali Anda memahami formatnya.
- **Jangan hapus/ubah nama tab** (Products, Sales, dst) di Google Sheets,
  karena skrip mencocokkan berdasarkan nama tab persis.
- Google Apps Script punya kuota harian gratis (biasanya cukup besar untuk
  toko UMKM), lihat [batas kuota Apps Script](https://developers.google.com/apps-script/guides/services/quotas)
  bila mengalami error kuota.
