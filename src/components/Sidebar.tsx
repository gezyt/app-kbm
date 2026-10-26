import type { FC } from "hono/jsx";
import type { SessionUser } from "../services/auth.service";
import { Brand, Icon, NAV_ITEMS } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";

/** Sidebar desktop (≥1024px). Mobile tetap memakai navigasi bawah. */
export const Sidebar: FC<{ active?: string; user: SessionUser }> = ({
  active,
  user,
}) => {
  const items = NAV_ITEMS.filter(
    (item) => item.key !== "students" || user.role === "admin",
  );
  return (
    <aside class="gt-sidebar fixed inset-y-0 left-0 z-20 hidden w-64 flex-col lg:flex">
      <div class="px-5 pb-5 pt-6">
        <a href="/app" class="inline-block">
          <Brand subtitle="Ruang kerja guru" />
        </a>
      </div>
      <nav class="flex-1 space-y-1 overflow-y-auto px-3">
        {items.map((item) => {
          const isActive = active === item.key;
          return (
            <a
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              class={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
              }`}
            >
              <Icon name={item.icon} class="h-5 w-5 shrink-0" />
              {item.label}
            </a>
          );
        })}
        <a
          href="/app/profile"
          aria-current={active === "profile" ? "page" : undefined}
          class={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            active === "profile"
              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
          }`}
        >
          <Icon name="user" class="h-5 w-5 shrink-0" />
          Profil
        </a>
      </nav>
      <div class="space-y-3 border-t border-slate-200 p-4 dark:border-white/10">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
            Tema gelap
          </span>
          <ThemeToggle />
        </div>
        <a
          href="/app/profile"
          class="flex items-center gap-3 rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-white/5"
        >
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
            {user.name.trim().charAt(0).toUpperCase() || "G"}
          </span>
          <span class="min-w-0 leading-tight">
            <span class="block truncate text-sm font-semibold text-slate-900 dark:text-white">
              {user.name}
            </span>
            <span class="block text-xs capitalize text-slate-500 dark:text-slate-400">
              {user.role}
            </span>
          </span>
        </a>
        <p class="px-1 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
          © 2026 GezyTeach Platform by Pak Gun.
        </p>
      </div>
    </aside>
  );
};
