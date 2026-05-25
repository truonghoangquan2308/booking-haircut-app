"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, UserCheck, UserX, Calendar } from "lucide-react";
import { Button, StatCard } from "@/components/DesignSystemComponents";
import { ReceptionistShell } from "@/components/ReceptionistShell";
import PageHeader from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useReceptionistSession } from "@/hooks/useReceptionistSession";
import {
  fetchManagerAppointments,
  fetchManagerBarbers,
  patchManagerBarberAvailability,
  type BarberOption,
  type ManagerAppointmentRow,
} from "@/lib/managerApi";

export default function ReceptionistBarbersPage() {
  const {
    user,
    uid,
    branches,
    selectedBranchId,
    loading,
    error,
    setError,
    onBranchChange,
    logout,
  } = useReceptionistSession();
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [appointments, setAppointments] = useState<ManagerAppointmentRow[]>([]);

  const load = useCallback(async () => {
    if (!uid || !selectedBranchId) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      const [barberRows, apptRows] = await Promise.all([
        fetchManagerBarbers(uid, selectedBranchId),
        fetchManagerAppointments(uid, { from: today, to: today }, selectedBranchId),
      ]);
      setBarbers(barberRows);
      setAppointments(apptRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [uid, selectedBranchId, setError]);

  useEffect(() => {
    void load();
  }, [load]);

  const statsByBarber = useMemo(() => {
    const map = new Map<number, { total: number; completed: number; cancelled: number }>();
    for (const appt of appointments) {
      const item = map.get(appt.barber_id) ?? { total: 0, completed: 0, cancelled: 0 };
      item.total += 1;
      if (appt.status === "completed" || appt.status === 'paid_and_done') item.completed += 1;
      if (appt.status === "cancelled") item.cancelled += 1;
      map.set(appt.barber_id, item);
    }
    return map;
  }, [appointments]);

  const statusCounts = useMemo(() => {
    return barbers.reduce(
      (acc, barber) => {
        const status = barber.status;
        if (status === "available") acc.available += 1;
        else if (status === "off") acc.off += 1;
        else acc.other += 1;
        return acc;
      },
      { available: 0, off: 0, other: 0 },
    );
  }, [barbers]);

  async function toggleBarberStatus(barber: BarberOption) {
    if (!uid || !selectedBranchId) return;
    const isAvailable = barber.status !== "available";
    try {
      const updated = await patchManagerBarberAvailability(
        uid,
        barber.barber_id,
        isAvailable,
        selectedBranchId,
      );
      setBarbers((prev) => prev.map((item) => (item.barber_id === updated.barber_id ? updated : item)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-gray-600">Đang tải dữ liệu...</div>;
  }

  return (
    <ReceptionistShell
      user={user}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onBranchChange={onBranchChange}
      onLogout={() => void logout()}
    >
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <PageHeader title="Quản lý thợ" subtitle="Theo dõi năng suất thợ hôm nay" />

        <div className="stat-grid">
          <StatCard icon={<Users size={20} />} label="Tổng số thợ" value={barbers.length} />
          <StatCard icon={<UserCheck size={20} />} label="Đang làm" value={statusCounts.available} />
          <StatCard icon={<UserX size={20} />} label="Đang nghỉ" value={statusCounts.off} />
          <StatCard icon={<Calendar size={20} />} label="Lịch trong ngày" value={appointments.length} />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-600">
              <tr>
                <th className="py-2 pr-2">Thợ</th>
                <th className="py-2 pr-2">Trạng thái</th>
                <th className="py-2 pr-2">Tổng lịch hôm nay</th>
                <th className="py-2 pr-2">Hoàn thành</th>
                <th className="py-2 pr-2">Đã hủy</th>
                <th className="py-2">Tỉ lệ hoàn thành</th>
                <th className="py-2">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {barbers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">
                    Chưa có dữ liệu thợ.
                  </td>
                </tr>
              ) : (
                barbers.map((b) => {
                  const st = statsByBarber.get(b.barber_id) ?? { total: 0, completed: 0, cancelled: 0 };
                  const completionRate = st.total ? Math.round((st.completed / st.total) * 100) : 0;
                  return (
                    <tr key={b.barber_id} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-medium">{b.full_name ?? `Thợ #${b.barber_id}`}</td>
                      <td className="py-2 pr-2">
                        {b.status === 'available' ? (
                          <StatusBadge status="Hoàn thành" />
                        ) : b.status === 'off' ? (
                          <StatusBadge status="Chờ xác nhận" />
                        ) : (
                          <StatusBadge status={b.status || 'Không rõ'} />
                        )}
                      </td>
                      <td className="py-2 pr-2">{st.total}</td>
                      <td className="py-2 pr-2 text-green-700">{st.completed}</td>
                      <td className="py-2 pr-2 text-red-600">{st.cancelled}</td>
                      <td className="py-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {completionRate}%
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          type="button"
                          onClick={() => void toggleBarberStatus(b)}
                          variant={b.status === "available" ? "danger" : "primary"}
                          className="px-3 py-1 text-xs"
                        >
                          {b.status === 'available' ? 'Đặt nghỉ' : 'Đặt làm'}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </ReceptionistShell>
  );
}
