"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ReceptionistShell } from "@/components/ReceptionistShell";
import PageHeader from "@/components/PageHeader";
import { useReceptionistSession } from "@/hooks/useReceptionistSession";
import {
  deleteSchedule,
  fetchManagerBarbers,
  fetchSchedules,
  upsertSchedule,
  type BarberOption,
  type WorkingScheduleRow,
} from "@/lib/managerApi";

export default function ReceptionistShiftsPage() {
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
  const [schedules, setSchedules] = useState<WorkingScheduleRow[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [barberId, setBarberId] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formBarberId, setFormBarberId] = useState<number>(0);
  const [formStart, setFormStart] = useState("09:00");
  const [formEnd, setFormEnd] = useState("18:00");
  const [isDayOff, setIsDayOff] = useState(false);

  const load = useCallback(async () => {
    if (!uid || !selectedBranchId) return;
    try {
      const [barberRows, scheduleRows] = await Promise.all([
        fetchManagerBarbers(uid, selectedBranchId),
        fetchSchedules(
          uid,
          {
            barber_id: barberId || undefined,
            from: from || undefined,
            to: to || undefined,
          },
          selectedBranchId,
        ),
      ]);
      setBarbers(barberRows);
      setSchedules(scheduleRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [uid, selectedBranchId, barberId, from, to, setError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!uid || !selectedBranchId || !formBarberId || !formDate) return;
    setBusy(true);
    setError(null);
    try {
      await upsertSchedule(
        uid,
        {
          barber_id: formBarberId,
          work_date: formDate,
          start_time: isDayOff ? "00:00:00" : `${formStart}:00`,
          end_time: isDayOff ? "00:00:00" : `${formEnd}:00`,
          is_day_off: isDayOff ? 1 : 0,
        },
        selectedBranchId,
      );
      await load();
      setFormDate("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteSchedule(id: number) {
    if (!uid || !selectedBranchId) return;
    if (!confirm("Bạn có chắc muốn xóa ca làm này?")) return;
    setBusy(true);
    try {
      await deleteSchedule(uid, id, selectedBranchId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    return [...schedules].sort((a, b) => `${a.work_date}${a.start_time}`.localeCompare(`${b.work_date}${b.start_time}`));
  }, [schedules]);

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
        <PageHeader title="Quản lý ca làm" subtitle="Phân ca cho thợ theo ngày" />

        <form onSubmit={onSubmit} className="mb-5 grid gap-3 rounded-xl bg-bb-input/40 p-4 md:grid-cols-5">
          <input type="date" required value={formDate} onChange={(e) => setFormDate(e.target.value)} />
          <select required value={formBarberId} onChange={(e) => setFormBarberId(Number(e.target.value))}>
            <option value={0}>-- Chọn thợ --</option>
            {barbers.map((b) => (
              <option key={b.barber_id} value={b.barber_id}>
                {b.full_name ?? `#${b.barber_id}`}
              </option>
            ))}
          </select>
          <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} disabled={isDayOff} />
          <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} disabled={isDayOff} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDayOff} onChange={(e) => setIsDayOff(e.target.checked)} />
            Nghỉ cả ngày
          </label>
          <button type="submit" disabled={busy} className="rounded-lg bg-bb-yellow px-3 py-2 text-sm font-bold text-black/80 md:col-span-5">
            {busy ? "Đang lưu..." : "Thêm / Cập nhật ca"}
          </button>
        </form>

        <div className="mb-4 grid gap-3 rounded-xl bg-bb-input/30 p-4 md:grid-cols-4">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <select value={barberId} onChange={(e) => setBarberId(Number(e.target.value))}>
            <option value={0}>Tất cả thợ</option>
            {barbers.map((b) => (
              <option key={b.barber_id} value={b.barber_id}>
                {b.full_name ?? `#${b.barber_id}`}
              </option>
            ))}
          </select>
          <button type="button" className="rounded-md px-3 py-2 text-sm text-white" style={{ backgroundColor: 'var(--brand-primary)' }} onClick={() => void load()}>
            Lọc
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-600">
              <tr>
                <th className="py-2 pr-2">Ngày</th>
                <th className="py-2 pr-2">Thợ</th>
                <th className="py-2 pr-2">Giờ làm</th>
                <th className="py-2 pr-2">Trạng thái</th>
                <th className="py-2">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {grouped.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    Chưa có ca làm.
                  </td>
                </tr>
              ) : (
                grouped.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="py-2 pr-2">{s.work_date}</td>
                    <td className="py-2 pr-2">{barbers.find((b) => b.barber_id === s.barber_id)?.full_name ?? `#${s.barber_id}`}</td>
                    <td className="py-2 pr-2">{s.is_day_off ? "—" : `${String(s.start_time).slice(0, 5)} - ${String(s.end_time).slice(0, 5)}`}</td>
                    <td className="py-2 pr-2">
                      <span className={`rounded-full px-2 py-1 text-xs ${s.is_day_off ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {s.is_day_off ? "Nghỉ" : "Làm việc"}
                      </span>
                    </td>
                    <td className="py-2">
                      <button type="button" onClick={() => void onDeleteSchedule(s.id)} className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </ReceptionistShell>
  );
}
