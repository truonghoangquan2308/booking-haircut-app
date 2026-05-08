"use client";

import { type ReactNode } from "react";
import { ManagerDashboardNav } from "@/components/ManagerDashboardNav";
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
      <header style={{ backgroundColor: "var(--color-navbar-bg)" }} className="px-4 py-4 text-white shadow">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white/80">receptionist-web · Lễ tân chi nhánh</p>
            <p className="text-lg font-bold">{user?.full_name ?? user?.email ?? "Receptionist"}</p>
            <ManagerDashboardNav />
            {branches.length > 0 && selectedBranchId != null && (
              <div className="mt-2 text-sm">
                <span className="mb-1 block text-white/80">Chi nhánh</span>
                {user?.role === "owner" && branches.length > 1 ? (
                  <select
                    className="max-w-[min(100%,22rem)] rounded-lg border-0 bg-white px-3 py-2 text-[var(--color-navbar-bg)]"
                    value={selectedBranchId}
                    onChange={(e) => onBranchChange(Number(e.target.value))}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name?.trim() ? b.name : `#${b.id}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="max-w-[min(100%,22rem)] rounded-lg bg-white/10 px-3 py-2 text-white">
                    {branches.find((b) => b.id === selectedBranchId)?.name?.trim() || `Chi nhánh #${selectedBranchId}`}
                  </p>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={onLogout} className="btn btn-secondary-light">
            Đăng xuất
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
}
