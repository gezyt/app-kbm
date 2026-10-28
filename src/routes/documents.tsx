import { Hono } from "hono";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import type { SessionUser } from "../services/auth.service";
import { logForUser } from "../services/activity-log.service";
import { Layout } from "../components/Layout";
import { Alert } from "../components/Alert";
import {
  DOCUMENT_CATEGORIES,
  MAX_DOCUMENT_SIZE,
  documentFilePath,
  createDocument,
  deleteDocument,
  ensureDocumentUploadDir,
  formatDocumentDate,
  formatFileSize,
  getDocumentByUser,
  listDocumentsByUser,
  makeStoredFileName,
  validateDocumentUpload,
  type DocumentCategory,
} from "../services/document.service";

type AppContext = {
  Variables: { user: SessionUser };
};

export const documentsRoutes = new Hono<AppContext>();

const UPLOAD_ERRORS: Record<string, string> = {
  no_file: "Pilih dulu berkas yang akan diunggah.",
  too_large: "Berkas terlalu besar. Maksimal 10 MB per berkas.",
  bad_type:
    "Jenis berkas belum didukung. Gunakan PDF, DOCX, XLSX, PPT, gambar, atau ZIP.",
  invalid: "Data dokumen tidak valid. Periksa kategori dan judulnya.",
};

