"use client";

import { Card } from "@/components/DesignSystemComponents";

type ScheduleViewProps = {
  uid: string;
  branchId: number;
};

export function ScheduleView({ uid, branchId }: ScheduleViewProps) {
  return (
    <Card
      title="Lịch hẹn trong ngày"
      description="Màn hình placeholder — sẽ nối API lịch hẹn sau."
    >
      <div className="space-y-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        <p>
          <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
            UID:
          </span>{" "}
          {uid}
        </p>
        <p>
          <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Branch ID:
          </span>{" "}
          {branchId}
        </p>
        <p>
          Gợi ý: chọn tab <span className="font-semibold">Đặt lịch</span> hoặc{" "}
          <span className="font-semibold">Walk-in</span> để tạo lịch, rồi qua{" "}
          <span className="font-semibold">Thanh toán</span>.
        </p>
      </div>
    </Card>
  );
}

