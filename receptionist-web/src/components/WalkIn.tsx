"use client";

import { useState } from "react";
import { Button, Card } from "@/components/DesignSystemComponents";

type WalkInProps = {
  uid: string;
  branchId: number;
  onSuccess: (appointmentId: number) => void;
};

export function WalkIn({ uid, branchId, onSuccess }: WalkInProps) {
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
    <Card title="Walk-in" description="Placeholder — sẽ nối luồng tiếp nhận khách tới trực tiếp.">
      <div className="space-y-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        <p>
          UID: <span style={{ color: "var(--color-text-primary)" }}>{uid}</span>
        </p>
        <p>
          Branch: <span style={{ color: "var(--color-text-primary)" }}>{branchId}</span>
        </p>
        <Button type="button" variant="primary" isLoading={loading} onClick={handleCreate}>
          Tạo phiếu (demo)
        </Button>
      </div>
    </Card>
  );
}

