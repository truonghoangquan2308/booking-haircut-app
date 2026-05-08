"use client";

export type TabType =
  | "schedule"
  | "book"
  | "walkin"
  | "payment"
  | "inventory"
  | "messages";

type ReceptionistTabBarProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
};

const tabs: { id: TabType; label: string }[] = [
  { id: "schedule", label: "Lịch hẹn" },
  { id: "book", label: "Đặt lịch" },
  { id: "walkin", label: "Walk-in" },
  { id: "payment", label: "Thanh toán" },
  { id: "inventory", label: "Kho" },
  { id: "messages", label: "Tin nhắn" },
];

export function ReceptionistTabBar({ activeTab, onTabChange }: ReceptionistTabBarProps) {
  return (
    <nav
      aria-label="Receptionist tabs"
      className="sticky top-0 z-10 border-b"
      style={{
        backgroundColor: "var(--color-navbar-bg)",
        borderColor: "rgba(255,255,255,0.15)",
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap gap-2 px-4 py-3">
        {tabs.map((t) => {
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                active ? "bg-white text-[var(--color-navbar-bg)]" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

