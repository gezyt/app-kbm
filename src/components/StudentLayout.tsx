import type { FC } from "hono/jsx";
import type { SessionStudent } from "../services/student-auth.service";
import { Brand, Icon } from "./Brand";
import { ThemeInitScript, ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  { key: "dashboard", label: "Beranda", href: "/siswa", icon: "home" },
  { key: "attendance", label: "Absensi", href: "/siswa/absensi", icon: "check" },
  { key: "scores", label: "Nilai", href: "/siswa/nilai", icon: "chart" },
  { key: "profile", label: "Profil", href: "/siswa/profil", icon: "user" },
] as const;

type StudentLayoutProps = {
  title: string;
  student: SessionStudent;
  activeNav?: string;
  children: any;
};

export const StudentLayout: FC<StudentLayoutProps> = ({
  title,
  student,
  activeNav,
  children,
}) => {
  return (
    <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} · GezyTeach Siswa</title>
        <ThemeInitScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
        <link rel="stylesheet" href="/static/style.css?v=20261026-1" />
        <script src="/vendor/htmx.min.js" defer />
      </head>
      <body class="gt-transition min-h-screen flex flex-col">
        <header class="gt-topbar sticky top-0 z-10 flex items-center justify-between px-4 py-3">
          <Brand subtitle="Portal siswa" />
          <div class="flex items-center gap-3">
            <ThemeToggle />
            <span class="gt-muted max-w-[35%] truncate text-sm">
              {student.name}
            </span>
          </div>
        </header>
        <main class="mx-auto w-full max-w-3xl flex-1 px-4 py-4 pb-24">
          {children}
        </main>
        <nav class="gt-bottomnav fixed bottom-0 inset-x-0 z-20">
          <ul class="flex overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map((item) => {
              const isActive = activeNav === item.key;
              return (
                <li class="flex-1 min-w-16">
                  <a
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    class={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                      isActive
                        ? "text-indigo-600 dark:text-indigo-300"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <span
                      class={`flex h-7 items-center justify-center rounded-full px-4 ${
                        isActive
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"
                          : ""
                      }`}
                    >
                      <Icon name={item.icon} class="h-5 w-5" />
                    </span>
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </body>
    </html>
  );
};
