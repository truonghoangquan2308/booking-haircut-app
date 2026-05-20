"use client";

import { type ReactNode } from "react";
import { ReceptionistDashboardNav } from "@/components/ReceptionistDashboardNav";
import { NavbarLogo } from "@/components/NavbarLogo";
import type { StaffUser } from "@/lib/api";
import type { ManagerBranchRow } from "@/lib/managerApi";

type ReceptionistShellProps = {
  user: StaffUser | null;
  branches: ManagerBranchRow[];
  selectedBranchId: number | null;
  onBranchChange: (nextId: number) => void;
  onLogout: () => void;
  children: ReactNode;
};

export function ReceptionistShell({
  user,
  branches,
  selectedBranchId,
  onBranchChange,
  onLogout,
  children,
}: ReceptionistShellProps) {
  void user;
  void branches;
  void selectedBranchId;
  void onBranchChange;

  return (
    <div style={{ backgroundColor: "var(--color-bg-page)" }} className="min-h-screen">
      <header className="sticky top-0 z-50 h-14 bg-[var(--brand-navy)] px-6 text-white">
        <div className="mx-auto flex h-full max-w-6xl items-center gap-3">
          <NavbarLogo role="receptionist" />

          <div className="ml-5 flex items-center gap-2">
            <ReceptionistDashboardNav />
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="ml-auto inline-flex items-center rounded-[var(--radius-btn)] border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-[rgba(153,27,27,0.08)]"
            style={{
              borderColor: "var(--status-cancelled-text)",
              color: "var(--status-cancelled-text)",
            }}
          >
            Đăng xuất
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
}
