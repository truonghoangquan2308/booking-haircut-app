"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StaffUser } from "@/lib/api";
import { NavbarLogo } from "@/components/NavbarLogo";

type AdminHeaderProps = {
  user: StaffUser;
  onLogout: () => void;
};

const NAV = [
  { href: "/dashboard", label: "Trang chủ" },
  { href: "/dashboard/users", label: "Tài khoản hệ thống" },
  { href: "/dashboard/shops", label: "Cửa hàng / chi nhánh" },
  { href: "/dashboard/audit", label: "Nhật ký hoạt động" },
] as const;

export function AdminHeader({ user, onLogout }: AdminHeaderProps) {
  void user;
  const pathname = usePathname() ?? "";

  return (
    <header className="sticky top-0 z-50 h-14 bg-[var(--brand-navy)] px-6">
      <nav className="mx-auto flex h-full max-w-7xl items-center gap-3">
        <NavbarLogo role="admin" />

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
          onClick={() => void onLogout()}
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
