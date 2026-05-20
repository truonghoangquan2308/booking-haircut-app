"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { NavbarLogo } from "@/components/NavbarLogo";

const LOGIN_WEB_URL = process.env.NEXT_PUBLIC_LOGIN_URL ?? "http://localhost:3005";

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

  async function handleLogout() {
    try {
      await signOut(auth);
    } finally {
      localStorage.removeItem("bb_firebase_token");
      localStorage.removeItem("bb_firebase_uid");
      window.location.replace(LOGIN_WEB_URL);
    }
  }

  return (
    <header className="sticky top-0 z-50 h-14 bg-[var(--brand-navy)] px-6">
      <nav className="mx-auto flex h-full max-w-[1200px] items-center gap-3">
        <NavbarLogo role="owner" />

        <div className="ml-5 flex items-center gap-2">
          {NAV.map(({ href, label }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-white text-[#1E3A5F]"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="ml-auto inline-flex items-center rounded-[var(--radius-btn)] border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-[rgba(153,27,27,0.08)]"
          style={{
            borderColor: "var(--status-cancelled-text)",
            color: "var(--status-cancelled-text)",
          }}
        >
          Đăng xuất
        </button>
      </nav>
    </header>
  );
}
