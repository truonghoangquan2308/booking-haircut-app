"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button, Card } from "@/components/DesignSystemComponents";
import { getApiBase, readJsonResponse } from "@/lib/api";

type ClosureRow = {
  id: number;
  branch_id: number;
  start_date: string;
  end_date: string;
  closure_type: string;
  reason?: string | null;
  canceled_at?: string | null;
};

export default function OwnerClosuresPage() {
  const [list, setList] = useState<ClosureRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0,10));
  const [branchId, setBranchId] = useState(0);
  const [reason, setReason] = useState("");

  const fetchClosures = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/branch-closures?from=${startDate}&to=${endDate}`);
      const data = await readJsonResponse<any>(res);
      if (!res.ok) throw new Error(data.error || 'Lỗi tải closures');
      setList(data.closures || []);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  };

  useEffect(() => { void fetchClosures(); }, []);

  const createClosure = async () => {
    try {
      const payload = { branch_id: branchId, start_date: startDate, end_date: endDate, closure_type: 'holiday', reason };
      const res = await fetch(`${getApiBase()}/api/branch-closures`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await readJsonResponse<any>(res);
      if (!res.ok) throw new Error(data.error || 'Tạo thất bại');
      alert('Tạo closure thành công');
      void fetchClosures();
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  const cancelClosure = async (id: number) => {
    if (!confirm('Hủy closure này?')) return;
    try {
      const res = await fetch(`${getApiBase()}/api/branch-closures/${id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canceled_by: null }) });
      const data = await readJsonResponse<any>(res);
      if (!res.ok) throw new Error(data.error || 'Hủy thất bại');
      alert('Đã hủy');
      void fetchClosures();
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-page)' }}>
      <PageHeader title="Quản lý đóng chi nhánh" subtitle="Owner: quản lý tất cả closure" />
      <main className="page-container py-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Tạo closure">
            <div className="space-y-2">
              <label className="block text-sm">Branch ID<input type="number" value={branchId} onChange={(e)=>setBranchId(Number(e.target.value))} className="w-full rounded border px-2 py-1"/></label>
              <label className="block text-sm">Start date<input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="w-full rounded border px-2 py-1"/></label>
              <label className="block text-sm">End date<input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="w-full rounded border px-2 py-1"/></label>
              <label className="block text-sm">Reason<input value={reason} onChange={(e)=>setReason(e.target.value)} className="w-full rounded border px-2 py-1"/></label>
              <div className="pt-2"><Button variant="primary" onClick={createClosure}>Tạo</Button></div>
            </div>
          </Card>

          <Card title="Danh sách closures">
            <div className="space-y-2">
              {loading ? <div>Đang tải…</div> : (
                <table className="w-full table-auto text-sm">
                  <thead>
                    <tr><th>ID</th><th>Branch</th><th>Period</th><th>Type</th><th>Reason</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {list.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td>{c.id}</td>
                        <td>{c.branch_id}</td>
                        <td>{c.start_date} → {c.end_date}</td>
                        <td>{c.closure_type}</td>
                        <td>{c.reason}</td>
                        <td>{!c.canceled_at ? <button className="text-sm text-red-600" onClick={()=>cancelClosure(c.id)}>Cancel</button> : <span className="text-sm text-gray-500">Cancelled</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