documentsRoutes.get("/app/documents", async (c) => {
  const user = c.get("user");
  const category = c.req.query("category") ?? "Semua";
  const q = c.req.query("q") ?? "";
  const error = c.req.query("error");
  const items = await listDocumentsByUser(user.id, { category, q });

  return c.html(
    <Layout title="Dokumen" user={user} activeNav="documents">
      <h1 class="text-xl font-semibold mb-1">Dokumen</h1>
      <p class="gt-muted text-sm mb-4">
        Simpan CP, ATP, RPP, LKPD, Asesmen, dan dokumen KBM lainnya di sini.
        Berkas tersimpan di server (maksimal 10 MB per berkas).
      </p>

      {error && <Alert>{UPLOAD_ERRORS[error] ?? error}</Alert>}

      <div class="gt-card p-4 mb-4">
        <h2 class="font-medium mb-3">Unggah Dokumen</h2>
        <form
          method="post"
          action="/app/documents"
          enctype="multipart/form-data"
          class="grid grid-cols-1 sm:grid-cols-2 gap-2"
        >
          <select name="category" required class="gt-input">
            {DOCUMENT_CATEGORIES.map((cat) => (
              <option value={cat}>{cat}</option>
            ))}
          </select>
          <input
            type="text"
            name="title"
            placeholder="Judul dokumen"
            required
            class="gt-input"
          />
          <input
            type="text"
            name="subject"
            placeholder="Mata pelajaran (opsional)"
            class="gt-input"
          />
          <input
            type="text"
            name="grade"
            placeholder="Kelas, mis. 7 / 8 / 9 (opsional)"
            class="gt-input"
          />
          <select name="semester" class="gt-input">
            <option value="">Semester (opsional)</option>
            <option value="Ganjil">Ganjil</option>
            <option value="Genap">Genap</option>
          </select>
          <input
            type="text"
            name="description"
            placeholder="Deskripsi (opsional)"
            class="gt-input sm:col-span-2"
          />
          <input
            type="file"
            name="file"
            required
            class="gt-input sm:col-span-2"
          />
          <button type="submit" class="gt-btn-primary sm:col-span-2 py-2">
            Unggah
          </button>
        </form>
        <p class="gt-muted text-xs mt-2">
          Didukung: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, ODT, ODS, ODP, TXT,
          MD, JPG, PNG, ZIP. Maksimal {MAX_DOCUMENT_SIZE / (1024 * 1024)} MB.
        </p>
      </div>

      <div class="gt-card p-4 mb-4">
        <form method="get" action="/app/documents" class="flex flex-wrap gap-2">
          <select name="category" class="gt-input flex-1 min-w-[140px]">
            <option value="Semua">Semua kategori</option>
            {DOCUMENT_CATEGORIES.map((cat) => (
              <option value={cat} selected={category === cat}>
                {cat}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="q"
            value={q}
            placeholder="Cari judul / mapel / deskripsi"
            class="gt-input flex-1 min-w-[180px]"
          />
          <button type="submit" class="gt-btn-primary px-4">
            Filter
          </button>
          {(category !== "Semua" || q) && (
            <a href="/app/documents" class="gt-btn px-4 py-2">
              Reset
            </a>
          )}
        </form>
      </div>

      <div class="space-y-2">
        {items.map((item) => (
          <div class="gt-card p-3 flex items-center justify-between gap-2">
            <div class="min-w-0 flex-1">
              <p class="font-medium truncate">{item.title}</p>
              <p class="gt-muted text-sm truncate">
                {item.category}
                {item.subject ? ` · ${item.subject}` : ""}
                {item.grade ? ` · Kelas ${item.grade}` : ""}
                {item.semester ? ` · ${item.semester}` : ""}
                {` · ${formatFileSize(item.fileSize)} · ${formatDocumentDate(item.createdAt)}`}
              </p>
              {item.description && (
                <p class="gt-muted text-sm truncate">{item.description}</p>
              )}
              <p class="gt-muted text-xs truncate">{item.fileName}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <a
                href={`/app/documents/${item.id}/download`}
                class="gt-badge-emerald text-xs font-medium px-2 py-1.5 rounded-lg"
              >
                Unduh
              </a>
              <button
                hx-delete={`/app/documents/${item.id}`}
                hx-confirm={`Hapus dokumen "${item.title}"? Berkasnya juga ikut terhapus.`}
                hx-target="closest div.gt-card"
                hx-swap="outerHTML"
                class="gt-link-red text-xs font-medium"
              >
                Hapus
              </button>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <p class="gt-muted text-sm text-center py-8">
            Belum ada dokumen
            {category !== "Semua" ? ` kategori ${category}` : ""}
            {q ? ` yang cocok dengan "${q}"` : ""}. Unggah dokumen pertama
            Anda di atas.
          </p>
        )}
      </div>

      <p class="gt-muted text-xs mt-4">
        Catatan: Backup &amp; Restore JSON mencakup data dokumen (judul,
        kategori, dan metadata), tetapi TIDAK mencakup isi berkasnya. Saat
        pindah server, salin juga folder <code>data/uploads/documents/</code>.
      </p>
    </Layout>,
  );
});

documentsRoutes.post("/app/documents", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();

  const category = String(body.category ?? "") as DocumentCategory;
  const title = String(body.title ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const grade = String(body.grade ?? "").trim();
  const semester = String(body.semester ?? "").trim();
  const description = String(body.description ?? "").trim();
  const file = body.file;

  if (!DOCUMENT_CATEGORIES.includes(category) || !title) {
    return c.redirect("/app/documents?error=invalid");
  }
  if (!(file instanceof File)) {
    return c.redirect("/app/documents?error=no_file");
  }
  const validationError = validateDocumentUpload(file);
  if (validationError) {
    if (validationError.includes("terlalu besar")) {
      return c.redirect("/app/documents?error=too_large");
    }
    if (validationError.includes("belum didukung")) {
      return c.redirect("/app/documents?error=bad_type");
    }
    return c.redirect("/app/documents?error=no_file");
  }

  ensureDocumentUploadDir();
  const storedFileName = makeStoredFileName(file.name);
  const path = documentFilePath(storedFileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  writeFileSync(path, buffer);

  try {
    const created = await createDocument(user.id, {
      category,
      title,
      subject: subject || undefined,
      grade: grade || undefined,
      semester: semester || undefined,
      description: description || undefined,
      fileName: file.name,
      storedFileName,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
    });
    await logForUser(
      user,
      "buat_dokumen",
      `Mengunggah dokumen ${title} (kategori ${category})`,
    );
    void created;
  } catch {
    // Jangan sisakan berkas yatim kalau metadata gagal tersimpan.
    try {
      unlinkSync(path);
    } catch {
      // Abaikan: berkas akan dibersihkan manual bila perlu.
    }
    return c.redirect("/app/documents?error=invalid");
  }

  return c.redirect("/app/documents");
});

documentsRoutes.get("/app/documents/:id/download", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const doc = await getDocumentByUser(user.id, id);
  if (!doc) return c.text("Dokumen tidak ditemukan.", 404);

  let path: string;
  try {
    path = documentFilePath(doc.storedFileName);
  } catch {
    return c.text("Nama berkas tersimpan tidak valid.", 400);
  }
  if (!existsSync(path)) {
    return c.text(
      "Berkas tidak ditemukan di server. Kemungkinan berkas tidak ikut saat restore backup (backup JSON hanya menyimpan metadata dokumen).",
      404,
    );
  }

  const file = Bun.file(path);
  const data = await file.arrayBuffer();
  const safeName = doc.fileName.replace(/["\r\n]/g, "");
  c.header("Content-Type", doc.mimeType);
  c.header(
    "Content-Disposition",
    `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
  );
  return c.body(data);
});

documentsRoutes.delete("/app/documents/:id", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const target = await deleteDocument(user.id, id);
  if (target) {
    try {
      const path = documentFilePath(target.storedFileName);
      if (existsSync(path)) unlinkSync(path);
    } catch {
      // Berkas sudah tidak ada / gagal dihapus: data sudah terhapus, cukup catat aktivitas.
    }
    await logForUser(
      user,
      "hapus_dokumen",
      `Menghapus dokumen ${target.title} (kategori ${target.category})`,
    );
  }
  return c.body(null);
});
