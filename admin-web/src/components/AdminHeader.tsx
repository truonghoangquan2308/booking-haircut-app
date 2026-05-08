"use client";

import type { StaffUser } from "@/lib/api";

type AdminHeaderProps = {
  user: StaffUser;
  title: string;
  subtitle?: string;
  onLogout: () => void;
};

export function AdminHeader({
  user,
  title,
  subtitle,
  onLogout,
}: AdminHeaderProps) {
  const line = subtitle ?? `Admin · ${user.email ?? "—"}`;

  return (
    <header style={{ backgroundColor: 'var(--color-navbar-bg)', borderColor: 'var(--color-border)' }} className="border-b shadow-md sticky top-0 z-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              style={{ color: 'var(--color-primary)' }}
              fill="currentColor"
              aria-hidden
            >
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.7)' }}>
              GROUP 5 · Admin
            </p>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-navbar-text)' }}>{title}</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{line}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="btn btn-secondary-light"
        >
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
