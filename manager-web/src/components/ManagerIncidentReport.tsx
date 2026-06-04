"use client";

import { useState } from "react";
import { Button, Card } from "@/components/DesignSystemComponents";
import { getApiBase, readJsonResponse } from "@/lib/api";

type Props = {
  uid: string | null;
  branchId: number | null;
  onDone?: () => void;
};

export default function ManagerIncidentReport({ uid, branchId, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  const report = async () => {
    if (!uid || !branchId) return;
    setLoading(true);
    try {
      const payload = {
        branch_id: branchId,
        manager_id: Number(uid) || null,
        start_date: new Date().toISOString().slice(0,10),
        end_date: new Date().toISOString().slice(0,10),
        request_type: 'incident',
        reason: reason || 'Sự cố do Manager báo cáo',
      };
      const res = await fetch(`${getApiBase()}/api/branch-closure-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-firebase-uid': uid },
        body: JSON.stringify(payload),
      });
      const data = await readJsonResponse<any>(res);
      if (!res.ok) throw new Error(data.error || 'Báo sự cố thất bại');
      setOpen(false);
      setReason('');
      if (onDone) onDone();
      alert('Yêu cầu đã gửi, chờ Owner phê duyệt.');
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button variant="warning" onClick={() => setOpen(true)}>Báo sự cố / đóng chi nhánh</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <Card title="Báo sự cố chi nhánh" description="Báo sự cố khẩn cấp (mất điện, nước, internet...).">
            <div className="space-y-3">
              <label className="block text-sm">
                Lý do (mô tả ngắn)
                <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded border px-2 py-1" />
              </label>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setOpen(false)}>Huỷ</Button>
                <Button variant="primary" isLoading={loading} onClick={report}>Gửi báo cáo & đóng</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
