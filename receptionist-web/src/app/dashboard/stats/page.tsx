"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, type StaffUser } from "@/lib/api";
import { ManagerDashboardNav } from "@/components/ManagerDashboardNav";
import {
  fetchManagerBranchList,
  fetchManagerStats,
  fetchManagerAppointments,
  type ManagerAppointmentRow,
  type ManagerBranchRow,
  type ManagerStatsResponse,
} from "@/lib/managerApi";
import * as XLSX from "xlsx";

const BRANCH_STORAGE_KEY = "manager-web-branch-id";

const APPOINTMENT_STATUS_ORDER = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

function dayKey(d: unknown): string {
  if (d == null) return "";
  const s = typeof d === "string" ? d : String(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function fmtMoney(v: string | number): string {
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";
}

export default function ManagerStatsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<ManagerBranchRow[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stats, setStats] = useState<ManagerStatsResponse | null>(null);
  const [appointments, setAppointments] = useState<ManagerAppointmentRow[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fb) => {
      if (!fb) {
        setBranchesLoaded(false);
        setBranches([]);
        setSelectedBranchId(null);
        setUid(null);
        router.replace("/");
        return;
      }
      try {
        const row = await fetchUserByFirebaseUid(fb.uid);
        if (row.role !== "owner" && row.role !== "manager") {
          await signOut(auth);
          router.replace("/");
          return;
        }
        if (row.is_locked === 1 || row.is_locked === true) {
          await signOut(auth);
          setError("Tài khoản đã bị khóa.");
          return;
        }
        setUser(row);
        setUid(fb.uid);
        try {
          const list = await fetchManagerBranchList(fb.uid);
          setBranches(list);
          if (list.length) {
            const pick =
              row.role === "manager"
                ? list[0].id
                : (() => {
                    const saved = Number(
                      typeof window !== "undefined"
                        ? localStorage.getItem(BRANCH_STORAGE_KEY)
                        : "",
                    );
                    return list.some((b) => b.id === saved)
                      ? saved
                      : list[0].id;
                  })();
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
    if (!uid || selectedBranchId == null || selectedBranchId <= 0) return;
    let cancelled = false;
    void (async () => {
      setLoadingStats(true);
      setError(null);
      try {
        const data = await fetchManagerStats(uid, selectedBranchId, {});
        if (cancelled) return;
        setStats(data);
        setFrom(data.from);
        setTo(data.to);
        const appts = await fetchManagerAppointments(uid, { status: "completed" }, selectedBranchId);
        if (!cancelled) setAppointments(appts);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setStats(null);
        }
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, selectedBranchId]);

  async function onApplyRange() {
    if (!uid || selectedBranchId == null) return;
    setLoadingStats(true);
    setError(null);
    try {
      const data = await fetchManagerStats(uid, selectedBranchId, {
        from: from || undefined,
        to: to || undefined,
      });
      setStats(data);
      const appts = await fetchManagerAppointments(uid, {
        from: from || undefined,
        to: to || undefined,
        status: "completed"
      }, selectedBranchId);
      setAppointments(appts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingStats(false);
    }
  }

  async function logout() {
    await signOut(auth);
    router.replace("/");
  }

  const canSwitchBranch =
    user?.role === "owner" && branches.length > 1;

  const mergedRows = (() => {
    if (!stats) return [];
    const map = new Map<
      string,
      { appt: number; revAppt: number; ord: number; revShop: number }
    >();
    for (const r of stats.appointments_by_day ?? []) {
      const k = dayKey(r.d);
      if (!k) continue;
      const prev = map.get(k) ?? {
        appt: 0,
        revAppt: 0,
        ord: 0,
        revShop: 0,
      };
      prev.appt = Number(r.appointments) || 0;
      prev.revAppt = Number(r.revenue) || 0;
      map.set(k, prev);
    }
    for (const r of stats.shop_orders_by_day ?? []) {
      const k = dayKey(r.d);
      if (!k) continue;
      const prev = map.get(k) ?? {
        appt: 0,
        revAppt: 0,
        ord: 0,
        revShop: 0,
      };
      prev.ord = Number(r.orders) || 0;
      prev.revShop = Number(r.revenue) || 0;
      map.set(k, prev);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, v]) => ({ d, ...v }));
  })();
  const barberStats = (() => {
    const map = new Map<number, { name: string; count: number; rev: number }>();
    for (const a of appointments) {
      if (!a.barber_id) continue;
      const prev = map.get(a.barber_id) ?? { name: a.barber_name || `#${a.barber_id}`, count: 0, rev: 0 };
      prev.count++;
      prev.rev += Number(a.total_price) || 0;
      map.set(a.barber_id, prev);
    }
    return [...map.values()].sort((a,b) => b.rev - a.rev);
  })();

  const serviceStats = (() => {
    const map = new Map<number, { name: string; count: number; rev: number }>();
    for (const a of appointments) {
      if (!a.service_id) continue;
      const prev = map.get(a.service_id) ?? { name: a.service_name || `#${a.service_id}`, count: 0, rev: 0 };
      prev.count++;
      prev.rev += Number(a.total_price) || 0;
      map.set(a.service_id, prev);
    }
    return [...map.values()].sort((a,b) => b.rev - a.rev);
  })();

  const completedRevenue = (() => {
    return appointments.reduce((sum, a) => sum + (Number(a.total_price) || 0), 0);
  })();

  function exportExcel() {
    if (!stats) return;

    // Sheet 1: Tổng quan
    const ws1 = XLSX.utils.json_to_sheet(mergedRows.map(r => ({
      "Ngày": r.d,
      "Lịch hẹn": r.appt,
      "DT Lịch hẹn": r.revAppt,
      "Đơn shop": r.ord,
      "DT Đơn shop": r.revShop,
    })));

    // Sheet 2: Doanh thu theo thợ
    const ws2 = XLSX.utils.json_to_sheet(barberStats.map(b => ({
      "Tên Thợ": b.name,
      "Số lịch HT": b.count,
      "Doanh thu": b.rev,
    })));

    // Sheet 3: Doanh thu theo Dịch vụ
    const ws3 = XLSX.utils.json_to_sheet(serviceStats.map(s => ({
      "Dịch vụ": s.name,
      "Số lịch HT": s.count,
      "Doanh thu": s.rev,
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Tổng quan");
    XLSX.utils.book_append_sheet(wb, ws2, "Theo Thợ");
    XLSX.utils.book_append_sheet(wb, ws3, "Theo Dịch vụ");

    XLSX.writeFile(wb, `Bao_cao_doanh_thu_${from || "all"}_to_${to || "all"}.xlsx`);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-page)' }}>
      <header style={{ backgroundColor: 'var(--color-navbar-bg)' }} className="px-4 py-4 text-white shadow">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white/80">
              manager-web · Doanh thu &amp; báo cáo chi nhánh
            </p>
            <p className="text-lg font-bold">
              {user?.full_name ?? user?.email ?? "—"}
            </p>
            <ManagerDashboardNav />
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="btn btn-secondary-light"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {error && (
          <p
            className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        {branches.length > 0 && selectedBranchId != null && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <span className="text-sm font-semibold text-bb-navy">
                Chi nhánh
              </span>
              {canSwitchBranch ? (
                <select
                  className="max-w-md rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium"
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
                      {b.name?.trim() ? b.name : `Chi nhánh #${b.id}`}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="max-w-md rounded-lg bg-bb-input/60 px-3 py-2 text-sm font-medium text-bb-navy">
                  {branches.find((b) => b.id === selectedBranchId)?.name?.trim() ||
                    `Chi nhánh #${selectedBranchId}`}
                </p>
              )}
            </div>
          </section>
        )}

        {branchesLoaded && branches.length === 0 && uid && !error && (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Chưa có chi nhánh gắn tài khoản (Manager cần{" "}
            <code className="rounded bg-white px-1">users.branch_id</code>).
          </p>
        )}

        {selectedBranchId != null && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-bb-navy">Khoảng thời gian</h2>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-gray-600">Từ ngày</span>
                <input
                  type="date"
                  className="rounded-lg border border-gray-200 px-3 py-2"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-600">Đến ngày</span>
                <input
                  type="date"
                  className="rounded-lg border border-gray-200 px-3 py-2"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => void onApplyRange()}
                disabled={loadingStats}
                className="rounded-xl bg-bb-yellow px-5 py-2.5 text-sm font-bold text-black/80 disabled:opacity-50"
              >
                {loadingStats ? "Đang tải…" : "Áp dụng"}
              </button>
            </div>
          </section>
        )}

        {loadingStats && !stats && (
          <p className="text-center text-gray-600">Đang tải thống kê…</p>
        )}

        {stats && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-600">Doanh thu (lịch đã hoàn thành)</p>
                <p className="mt-1 text-2xl font-bold text-bb-navy">
                  {fmtMoney(completedRevenue)}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Chi nhánh #{stats.branch_id} · {stats.from} → {stats.to}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-600">Doanh thu từ shop</p>
                <p className="mt-1 text-2xl font-bold text-bb-navy">
                  {fmtMoney(stats.summary.revenue_shop ?? 0)}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Đơn đã giao / hoàn thành (delivered + hoàn thành) trong kỳ
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-600">Số lịch hẹn (trong kỳ)</p>
                <p className="mt-1 text-2xl font-bold text-bb-navy">
                  {stats.summary.appointment_count}
                </p>
              </div>
            </div>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-bb-navy">
                Lịch hẹn theo trạng thái
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600">
                      <th className="py-2 pr-2">Trạng thái</th>
                      <th className="py-2">Số lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {APPOINTMENT_STATUS_ORDER.map((status) => {
                      const row = stats.appointments_by_status?.find(
                        (r) => r.status === status,
                      );
                      const cnt = row ? Number(row.cnt) : 0;
                      return (
                        <tr key={status} className="border-b border-gray-100">
                          <td className="py-2 pr-2">
                            {APPOINTMENT_STATUS_LABELS[status] ?? status}
                          </td>
                          <td className="py-2">{cnt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-bb-navy">
                  Theo ngày (lịch hẹn &amp; đơn shop)
                </h3>
                {stats.shop_orders_scope === "global" && (
                  <span className="text-xs text-amber-800">
                    Đơn shop: toàn hệ thống (DB chưa có{" "}
                    <code className="rounded bg-amber-100 px-1">branch_id</code>)
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600">
                      <th className="py-2 pr-2">Ngày</th>
                      <th className="py-2 pr-2">Lịch hẹn</th>
                      <th className="py-2 pr-2">Doanh thu dịch vụ (đã HT)</th>
                      <th className="py-2 pr-2">Đơn shop</th>
                      <th className="py-2">Doanh thu shop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-gray-500">
                          Không có dữ liệu trong kỳ.
                        </td>
                      </tr>
                    ) : (
                      mergedRows.map((row) => (
                        <tr key={row.d} className="border-b border-gray-100">
                          <td className="py-2 pr-2 font-mono text-xs">{row.d}</td>
                          <td className="py-2 pr-2">{row.appt}</td>
                          <td className="py-2 pr-2">{fmtMoney(row.revAppt)}</td>
                          <td className="py-2 pr-2">{row.ord}</td>
                          <td className="py-2">{fmtMoney(row.revShop)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-bold text-bb-navy">Thống kê theo Thợ (lịch đã hoàn thành)</h3>
                <button type="button" onClick={exportExcel} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-green-700">
                  Xuất Excel (Tất cả bảng)
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600">
                      <th className="py-2 pr-2">Thợ</th>
                      <th className="py-2 pr-2">Số lịch HT</th>
                      <th className="py-2">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {barberStats.length === 0 ? (
                      <tr><td colSpan={3} className="py-4 text-center text-gray-500">Không có dữ liệu.</td></tr>
                    ) : (
                      barberStats.map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="py-2 pr-2 font-medium">{row.name}</td>
                          <td className="py-2 pr-2">{row.count}</td>
                          <td className="py-2 font-bold text-bb-navy">{fmtMoney(row.rev)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-base font-bold text-bb-navy">Thống kê theo Dịch vụ (lịch đã hoàn thành)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600">
                      <th className="py-2 pr-2">Dịch vụ</th>
                      <th className="py-2 pr-2">Số lịch HT</th>
                      <th className="py-2">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceStats.length === 0 ? (
                      <tr><td colSpan={3} className="py-4 text-center text-gray-500">Không có dữ liệu.</td></tr>
                    ) : (
                      serviceStats.map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="py-2 pr-2 font-medium">{row.name}</td>
                          <td className="py-2 pr-2">{row.count}</td>
                          <td className="py-2 font-bold text-bb-navy">{fmtMoney(row.rev)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
