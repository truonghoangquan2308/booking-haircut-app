"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Table, ToastContainer, useToast } from "@/components/DesignSystemComponents";
import {
  deleteSchedule,
  fetchManagerBarbers,
  fetchSchedules,
  upsertSchedule,
  type BarberOption,
  type WorkingScheduleRow,
} from "@/lib/managerApi";

type WorkingScheduleManagementProps = {
  uid: string;
  branchId: number;
};

type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0-CN, 1-T2 ... 6-T7

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function WorkingScheduleManagement({ uid, branchId }: WorkingScheduleManagementProps) {
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [schedules, setSchedules] = useState<WorkingScheduleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [scheduleBarber, setScheduleBarber] = useState<number>(0);
  const [workDate, setWorkDate] = useState("");
  const [startT, setStartT] = useState("09:00");
  const [endT, setEndT] = useState("18:00");
  const [dayOff, setDayOff] = useState(false);

  const [saving, setSaving] = useState(false);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [selectedWeekDays, setSelectedWeekDays] = useState<WeekDay[]>([]);

  const { toasts, show, remove } = useToast();

  async function reload() {
    const [b, s] = await Promise.all([
      fetchManagerBarbers(uid, branchId),
      fetchSchedules(uid, {}, branchId),
    ]);
    setBarbers(b);
    setSchedules(s);
    if (b.length && scheduleBarber === 0) {
      setScheduleBarber(b[0].barber_id);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        await reload();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, branchId]);

  const barberNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const b of barbers) m.set(b.barber_id, b.full_name ?? `#${b.barber_id}`);
    return m;
  }, [barbers]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!uid || !branchId || !scheduleBarber || !workDate) return;
    setSaving(true);
    setError(null);
    try {
      const bodyBase = {
        barber_id: scheduleBarber,
        start_time: `${startT}:00`.slice(0, 8),
        end_time: `${endT}:00`.slice(0, 8),
        is_day_off: dayOff ? 1 : 0,
      };

      const promises: Array<Promise<void>> = [];

      if (repeatWeekly && selectedWeekDays.length > 0) {
        const base = new Date(workDate);
        const baseWd = base.getDay() as WeekDay;
        for (const wd of selectedWeekDays) {
          const diff = wd - baseWd;
          const target = new Date(base);
          target.setDate(base.getDate() + diff);
          promises.push(
            upsertSchedule(
              uid,
              { ...bodyBase, work_date: toYmd(target) },
              branchId,
            ),
          );
        }
      } else {
        promises.push(upsertSchedule(uid, { ...bodyBase, work_date: workDate }, branchId));
      }

      await Promise.all(promises);
      show(`Đã lưu ${promises.length} ngày thành công.`, "success");
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      show(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Xóa dòng lịch này?")) return;
    setError(null);
    try {
      await deleteSchedule(uid, id, branchId);
      show("Đã xóa lịch.", "success");
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      show(msg, "error");
    }
  }

  const headers = ["Thợ", "Ngày", "Giờ", "Nghỉ", ""];
  const rows = schedules.map((s) => [
    barberNameById.get(s.barber_id) ?? `#${s.barber_id}`,
    String(s.work_date),
    `${String(s.start_time).slice(0, 5)} – ${String(s.end_time).slice(0, 5)}`,
    s.is_day_off ? "Có" : "Không",
    <Button
      key={`del-${s.id}`}
      type="button"
      variant="danger"
      size="sm"
      onClick={(ev) => {
        ev.stopPropagation();
        void onDelete(s.id);
      }}
    >
      Xóa
    </Button>,
  ]);

  return (
    <>
      <Card
        title="Quản lý ca làm"
        description="Lịch làm việc của thợ (thêm / sửa theo thợ + ngày)."
      >
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={(e) => void onSave(e)} className="mb-5 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">Thợ</span>
            <select
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
              value={scheduleBarber || ""}
              onChange={(e) => setScheduleBarber(Number(e.target.value) || 0)}
              disabled={loading}
            >
              {barbers.length === 0 ? (
                <option value="">—</option>
              ) : (
                barbers.map((b) => (
                  <option key={b.barber_id} value={b.barber_id}>
                    #{b.barber_id} {b.full_name ?? ""}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">Ngày</span>
            <input
              type="date"
              required
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              disabled={loading}
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">Bắt đầu</span>
            <input
              type="time"
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
              value={startT}
              onChange={(e) => setStartT(e.target.value)}
              disabled={loading}
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">Kết thúc</span>
            <input
              type="time"
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
              value={endT}
              onChange={(e) => setEndT(e.target.value)}
              disabled={loading}
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input type="checkbox" checked={dayOff} onChange={(e) => setDayOff(e.target.checked)} />
            Nghỉ cả ngày
          </label>

          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={repeatWeekly}
              onChange={(e) => setRepeatWeekly(e.target.checked)}
            />
            Lặp lại trong tuần
          </label>

          <Button type="submit" variant="primary" isLoading={saving} disabled={!scheduleBarber}>
            Lưu lịch
          </Button>

          {repeatWeekly && (
            <div className="w-full pt-2">
              <div className="flex flex-wrap gap-2">
                {([
                  { val: 1, label: "T2" },
                  { val: 2, label: "T3" },
                  { val: 3, label: "T4" },
                  { val: 4, label: "T5" },
                  { val: 5, label: "T6" },
                  { val: 6, label: "T7" },
                  { val: 0, label: "CN" },
                ] as const).map((wd) => (
                  <label
                    key={wd.val}
                    className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedWeekDays.includes(wd.val)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedWeekDays((prev) => [...prev, wd.val]);
                        } else {
                          setSelectedWeekDays((prev) => prev.filter((d) => d !== wd.val));
                        }
                      }}
                    />
                    {wd.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>

        <Table
          headers={headers}
          rows={rows}
          loading={loading}
          empty={rows.length === 0}
          emptyMessage="Chưa có lịch."
        />
      </Card>
      <ToastContainer toasts={toasts} onRemove={remove} />
    </>
  );
}

