import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { Alert } from "../components/Alert";
import { Layout } from "../components/Layout";
import { SESSION_COOKIE } from "../middleware/auth";
import type { SessionUser } from "../services/auth.service";
import { logActivity, logForUser } from "../services/activity-log.service";
import {
  BACKUP_TABLE_LABELS,
  backupFileName,
  backupTableCounts,
  createPendingRestore,
  exportBackupData,
  getBackupSummary,
  restoreBackupData,
  takePendingRestore,
  validateBackupData,
  type BackupData,
} from "../services/backup.service";

type AppContext = {
  Variables: { user: SessionUser };
};

export const backupRoutes = new Hono<AppContext>();

function formatBackupTime(ms: number): string {
  return new Date(ms).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ERROR_MESSAGES: Record<string, string> = {
  no_file: "Pilih dulu berkas backup (.json) yang akan dipulihkan.",
  invalid_file: "Berkas tidak bisa dibaca sebagai JSON.",
  invalid_backup: "Berkas bukan backup GezyTeach yang valid.",
  confirm_required: "Centang dulu pernyataan persetujuan sebelum restore.",
  expired: "Konfirmasi restore sudah kedaluwarsa (lebih dari 10 menit) atau bukan dari akun Anda. Unggah ulang berkasnya.",
  restore_failed:
    "Restore gagal (kemungkinan isi berkas tidak cocok dengan skema). Data lama tidak berubah.",
};

function BackupPage({
  user,
  summary,
  error,
}: {
  user: SessionUser;
  summary: { total: number; counts: Record<string, number> };
  error?: string;
}) {
  return (
    <Layout title="Backup & Restore" user={user}>
      <div class="mb-4">
        <h1 class="text-xl font-bold tracking-tight">Backup & Restore</h1>
        <p class="gt-muted text-sm">
          Satu berkas JSON untuk seluruh data GezyTeach. Hanya admin yang bisa
          mengunduh & memulihkan.
        </p>
      </div>

      {error && <Alert>{ERROR_MESSAGES[error] ?? error}</Alert>}

      <div class="gt-card mb-4 p-4">
        <h2 class="font-semibold">💾 Unduh Backup</h2>
        <p class="gt-muted mt-1 text-sm">
          Berisi {summary.total} baris data: {summary.counts.users ?? 0} akun,{" "}
          {summary.counts.classes ?? 0} kelas, {summary.counts.students ?? 0}{" "}
          siswa, {summary.counts.schedules ?? 0} jadwal,{" "}
          {summary.counts.journals ?? 0} jurnal, {summary.counts.scores ?? 0}{" "}
          nilai, {summary.counts.attendance ?? 0} absensi, dan sisanya.
        </p>
        <p class="gt-muted mt-2 text-sm">
          ⚠️ Berkas backup berisi hash kata sandi akun. Simpan di tempat aman
          dan jangan dibagikan ke sembarang orang. Sesi login tidak ikut
          dibackup.
        </p>
        <a
          href="/app/admin/backup/download"
          class="gt-btn-primary mt-3 inline-block px-4 py-2.5"
        >
          Unduh Backup (.json)
        </a>
      </div>

      <form
        method="post"
        action="/app/admin/restore"
        enctype="multipart/form-data"
        class="gt-card p-4"
      >
        <h2 class="font-semibold">♻️ Pulihkan dari Backup</h2>
        <div class="gt-badge-red mt-3 rounded-lg px-3 py-2 text-sm">
          <b>Restore mengganti SELURUH data</b> — bukan menggabung. Data yang
          tidak ada di berkas akan hilang dan tidak bisa dibatalkan, kecuali
          dengan memulihkan backup lain. Setelah restore berhasil, semua akun
          wajib login ulang dengan akun & kata sandi dari berkas backup.
        </div>
        <p class="gt-muted mt-2 text-sm">
          Disarankan: unduh dulu backup kondisi saat ini sebelum restore,
          supaya kondisi sekarang tetap bisa dikembalikan.
        </p>
        <label class="mt-3 block">
          <span class="gt-label">Berkas backup (.json)</span>
          <input
            type="file"
            name="file"
            accept=".json,application/json"
            required
            class="gt-input"
          />
        </label>
        <label class="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirm" value="1" required class="mt-1" />
          <span>
            Saya paham restore akan mengganti seluruh data dan tidak bisa
            dibatalkan.
          </span>
        </label>
        <button class="gt-btn-primary mt-3 w-full py-2.5">
          Lanjut ke Ringkasan & Konfirmasi
        </button>
      </form>
    </Layout>
  );
}

function ConfirmPage({
  user,
  token,
  data,
}: {
  user: SessionUser;
  token: string;
  data: BackupData;
}) {
  const { total, counts } = backupTableCounts(data);
  return (
    <Layout title="Konfirmasi Restore" user={user}>
      <div class="mb-4">
        <h1 class="text-xl font-bold tracking-tight">Konfirmasi Restore</h1>
        <p class="gt-muted text-sm">
          Periksa dulu isi berkasnya. Langkah ini masih bisa dibatalkan —
          data belum berubah apa pun.
        </p>
      </div>
      <div class="gt-card mb-4 p-4">
        <p class="text-sm">
          <span class="gt-muted">Diekspor pada: </span>
          <b>{formatBackupTime(data.exportedAt)}</b>
        </p>
        <p class="mt-1 text-sm">
          <span class="gt-muted">Total: </span>
          <b>{total} baris</b>
        </p>
        <div class="mt-3 space-y-1 text-sm">
          {Object.entries(counts)
            .filter(([, n]) => n > 0)
            .map(([key, n]) => (
              <p class="flex justify-between gap-3">
                <span>{BACKUP_TABLE_LABELS[key] ?? key}</span>
                <b>{n}</b>
              </p>
            ))}
        </div>
      </div>
      <form method="post" action="/app/admin/restore/confirm" class="gt-card p-4">
        <input type="hidden" name="token" value={token} />
        <div class="gt-badge-red rounded-lg px-3 py-2 text-sm">
          Setelah tombol di bawah ditekan, <b>seluruh data saat ini diganti</b>{" "}
          dengan isi berkas di atas dan <b>Anda langsung logout</b>.
        </div>
        <label class="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirm" value="1" required class="mt-1" />
          <span>
            Saya sudah mengunduh backup kondisi saat ini dan yakin memulihkan
            backup ini.
          </span>
        </label>
        <button class="gt-btn-primary mt-3 w-full py-2.5">
          Ya, Pulihkan Sekarang
        </button>
        <a href="/app/admin/backup" class="gt-btn-secondary mt-2 block py-2.5 text-center">
          Batalkan
        </a>
      </form>
    </Layout>
  );
}

backupRoutes.get("/app/admin/backup", async (c) => {
  const summary = await getBackupSummary();
  return c.html(
    <BackupPage
      user={c.get("user")}
      summary={summary}
      error={c.req.query("error")}
    />,
  );
});

backupRoutes.get("/app/admin/backup/download", async (c) => {
  const user = c.get("user");
  const data = await exportBackupData();
  const { total } = backupTableCounts(data);
  await logForUser(
    user,
    "backup_data",
    `Mengunduh backup data (${total} baris, diekspor ${formatBackupTime(data.exportedAt)})`,
  );
  c.header("Content-Type", "application/json; charset=utf-8");
  c.header(
    "Content-Disposition",
    `attachment; filename="${backupFileName(data.exportedAt)}"`,
  );
  return c.body(JSON.stringify(data, null, 2));
});

/** Langkah 1 restore: unggah berkas, validasi, tampilkan ringkasan. */
backupRoutes.post("/app/admin/restore", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const summary = await getBackupSummary();
  const renderError = (error: string) =>
    c.html(<BackupPage user={user} summary={summary} error={error} />, 400);

  if (body.confirm !== "1") return renderError("confirm_required");
  const file = body.file;
  if (!(file instanceof File)) return renderError("no_file");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return renderError("invalid_file");
  }
  const validated = validateBackupData(parsed);
  if (!validated.ok) return renderError(validated.error);
  const token = createPendingRestore(validated.data, user.id);
  return c.html(
    <ConfirmPage user={user} token={token} data={validated.data} />,
  );
});

/** Langkah 2 restore: konfirmasi final, ganti data, bersihkan sesi. */
backupRoutes.post("/app/admin/restore/confirm", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const summary = await getBackupSummary();
  const renderError = (error: string) =>
    c.html(<BackupPage user={user} summary={summary} error={error} />, 400);

  if (body.confirm !== "1") return renderError("confirm_required");
  const token = String(body.token ?? "");
  const data = takePendingRestore(token, user.id);
  if (!data) return renderError("expired");

  const result = await restoreBackupData(data);
  if (!result.ok) return renderError("restore_failed");

  // Log dicatat SETELAH restore (tabel log sudah diganti isi backup), dengan
  // userId kosong supaya tidak menunjuk ke akun yang mungkin sudah tidak ada.
  await logActivity({
    userId: null,
    userName: user.name,
    userRole: "admin",
    action: "restore_data",
    detail: `Memulihkan data dari backup (diekspor ${formatBackupTime(data.exportedAt)})`,
  });

  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.redirect("/login?restored=1");
});
