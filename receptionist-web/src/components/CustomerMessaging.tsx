"use client";

import { Card, Button } from "@/components/DesignSystemComponents";

type AutoReplyMessagingProps = {
  uid: string;
  branchId: number;
};

export function AutoReplyMessaging({ uid, branchId }: AutoReplyMessagingProps) {
  return (
    <Card title="Tin nhắn khách hàng" description="Placeholder — sẽ tích hợp kênh chat/tự động trả lời sau.">
      <div className="space-y-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        <p>
          UID: <span style={{ color: "var(--color-text-primary)" }}>{uid}</span>
        </p>
        <p>
          Branch: <span style={{ color: "var(--color-text-primary)" }}>{branchId}</span>
        </p>
        <Button type="button" variant="secondary" onClick={() => {}}>
          Tạo kịch bản auto-reply (demo)
        </Button>
      </div>
    </Card>
  );
}

