"use client";

import { type ReactNode } from "react";
import { ReceptionistDashboardNav } from "@/components/ReceptionistDashboardNav";
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
  return (
    <div style={{ backgroundColor: "var(--color-bg-page)" }} className="min-h-screen">
      <header className="sticky top-0 z-50 h-14 bg-[#1C2B4A] px-6 text-white">
        <div className="mx-auto flex h-full max-w-6xl items-center gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/images/skibidi-logo.svg"
              alt="SKIBIDI"
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-yellow-400/50"
            />
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold tracking-wide text-white">SKIBIDI</span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-yellow-400">
                Receptionist
              </span>
            </div>
          </div>

          <div className="ml-5 flex items-center gap-2">
            <ReceptionistDashboardNav />
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="ml-auto rounded-md border border-red-400/30 px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10"
          >
            Đăng xuất
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
}
