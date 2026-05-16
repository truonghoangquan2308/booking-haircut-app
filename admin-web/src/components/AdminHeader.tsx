"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StaffUser } from "@/lib/api";

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
  const pathname = usePathname() ?? "";

  return (
    <header className="sticky top-0 z-50 h-14 bg-[#1C2B4A] px-6">
      <nav className="mx-auto flex h-full max-w-7xl items-center gap-3">
        <div className="flex items-center gap-3">
          <picture>
            <source srcSet="/SKIBIDI-logo.png" type="image/png" />
            <img
              src="/SKIBIDI-logo.svg"
              alt="SKIBIDI"
              className="h-10 w-10 rounded-full object-cover ring-2 ring-yellow-400/50"
            />
          </picture>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-wide text-white">SKIBIDI</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-yellow-400">
              Admin
            </span>
          </div>
        </div>

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
                className={`rounded-md px-3 py-1.5 text-sm ${
                  active
                    ? "bg-white/12 text-white font-medium"
                    : "text-white/65 hover:text-white hover:bg-white/8"
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
          className="ml-auto rounded-md border border-red-400/30 px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10"
        >
          Đăng xuất
        </button>
      </nav>
    </header>
  );
}
