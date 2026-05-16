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
  return (
    <header className="sticky top-0 z-50 h-14 bg-[#1C2B4A] px-6 text-white">
      <div className="mx-auto flex h-full max-w-5xl items-center gap-3">
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
          {tabs.map((t) => {
            const active = t.id === activeTab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  active
                    ? "bg-white/12 text-white font-medium"
                    : "text-white/65 hover:text-white hover:bg-white/8"
                }`}
              >
                {t.label}
              </button>
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
      </div>
    </header>
  );
}

