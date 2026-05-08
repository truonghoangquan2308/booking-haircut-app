"use client";

import type { StaffUser } from "@/lib/api";
import type { ManagerBranchRow } from "@/lib/managerApi";

type ReceptionistHeaderProps = {
  user: StaffUser;
  branches: ManagerBranchRow[];
  selectedBranchId: number | null;
  onBranchChange: (branchId: number) => void;
  onLogout: () => void;
};

export function ReceptionistHeader({
  user,
  branches,
  selectedBranchId,
  onBranchChange,
  onLogout,
}: ReceptionistHeaderProps) {
  return (
    <header
      className="border-b"
      style={{
        backgroundColor: "var(--color-bg-card)",
        borderColor: "var(--color-border)",
        color: "var(--color-text-primary)",
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="min-w-[16rem]">
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Lễ tân
          </p>
          <p className="text-lg font-bold">
            {user.full_name?.trim() || user.email || "Receptionist"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[16rem]">
            <label
              className="mb-1 block text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Chi nhánh
            </label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "var(--color-bg-page)",
                color: "var(--color-text-primary)",
              }}
              value={selectedBranchId ?? ""}
              onChange={(e) => onBranchChange(Number(e.target.value))}
              disabled={branches.length === 0}
            >
              {branches.length === 0 ? (
                <option value="">Chưa có chi nhánh</option>
              ) : (
                branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name?.trim() ? b.name : `Chi nhánh #${b.id}`}
                  </option>
                ))
              )}
            </select>
          </div>

          <button type="button" className="btn btn-secondary" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}

