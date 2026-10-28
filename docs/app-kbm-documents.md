# Modul Dokumen — App KBM (v1)

Basis: clone GezyTeach (`main` 5560fe6) yang sudah ter-push ke `gezyt/app-kbm`.
Modul ini dibangun atas perintah Pak Gun 27 Oktober 2026: "langsung mulai
membangun". Belum di-push; kode di bawah ini masih lokal di
`~/workspace/app-kbm` sampai Pak Gun memerintahkan push.

## Keputusan yang dikunci (default v1)

- **Tidak merusak Perangkat lama.** Menu Perangkat (tautan Google Drive)
  tetap ada. Dokumen adalah menu baru `/app/documents`, tabel baru
  `documents`, supaya data Drive lama dan backup lama tetap jalan.
- **Kategori:** CP, ATP, RPP, LKPD, Asesmen, Lainnya.
  (Koreksi Pak Gun: ATP, bukan ATPP.)
- **Satu guru, satu kepemilikan.** Setiap dokumen milik `user_id` pembuatnya.
  Unduh dan hapus selalu memeriksa pemilik; dokumen guru lain tidak bisa
  dibuka lewat ID (404).
- **Unggah berkas, bukan tautan.** Berkas disimpan di
  `data/uploads/documents/` (sudah di-`.gitignore` lewat `data/`).
  Nama simpan dibuat acak (`waktu-random-nama-aman.ext`), nama asli hanya
  dipakai untuk label unduhan. Ini mencegah tabrakan nama dan path traversal.
- **Batas:** maksimal 10 MB per berkas. Jenis yang diterima: PDF, DOC, DOCX,
  XLS, XLSX, PPT, PPTX, ODT, ODS, ODP, TXT, MD, JPG, PNG, ZIP.
- **Filter:** kategori + pencarian judul/mapel/deskripsi. Metadata opsional:
  mata pelajaran, kelas, semester (Ganjil/Genap), deskripsi.
- **Jejak:** unggah dan hapus dicatat di Log Aktivitas
  (`buat_dokumen`, `hapus_dokumen`).
- **Backup:** tabel `documents` ikut Backup & Restore JSON (metadata saja).
  Isi berkas TIDAK ikut JSON. Saat pindah server, salin juga folder
  `data/uploads/documents/`; kalau tidak, unduhan dokumen hasil restore
  akan 404 dengan pesan yang menjelaskan hal itu.

## Yang sengaja BELUM diubah di v1

- Nama, judul, cookie sesi, nama berkas database (`gezyteach.db`), dan
  format backup masih GezyTeach. Mengubah itu sekaligus berisiko merusak
  data/backup GezyTeach yang sudah berjalan. Rebrand penuh ke App KBM
  (nama paket, Brand, cookie, DB, seed) adalah langkah terpisah bila
  Pak Gun memintanya.
- Tidak ada pratinjau berkas di browser, tidak ada folder/berbagi antar
  guru, tidak ada versi dokumen. Itu iterasi berikutnya, bukan v1.

## Berkas yang berubah / baru

- Baru: `src/services/document.service.ts`, `src/routes/documents.tsx`,
  `src/db/migrations/0010_documents.sql`, dokumen ini.
- Diubah: `src/db/schema.ts` (tabel + relasi `documents`),
  `src/db/migrations/meta/_journal.json` (entri 0010),
  `src/components/Brand.tsx` (menu Dokumen),
  `src/routes/dashboard.tsx` (kartu Dokumen),
  `src/index.ts` (pasang route),
  `src/services/activity-log.service.ts` (label),
  `src/services/backup.service.ts` (tabel + urutan + catatan berkas).

## Catatan migrasi

`0010_documents.sql` ditulis manual. `bun run db:generate` (drizzle-kit)
gagal di repo ini karena meminta prompt interaktif soal konflik kolom
— kemungkinan karena snapshot drizzle di `meta/` hanya sampai migrasi
0003, sementara migrasi 0004–0009 ditulis tangan. Menulis migrasi manual
lebih aman daripada menjawab prompt itu secara buta. Isi SQL-nya
mengikuti pola migrasi sebelumnya (teks polos untuk enum SQLite, FK
cascade ke `users`, indeks unik nama simpan + indeks user/kategori).

## Cara menjalankan (uji lokal)

```bash
bun install
bun run db:migrate
bun run db:seed   # akun uji lokal saja, ganti password setelah login
bun run build:css
bun run dev       # http://localhost:3000
```

Buka `/app/documents`, unggah berkas, filter kategori, unduh, lalu hapus.
Hapus dokumen harus menghapus baris database DAN berkasnya di
`data/uploads/documents/`.
