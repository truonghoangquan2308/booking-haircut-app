"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavbarLogo } from "@/components/NavbarLogo";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Vận hành chi nhánh" },
  { href: "/dashboard/stats", label: "Doanh thu & báo cáo" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname() ?? "";

  return (
    <header className="sticky top-0 z-50 h-14 bg-[var(--brand-navy)] px-6">
      <nav className="mx-auto flex h-full max-w-7xl items-center gap-3">
        <NavbarLogo role="manager" />

        <div className="ml-5 flex items-center gap-2">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-white text-[#1E3A5F]"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center rounded-[var(--radius-btn)] border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-[rgba(153,27,27,0.08)]"
            style={{
              borderColor: "var(--status-cancelled-text)",
              color: "var(--status-cancelled-text)",
            }}
          >
            Đăng xuất
          </button>
        </div>
      </nav>
    </header>
  );
}
