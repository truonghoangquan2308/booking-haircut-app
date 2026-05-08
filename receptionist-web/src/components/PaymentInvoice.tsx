"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "@/components/DesignSystemComponents";

type PaymentInvoiceProps = {
  uid: string;
  appointmentId: number;
  branchId: number;
  onSuccess: () => void;
};

export function PaymentInvoice({
  uid,
  appointmentId,
  branchId,
  onSuccess,
}: PaymentInvoiceProps) {
  const [loading, setLoading] = useState(false);
  const total = useMemo(() => (appointmentId % 100000) + 50000, [appointmentId]);

  const handlePay = async () => {
    setLoading(true);
    try {
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Thanh toán" description="Placeholder hoá đơn — sẽ nối API thanh toán sau.">
      <div className="space-y-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        <p>
          UID: <span style={{ color: "var(--color-text-primary)" }}>{uid}</span>
        </p>
        <p>
          Branch: <span style={{ color: "var(--color-text-primary)" }}>{branchId}</span>
        </p>
        <p>
          Appointment:{" "}
          <span style={{ color: "var(--color-text-primary)" }}>#{appointmentId}</span>
        </p>
        <p>
          Tổng tiền (demo):{" "}
          <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {total.toLocaleString("vi-VN")}₫
          </span>
        </p>
        <div className="pt-2">
          <Button type="button" variant="primary" isLoading={loading} onClick={handlePay}>
            Xác nhận thanh toán (demo)
          </Button>
        </div>
      </div>
    </Card>
  );
}

