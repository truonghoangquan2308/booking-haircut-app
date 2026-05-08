"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ManagerDashboardNav() {
  const pathname = usePathname() ?? "";
  const items = [
    { href: "/dashboard", label: "Vận hành chi nhánh" },
    { href: "/dashboard/stats", label: "Doanh thu & báo cáo" },
  ] as const;

  return (
    <nav className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Menu dashboard">
      {items.map(({ href, label }) => {
        const active =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-full px-3 py-1.5 font-semibold transition ${
              active
                ? "bg-white text-[var(--color-navbar-bg)]"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
