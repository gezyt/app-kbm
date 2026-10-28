import { and, desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { db } from "../db";
import { documents } from "../db/schema";

export const DOCUMENT_CATEGORIES = [
  "CP",
  "ATP",
  "RPP",
  "LKPD",
  "Asesmen",
  "Lainnya",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Batas unggah v1: 10 MB per berkas. Cukup untuk PDF/DOCX guru, masih aman di HP. */
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
  "txt",
  "md",
  "jpg",
  "jpeg",
  "png",
  "zip",
] as const;

/** Folder berkas. Di dalam `data/` (sudah di-.gitignore), jadi tidak ikut commit. */
export const DOCUMENT_UPLOAD_DIR = join(
  process.cwd(),
  "data",
  "uploads",
  "documents",
);

export function ensureDocumentUploadDir(): void {
  mkdirSync(DOCUMENT_UPLOAD_DIR, { recursive: true });
}

export function documentFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
}

export function validateDocumentUpload(file: File): string | null {
  if (!file || file.size === 0) return "Pilih berkas dulu.";
  if (file.size > MAX_DOCUMENT_SIZE) {
    return "Berkas terlalu besar. Maksimal 10 MB per berkas.";
  }
  const ext = documentFileExtension(file.name);
  if (
    !(ALLOWED_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)
  ) {
    return `Jenis berkas .${ext || "?"} belum didukung. Gunakan PDF, DOCX, XLSX, PPT, gambar, atau ZIP.`;
  }
  return null;
}

/** Nama simpan yang aman: tidak pernah memakai nama asli mentah-mentah. */
export function makeStoredFileName(originalName: string): string {
  const safe = basename(originalName)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 80);
  const ext = documentFileExtension(originalName);
  const base = safe.replace(/\.[^.]*$/, "") || "dokumen";
  return `${Date.now()}-${randomBytes(6).toString("hex")}-${base}.${ext}`;
}

/**
 * Path absolut berkas di server. Menolak nama yang mengandung pemisah
 * direktori, supaya tidak ada yang bisa keluar dari folder unggahan
 * (path traversal) lewat nilai `stored_file_name` di database.
 */
export function documentFilePath(storedFileName: string): string {
  if (
    !storedFileName ||
    storedFileName !== basename(storedFileName) ||
    storedFileName.includes("..")
  ) {
    throw new Error("Nama berkas tersimpan tidak valid.");
  }
  return join(DOCUMENT_UPLOAD_DIR, storedFileName);
}

export type DocumentFilters = {
  category?: string;
  q?: string;
};

export async function listDocumentsByUser(
  userId: number,
  filters: DocumentFilters = {},
) {
  const rows = await db.query.documents.findMany({
    where: (d, { eq: eqFn }) => eqFn(d.userId, userId),
    orderBy: (d, { desc: descFn }) => [descFn(d.createdAt), descFn(d.id)],
  });
  const q = (filters.q ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    if (
      filters.category &&
      filters.category !== "Semua" &&
      row.category !== filters.category
    ) {
      return false;
    }
    if (q) {
      const hay = `${row.title} ${row.subject ?? ""} ${row.description ?? ""} ${row.fileName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export async function getDocumentByUser(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createDocument(
  userId: number,
  data: {
    category: DocumentCategory;
    title: string;
    subject?: string;
    grade?: string;
    semester?: string;
    description?: string;
    fileName: string;
    storedFileName: string;
    fileSize: number;
    mimeType: string;
  },
) {
  const [created] = await db
    .insert(documents)
    .values({
      userId,
      category: data.category,
      title: data.title,
      subject: data.subject || null,
      grade: data.grade || null,
      semester: data.semester || null,
      description: data.description || null,
      fileName: data.fileName,
      storedFileName: data.storedFileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
    })
    .returning();
  return created;
}

export async function deleteDocument(userId: number, id: number) {
  const target = await getDocumentByUser(userId, id);
  if (!target) return null;
  await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)));
  return target;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDocumentDate(ms: number): string {
  return new Date(ms).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
