"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Trang chủ" },
  { href: "/dashboard/users", label: "Tài khoản hệ thống" },
  { href: "/dashboard/shops", label: "Cửa hàng / chi nhánh" },
  { href: "/dashboard/audit", label: "Nhật ký hoạt động" },
] as const;

export function AdminSubNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Điều hướng Admin"
      className="border-b border-white/10 bg-[#2d1b4e] px-4 py-2.5 text-sm shadow-sm"
    >
      <div className="mx-auto flex max-w-[1920px] flex-wrap gap-2">
        {NAV.map(({ href, label }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-4 py-2 font-semibold transition ${
                active
                  ? "bg-[#ffc107] text-black shadow-sm"
                  : "bg-white/10 text-white hover:bg-white/20"
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
