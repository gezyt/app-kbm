import { Hono } from "hono";
import type { SessionUser } from "../services/auth.service";
import { listClassesWithStudentCount } from "../services/class.service";
import {
  listJournalsByDate,
  normalizeJournalSubject,
} from "../services/journal.service";
import {
  listSchedulesByUser,
  listSchedulesByUserAndDay,
} from "../services/schedule.service";
import { DAY_NAMES, todayIso } from "../utils/dates";
import { Icon, type IconName } from "../components/Brand";
import { Layout } from "../components/Layout";

type AppContext = {
  Variables: { user: SessionUser };
};

export const dashboardRoutes = new Hono<AppContext>();

function greetingFor(hour: number): string {
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 19) return "Selamat sore";
  return "Selamat malam";
}

const QUICK_ACTIONS: Array<{
  href: string;
  label: string;
  desc: string;
  icon: IconName;
  tone: string;
  adminOnly?: boolean;
}> = [
  { href: "/app/schedule", label: "Jadwal", desc: "Atur jam mengajar", icon: "calendar", tone: "gt-icon-indigo" },
  { href: "/app/journal", label: "Jurnal", desc: "Tulis & lengkapi", icon: "journal", tone: "gt-icon-violet" },
  { href: "/app/attendance", label: "Absensi", desc: "Catat kehadiran", icon: "check", tone: "gt-icon-emerald" },
  { href: "/app/scores", label: "Nilai", desc: "Input & rekap", icon: "chart", tone: "gt-icon-amber" },
  { href: "/app/students", label: "Data Siswa", desc: "Kelola per kelas", icon: "students", tone: "gt-icon-sky", adminOnly: true },
  { href: "/app/resources", label: "Perangkat", desc: "Tautan Drive KBM", icon: "folder", tone: "gt-icon-rose" },
];

