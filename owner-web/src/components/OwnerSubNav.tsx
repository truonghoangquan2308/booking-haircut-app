"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Trang chủ" },
  { href: "/dashboard/stats", label: "Doanh thu & báo cáo" },
  { href: "/dashboard/ops", label: "Quản lý chi nhánh" },
  { href: "/dashboard/barbers", label: "Quản lý thợ" },
  { href: "/dashboard/services", label: "Quản lý dịch vụ" },
  { href: "/dashboard/shop", label: "Quản lý shop" },
  { href: "/dashboard/offers", label: "Quản lý ưu đãi" },
] as const;

export function OwnerSubNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Điều hướng Owner"
      className="border-b border-[rgba(255,255,255,0.08)] bg-[var(--color-navbar-bg)] px-4 py-2.5 text-sm shadow-sm"
    >
      <div className="mx-auto flex max-w-[1920px] flex-wrap gap-2">
        {NAV.map(({ href, label }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-4 py-2 font-semibold transition ${
                active
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-text)] shadow-sm"
                  : "bg-[var(--color-navbar-bg)]/70 text-white hover:bg-[var(--color-navbar-bg)]/90"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
