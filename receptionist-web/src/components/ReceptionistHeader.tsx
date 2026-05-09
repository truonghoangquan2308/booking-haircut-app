"use client";

import type { StaffUser } from "@/lib/api";
import type { ManagerBranchRow } from "@/lib/managerApi";
import type { TabType } from "@/components/ReceptionistTabBar";

type ReceptionistHeaderProps = {
  user: StaffUser;
  branches: ManagerBranchRow[];
  selectedBranchId: number | null;
  onBranchChange: (branchId: number) => void;
  onLogout: () => void;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
};

const tabs: { id: TabType; label: string }[] = [
  { id: "schedule", label: "Quản lý tại quầy" },
  { id: "shop", label: "Quản lý shop" },
  { id: "book", label: "Quản lý ca làm" },
  { id: "messages", label: "Liên hệ khách hàng" },
  { id: "walkin", label: "Quản lý thợ" },
];

export function ReceptionistHeader({
  user,
  branches,
  selectedBranchId,
  onLogout,
  activeTab,
  onTabChange,
}: ReceptionistHeaderProps) {
  return (
    <header
      className="border-b"
      style={{
        backgroundColor: "var(--color-navbar-bg)",
        borderColor: "rgba(255,255,255,0.08)",
        color: "white",
      }}
    >
      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[16rem]">
            <p className="text-sm text-white/80">receptionist-web · Lễ tân chi nhánh</p>
            <p className="text-lg font-bold leading-tight">{user.full_name?.trim() || user.email || "Lễ tân"}</p>

            <nav className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Menu dashboard">
              {tabs.map((t) => {
                const active = t.id === activeTab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTabChange(t.id)}
                    className={`rounded-full px-3 py-1.5 font-semibold transition ${
                      active ? "bg-white text-[var(--color-navbar-bg)]" : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </nav>

            {branches.length > 0 && selectedBranchId != null && (
              <div className="mt-2 text-sm">
                <span className="mb-1 block text-white/80">Chi nhánh</span>
                <p className="max-w-[min(100%,22rem)] rounded-lg bg-white px-3 py-2 text-[var(--color-navbar-bg)]">
                  {branches.find((b) => b.id === selectedBranchId)?.name?.trim() ||
                    `Chi nhánh #${selectedBranchId}`}
                </p>
              </div>
            )}
          </div>

          <button type="button" onClick={onLogout} className="btn btn-secondary-light">
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}