dashboardRoutes.get("/app", async (c) => {
  const user = c.get("user");
  const now = new Date();
  const today = todayIso();
  const todayLabel = `${DAY_NAMES[now.getDay()]}, ${now.toLocaleDateString(
    "id-ID",
    { day: "numeric", month: "long", year: "numeric" },
  )}`;
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;

  // Hanya baca data yang sudah ada: tidak ada tabel, rute, atau API baru.
  const [classes, schedulesToday, schedulesWeek, journalsToday] =
    await Promise.all([
      listClassesWithStudentCount(),
      listSchedulesByUserAndDay(user.id, now.getDay()),
      listSchedulesByUser(user.id),
      listJournalsByDate(user.id, today),
    ]);

  const totalStudents = classes.reduce((sum, k) => sum + k.studentCount, 0);

  // Kelompokkan jadwal hari ini per kelas+mapel, seperti halaman Jurnal:
  // satu jurnal melayani beberapa jam pada kelas+mapel yang sama.
  const journalByAssignment = new Map(
    journalsToday.map((j) => [`${j.classId}:${j.subjectKey}`, j]),
  );
  type TodayGroup = {
    schedule: (typeof schedulesToday)[number];
    times: string[];
    journal?: (typeof journalsToday)[number];
  };
  const groups = new Map<string, TodayGroup>();
  for (const s of schedulesToday) {
    const key = `${s.classId}:${normalizeJournalSubject(s.subject)}`;
    const group = groups.get(key);
    if (group) group.times.push(`${s.startTime}–${s.endTime}`);
    else
      groups.set(key, {
        schedule: s,
        times: [`${s.startTime}–${s.endTime}`],
        journal: journalByAssignment.get(key),
      });
  }
  const todayGroups = [...groups.values()];
  const journalsDone = todayGroups.filter(
    (g) => g.journal?.status === "completed",
  ).length;
  const journalProgress =
    todayGroups.length > 0
      ? Math.round((journalsDone / todayGroups.length) * 100)
      : 0;

  const sortedToday = [...schedulesToday].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );
  const nextSession = sortedToday.find((s) => s.endTime > nowTime);
  const allDoneToday =
    schedulesToday.length > 0 && !nextSession;

  const firstName = user.name.trim().split(/\s+/)[0] || user.name;

  return c.html(
    <Layout title="Beranda" user={user} activeNav="dashboard">
      {/* Hero: sapaan + sesi berikutnya, bukan sekadar angka. */}
      <section class="gt-hero mb-6 overflow-hidden p-5 sm:p-7">
        <div class="relative">
          <p class="text-sm font-medium text-indigo-100">{todayLabel}</p>
          <h1 class="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {greetingFor(now.getHours())}, {firstName}.
          </h1>
          <p class="mt-2 max-w-xl text-sm leading-relaxed text-indigo-100">
            {schedulesToday.length === 0
              ? "Hari ini tidak ada jadwal mengajar. Waktu yang pas untuk menyiapkan perangkat atau melengkapi jurnal kemarin."
              : allDoneToday
                ? "Semua sesi hari ini sudah lewat. Tinggal melengkapi jurnal bila ada yang masih draf."
                : nextSession
                  ? `Sesi berikutnya: ${nextSession.subject} · ${nextSession.class.name}, pukul ${nextSession.startTime}–${nextSession.endTime}.`
                  : "Jadwal hari ini sudah siap."}
          </p>
          <div class="mt-5 flex flex-wrap gap-2">
            <a
              href="/app/journal"
              class="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm"
            >
              <Icon name="journal" class="h-4 w-4" />
              Buka jurnal hari ini
            </a>
            <a
              href="/app/attendance"
              class="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30"
            >
              <Icon name="check" class="h-4 w-4" />
              Isi absensi
            </a>
          </div>
        </div>
      </section>

      {/* Statistik ringkas. */}
      <section class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { value: String(classes.length), label: "Kelas", sub: "di sekolah" },
          { value: String(totalStudents), label: "Siswa", sub: "total terdaftar" },
          { value: String(todayGroups.length), label: "Sesi hari ini", sub: `${schedulesWeek.length} sesi seminggu` },
          { value: `${journalsDone}/${todayGroups.length}`, label: "Jurnal selesai", sub: "hari ini" },
        ].map((stat) => (
          <div class="gt-card p-4">
            <p class="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {stat.value}
            </p>
            <p class="mt-0.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {stat.label}
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400">{stat.sub}</p>
          </div>
        ))}
      </section>

      <div class="grid gap-6 lg:grid-cols-5">
        {/* Linimasa hari ini. */}
        <section class="lg:col-span-3">
          <div class="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 class="text-lg font-bold tracking-tight">Jadwal hari ini</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                {todayGroups.length === 0
                  ? "Belum ada sesi."
                  : `${todayGroups.length} sesi · ${journalsDone} jurnal selesai`}
              </p>
            </div>
            <a href="/app/schedule" class="gt-link-indigo shrink-0 text-sm font-semibold">
              Semua jadwal →
            </a>
          </div>

          {todayGroups.length > 0 && (
            <div class="gt-card mb-3 p-4">
              <div class="mb-1 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Progres jurnal hari ini</span>
                <span>{journalProgress}%</span>
              </div>
              <div class="gt-progress">
                <div class="gt-progress-bar" style={`width: ${journalProgress}%`} />
              </div>
            </div>
          )}

          <div class="space-y-3">
            {todayGroups.map(({ schedule: s, times, journal }) => {
              const status = !journal
                ? { text: "Belum dibuat", cls: "gt-badge-slate" }
                : journal.status === "completed"
                  ? { text: "Selesai", cls: "gt-badge-emerald" }
                  : { text: "Draf", cls: "gt-badge-amber" };
              const href = journal
                ? `/app/journal/${journal.id}`
                : "/app/journal";
              return (
                <a href={href} class="gt-card gt-card-hover block p-4">
                  <div class="flex items-start gap-3">
                    <span class="gt-time-badge shrink-0">
                      {times[0]?.split("–")[0] ?? s.startTime}
                    </span>
                    <div class="min-w-0 flex-1">
                      <p class="truncate font-semibold">{s.subject}</p>
                      <p class="truncate text-sm text-slate-500 dark:text-slate-400">
                        {s.class.name}
                        {s.room ? ` · Ruang ${s.room}` : ""} · {times.join(", ")}
                      </p>
                    </div>
                    <span class={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.cls}`}>
                      {status.text}
                    </span>
                  </div>
                </a>
              );
            })}
            {todayGroups.length === 0 && (
              <div class="gt-card p-6 text-center">
                <p class="font-semibold">Tidak ada jadwal hari ini</p>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Tambahkan jadwal dulu, atau manfaatkan hari ini untuk
                  menyiapkan perangkat mengajar.
                </p>
                <a
                  href="/app/schedule"
                  class="gt-btn-primary mt-4 inline-block px-4 py-2 text-sm"
                >
                  Atur jadwal
                </a>
              </div>
            )}
          </div>
        </section>

        {/* Aksi cepat + kelas. */}
        <section class="lg:col-span-2">
          <h2 class="mb-3 text-lg font-bold tracking-tight">Aksi cepat</h2>
          <div class="mb-6 grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.filter(
              (a) => !a.adminOnly || user.role === "admin",
            ).map((a) => (
              <a href={a.href} class="gt-card gt-card-hover p-4">
                <span class={`gt-icon-badge ${a.tone}`}>
                  <Icon name={a.icon} class="h-5 w-5" />
                </span>
                <p class="mt-3 text-sm font-semibold">{a.label}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{a.desc}</p>
              </a>
            ))}
          </div>

          <div class="mb-3 flex items-end justify-between gap-3">
            <h2 class="text-lg font-bold tracking-tight">Kelas</h2>
            {user.role === "admin" && (
              <a href="/app/students" class="gt-link-indigo shrink-0 text-sm font-semibold">
                Kelola siswa →
              </a>
            )}
          </div>
          <div class="space-y-3">
            {classes.map((k) => (
              user.role === "admin" ? (
                <a href={`/app/students/${k.id}`} class="gt-card gt-card-hover block p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate font-semibold">{k.name}</p>
                      <p class="text-sm text-slate-500 dark:text-slate-400">
                        {[k.level, k.academicYear].filter(Boolean).join(" · ") || "Tanpa keterangan"}
                      </p>
                    </div>
                    <span class="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
                      {k.studentCount} siswa
                    </span>
                  </div>
                </a>
              ) : (
                <div class="gt-card p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate font-semibold">{k.name}</p>
                      <p class="text-sm text-slate-500 dark:text-slate-400">
                        {[k.level, k.academicYear].filter(Boolean).join(" · ") || "Tanpa keterangan"}
                      </p>
                    </div>
                    <span class="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
                      {k.studentCount} siswa
                    </span>
                  </div>
                </div>
              )
            ))}
            {classes.length === 0 && (
              <p class="gt-card p-4 text-sm text-slate-500 dark:text-slate-400">
                Belum ada kelas. Kelas dibuat dari menu Data Siswa (admin).
              </p>
            )}
          </div>
        </section>
      </div>

      <p class="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
        Semua data dan menu tetap sama — yang berubah hanya tampilan.
      </p>
    </Layout>,
  );
});
