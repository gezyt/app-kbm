import type { FC } from "hono/jsx";
import type { SessionUser } from "../services/auth.service";
import { Brand, Logo } from "./Brand";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { ThemeInitScript, ThemeToggle } from "./ThemeToggle";

// Naikkan versi ini setiap kali aset CSS berubah agar cache CDN/browser tidak
// menampilkan stylesheet lama setelah deploy.
const STATIC_ASSET_VERSION = "20261026-1";

type LayoutProps = {
  title: string;
  user?: SessionUser;
  activeNav?: string;
  printMode?: boolean;
  children: any;
};

export const Layout: FC<LayoutProps> = ({
  title,
  user,
  activeNav,
  printMode,
  children,
}) => {
  return (
    <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} · GezyTeach</title>
        <ThemeInitScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
        <link rel="stylesheet" href={`/static/style.css?v=${STATIC_ASSET_VERSION}`} />
        <script src="/vendor/htmx.min.js" defer />
      </head>
      <body class={`gt-transition min-h-screen flex flex-col ${printMode ? "print-mode" : ""}`}>
        {printMode ? (
          <main class="flex-1 px-4 py-4 w-full mx-auto">{children}</main>
        ) : user ? (
          <div class="min-h-screen lg:pl-64">
            <Sidebar active={activeNav} user={user} />
            <div class="flex min-h-screen flex-col">
              <header class="gt-topbar sticky top-0 z-10 flex items-center justify-between px-4 py-3 lg:hidden">
                <a href="/app">
                  <Brand subtitle="Ruang kerja guru" />
                </a>
                <div class="flex items-center gap-3">
                  <ThemeToggle />
                  <a
                    href="/app/profile"
                    class="gt-link-muted max-w-[35%] truncate text-sm"
                  >
                    {user.name}
                  </a>
                </div>
              </header>
              <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-10">
                {children}
              </main>
              <footer class="gt-site-footer">
                © 2026 GezyTeach Platform by Pak Gun. All rights reserved.
              </footer>
            </div>
            <Navbar active={activeNav} user={user} />
          </div>
        ) : (
          <>
            <main class="relative flex flex-1 items-center justify-center px-4 py-10">
              <div class="absolute right-4 top-4">
                <ThemeToggle />
              </div>
              <div class="flex w-full flex-col items-center gap-5">
                <Logo size="lg" />
                <div class="flex w-full justify-center">{children}</div>
              </div>
            </main>
            <footer class="gt-site-footer">
              © 2026 GezyTeach Platform by Pak Gun. All rights reserved.
            </footer>
          </>
        )}
      </body>
    </html>
  );
};
