import type { FC } from "hono/jsx";
import type { SessionUser } from "../services/auth.service";
import { Icon, NAV_ITEMS } from "./Brand";

/** Navigasi bawah untuk HP. Di desktop digantikan Sidebar. */
export const Navbar: FC<{ active?: string; user: SessionUser }> = ({
  active,
  user,
}) => {
  const items = NAV_ITEMS.filter(
    (item) => item.key !== "students" || user.role === "admin",
  );
  return (
    <nav class="gt-bottomnav fixed bottom-0 inset-x-0 z-20 lg:hidden" hx-boost="true">
      <ul class="flex overflow-x-auto no-scrollbar">
        {items.map((item) => {
          const isActive = active === item.key;
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
                  class={`flex h-7 items-center justify-center rounded-full px-4 transition-colors ${
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
  );
};
