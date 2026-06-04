"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, StatCard } from "@/components/DesignSystemComponents";
import { Clock, CheckCircle, XCircle, DoorClosed } from "lucide-react";
import { getApiBase, readJsonResponse } from "@/lib/api";

type Props = {
  uid: string | null;
  branchId: number | null;
  onDone?: () => void;
};

export default function ManagerIncidentManagement({ uid, branchId, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);

  // form
  const [title, setTitle] = useState("");
  const [requestType, setRequestType] = useState("incident");
  const [impactLevel, setImpactLevel] = useState("medium");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [detailedReason, setDetailedReason] = useState("");
  const [estimatedReopenDate, setEstimatedReopenDate] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  const fetchData = async () => {
    if (!branchId) return;
    try {
      const [rReq, rClos] = await Promise.all([
        fetch(`${getApiBase()}/api/branch-closure-requests?branch_id=${branchId}`),
        fetch(`${getApiBase()}/api/branch-closures?branch_id=${branchId}`),
      ]);
      const reqJson = await readJsonResponse<any>(rReq);
      const closJson = await readJsonResponse<any>(rClos);
      setRequests(reqJson.requests || []);
      setClosures(closJson.closures || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === "pending").length;
    const approved = requests.filter((r) => r.status === "approved").length;
    const rejected = requests.filter((r) => r.status === "rejected").length;
    const active = closures.filter((c) => !c.canceled_at).length;
    return { pending, approved, rejected, active };
  }, [requests, closures]);

  const createRequest = async () => {
    if (!branchId || !uid) return alert('Thiếu thông tin chi nhánh/uid');
    if (!startDate) return alert('Ngày bắt đầu bắt buộc');
    setLoading(true);
    try {
      const payload: any = {
        branch_id: branchId,
        manager_id: null,
        request_type: requestType,
        title: title || null,
        impact_level: impactLevel || null,
        start_date: startDate,
        end_date: endDate || startDate,
        start_time: startTime || null,
        end_time: endTime || null,
        detailed_reason: detailedReason || null,
        estimated_reopen_date: estimatedReopenDate || null,
        attachment_url: attachmentUrl || null,
      };

      const res = await fetch(`${getApiBase()}/api/branch-closure-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-firebase-uid': uid },
        body: JSON.stringify(payload),
      });
      const data = await readJsonResponse<any>(res);
      if (!res.ok) throw new Error(data.error || 'Gửi yêu cầu thất bại');
      alert('Yêu cầu đã gửi, chờ Owner phê duyệt.');
      // reset
      setTitle(''); setDetailedReason(''); setAttachmentUrl(''); setStartDate(''); setEndDate(''); setStartTime(''); setEndTime(''); setEstimatedReopenDate('');
      if (onDone) onDone();
      await fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-bb-navy">Quản lý sự cố & đóng cửa chi nhánh</h2>

      <div className="mt-4 stat-grid">
        <StatCard
          label="Đang chờ duyệt"
          value={stats.pending}
          icon={
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
          }
        />
        <StatCard
          label="Đã phê duyệt"
          value={stats.approved}
          icon={
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-amber-500" />
            </div>
          }
        />
        <StatCard
          label="Bị từ chối"
          value={stats.rejected}
          icon={
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-amber-500" />
            </div>
          }
        />
        <StatCard
          label="Đang đóng cửa"
          value={stats.active}
          icon={
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <DoorClosed className="w-5 h-5 text-amber-500" />
            </div>
          }
        />
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row">
        <div className="flex-1">
          <Card title="Tạo yêu cầu mới">
            <div className="h-full flex flex-col">
              <div className="space-y-3 text-sm flex-1">
            <label className="block">
              Tiêu đề
              <input className="w-full rounded border px-2 py-1" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block">
              Loại sự cố
              <select className="w-full rounded border px-2 py-1" value={requestType} onChange={(e) => setRequestType(e.target.value)}>
                <option value="incident">Sự cố</option>
                <option value="temporary_close">Đóng cửa</option>
              </select>
            </label>
            <label className="block">
              Mức độ ảnh hưởng
              <select className="w-full rounded border px-2 py-1" value={impactLevel} onChange={(e) => setImpactLevel(e.target.value)}>
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Cao</option>
                <option value="critical">Nguy cấp</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">Ngày bắt đầu<input type="date" className="w-full rounded border px-2 py-1" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
              <label className="block text-sm">Ngày kết thúc<input type="date" className="w-full rounded border px-2 py-1" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">Giờ bắt đầu<input type="time" className="w-full rounded border px-2 py-1" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
              <label className="block text-sm">Giờ kết thúc<input type="time" className="w-full rounded border px-2 py-1" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
            </div>
            <label className="block">
              Nguyên nhân chi tiết
              <textarea className="w-full rounded border px-2 py-1" rows={4} value={detailedReason} onChange={(e) => setDetailedReason(e.target.value)} />
            </label>
            <label className="block">Dự kiến mở lại<input type="date" className="w-full rounded border px-2 py-1" value={estimatedReopenDate} onChange={(e) => setEstimatedReopenDate(e.target.value)} /></label>
            
              </div>
              <div className="mt-2">
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => { setTitle(''); setDetailedReason(''); setAttachmentUrl(''); setStartDate(''); setEndDate(''); setStartTime(''); setEndTime(''); setEstimatedReopenDate(''); }}>Huỷ</Button>
                  <Button variant="primary" isLoading={loading} onClick={createRequest}>Gửi yêu cầu</Button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex-1">
          <Card title="Lịch sử yêu cầu">
            <div className="h-full flex flex-col text-sm">
              {requests.length === 0 ? (
                <p className="text-gray-500">Chưa có yêu cầu.</p>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 overflow-y-auto pr-1 max-h-[480px]">
                    {requests.map((r) => (
                      <div key={r.id} className="rounded-md border p-2 mb-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{r.title || r.request_type} · {r.manager_name}</div>
                          <div className="text-xs text-gray-600">{r.status}</div>
                        </div>
                        <div className="text-xs text-gray-600">{r.start_date}{r.end_date && r.end_date !== r.start_date ? ` - ${r.end_date}` : ''}</div>
                        <div className="mt-1 text-sm">{r.detailed_reason || r.reason}</div>
                        {r.status === 'rejected' && r.rejection_reason ? (
                          <div className="mt-1 text-xs text-red-600">Lý do từ chối: {r.rejection_reason}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <Card title="Đóng cửa đang hoạt động">
          <div className="space-y-2 text-sm">
            {closures.length === 0 ? (
              <p className="text-gray-500">Không có đóng cửa đang hoạt động.</p>
            ) : (
              <div className="space-y-2">
                {closures.map((c) => (
                  <div key={c.id} className="rounded-md border p-2 flex items-start justify-between">
                    <div>
                      <div className="font-medium">{c.display_date_range || c.display_start_date}</div>
                      <div className="text-xs text-gray-600">{c.display_time_range || ''}</div>
                      <div className="mt-1 text-sm">{c.reason}</div>
                    </div>
                    <div className="text-sm text-gray-600">{c.canceled_at ? 'Đã hủy' : 'Đang hoạt động'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}
