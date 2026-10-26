import { Hono } from "hono";
import type { SessionUser } from "../services/auth.service";
import {
  activityActionLabel,
  formatLogTime,
  listActivityLogsPage,
} from "../services/activity-log.service";
import { Layout } from "../components/Layout";

type AppContext = {
  Variables: { user: SessionUser };
};

export const activityLogRoutes = new Hono<AppContext>();

/** Nomor halaman ringkas: semua nomor bila sedikit, jendela + ellipsis bila banyak. */
function compactPageNumbers(
  page: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) out.push("ellipsis");
    out.push(sorted[i]!);
  }
  return out;
}

/**
 * Halaman Log Aktivitas. Hanya admin yang bisa membukanya: middleware
 * `requireAdmin` untuk `/app/admin/*` di index.ts sudah mengunci rute ini
 * (guru yang membuka URL langsung mendapat 403), jadi handler ini tidak
 * perlu memeriksa peran lagi.
 *
 * Yang dicatat: seluruh aksi guru & admin (login, kelola pengguna/sekolah/
 * kelas/siswa, jadwal, jurnal, absensi, nilai, perangkat, anekdot, ekspor).
 * Yang TIDAK dicatat: aktivitas siswa di portal /siswa, dan pembukaan
 * halaman log ini sendiri (supaya log tidak membanjiri dirinya sendiri).
 * Kata sandi, PIN siswa, dan token tidak pernah masuk ke kolom detail.
 */
activityLogRoutes.get("/app/admin/logs", async (c) => {
  const user = c.get("user");
  const q = c.req.query("q") ?? "";
  const role = c.req.query("role") ?? "";
  const page = Math.max(Math.trunc(Number(c.req.query("page"))) || 1, 1);

  const { logs, pagination } = await listActivityLogsPage(
    { q, role },
    { page, pageSize: 25 },
  );
  const firstRow =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const lastRow = Math.min(pagination.page * pagination.pageSize, pagination.total);
  const pageNumbers = compactPageNumbers(pagination.page, pagination.totalPages);
  const href = (p: number) =>
    `/app/admin/logs?q=${encodeURIComponent(q)}&role=${encodeURIComponent(role)}&page=${p}`;

  return c.html(
    <Layout title="Log Aktivitas" user={user}>
      <div class="mb-4">
        <h1 class="text-xl font-bold tracking-tight">Log Aktivitas</h1>
        <p class="gt-muted text-sm">
          Seluruh aktivitas guru & admin. Waktu mengikuti waktu server.
        </p>
      </div>

      <form method="get" class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          type="search"
          name="q"
          value={q}
          placeholder="Cari nama, aksi, atau detail…"
          aria-label="Cari log"
          class="gt-input sm:col-span-2"
        />
        <select name="role" class="gt-input" onchange="this.form.submit()">
          <option value="" selected={role === ""}>Semua peran</option>
          <option value="admin" selected={role === "admin"}>Admin</option>
          <option value="guru" selected={role === "guru"}>Guru</option>
        </select>
        <button class="gt-btn-primary py-2.5 sm:col-span-3">Cari</button>
      </form>

      {pagination.total > 0 && (
        <p class="gt-muted mb-3 text-sm">
          Menampilkan {firstRow}–{lastRow} dari {pagination.total} log
        </p>
      )}

      <div class="space-y-2">
        {logs.map((log) => (
          <div class="gt-card p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-semibold">{activityActionLabel(log.action)}</p>
                <p class="text-sm text-slate-600 dark:text-slate-300">
                  {log.detail}
                </p>
              </div>
              <span class="gt-badge-slate shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize">
                {log.userRole ?? "-"}
              </span>
            </div>
            <p class="gt-muted mt-2 text-xs">
              {log.userName} · {formatLogTime(log.createdAt)}
            </p>
          </div>
        ))}
        {logs.length === 0 && (
          <div class="gt-card p-6 text-center">
            <p class="font-semibold">Belum ada log yang sesuai</p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Log mulai tercatat setelah fitur ini di-deploy; aktivitas lama
              tidak bisa ditampilkan.
            </p>
          </div>
        )}
      </div>

      {pagination.totalPages > 1 && (
        <nav class="gt-pagination" aria-label="Navigasi halaman log">
          {pagination.page === 1 ? (
            <span class="gt-pagination-link gt-pagination-disabled" aria-disabled="true">
              ‹ Sebelumnya
            </span>
          ) : (
            <a class="gt-pagination-link" href={href(pagination.page - 1)} rel="prev">
              ‹ Sebelumnya
            </a>
          )}
          {pageNumbers.map((item) =>
            item === "ellipsis" ? (
              <span class="gt-pagination-ellipsis" aria-hidden="true">…</span>
            ) : (
              <a
                class={`gt-pagination-link ${item === pagination.page ? "gt-pagination-current" : ""}`}
                href={href(item)}
                aria-current={item === pagination.page ? "page" : undefined}
              >
                {item}
              </a>
            ),
          )}
          {pagination.page === pagination.totalPages ? (
            <span class="gt-pagination-link gt-pagination-disabled" aria-disabled="true">
              Berikutnya ›
            </span>
          ) : (
            <a class="gt-pagination-link" href={href(pagination.page + 1)} rel="next">
              Berikutnya ›
            </a>
          )}
        </nav>
      )}
    </Layout>,
  );
});
