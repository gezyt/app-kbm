import { and, count, desc, eq, like, or } from "drizzle-orm";
import { db } from "../db";
import { activityLogs } from "../db/schema";
import type { SessionUser } from "./auth.service";

/**
 * Pencatatan aktivitas guru & admin untuk halaman /app/admin/logs.
 *
 * Prinsip keamanan:
 * - Anti-gagal: `logActivity` menelan error-nya sendiri. Kegagalan mencatat
 *   TIDAK BOLEH menggagalkan aksi utama (login, simpan nilai, hapus, dll).
 * - Tanpa rahasia: jangan pernah memasukkan kata sandi, PIN siswa, token,
 *   atau isi kredensial apa pun ke `detail`. Penyebutan "reset password"
 *   atau "aktivasi login" saja sudah cukup; nilainya tidak dicatat.
 * - Snapshot aktor: nama & peran disalin saat kejadian, jadi log tetap
 *   bermakna meski akunnya diubah/dihapus belakangan.
 */

export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  login: "Masuk",
  login_gagal: "Gagal masuk",
  logout: "Keluar",
  buat_user: "Tambah pengguna",
  ubah_user: "Ubah pengguna",
  reset_password_user: "Reset password pengguna",
  hapus_user: "Hapus pengguna",
  ubah_profil_sekolah: "Ubah profil sekolah",
  buat_kelas: "Tambah kelas",
  hapus_kelas: "Hapus kelas",
  buat_siswa: "Tambah siswa",
  hapus_siswa: "Hapus siswa",
  hapus_siswa_massal: "Hapus siswa (massal)",
  impor_siswa_csv: "Impor siswa (CSV)",
  aktivasi_login_siswa: "Aktivasi login siswa",
  nonaktifkan_login_siswa: "Nonaktifkan login siswa",
  aktivasi_login_siswa_massal: "Aktivasi login siswa (massal)",
  ekspor_login_siswa_csv: "Ekspor login siswa (CSV)",
  buat_jadwal: "Tambah jadwal",
  hapus_jadwal: "Hapus jadwal",
  buat_jurnal: "Buat jurnal",
  simpan_jurnal: "Simpan jurnal",
  simpan_absensi: "Simpan absensi",
  hapus_absensi: "Hapus absensi",
  buat_rencana_nilai: "Tambah rencana nilai",
  hapus_rencana_nilai: "Hapus rencana nilai",
  simpan_nilai: "Simpan nilai",
  buat_perangkat: "Tambah perangkat",
  hapus_perangkat: "Hapus perangkat",
  ubah_password_sendiri: "Ubah password sendiri",
  buat_catatan_anekdot: "Tambah catatan anekdot",
  ubah_catatan_anekdot: "Ubah catatan anekdot",
  hapus_catatan_anekdot: "Hapus catatan anekdot",
  simpan_narasi_anekdot: "Simpan narasi anekdot",
  ekspor_rekap_absensi_csv: "Ekspor rekap absensi (CSV)",
};

export function activityActionLabel(action: string): string {
  return ACTIVITY_ACTION_LABELS[action] ?? action;
}

export async function logActivity(input: {
  userId?: number | null;
  userName: string;
  userRole?: string | null;
  action: string;
  detail: string;
}): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      userId: input.userId ?? null,
      userName: input.userName,
      userRole: input.userRole ?? null,
      action: input.action,
      detail: input.detail,
    });
  } catch {
    // Sengaja ditelan: log tidak boleh menggagalkan aksi utama.
  }
}

export async function logForUser(
  user: SessionUser,
  action: string,
  detail: string,
): Promise<void> {
  await logActivity({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action,
    detail,
  });
}

export type ActivityLogFilters = {
  q?: string;
  role?: string;
};

export type ActivityLogPagination = {
  page: number;
  pageSize: number;
};

function sanitizeSearch(q: string): string {
  // LIKE mengartikan % dan _ sebagai wildcard; buang keduanya supaya
  // pencarian benar-benar mencari teks yang diketik pengguna.
  return q.replace(/[%_]/g, "");
}

export async function listActivityLogsPage(
  filters: ActivityLogFilters,
  pagination: ActivityLogPagination,
) {
  const pageSize = Math.min(Math.max(Math.trunc(pagination.pageSize) || 25, 1), 100);
  const requestedPage = Math.max(Math.trunc(pagination.page) || 1, 1);
  const conditions = [];
  const q = sanitizeSearch(filters.q?.trim() ?? "");
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        like(activityLogs.userName, pattern),
        like(activityLogs.action, pattern),
        like(activityLogs.detail, pattern),
      ),
    );
  }
  if (filters.role === "admin" || filters.role === "guru") {
    conditions.push(eq(activityLogs.userRole, filters.role));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ total: count() })
    .from(activityLogs)
    .where(where);
  const total = totalRow?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const page = Math.min(requestedPage, Math.max(totalPages, 1));
  const logs = await db.query.activityLogs.findMany({
    where,
    orderBy: (l, { desc: descFn }) => [descFn(l.createdAt), descFn(l.id)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return { logs, pagination: { page, pageSize, total, totalPages } };
}

export function formatLogTime(createdAtMs: number): string {
  return new Date(createdAtMs).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
