import { count } from "drizzle-orm";
import { db } from "../db";
import {
  activityLogs,
  anecdotalDevelopmentThresholds,
  anecdotalRecordValues,
  anecdotalRecords,
  anecdotalSemesterSummaries,
  assessmentPlans,
  attendance,
  classes,
  documents,
  journals,
  resources,
  schedules,
  schoolProfiles,
  scores,
  sessions,
  studentSessions,
  students,
  users,
  visionValues,
} from "../db/schema";

/**
 * Backup & Restore data GezyTeach — satu berkas JSON, untuk admin saja.
 *
 * Semantiknya sengaja dibuat seperti fitur yang sama di GezyAspro, yang
 * sudah disetujui Pak Gun di sana:
 * - Backup = SELURUH data (semua tabel data, termasuk akun & log aktivitas).
 *   Sesi login TIDAK ikut dibackup: token sesi tidak boleh keluar dari server
 *   lewat berkas unduhan.
 * - Restore = MENGGANTI seluruh data, bukan menggabung. Data lama yang tidak
 *   ada di berkas akan hilang. Karena itu halaman restore memakai konfirmasi
 *   dua langkah (unggah → ringkasan → konfirmasi) dan menyarankan admin
 *   mengunduh backup kondisi saat ini dulu.
 * - Restore berjalan dalam SATU transaksi: gagal di tengah = data lama utuh.
 * - Setelah restore berhasil, SEMUA sesi (guru/admin & siswa) dibersihkan,
 *   jadi semua orang wajib login ulang — dengan akun & kata sandi dari
 *   berkas backup.
 *
 * Catatan keamanan berkas: backup berisi hash kata sandi akun (bukan kata
 * sandi aslinya, tapi tetap sensitif). Halaman backup memperingatkan admin
 * agar menyimpannya di tempat aman dan tidak membagikannya.
 *
 * PENGECUALIAN sejak modul Dokumen (app-kbm): JSON ini mencakup metadata
 * dokumen (judul, kategori, nama berkas), tetapi TIDAK mencakup isi
 * berkasnya. Berkas ada di `data/uploads/documents/` dan harus disalin
 * terpisah saat pindah server, kalau tidak unduhan dokumen hasil restore
 * akan 404.
 */

export const BACKUP_APP = "gezyteach-backup";
export const BACKUP_VERSION = 1;

/** Tabel data yang ikut backup/restore. Sesi sengaja tidak ada di sini. */
const BACKUP_TABLES = [
  { key: "users", table: users },
  { key: "school_profiles", table: schoolProfiles },
  { key: "classes", table: classes },
  { key: "students", table: students },
  { key: "schedules", table: schedules },
  { key: "journals", table: journals },
  { key: "assessment_plans", table: assessmentPlans },
  { key: "scores", table: scores },
  { key: "attendance", table: attendance },
  { key: "resources", table: resources },
  { key: "documents", table: documents },
  { key: "vision_values", table: visionValues },
  { key: "anecdotal_records", table: anecdotalRecords },
  { key: "anecdotal_record_values", table: anecdotalRecordValues },
  { key: "anecdotal_semester_summaries", table: anecdotalSemesterSummaries },
  { key: "anecdotal_development_thresholds", table: anecdotalDevelopmentThresholds },
  { key: "activity_logs", table: activityLogs },
] as const;

type BackupTableKey = (typeof BACKUP_TABLES)[number]["key"];

/**
 * Urutan hapus (anak dulu, induk belakangan) agar foreign key tetap valid
 * tanpa perlu mematikan pengecekan FK.
 */
const DELETE_ORDER: BackupTableKey[] = [
  "anecdotal_record_values",
  "scores",
  "attendance",
  "anecdotal_semester_summaries",
  "journals",
  "anecdotal_records",
  "assessment_plans",
  "schedules",
  "students",
  "resources",
  "documents",
  "activity_logs",
  "classes",
  "vision_values",
  "anecdotal_development_thresholds",
  "school_profiles",
  "users",
];

/** Urutan isi (induk dulu, anak belakangan). */
const INSERT_ORDER: BackupTableKey[] = [
  "users",
  "school_profiles",
  "vision_values",
  "anecdotal_development_thresholds",
  "classes",
  "students",
  "schedules",
  "assessment_plans",
  "journals",
  "anecdotal_records",
  "scores",
  "attendance",
  "resources",
  "documents",
  "anecdotal_record_values",
  "anecdotal_semester_summaries",
  "activity_logs",
];

export type BackupData = {
  app: string;
  version: number;
  exportedAt: number;
  tables: Record<string, Array<Record<string, unknown>>>;
};

export async function exportBackupData(): Promise<BackupData> {
  const tables: Record<string, Array<Record<string, unknown>>> = {};
  for (const { key, table } of BACKUP_TABLES) {
    const rows = await db.select().from(table);
    tables[key] = rows as Array<Record<string, unknown>>;
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: Date.now(), tables };
}

export async function getBackupSummary(): Promise<{
  total: number;
  counts: Record<string, number>;
}> {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const { key, table } of BACKUP_TABLES) {
    const [row] = await db.select({ total: count() }).from(table);
    const n = row?.total ?? 0;
    counts[key] = n;
    total += n;
  }
  return { total, counts };
}

