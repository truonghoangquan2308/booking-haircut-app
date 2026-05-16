"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

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
    <header className="sticky top-0 z-50 h-14 bg-[#1C2B4A] px-6">
      <nav className="mx-auto flex h-full max-w-[1200px] items-center gap-3">
        <div className="flex items-center gap-3">
          <Image
            src="/images/skibidi-logo.png"
            alt="SKIBIDI"
            width={40}
            height={40}
            className="rounded-full object-cover ring-2 ring-yellow-400/50"
          />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-wide text-white">SKIBIDI</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-yellow-400">
              Owner
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
          onClick={handleLogout}
          className="ml-auto rounded-md border border-red-400/30 px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10"
        >
          Đăng xuất
        </button>
      </nav>
    </header>
  );
}
