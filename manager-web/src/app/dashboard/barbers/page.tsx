"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, type StaffUser } from "@/lib/api";
import { ManagerDashboardNav } from "@/components/ManagerDashboardNav";
import {
  fetchManagerBarbers,
  fetchManagerBranchList,
  patchManagerBarberAvailability,
  type BarberOption,
  type ManagerBranchRow,
} from "@/lib/managerApi";

const BRANCH_STORAGE_KEY = "manager-web-branch-id";

export default function ManagerBarbersPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [user, setUser] = useState<StaffUser | null>(null);
  const [branches, setBranches] = useState<ManagerBranchRow[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingBarber, setSavingBarber] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBarbers = useCallback(async (firebaseUid: string, branchId: number) => {
    try {
      setError(null);
      const barberRows = await fetchManagerBarbers(firebaseUid, branchId);
      setBarbers(barberRows);
    } catch (e) {
      setBarbers([]);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    const storedUid = localStorage.getItem("bb_firebase_uid");
    if (!storedUid) {
      router.replace("/");
      return;
    }

    let active = true;
    (async () => {
      try {
        const row = await fetchUserByFirebaseUid(storedUid);
        if (!active) return;
        if (row.role !== "manager" && row.role !== "owner") {
          localStorage.removeItem("bb_firebase_uid");
          localStorage.removeItem("bb_firebase_token");
          router.replace("/");
          return;
        }
        if (row.is_locked === 1 || row.is_locked === true) {
          setError("Tài khoản đã bị khóa.");
          setLoading(false);
          return;
        }

        setUser(row);
        setUid(storedUid);

        const branchList = await fetchManagerBranchList(storedUid);
        if (!active) return;
        setBranches(branchList);

        if (branchList.length > 0) {
          const saved = Number(localStorage.getItem(BRANCH_STORAGE_KEY));
          const initialBranch = branchList.some((b) => b.id === saved)
            ? saved
            : branchList[0].id;
          setSelectedBranchId(initialBranch);
          await loadBarbers(storedUid, initialBranch);
        } else {
          setSelectedBranchId(null);
          setBarbers([]);
        }
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [router, loadBarbers]);

  useEffect(() => {
    if (!uid || selectedBranchId == null) return;
    let active = true;
    (async () => {
      try {
        await loadBarbers(uid, selectedBranchId);
      } catch {
        /* ignored: error already handled in loadBarbers */
      }
    })();
    return () => {
      active = false;
    };
  }, [uid, selectedBranchId, loadBarbers]);

  const handleBranchChange = (branchId: number) => {
    setSelectedBranchId(branchId);
    try {
      localStorage.setItem(BRANCH_STORAGE_KEY, String(branchId));
    } catch {
      /* ignore */
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // continue anyway
    }
    localStorage.removeItem("bb_firebase_uid");
    localStorage.removeItem("bb_firebase_token");
    router.replace("/");
  };

  const toggleBarberStatus = async (barber: BarberOption) => {
    if (!uid || !selectedBranchId) return;
    setSavingBarber(barber.barber_id);
    setError(null);
    try {
      const updated = await patchManagerBarberAvailability(
        uid,
        barber.barber_id,
        barber.status !== "available",
        selectedBranchId,
      );
      setBarbers((prev) => prev.map((item) => (item.barber_id === updated.barber_id ? updated : item)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingBarber(null);
    }
  };

  const statusCounts = useMemo(
    () =>
      barbers.reduce(
        (acc, barber) => {
          if (barber.status === "available") acc.available += 1;
          else if (barber.status === "off") acc.off += 1;
          else acc.other += 1;
          return acc;
        },
        { available: 0, off: 0, other: 0 },
      ),
    [barbers],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-900">
        <div className="h-10 w-10 animate-pulse rounded-full bg-slate-300" />
        <p className="font-medium">Đang tải…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-slate-900/95 text-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm text-slate-300">manager-web · Quản lý chi nhánh</p>
            <p className="text-lg font-bold">{user?.full_name ?? user?.email ?? "Quản lý"}</p>
            <ManagerDashboardNav />
            {branches.length > 0 && selectedBranchId != null && (
              <div className="mt-3 text-sm">
                <span className="mb-1 block text-slate-400">Chi nhánh</span>
                {branches.length > 1 ? (
                  <select
                    className="max-w-[min(100%,22rem)] rounded-lg border border-slate-700 bg-white px-3 py-2 text-slate-900"
                    value={selectedBranchId}
                    onChange={(e) => handleBranchChange(Number(e.target.value))}
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name ?? `#${branch.id}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="max-w-[min(100%,22rem)] rounded-lg bg-slate-800 px-3 py-2 text-slate-100">
                    {branches.find((b) => b.id === selectedBranchId)?.name || `Chi nhánh #${selectedBranchId}`}
                  </p>
                )}
              </div>
            )}
          </div>

          <button type="button" onClick={handleLogout} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">Quản lý thợ</p>
              <h1 className="text-2xl font-bold text-slate-900">Danh sách thợ</h1>
            </div>
            <div className="text-sm text-slate-500">
              {selectedBranchId == null
                ? "Chưa chọn chi nhánh"
                : `${barbers.length} thợ trong chi nhánh`}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Tổng thợ</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{barbers.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Đang làm</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-700">{statusCounts.available}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Đang nghỉ</p>
              <p className="mt-2 text-3xl font-semibold text-amber-700">{statusCounts.off}</p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-3 pr-4">Thợ</th>
                  <th className="py-3 pr-4">Tình trạng</th>
                  <th className="py-3 pr-4">Trạng thái</th>
                  <th className="py-3 pr-4">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {barbers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      Không tìm thấy thợ trong chi nhánh này.
                    </td>
                  </tr>
                ) : (
                  barbers.map((barber) => (
                    <tr key={barber.barber_id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        {barber.full_name ?? `#${barber.barber_id}`}
                      </td>
                      <td className="py-3 pr-4">
                        {barber.is_available === 1 || barber.status === "available" ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                            Đang làm
                          </span>
                        ) : barber.status === "off" ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                            Nghỉ
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                            {barber.status ?? "Không rõ"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {barber.status ?? "—"}
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          disabled={savingBarber === barber.barber_id}
                          onClick={() => void toggleBarberStatus(barber)}
                          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {barber.status === "available" ? "Đặt nghỉ" : "Đặt làm"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
