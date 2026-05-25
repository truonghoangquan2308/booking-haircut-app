const STATUS_MAP: Record<string, [string, string]> = {
  "Chờ xác nhận": ["--status-pending-bg", "--status-pending-text"],
  "Đã xác nhận": ["--status-confirmed-bg", "--status-confirmed-text"],
  "Đang thực hiện": ["--status-confirmed-bg", "--status-confirmed-text"],
  "Hoàn thành": ["--status-done-bg", "--status-done-text"],
  "Đã hủy": ["--status-cancelled-bg", "--status-cancelled-text"],
};

import React from "react";

export function StatusBadgeInner({ status }: { status: string }) {
  const [bg, text] = STATUS_MAP[status] ?? [
    "--surface-card-border",
    "--text-secondary",
  ];

  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-badge)] px-2.5 py-1 text-xs font-semibold"
      style={{
        backgroundColor: `var(${bg})`,
        color: `var(${text})`,
      }}
    >
      {status}
    </span>
  );
}

export const StatusBadge = React.memo(StatusBadgeInner);
