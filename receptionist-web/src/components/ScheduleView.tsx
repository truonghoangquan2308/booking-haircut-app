"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, StatCard, ToastContainer, useToast } from "@/components/DesignSystemComponents";
import { Users, DollarSign, UserCheck, Calendar } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";
import {
  createAppointmentOnBehalf,
  fetchBarberTimeSlots,
  fetchManagerAppointments,
  fetchManagerBarbers,
  fetchManagerServices,
  patchAppointmentStatus,
  type BarberOption,
  type ManagerAppointmentRow,
  type ServiceOption,
} from "@/lib/managerApi";

type ScheduleViewProps = {
  uid: string;
  branchId: number;
  onPay?: (appointmentId: number) => void;
};

const APPOINTMENT_STATUSES = [
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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function timeHm(t: unknown) {
  const s = String(t ?? "");
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function money(v: string | number) {
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";
}

function inTimeRange(start: string, from: string, to: string) {
  const s = timeHm(start);
  if (from && s < from) return false;
  if (to && s > to) return false;
  return true;
}

export function ScheduleView({ uid, branchId, onPay }: ScheduleViewProps) {
  const today = useMemo(() => ymd(new Date()), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyApptId, setBusyApptId] = useState<number | null>(null);

  const [appointments, setAppointments] = useState<ManagerAppointmentRow[]>([]);
  const [pendingConfirmations, setPendingConfirmations] = useState<ManagerAppointmentRow[]>([]);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);

  // Filters
  const [status, setStatus] = useState<string>("");
  const [barberId, setBarberId] = useState<number>(0);
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"book" | "walkin">("book");
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cServiceId, setCServiceId] = useState<number>(0);
  const [cBarberId, setCBarberId] = useState<number>(0);
  const [cDate, setCDate] = useState(today);
  const [cSlotId, setCSlotId] = useState<number>(0);
  const [cNote, setCNote] = useState("");
  const [slots, setSlots] = useState<Array<{ id: number; start_time: string; end_time: string; is_booked: number }>>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const { toasts, show, remove } = useToast();

  const barberNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const b of barbers) m.set(b.barber_id, b.full_name ?? `#${b.barber_id}`);
    return m;
  }, [barbers]);

  const serviceById = useMemo(() => {
    const m = new Map<number, ServiceOption>();
    for (const s of services) m.set(s.id, s);
    return m;
  }, [services]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appt, b, s] = await Promise.all([
        fetchManagerAppointments(
          uid,
          {
            from: today,
            to: today,
            status: status || undefined,
            barber_id: barberId || undefined,
          },
          branchId,
        ),
        fetchManagerBarbers(uid, branchId),
        fetchManagerServices(),
      ]);
      setAppointments(appt);
      setBarbers(b);
      setServices(s);
      if (b.length && cBarberId === 0) setCBarberId(b[0].barber_id);
      if (s.length && cServiceId === 0) setCServiceId(s[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [uid, branchId, today, status, barberId, cBarberId, cServiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const rows = appointments
      .filter((a) => inTimeRange(String(a.start_time), fromTime, toTime))
      .sort((a, b) => `${a.start_time}`.localeCompare(`${b.start_time}`));
    return rows;
  }, [appointments, fromTime, toTime]);

  // Pagination for large appointment lists to avoid rendering too many rows at once
  const [pageSize] = useState(() => 50);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const revenue = filtered.reduce((sum, a) => {
      if (a.status !== "completed" && a.status !== 'paid_and_done') return sum;
      return sum + (Number(a.total_price) || 0);
    }, 0);
    const waiting = filtered.filter((a) => a.status === "pending" || a.status === "confirmed").length;
    const nowHm = `${pad2(new Date().getHours())}:${pad2(new Date().getMinutes())}`;
    const upcoming = filtered.filter((a) => {
      if (a.status === "cancelled" || a.status === "completed" || a.status === 'paid_and_done') return false;
      return timeHm(a.start_time) >= nowHm;
    }).length;
    return { total, revenue, waiting, upcoming };
  }, [filtered]);

  async function onUpdateStatus(id: number, next: string) {
    setBusyApptId(id);
    setError(null);
    try {
      await patchAppointmentStatus(uid, id, next, branchId);
      show("Đã cập nhật trạng thái.", "success");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      show(msg, "error");
    } finally {
      setBusyApptId(null);
    }
  }

  const loadSlots = useCallback(async () => {
    if (!cBarberId || !cDate) return;
    setSlotsLoading(true);
    try {
      const list = await fetchBarberTimeSlots(cBarberId, cDate);
      setSlots(list);
      const first = list.find((x) => Number(x.is_booked) !== 1);
      setCSlotId(first ? first.id : 0);
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "error");
      setSlots([]);
      setCSlotId(0);
    } finally {
      setSlotsLoading(false);
    }
  }, [cBarberId, cDate, show]);

  useEffect(() => {
    if (!createOpen) return;
    void loadSlots();
  }, [createOpen, loadSlots]);

  // Poll for technician-completed appointments (waiting confirmation)
  useEffect(() => {
    let mounted = true;
    let timer: number | null = null;
    async function fetchPending() {
      try {
        const list = await fetchManagerAppointments(uid, { from: today, to: today, status: 'technician_completed' }, branchId);
        if (!mounted) return;
        setPendingConfirmations(list);
      } catch {
        // ignore polling errors
      }
    }
    void fetchPending();
    timer = window.setInterval(() => {
      void fetchPending();
    }, 5000);
    return () => { mounted = false; if (timer) clearInterval(timer); };
  }, [uid, branchId, today]);

  async function onCreate() {
    if (!cPhone.trim()) {
      show("Nhập SĐT khách.", "warning");
      return;
    }
    if (!cServiceId || !cBarberId || !cSlotId || !cDate) {
      show("Chọn đủ dịch vụ / thợ / giờ.", "warning");
      return;
    }
    const svc = serviceById.get(cServiceId);
    const price = Number(svc?.price ?? 0) || 0;
    const slot = slots.find((x) => x.id === cSlotId);
    if (!slot) {
      show("Khung giờ không hợp lệ.", "error");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await createAppointmentOnBehalf(
        uid,
        {
          customer_phone: cPhone.trim(),
          customer_name: cName.trim() || undefined,
          barber_id: cBarberId,
          service_id: cServiceId,
          time_slot_id: cSlotId,
          appt_date: cDate,
          start_time: String(slot.start_time).slice(0, 8),
          end_time: String(slot.end_time).slice(0, 8),
          total_price: price,
          note: cNote.trim() || undefined,
        },
        branchId,
      );
      show(`Đã tạo lịch #${res.appointment_id}.`, "success");
      setCreateOpen(false);
      setCNote("");
      setCName("");
      setCPhone("");
      await load();
      if (createMode === "walkin" && onPay) {
        onPay(res.appointment_id);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      show(msg, "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <PageHeader title="Quản lý tại quầy" subtitle="Danh sách lịch hẹn hôm nay" />

        <div className="stat-grid">
          <StatCard icon={<Users size={20} />} label="Số khách hôm nay" value={stats.total} />
          <StatCard icon={<DollarSign size={20} />} label="Doanh thu hôm nay" value={money(stats.revenue)} />
          <StatCard icon={<UserCheck size={20} />} label="Khách đang chờ" value={stats.waiting} />
          <StatCard icon={<Calendar size={20} />} label="Lịch sắp tới" value={stats.upcoming} />
        </div>

        {pendingConfirmations.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-amber-200 flex items-center justify-center font-semibold">
                  ⚠
                </div>
                <div>
                  <div className="font-semibold">Chờ xác nhận hoàn thành</div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {pendingConfirmations.length} đơn chờ xác nhận
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {pendingConfirmations.map((p) => (
                <div key={p.id} className="rounded-lg border border-amber-200 bg-amber-25 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{p.customer_name ?? '-'}</div>
                      <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {p.barber_name ?? `#${p.barber_id}`} · {p.service_name ?? `#${p.service_id}`}
                      </div>
                    </div>
                    <div className="text-sm font-mono">{timeHm(p.start_time)}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{money(p.total_price)}</div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        isLoading={busyApptId === p.id}
                        onClick={async () => {
                          setBusyApptId(p.id);
                          try {
                            // mark appointment as completed / awaiting payment then navigate to payment page
                            await patchAppointmentStatus(uid, p.id, 'completed', branchId);
                            show('Đã chuyển sang chờ thanh toán.', 'success');
                            // navigate to payment screen (parent handles navigation via onPay)
                            onPay?.(p.id);
                            // refresh list in background
                            await load();
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : String(e);
                            show(msg, 'error');
                          } finally {
                            setBusyApptId(null);
                          }
                        }}
                      >
                        Xác nhận & Thanh toán
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={async () => {
                          setBusyApptId(p.id);
                          try {
                            await patchAppointmentStatus(uid, p.id, 'in_progress', branchId);
                            show('Đã gửi lại thợ.', 'success');
                            await load();
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : String(e);
                            show(msg, 'error');
                          } finally {
                            setBusyApptId(null);
                          }
                        }}
                      >
                        Gửi lại thợ làm
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              Trạng thái
            </span>
            <select
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Tất cả</option>
              {APPOINTMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {APPOINTMENT_STATUS_LABELS[s] ?? s}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              Thợ
            </span>
            <select
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
              value={barberId}
              onChange={(e) => setBarberId(Number(e.target.value))}
            >
              <option value={0}>Tất cả</option>
              {barbers.map((b) => (
                <option key={b.barber_id} value={b.barber_id}>
                  {b.full_name ?? `#${b.barber_id}`}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              Giờ từ
            </span>
            <input
              type="time"
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
              value={fromTime}
              onChange={(e) => setFromTime(e.target.value)}
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              Giờ đến
            </span>
            <input
              type="time"
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
              value={toTime}
              onChange={(e) => setToTime(e.target.value)}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void load()} isLoading={loading}>
              Tải lại
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setCreateMode("walkin");
                setCDate(today);
                setCreateOpen(true);
              }}
            >
              Walk-in
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]" style={{ color: "var(--color-text-secondary)" }}>
                <th className="py-2 pr-2">Giờ hẹn</th>
                <th className="py-2 pr-2">Tên khách</th>
                <th className="py-2 pr-2">SĐT</th>
                <th className="py-2 pr-2">Dịch vụ</th>
                <th className="py-2 pr-2">Thợ phụ trách</th>
                <th className="py-2 pr-2">Trạng thái</th>
                <th className="py-2">Thao tác nhanh</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center" style={{ color: "var(--color-text-secondary)" }}>
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center" style={{ color: "var(--color-text-secondary)" }}>
                    Chưa có lịch hẹn hôm nay (hoặc không khớp bộ lọc).
                  </td>
                </tr>
              ) : (
                paginated.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--color-border)]/60">
                    <td className="py-2 pr-2 font-mono text-xs">
                      {timeHm(a.start_time)}–{timeHm(a.end_time)}
                    </td>
                    <td className="py-2 pr-2">
                      <div className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {a.customer_name ?? "-"}
                      </div>
                      {a.note ? (
                        <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                          {a.note}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2">{a.customer_phone ?? "—"}</td>
                    <td className="py-2 pr-2">{a.service_name ?? `#${a.service_id}`}</td>
                    <td className="py-2 pr-2">{a.barber_name ?? barberNameById.get(a.barber_id) ?? `#${a.barber_id}`}</td>
                    <td className="py-2 pr-2">
                      <StatusBadge status={APPOINTMENT_STATUS_LABELS[a.status] ?? a.status} />
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          disabled={busyApptId === a.id || a.status === "cancelled" || a.status === 'paid_and_done'}
                          onClick={() => void onUpdateStatus(a.id, "cancelled")}
                        >
                          Hủy
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setPage(Math.max(1, page - 1))}>
                Prev
              </Button>
              <div className="text-sm text-[var(--color-text-secondary)]">Trang {page} / {totalPages}</div>
              <Button type="button" variant="secondary" onClick={() => setPage(Math.min(totalPages, page + 1))}>
                Next
              </Button>
            </div>
          )}
        </div>
        </div>
      </section>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold" style={{ color: "var(--color-navbar-bg)" }}>
                  {createMode === "walkin" ? "Tạo Walk-in" : "Tạo lịch hẹn"}
                </h3>
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  Chọn dịch vụ, thợ, giờ và ghi chú khách.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm font-semibold"
                onClick={() => setCreateOpen(false)}
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
                  SĐT
                </span>
                <input
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
                  value={cPhone}
                  onChange={(e) => setCPhone(e.target.value)}
                  placeholder="VD: 09xxxxxxxx"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
                  Tên khách (tuỳ chọn)
                </span>
                <input
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
                  Ngày
                </span>
                <input
                  type="date"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
                  value={cDate}
                  onChange={(e) => setCDate(e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
                  Dịch vụ
                </span>
                <select
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
                  value={cServiceId}
                  onChange={(e) => setCServiceId(Number(e.target.value))}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.price != null ? `· ${money(s.price)}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
                  Thợ
                </span>
                <select
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
                  value={cBarberId}
                  onChange={(e) => {
                    setCBarberId(Number(e.target.value));
                    setCSlotId(0);
                    void loadSlots();
                  }}
                >
                  {barbers.map((b) => (
                    <option key={b.barber_id} value={b.barber_id}>
                      {b.full_name ?? `#${b.barber_id}`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
                  Giờ
                </span>
                <select
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
                  value={cSlotId}
                  onChange={(e) => setCSlotId(Number(e.target.value))}
                  disabled={slotsLoading}
                >
                  {slotsLoading ? (
                    <option value={0}>Đang tải khung giờ…</option>
                  ) : (
                    <>
                      {slots
                        .filter((x) => Number(x.is_booked) !== 1)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {timeHm(x.start_time)}–{timeHm(x.end_time)}
                          </option>
                        ))}
                    </>
                  )}
                </select>
              </label>

              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
                  Ghi chú khách
                </span>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
                  value={cNote}
                  onChange={(e) => setCNote(e.target.value)}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                Hủy
              </Button>
              <Button type="button" variant="primary" isLoading={creating} onClick={() => void onCreate()}>
                Tạo lịch
              </Button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={remove} />
    </>
  );
}
