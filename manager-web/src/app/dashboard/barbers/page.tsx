"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { Button, StatCard } from "@/components/DesignSystemComponents";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Users, UserCheck, UserX } from "lucide-react";
import {
  fetchManagerBarbers,
  fetchManagerBranchList,
  patchManagerBarberAvailability,
  type BarberOption,
} from "@/lib/managerApi";

const BRANCH_STORAGE_KEY = "manager-web-branch-id";

export default function ManagerBarbersPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
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
          setError("TÃ i khoáº£n đÃ£ bá»‹ khÃ³a.");
          setLoading(false);
          return;
        }

        setUid(storedUid);

        const branchList = await fetchManagerBranchList(storedUid);
        if (!active) return;

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
    (async () => {
      try {
        await loadBarbers(uid, selectedBranchId);
      } catch {
        /* ignored: error already handled in loadBarbers */
      }
    })();
  }, [uid, selectedBranchId, loadBarbers]);

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
        <p className="font-medium">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar onLogout={handleLogout} />
      <PageHeader
        title="Quản lý Thợ"
        subtitle="Danh sách Thợ và Trạng thái"
      />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">Quản lý Thợ</p>
              <h1 className="text-2xl font-bold text-slate-900">Danh sách Thợ</h1>
            </div>
            <div className="text-sm text-slate-500">
              {selectedBranchId == null
                ? "Chưa chọn Chi nhánh"
                : `${barbers.length} Thợ trong Chi nhánh`}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <StatCard label="Tổng Thợ" value={barbers.length} icon={<Users className="h-5 w-5" />} />
            <StatCard label="Đang làm" value={statusCounts.available} icon={<UserCheck className="h-5 w-5" />} />
            <StatCard label="Đang nghỉ" value={statusCounts.off} icon={<UserX className="h-5 w-5" />} />
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
                      Không tìm thấy Thợ trong Chi nhánh này.
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
                          <StatusBadge status="Hoàn thành" />
                        ) : barber.status === "off" ? (
                          <StatusBadge status="Chờ xác nhận" />
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                            {barber.status ?? "Không rõ"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {barber.status ?? "_”"}
                      </td>
                      <td className="py-3">
                        <Button type="button" variant="secondary" size="sm" disabled={savingBarber === barber.barber_id} onClick={() => void toggleBarberStatus(barber)}>
                          {barber.status === "available" ? "Đặt nghỉ" : "Đặt làm"}
                        </Button>
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