export function backupFileName(exportedAtMs: number): string {
  const d = new Date(exportedAtMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `backup-gezyteach-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

export type ValidateBackupResult =
  | { ok: true; data: BackupData }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validasi berkas backup sebelum ditampilkan ringkasannya. Validasi ini
 * sengaja ketat di penanda & akun (supaya tidak mungkin memulihkan berkas
 * aplikasi lain atau berkas tanpa admin), tapi longgar di tabel lain: tabel
 * yang tidak ada di berkas dianggap kosong, supaya backup dari versi lama
 * yang belum punya tabel baru tetap bisa dipulihkan.
 */
export function validateBackupData(parsed: unknown): ValidateBackupResult {
  if (!isPlainObject(parsed)) {
    return { ok: false, error: "Berkas bukan JSON objek yang valid." };
  }
  if (parsed.app !== BACKUP_APP) {
    return { ok: false, error: "Berkas ini bukan backup GezyTeach." };
  }
  if (parsed.version !== BACKUP_VERSION) {
    return { ok: false, error: "Versi format backup tidak dikenali." };
  }
  if (!isPlainObject(parsed.tables)) {
    return { ok: false, error: "Berkas backup tidak berisi tabel data." };
  }
  const tables = parsed.tables;
  for (const { key } of BACKUP_TABLES) {
    const rows = tables[key];
    if (rows === undefined) continue;
    if (!Array.isArray(rows) || !rows.every(isPlainObject)) {
      return { ok: false, error: `Isi tabel ${key} di berkas tidak valid.` };
    }
  }
  const userRows = tables.users;
  if (!Array.isArray(userRows) || userRows.length === 0) {
    return { ok: false, error: "Backup harus berisi minimal satu akun." };
  }
  const hasAdmin = userRows.some(
    (u) =>
      typeof u.name === "string" &&
      typeof u.email === "string" &&
      typeof u.passwordHash === "string" &&
      u.role === "admin",
  );
  if (!hasAdmin) {
    return {
      ok: false,
      error: "Backup harus berisi minimal satu akun admin yang valid.",
    };
  }
  return {
    ok: true,
    data: {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt:
        typeof parsed.exportedAt === "number" ? parsed.exportedAt : Date.now(),
      tables: tables as Record<string, Array<Record<string, unknown>>>,
    },
  };
}

export type RestoreResult = { ok: true } | { ok: false; error: string };

/**
 * Mengganti seluruh data dengan isi backup dalam satu transaksi, lalu
 * membersihkan semua sesi. ID dipertahankan persis dari berkas.
 *
 * Tentang sqlite_sequence: DELETE tidak menurunkan urutan AUTOINCREMENT, dan
 * INSERT dengan ID eksplisit yang lebih besar otomatis menaikkan urutannya,
 * jadi tidak perlu perbaikan urutan manual setelah restore.
 */
export async function restoreBackupData(data: BackupData): Promise<RestoreResult> {
  const byKey = new Map(BACKUP_TABLES.map(({ key, table }) => [key, table]));
  try {
    await db.transaction(async (tx) => {
      for (const key of DELETE_ORDER) {
        await tx.delete(byKey.get(key)!);
      }
      for (const key of INSERT_ORDER) {
        const rows = data.tables[key] ?? [];
        if (rows.length === 0) continue;
        await tx.insert(byKey.get(key)!).values(rows as never);
      }
      // Sesi ikut dibersihkan di dalam transaksi yang sama.
      await tx.delete(sessions);
      await tx.delete(studentSessions);
    });
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Restore gagal (kemungkinan isi berkas tidak cocok dengan skema). Data lama tidak berubah.",
    };
  }
}

/** Penyimpanan sementara untuk langkah konfirmasi restore (di memori proses). */
const pendingRestores = new Map<
  string,
  { data: BackupData; actorId: number; expiresAt: number }
>();

export function createPendingRestore(
  data: BackupData,
  actorId: number,
): string {
  const token = crypto.randomUUID();
  pendingRestores.set(token, {
    data,
    actorId,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  return token;
}

export function takePendingRestore(
  token: string,
  actorId: number,
): BackupData | null {
  const pending = pendingRestores.get(token);
  if (!pending) return null;
  pendingRestores.delete(token);
  if (pending.actorId !== actorId || pending.expiresAt < Date.now()) {
    return null;
  }
  return pending.data;
}

export function backupTableCounts(
  data: BackupData,
): { total: number; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const { key } of BACKUP_TABLES) {
    const n = data.tables[key]?.length ?? 0;
    counts[key] = n;
    total += n;
  }
  return { total, counts };
}

export const BACKUP_TABLE_LABELS: Record<string, string> = {
  users: "Akun",
  school_profiles: "Profil sekolah",
  classes: "Kelas",
  students: "Siswa",
  schedules: "Jadwal",
  journals: "Jurnal",
  assessment_plans: "Rencana nilai",
  scores: "Nilai",
  attendance: "Absensi",
  resources: "Perangkat",
  documents: "Dokumen",
  vision_values: "Nilai visi",
  anecdotal_records: "Catatan anekdot",
  anecdotal_record_values: "Nilai visi catatan",
  anecdotal_semester_summaries: "Rekap narasi semester",
  anecdotal_development_thresholds: "Ambang perkembangan",
  activity_logs: "Log aktivitas",
};
