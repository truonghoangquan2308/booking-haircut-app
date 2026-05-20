"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Quản lý tại quầy" },
  { href: "/dashboard/shop", label: "Quản lý shop" },
  { href: "/dashboard/shifts", label: "Quản lý ca làm" },
  { href: "/dashboard/customers", label: "Liên hệ khách hàng" },
  { href: "/dashboard/barbers", label: "Quản lý thợ" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ReceptionistDashboardNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex items-center gap-2" aria-label="Receptionist navigation">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              active
                ? "bg-white"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
            style={active ? { color: "#1E3A5F" } : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
