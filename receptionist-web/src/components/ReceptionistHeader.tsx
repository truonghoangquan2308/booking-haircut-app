"use client";

import type { StaffUser } from "@/lib/api";
import type { ManagerBranchRow } from "@/lib/managerApi";
import type { TabType } from "@/components/ReceptionistTabBar";
import { NavbarLogo } from "@/components/NavbarLogo";

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
  { id: "barbers", label: "Quản lý thợ" },
];

export function ReceptionistHeader({
  user,
  branches,
  selectedBranchId,
  onLogout,
  activeTab,
  onTabChange,
}: ReceptionistHeaderProps) {
  void user;
  void branches;
  void selectedBranchId;

  return (
    <header className="sticky top-0 z-50 h-14 bg-[var(--brand-navy)] px-6 text-white">
      <div className="mx-auto flex h-full max-w-5xl items-center gap-3">
        <NavbarLogo role="receptionist" />

        <div className="ml-5 flex items-center gap-2">
          {tabs.map((t) => {
            const active = t.id === activeTab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
                style={active ? { color: "#1E3A5F" } : undefined}
              >
                {t.label}
              </button>
            );
          })}
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
  );
}
