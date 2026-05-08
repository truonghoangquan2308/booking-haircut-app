"use client";

import { Card, Table } from "@/components/DesignSystemComponents";

type InventoryManagementProps = {
  uid: string;
  branchId: number;
};

export function InventoryManagement({ uid, branchId }: InventoryManagementProps) {
  const headers = ["Mặt hàng", "Tồn", "Ghi chú"];
  const rows = [
    ["Gel vuốt tóc", 12, "Demo"],
    ["Dao cạo", 48, "Demo"],
    ["Khăn giấy", 120, "Demo"],
  ];

  return (
    <Card title="Quản lý kho" description="Placeholder — dữ liệu demo.">
      <p className="mb-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        UID: <span style={{ color: "var(--color-text-primary)" }}>{uid}</span> · Branch:{" "}
        <span style={{ color: "var(--color-text-primary)" }}>{branchId}</span>
      </p>
      <Table headers={headers} rows={rows} />
    </Card>
  );
}

