"use client";

import { useState } from "react";
import { Button, Card } from "@/components/DesignSystemComponents";

type BookAppointmentProps = {
  uid: string;
  branchId: number;
  onSuccess: (appointmentId: number) => void;
};

export function BookAppointment({ uid, branchId, onSuccess }: BookAppointmentProps) {
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const fakeId = Date.now();
      onSuccess(fakeId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Đặt lịch" description="Placeholder form — sẽ nối API đặt lịch sau.">
      <div className="space-y-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        <p>
          UID: <span style={{ color: "var(--color-text-primary)" }}>{uid}</span>
        </p>
        <p>
          Branch: <span style={{ color: "var(--color-text-primary)" }}>{branchId}</span>
        </p>
        <Button type="button" variant="primary" isLoading={loading} onClick={handleCreate}>
          Tạo lịch hẹn (demo)
        </Button>
      </div>
    </Card>
  );
}

