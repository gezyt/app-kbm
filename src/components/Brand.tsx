import type { FC } from "hono/jsx";

/**
 * Identitas baru GezyTeach (redesain 2026-10-26).
 *
 * Prinsip: ramah dan mudah dibaca di HP guru, bukan kaca/glow.
 * Warna utama indigo, aksen violet + amber, tipografi Plus Jakarta Sans.
 * Ikon SVG garis (bukan emoji) supaya konsisten di semua halaman.
 * Tidak ada perubahan rute, API, atau skema database di sini.
 */

export const NAV_ITEMS = [
  { key: "dashboard", label: "Beranda", href: "/app", icon: "home" },
  { key: "schedule", label: "Jadwal", href: "/app/schedule", icon: "calendar" },
  { key: "journal", label: "Jurnal", href: "/app/journal", icon: "journal" },
  { key: "attendance", label: "Absensi", href: "/app/attendance", icon: "check" },
  { key: "students", label: "Siswa", href: "/app/students", icon: "students" },
  { key: "scores", label: "Nilai", href: "/app/scores", icon: "chart" },
  { key: "resources", label: "Perangkat", href: "/app/resources", icon: "folder" },
  { key: "documents", label: "Dokumen", href: "/app/documents", icon: "book" },
] as const;

export type IconName =
  | "home"
  | "calendar"
  | "journal"
  | "check"
  | "students"
  | "chart"
  | "folder"
  | "user"
  | "clock"
  | "book"
  | "arrow";

const PATHS: Record<IconName, string> = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9.5 20v-5.5h5V20",
  calendar:
    "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19zM4 10h16M8.5 3.5v3M15.5 3.5v3",
  journal:
    "M6 3.5h8.5L20 9v11.5A1.5 1.5 0 0 1 18.5 22h-12A1.5 1.5 0 0 1 5 20.5v-16A1.5 1.5 0 0 1 6 3.5zM14.5 3.5V9H20M9 14h7M9 17.5h5",
  check: "M4 12.5 9.5 18 20 6.5",
  students:
    "M9 8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 4.7a3 3 0 0 1 0 5.6M17.5 15.3c2 .6 3.4 2.2 4 4.7",
  chart: "M4 20V11M10 20V4M16 20v-7M21 20H3",
  folder:
    "M3 7a2 2 0 0 1 2-2h4l2.5 2.5H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  user: "M12 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM4.5 20.5c1-3.5 3.8-5.5 7.5-5.5s6.5 2 7.5 5.5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2",
  book:
    "M12 6.5C10 5 7 4.5 4 4.5v15c3 0 6 .5 8 2 2-1.5 5-2 8-2v-15c-3 0-6 .5-8 2zM12 6.5v15",
  arrow: "M4.5 12h15M13.5 6l6 6-6 6",
};

export const Icon: FC<{ name: IconName; class?: string }> = ({
  name,
  class: className,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className ?? "h-5 w-5"}
    aria-hidden="true"
  >
    <path d={PATHS[name]} />
  </svg>
);

/** Mark logo: buku terbuka di atas ubin gradasi indigo → violet. */
export const Logo: FC<{ size?: "md" | "lg" }> = ({ size = "md" }) => (
  <span
    class={`gt-logo ${size === "lg" ? "gt-logo-lg" : ""}`}
    aria-hidden="true"
  >
    <Icon name="book" class="h-5 w-5" />
  </span>
);

export const Brand: FC<{ subtitle?: string }> = ({ subtitle }) => (
  <span class="flex items-center gap-2.5">
    <Logo />
    <span class="leading-none">
      <span class="block text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
        GezyTeach
      </span>
      {subtitle ? (
        <span class="mt-0.5 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {subtitle}
        </span>
      ) : null}
    </span>
  </span>
);
