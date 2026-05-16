"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <header className="sticky top-0 z-50 h-14 bg-[#1C2B4A] px-6">
      <nav className="mx-auto flex h-full max-w-7xl items-center gap-3">
        <div className="flex items-center gap-3">
          <Image
            src="/images/skibidi-logo.svg"
            alt="SKIBIDI"
            width={40}
            height={40}
            className="rounded-full object-cover ring-2 ring-yellow-400/50"
          />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-wide text-white">
              SKIBIDI
            </span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-yellow-400">
              Manager
            </span>
          </div>
        </div>

        <div className="ml-5 flex items-center gap-2">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  active
                    ? "bg-white/12 text-white font-medium"
                    : "text-white/65 hover:text-white hover:bg-white/8"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="ml-auto rounded-md border border-red-400/30 px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10"
        >
          Đăng xuất
        </button>
      </nav>
    </header>
  );
}
