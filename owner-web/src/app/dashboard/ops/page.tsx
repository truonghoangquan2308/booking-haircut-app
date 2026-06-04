"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, type StaffUser } from "@/lib/api";
import { StatCard } from "@/components/DesignSystemComponents";
import { Calendar, Clock3, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  fetchManagerAppointments,
  fetchManagerBranchList,
  type ManagerBranchRow,
  fetchSchedules,
} from "@/lib/managerApi";
import {
  fetchBranchClosures,
  createBranchClosure,
  updateBranchClosure,
  cancelBranchClosure,
  type BranchClosureRow,
  type ClosureType,
} from '@/lib/branchClosuresApi';
import {
  fetchBranchClosureRequests,
  approveBranchClosureRequest,
  rejectBranchClosureRequest,
  type BCRequestRow,
} from '@/lib/branchClosureRequestsApi';

const BRANCH_STORAGE_KEY = "manager-dashboard-branch-id";

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<ManagerBranchRow[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(
    null,
  );
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [closures, setClosures] = useState<BranchClosureRow[]>([]);
  const [requests, setRequests] = useState<BCRequestRow[]>([]);
  const [loadingClosures, setLoadingClosures] = useState(false);
  const [editing, setEditing] = useState<BranchClosureRow | null>(null);
  const [formState, setFormState] = useState<{
    start_date: string;
    end_date: string;
    closure_type: ClosureType;
    start_time: string;
    end_time: string;
    reason: string;
  }>({
    start_date: '',
    end_date: '',
    closure_type: 'temporary_close',
    start_time: '',
    end_time: '',
    reason: '',
  });
  const [branchStatus, setBranchStatus] = useState<'Open'|'Closed'>('Open');
  const [appointmentSummary, setAppointmentSummary] = useState<{
    today: number;
    pending: number;
    completed: number;
    cancelled: number;
    byBranch: Array<{
      branchId: number;
      branchName: string;
      today: number;
      thisWeek: number;
      pending: number;
    }>;
  }>({
    today: 0,
    pending: 0,
    completed: 0,
    cancelled: 0,
    byBranch: [],
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [scheduleSummary, setScheduleSummary] = useState<Array<{
    branchId: number;
    branchName: string;
    working: number;
    off: number;
  }>>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fb) => {
      const effectiveUid = fb?.uid ?? localStorage.getItem("bb_firebase_uid");
      if (!effectiveUid) {
        setBranchesLoaded(false);
        setBranches([]);
        setSelectedBranchId(null);
        setUid(null);
        router.replace("/");
        return;
      }
      try {
        const row = await fetchUserByFirebaseUid(effectiveUid);
        if (row.role !== "owner" && row.role !== "manager") {
          if (fb) await signOut(auth);
          router.replace("/");
          return;
        }
        if (row.is_locked === 1 || row.is_locked === true) {
          if (fb) await signOut(auth);
          setError("Tài khoản đã bị khóa.");
          return;
        }
        setUser(row);
        setUid(effectiveUid);
        try {
          const list = await fetchManagerBranchList(effectiveUid);
          setBranches(list);
          if (list.length) {
            const saved = Number(
              typeof window !== "undefined"
                ? localStorage.getItem(BRANCH_STORAGE_KEY)
                : "",
            );
            const pick = list.some((b) => b.id === saved)
              ? saved
              : list[0].id;
            setSelectedBranchId(pick);
            try {
              localStorage.setItem(BRANCH_STORAGE_KEY, String(pick));
            } catch {
              /* ignore */
            }
          } else {
            setSelectedBranchId(null);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setBranchesLoaded(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!uid || branches.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const summary = {
          today: 0,
          pending: 0,
          completed: 0,
          cancelled: 0,
          byBranch: [] as Array<{
            branchId: number;
            branchName: string;
            today: number;
            thisWeek: number;
            pending: number;
          }>,
        };

        for (const branch of branches) {
          const appointments = await fetchManagerAppointments(uid, {}, branch.id);
          if (cancelled) return;
          const branchName = branch.name?.trim() ? branch.name : `Chi nhánh #${branch.id}`;
          let todayCount = 0;
          let weekCount = 0;
          let pendingCount = 0;
          for (const appt of appointments) {
            if (appt.appt_date === today) {
              summary.today++;
              todayCount++;
            }
            if (appt.appt_date >= weekAgo) weekCount++;
            if (appt.status === 'pending') {
              summary.pending++;
              pendingCount++;
            }
            if (appt.status === 'completed') summary.completed++;
            if (appt.status === 'cancelled') summary.cancelled++;
          }
          summary.byBranch.push({
            branchId: branch.id,
            branchName,
            today: todayCount,
            thisWeek: weekCount,
            pending: pendingCount,
          });
        }

        setAppointmentSummary(summary);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, branches]);

  // Load today's working schedules summary for each branch
  useEffect(() => {
    if (!uid || branches.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const sums: Array<{ branchId: number; branchName: string; working: number; off: number }> = [];
        for (const branch of branches) {
          const schedules = await fetchSchedules(uid, { from: today, to: today }, branch.id);
          if (cancelled) return;
          let working = 0;
          let off = 0;
          for (const s of schedules) {
            if (s.is_day_off && Number(s.is_day_off) === 1) off++;
            else working++;
          }
          const branchName = branch.name?.trim() ? branch.name : `Chi nhánh #${branch.id}`;
          sums.push({ branchId: branch.id, branchName, working, off });
        }
        setScheduleSummary(sums);
      } catch (e:any) {
        if (!cancelled) setError(e?.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [uid, branches]);

  // Load closures when branch changes
  useEffect(() => {
    if (!selectedBranchId) return;
    void loadClosures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);
  useEffect(() => {
    if (!selectedBranchId) return;
    void loadRequests();
  }, [selectedBranchId]);

  async function loadClosures() {
    if (!selectedBranchId) return;
    setLoadingClosures(true);
    try {
      const today = new Date().toISOString().slice(0,10);
      const rows = await fetchBranchClosures(selectedBranchId, today);
      setClosures(rows ?? []);
      const isClosed = (rows || []).some(r => r.start_date <= today && r.end_date >= today && !r.canceled_at);
      setBranchStatus(isClosed ? 'Closed' : 'Open');
    } catch (e:any) {
      console.error('loadClosures', e?.message || e);
      setError(e?.message || String(e));
    } finally {
      setLoadingClosures(false);
    }
  }

  async function loadRequests() {
    if (!selectedBranchId) return;
    try {
      const rows = await fetchBranchClosureRequests(selectedBranchId);
      setRequests(rows ?? []);
    } catch (e:any) {
      console.error('loadRequests', e?.message || e);
    }
  }

  function fmtDateDisplay(d?: string|null) {
    if (!d) return '';
    try { return `${d.slice(8,10)}/${d.slice(5,7)}/${d.slice(0,4)}`; } catch(e) { return d; }
  }

  function resetForm() {
    setFormState({ start_date: '', end_date: '', closure_type: 'temporary_close', start_time: '', end_time: '', reason: '' });
    setEditing(null);
  }

  async function handleApproveRequest(id: number) {
    try {
      // call API to approve
      await approveBranchClosureRequest(id, Number(user?.id ?? 0));
      await loadRequests();
      await loadClosures();
      alert('Đã phê duyệt yêu cầu và tạo đóng cửa.');
    } catch (e:any) {
      console.error('approve', e?.message || e);
      alert('Phê duyệt thất bại');
    }
  }

  async function handleRejectRequest(id: number) {
    const raw = window.prompt('Lý do từ chối:');
    if (raw === null) return; // user cancelled
    const reason = String(raw).trim();
    if (!reason) {
      alert('Lý do từ chối bắt buộc');
      return;
    }
    try {
      await rejectBranchClosureRequest(id, Number(user?.id ?? 0), reason);
      await loadRequests();
      alert('Đã từ chối yêu cầu.');
    } catch (e:any) {
      console.error('reject', e?.message || e);
      alert('Từ chối thất bại');
    }
  }

  function setFormFromClosure(c: BranchClosureRow) {
    setFormState({ start_date: c.start_date ?? '', end_date: c.end_date ?? c.start_date ?? '', closure_type: c.closure_type ?? 'temporary_close', start_time: c.start_time ?? '', end_time: c.end_time ?? '', reason: c.reason ?? '' });
  }

  return (
    <div className="min-h-screen bg-bb-surface">
      <PageHeader
        title="Quản lý chi nhánh"
        subtitle={user?.full_name ?? ""}
      />

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        {branches.length > 0 && selectedBranchId != null && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <span className="text-sm font-semibold text-bb-navy">
                Chi nhánh
              </span>
              <select
                className="max-w-md rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900"
                value={selectedBranchId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  if (!Number.isFinite(id) || id <= 0) return;
                  setSelectedBranchId(id);
                  try {
                    localStorage.setItem(BRANCH_STORAGE_KEY, String(id));
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name?.trim()
                      ? b.name
                      : `Chi nhánh #${b.id}`}
                    {b.address ? ` — ${b.address}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs text-gray-500">
              Lịch hẹn và lịch làm việc thợ theo chi nhánh đã chọn. Đơn shop là
              toàn hệ thống.
            </p>
            {/* Branch Closure Management */}
            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-semibold text-bb-navy">Quản lý đóng cửa chi nhánh</h3>
              <p className="text-xs text-gray-600 mb-2">Trạng thái hiện tại: <strong className="ml-2">{branchStatus}</strong></p>
              <div className="mb-3">
                <h4 className="text-sm font-medium">Yêu cầu đóng cửa chờ phê duyệt</h4>
                <div className="mt-2">
                  {(!requests || requests.filter(r=>r.status === 'pending').length === 0) && <div className="text-sm text-gray-500">Không có yêu cầu chờ phê duyệt.</div>}
                  <ul className="space-y-2">
                    {requests.filter(r=>r.status === 'pending').map(r => (
                      <li key={r.id} className="p-3 border rounded">
                        <div className="text-sm space-y-1">
                          <div className="font-semibold text-bb-navy">{r.title ?? (r.request_type ?? 'Yêu cầu')}</div>
                          <div className="text-xs text-gray-700">Loại: <strong className="ml-1">{r.request_type}</strong> — Mức độ: <strong className="ml-1">{r.impact_level ?? '-'}</strong></div>
                          <div className="text-xs text-gray-700">Từ: <strong className="ml-1">{fmtDateDisplay(r.start_date)}</strong>  Đến: <strong className="ml-1">{fmtDateDisplay(r.end_date)}</strong></div>
                          <div className="text-xs text-gray-700">Nguyên nhân: <div className="mt-1 text-gray-600">{r.detailed_reason ?? r.reason ?? '-'}</div></div>
                          <div className="text-xs text-gray-700">Dự kiến mở lại: <strong className="ml-1">{r.estimated_reopen_date ? fmtDateDisplay(r.estimated_reopen_date) : '-'}</strong></div>
                          <div className="text-xs text-gray-500">Người yêu cầu: {r.manager_name ?? 'Manager'}</div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button className="btn btn-sm btn-primary" onClick={() => handleApproveRequest(r.id)}>Phê duyệt</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => handleRejectRequest(r.id)}>Từ chối</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Ngày bắt đầu</label>
                  <input type="date" value={formState.start_date} onChange={(e)=>setFormState(s=>({...s,start_date:e.target.value}))} className="mt-1 block w-full rounded border px-2 py-1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Ngày kết thúc</label>
                  <input type="date" value={formState.end_date} onChange={(e)=>setFormState(s=>({...s,end_date:e.target.value}))} className="mt-1 block w-full rounded border px-2 py-1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Kiểu đóng</label>
                  <select value={formState.closure_type} onChange={(e)=>setFormState(s=>({...s,closure_type: e.target.value as ClosureType}))} className="mt-1 block w-full rounded border px-2 py-1">
                    <option value="temporary_close">Temporary</option>
                    <option value="holiday">Holiday</option>
                    <option value="incident">Incident</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Bắt đầu (giờ, optional)</label>
                  <input type="time" value={formState.start_time ?? ''} onChange={(e)=>setFormState(s=>({...s,start_time:e.target.value}))} className="mt-1 block w-full rounded border px-2 py-1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Kết thúc (giờ, optional)</label>
                  <input type="time" value={formState.end_time ?? ''} onChange={(e)=>setFormState(s=>({...s,end_time:e.target.value}))} className="mt-1 block w-full rounded border px-2 py-1" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700">Lý do (optional)</label>
                  <textarea value={formState.reason ?? ''} onChange={(e)=>setFormState(s=>({...s,reason:e.target.value}))} className="mt-1 block w-full rounded border px-2 py-1" />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="rounded bg-bb-navy px-3 py-1 text-white" onClick={async ()=>{
                  if (!selectedBranchId) return;
                  try {
                    if (editing) {
                      const updated = await updateBranchClosure(editing.id, { ...formState, branch_id: selectedBranchId });
                      setEditing(null);
                    } else {
                      const created = await createBranchClosure({ ...formState, branch_id: selectedBranchId });
                    }
                    await loadClosures();
                    resetForm();
                  } catch (e:any) {
                    alert(e?.message || String(e));
                  }
                }}>{editing ? 'Cập nhật' : 'Tạo đóng cửa'}</button>
                <button className="rounded border px-3 py-1" onClick={()=>{ setEditing(null); resetForm(); }}>Huỷ</button>
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-medium">Danh sách đóng cửa (active/upcoming)</h4>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b"><th className="py-2">Khoảng</th><th className="py-2">Giờ</th><th className="py-2">Kiểu</th><th className="py-2">Lý do</th><th className="py-2">Hành động</th></tr>
                    </thead>
                    <tbody>
                      {closures.length === 0 ? (
                        <tr><td colSpan={5} className="py-4 text-center text-gray-500">Không có đóng cửa</td></tr>
                      ) : (
                        closures.map(c => (
                          <tr key={c.id} className="border-b">
                            <td className="py-2">{(c as any).display_date_range ?? (c.start_date + (c.end_date && c.end_date !== c.start_date ? ` — ${c.end_date}` : ''))}</td>
                            <td className="py-2">{(c as any).display_time_range ?? (c.start_time ? `${c.start_time} - ${c.end_time ?? ''}` : 'Cả ngày')}</td>
                            <td className="py-2">{c.closure_type}</td>
                            <td className="py-2">{c.reason ?? ''}</td>
                            <td className="py-2">
                              <button className="mr-2 text-sm text-blue-600" onClick={()=>{ setEditing(c); setFormFromClosure(c); }}>Sửa</button>
                              <button className="text-sm text-red-600" onClick={async ()=>{ if (!confirm('Huỷ closure này?')) return; try{ await cancelBranchClosure(c.id); await loadClosures(); }catch(e:any){ alert(e?.message||String(e)) } }}>Huỷ</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}


        {branchesLoaded && branches.length === 0 && uid && !error && (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Chưa có chi nhánh nào gắn với tài khoản Owner (kiểm tra{" "}
            <code className="rounded bg-white px-1">branches.owner_id</code>).
          </p>
        )}

        {error && (
          <p
            className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-bb-navy">Lịch hẹn chi nhánh</h2>
          <p className="mb-4 text-sm text-gray-600">
            Tổng quan lịch hẹn toàn hệ thống. API{" "}
            <code className="rounded bg-bb-input px-1">
              /api/manager/appointments
            </code>
            .
          </p>
          <div className="stat-grid mb-6">
            <StatCard
              label="Hôm nay"
              value={appointmentSummary.today}
              icon={<Calendar className="h-5 w-5" />}
              iconBg={"var(--status-pending-bg)"}
              iconColor={"var(--brand-amber)"}
            />
            <StatCard
              label="Đang chờ"
              value={appointmentSummary.pending}
              icon={<Clock3 className="h-5 w-5" />}
              iconBg={"var(--status-pending-bg)"}
              iconColor={"var(--brand-amber)"}
            />
            <StatCard
              label="Hoàn thành"
              value={appointmentSummary.completed}
              icon={<CheckCircle2 className="h-5 w-5" />}
              iconBg={"var(--status-pending-bg)"}
              iconColor={"var(--brand-amber)"}
            />
            <StatCard
              label="Đã huỷ"
              value={appointmentSummary.cancelled}
              icon={<XCircle className="h-5 w-5" />}
              iconBg={"var(--status-pending-bg)"}
              iconColor={"var(--brand-amber)"}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600">
                  <th className="py-2 pr-2">Chi nhánh</th>
                  <th className="py-2 pr-2">Hôm nay</th>
                  <th className="py-2 pr-2">Tuần này</th>
                  <th className="py-2">Chờ xác nhận</th>
                </tr>
              </thead>
              <tbody>
                {appointmentSummary.byBranch.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-500">
                      Chưa có dữ liệu.
                    </td>
                  </tr>
                ) : (
                  appointmentSummary.byBranch.map((b) => (
                    <tr key={b.branchId} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-medium">{b.branchName}</td>
                      <td className="py-2 pr-2">{b.today}</td>
                      <td className="py-2 pr-2">{b.thisWeek}</td>
                      <td className="py-2">{b.pending}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-bb-navy">Lịch làm việc thợ</h2>
          <p className="mb-4 text-sm text-gray-600">
            Tổng quan nhân sự hôm nay. API{" "}
            <code className="rounded bg-bb-input px-1">/api/manager/working-schedules</code>
            .
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600">
                  <th className="py-2 pr-2">Chi nhánh</th>
                  <th className="py-2 pr-2">Thợ đang làm</th>
                  <th className="py-2">Thợ nghỉ</th>
                </tr>
              </thead>
              <tbody>
                {scheduleSummary.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-500">
                      Chưa có dữ liệu.
                    </td>
                  </tr>
                ) : (
                  scheduleSummary.map((s) => (
                    <tr key={s.branchId} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-medium">{s.branchName}</td>
                      <td className="py-2 pr-2">{s.working}</td>
                      <td className="py-2">{s.off}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-center text-xs text-gray-500">
          API{" "}
          <code className="rounded bg-gray-200 px-1">/api/manager/*</code> — Owner
          chọn chi nhánh (header{" "}
          <code className="rounded bg-gray-200 px-1">x-manager-branch-id</code>
          ); thợ cần{" "}
          <code className="rounded bg-gray-200 px-1">barbers.branch_id</code>{" "}
          khớp chi nhánh đó.
        </p>
      </main>
    </div>
  );
}
