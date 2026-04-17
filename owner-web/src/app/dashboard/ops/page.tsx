"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, type StaffUser } from "@/lib/api";
import {
  fetchManagerAppointments,
  fetchManagerBranchList,
  type ManagerBranchRow,
} from "@/lib/managerApi";

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

  async function logout() {
    await signOut(auth);
    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-bb-surface">
      <header className="bg-bb-navy px-4 py-4 text-white shadow">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white/80">Owner · Quản lý chi nhánh</p>
            <p className="text-lg font-bold">
              {user?.full_name ?? user?.email ?? "Owner"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25"
          >
            Đăng xuất
          </button>
        </div>
      </header>

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
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{appointmentSummary.today}</div>
              <div className="text-sm text-blue-800">Hôm nay</div>
            </div>
            <div className="rounded-lg bg-yellow-50 p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{appointmentSummary.pending}</div>
              <div className="text-sm text-yellow-800">Đang chờ</div>
            </div>
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{appointmentSummary.completed}</div>
              <div className="text-sm text-green-800">Hoàn thành</div>
            </div>
            <div className="rounded-lg bg-red-50 p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{appointmentSummary.cancelled}</div>
              <div className="text-sm text-red-800">Đã huỷ</div>
            </div>
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
