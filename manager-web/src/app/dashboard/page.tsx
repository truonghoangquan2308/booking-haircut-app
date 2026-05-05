"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, type StaffUser } from "@/lib/api";
import { ManagerDashboardNav } from "@/components/ManagerDashboardNav";
import {
  deleteSchedule,
  fetchManagerAppointments,
  fetchManagerBarbers,
  fetchManagerBranchList,
  fetchManagerOrders,
  fetchSchedules,
  patchAppointmentStatus,
  patchOrderStatus,
  upsertSchedule,
  fetchManagerServices,
  type BarberOption,
  type ManagerAppointmentRow,
  type ManagerBranchRow,
  type ShopOrderRow,
  type WorkingScheduleRow,
  type ServiceOption,
} from "@/lib/managerApi";

const BRANCH_STORAGE_KEY = "manager-web-branch-id";

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipping",
  "delivered",
  "completed",
  "cancelled",
] as const;

const ORDER_STATUS_LABELS: Record<(typeof ORDER_STATUSES)[number], string> = {
  pending: "Chờ xử lý",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  delivered: "Đã giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [orders, setOrders] = useState<ShopOrderRow[]>([]);
  const [schedules, setSchedules] = useState<WorkingScheduleRow[]>([]);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyOrder, setBusyOrder] = useState<number | null>(null);
  const [scheduleBarber, setScheduleBarber] = useState<number>(0);
  const [workDate, setWorkDate] = useState("");
  const [startT, setStartT] = useState("09:00");
  const [endT, setEndT] = useState("18:00");
  const [dayOff, setDayOff] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [appointments, setAppointments] = useState<ManagerAppointmentRow[]>(
    [],
  );
  const [apptFrom, setApptFrom] = useState("");
  const [apptTo, setApptTo] = useState("");
  const [apptStatus, setApptStatus] = useState("");
  const [apptBarberId, setApptBarberId] = useState<number>(0);
  const [apptServiceId, setApptServiceId] = useState<number>(0);
  const [busyAppt, setBusyAppt] = useState<number | null>(null);
  const [branches, setBranches] = useState<ManagerBranchRow[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [apptPage, setApptPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [selectedAppt, setSelectedAppt] = useState<ManagerAppointmentRow | null>(null);
  const [isRepeatWeekly, setIsRepeatWeekly] = useState(false);
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([]);
  const [toastMsg, setToastMsg] = useState("");

  const APPT_PAGE_SIZE = 20;
  const ORDER_PAGE_SIZE = 20;

  const loadMain = useCallback(async (firebaseUid: string, branchId?: number) => {
    setError(null);
    const errs: string[] = [];

    const [r1, r2, r3, r4] = await Promise.allSettled([
      fetchManagerOrders(firebaseUid, branchId),
      fetchSchedules(firebaseUid, {}, branchId),
      fetchManagerBarbers(firebaseUid, branchId),
      fetchManagerServices(),
    ]);

    if (r1.status === "fulfilled") {
      setOrders(r1.value);
    } else {
      setOrders([]);
      const msg =
        r1.reason instanceof Error ? r1.reason.message : String(r1.reason);
      errs.push(`Đơn shop: ${msg}`);
    }

    if (r2.status === "fulfilled") {
      setSchedules(r2.value);
    } else {
      setSchedules([]);
      const msg =
        r2.reason instanceof Error ? r2.reason.message : String(r2.reason);
      errs.push(`Lịch làm việc: ${msg}`);
    }

    if (r3.status === "fulfilled") {
      const b = r3.value;
      setBarbers(b);
      if (b.length) {
        setScheduleBarber((prev) => (prev === 0 ? b[0].barber_id : prev));
      }
    } else {
      setBarbers([]);
      const msg =
        r3.reason instanceof Error ? r3.reason.message : String(r3.reason);
      errs.push(`Thợ: ${msg}`);
    }

    if (r4.status === "fulfilled") {
      setServices(r4.value);
    } else {
      setServices([]);
    }

    if (errs.length) setError(errs.join(" · "));
  }, []);

  useEffect(() => {
    const storedUid = localStorage.getItem("bb_firebase_uid");

    if (!storedUid) {
      setBranchesLoaded(false);
      setBranches([]);
      setSelectedBranchId(null);
      router.replace("/");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const row = await fetchUserByFirebaseUid(storedUid);
        if (cancelled) return;

        if (row.role !== "manager" && row.role !== "owner") {
          localStorage.removeItem("bb_firebase_token");
          localStorage.removeItem("bb_firebase_uid");
          router.replace("/");
          return;
        }
        if (row.is_locked === 1 || row.is_locked === true) {
          setError("Tài khoản đã bị khóa.");
          return;
        }
        setUser(row);
        setUid(storedUid);

        let branchForApi: number | undefined;
        try {
          const list = await fetchManagerBranchList(storedUid);
          if (cancelled) return;
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
            branchForApi = pick;
            try {
              localStorage.setItem(BRANCH_STORAGE_KEY, String(pick));
            } catch {
              /* ignore */
            }
          } else {
            setSelectedBranchId(null);
          }
        } catch (e) {
          if (!cancelled) {
            setBranches([]);
            setSelectedBranchId(null);
            setError(e instanceof Error ? e.message : String(e));
          }
        } finally {
          if (!cancelled) setBranchesLoaded(true);
        }

        if (!cancelled) await loadMain(storedUid, branchForApi);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, loadMain]);

  useEffect(() => {
    if (!uid || !branchesLoaded) return;
    let cancelled = false;
    void (async () => {
      try {
        setApptPage(1); // Mặc định về trang 1 khi lọc
        const list = await fetchManagerAppointments(
          uid,
          {
            from: apptFrom || undefined,
            to: apptTo || undefined,
            status: apptStatus || undefined,
            barber_id: apptBarberId || undefined,
            service_id: apptServiceId || undefined,
          },
          selectedBranchId ?? undefined,
        );
        if (!cancelled) setAppointments(list);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setAppointments([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    uid,
    branchesLoaded,
    selectedBranchId,
    apptFrom,
    apptTo,
    apptStatus,
    apptBarberId,
    apptServiceId,
  ]);

  async function onAppointmentStatus(id: number, status: string) {
    if (!uid) return;
    setBusyAppt(id);
    setError(null);
    const branch = selectedBranchId ?? undefined;
    try {
      await patchAppointmentStatus(uid, id, status, branch);
      setAppointments(
        await fetchManagerAppointments(
          uid,
          {
            from: apptFrom || undefined,
            to: apptTo || undefined,
            status: apptStatus || undefined,
            barber_id: apptBarberId || undefined,
            service_id: apptServiceId || undefined,
          },
          branch,
        ),
      );
      if (selectedAppt && selectedAppt.id === id) {
        setSelectedAppt((prev) => prev ? { ...prev, status } : null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyAppt(null);
    }
  }

  async function onOrderStatus(id: number, status: string) {
    if (!uid) return;
    setBusyOrder(id);
    setError(null);
    const branch = selectedBranchId ?? undefined;
    try {
      await patchOrderStatus(uid, id, status, branch);
      setOrders(await fetchManagerOrders(uid, branch));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyOrder(null);
    }
  }

  async function reloadSchedules() {
    if (!uid) return;
    setSchedules(await fetchSchedules(uid, {}, selectedBranchId ?? undefined));
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!uid || !scheduleBarber || !workDate) return;
    setSavingSchedule(true);
    setError(null);
    try {
      const promises = [];
      if (isRepeatWeekly && selectedWeekDays.length > 0) {
        const baseDate = new Date(workDate);
        const dayOfWeek = baseDate.getDay(); // 0-CN, 1-T2
        for (const wd of selectedWeekDays) {
          const diff = wd - dayOfWeek;
          const target = new Date(baseDate);
          target.setDate(baseDate.getDate() + diff);
          const ymd = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
          promises.push(
            upsertSchedule(
              uid,
              {
                barber_id: scheduleBarber,
                work_date: ymd,
                start_time: `${startT}:00`.slice(0, 8),
                end_time: `${endT}:00`.slice(0, 8),
                is_day_off: dayOff ? 1 : 0,
              },
              selectedBranchId ?? undefined,
            )
          );
        }
      } else {
        promises.push(
          upsertSchedule(
            uid,
            {
              barber_id: scheduleBarber,
              work_date: workDate,
              start_time: `${startT}:00`.slice(0, 8),
              end_time: `${endT}:00`.slice(0, 8),
              is_day_off: dayOff ? 1 : 0,
            },
            selectedBranchId ?? undefined,
          )
        );
      }
      await Promise.all(promises);
      setToastMsg(`Đã lưu ${promises.length} ngày thành công.`);
      setTimeout(() => setToastMsg(""), 3000);
      await reloadSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingSchedule(false);
    }
  }

  async function removeSchedule(id: number) {
    if (!uid || !confirm("Xóa dòng lịch này?")) return;
    try {
      await deleteSchedule(uid, id, selectedBranchId ?? undefined);
      await reloadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function onBranchChange(nextId: number) {
    if (user?.role !== "owner") return;
    setSelectedBranchId(nextId);
    try {
      localStorage.setItem(BRANCH_STORAGE_KEY, String(nextId));
    } catch {
      /* ignore */
    }
    if (uid) void loadMain(uid, nextId);
  }

  const canSwitchBranch =
    user?.role === "owner" && branches.length > 1;

  async function logout() {
    await signOut(auth);
    localStorage.removeItem("bb_firebase_token");
    localStorage.removeItem("bb_firebase_uid");
    router.replace("/");
  }

  const totalApptPages = Math.max(1, Math.ceil(appointments.length / APPT_PAGE_SIZE));
  const currentAppointments = appointments.slice((apptPage - 1) * APPT_PAGE_SIZE, apptPage * APPT_PAGE_SIZE);

  const totalOrderPages = Math.max(1, Math.ceil(orders.length / ORDER_PAGE_SIZE));
  const currentOrders = orders.slice((orderPage - 1) * ORDER_PAGE_SIZE, orderPage * ORDER_PAGE_SIZE);

  return (
    <div style={{ backgroundColor: 'var(--color-bg-page)' }} className="min-h-screen">
      <header style={{ backgroundColor: 'var(--color-navbar-bg)' }} className="px-4 py-4 text-white shadow">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white/80">
              manager-web · Quản lý chi nhánh ·{" "}
              {user?.role === "owner" ? "Owner" : "Manager"}
            </p>
            <p className="text-lg font-bold">
              {user?.full_name ?? user?.email ?? "Staff"}
            </p>
            <ManagerDashboardNav />
            {branches.length > 0 && selectedBranchId != null && (
              <div className="mt-2 text-sm">
                <span className="mb-1 block text-white/80">Chi nhánh</span>
                {canSwitchBranch ? (
                  <label className="block">
                    <select
                      className="max-w-[min(100%,20rem)] rounded-lg border-0 bg-white px-3 py-2 text-[var(--color-navbar-bg)]"
                      value={selectedBranchId}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v) || v <= 0) return;
                        onBranchChange(v);
                      }}
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name?.trim() ? b.name : `#${b.id}`}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="max-w-[min(100%,20rem)] rounded-lg bg-white/10 px-3 py-2 text-white">
                    {branches.find((b) => b.id === selectedBranchId)?.name?.trim() ||
                      `Chi nhánh #${selectedBranchId}`}
                  </p>
                )}
              </div>
            )}
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

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
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
            Xem và cập nhật trạng thái đặt lịch tại chi nhánh (tối đa 300 bản ghi).
            API{" "}
            <code className="rounded bg-bb-input px-1">
              /api/manager/appointments
            </code>
            .
          </p>
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl bg-bb-input/50 p-4">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Từ ngày</span>
              <input
                type="date"
                className="rounded-lg border-0 bg-white px-3 py-2"
                value={apptFrom}
                onChange={(e) => setApptFrom(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Đến ngày</span>
              <input
                type="date"
                className="rounded-lg border-0 bg-white px-3 py-2"
                value={apptTo}
                onChange={(e) => setApptTo(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Trạng thái</span>
              <select
                className="rounded-lg border-0 bg-white px-3 py-2"
                value={apptStatus}
                onChange={(e) => setApptStatus(e.target.value)}
              >
                <option value="">Tất cả</option>
                {APPOINTMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Thợ</span>
              <select
                className="rounded-lg border-0 bg-white px-3 py-2"
                value={apptBarberId}
                onChange={(e) => setApptBarberId(Number(e.target.value))}
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
              <span className="mb-1 block text-gray-600">Dịch vụ</span>
              <select
                className="rounded-lg border-0 bg-white px-3 py-2"
                value={apptServiceId}
                onChange={(e) => setApptServiceId(Number(e.target.value))}
              >
                <option value={0}>Tất cả</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Khách</th>
                  <th className="py-2 pr-2">Thợ</th>
                  <th className="py-2 pr-2">Dịch vụ</th>
                  <th className="py-2 pr-2">Ngày / giờ</th>
                  <th className="py-2 pr-2">Giá</th>
                  <th className="py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {currentAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-500">
                      Chưa có lịch hẹn (hoặc không khớp bộ lọc).
                    </td>
                  </tr>
                ) : (
                  currentAppointments.map((a) => (
                    <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer" onClick={() => setSelectedAppt(a)}>
                      <td className="py-2 pr-2 font-mono">{a.id}</td>
                      <td className="py-2 pr-2">
                        <div className="font-medium">
                          {a.customer_name ?? "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {a.customer_phone ?? ""}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        {a.barber_name ?? `#${a.barber_id}`}
                      </td>
                      <td className="py-2 pr-2">{a.service_name ?? "—"}</td>
                      <td className="py-2 pr-2 text-xs text-gray-700">
                        {String(a.appt_date)}{" "}
                        {String(a.start_time).slice(0, 5)}–
                        {String(a.end_time).slice(0, 5)}
                      </td>
                      <td className="py-2 pr-2">{String(a.total_price)}</td>
                      <td className="py-2 pr-2">
                        <select
                          className="rounded-lg border border-gray-200 bg-bb-input px-2 py-1 text-xs"
                          value={a.status}
                          disabled={busyAppt === a.id}
                          onChange={(e) =>
                            void onAppointmentStatus(a.id, e.target.value)
                          }
                          onClick={(e) => e.stopPropagation()}
                        >
                          {APPOINTMENT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalApptPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                disabled={apptPage <= 1}
                onClick={() => setApptPage((p) => Math.max(1, p - 1))}
              >
                Trước
              </button>
              <span className="text-gray-600">
                Trang {apptPage}/{totalApptPages}
              </span>
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                disabled={apptPage >= totalApptPages}
                onClick={() => setApptPage((p) => Math.min(totalApptPages, p + 1))}
              >
                Sau
              </button>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-bb-navy">Đơn shop</h2>
          <p className="mb-4 text-sm text-gray-600">
            Cập nhật trạng thái đơn (tối đa 200 đơn gần nhất).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Khách</th>
                  <th className="py-2 pr-2">Tổng</th>
                  <th className="py-2 pr-2">Trạng thái</th>
                  <th className="py-2">Ngày</th>
                </tr>
              </thead>
              <tbody>
                {currentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-500">
                      Chưa có đơn.
                    </td>
                  </tr>
                ) : (
                  currentOrders.map((o) => (
                    <tr key={o.id} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-mono">{o.id}</td>
                      <td className="py-2 pr-2">
                        <div className="font-medium">
                          {o.customer_name ?? "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {o.customer_phone ?? o.customer_email ?? ""}
                        </div>
                      </td>
                      <td className="py-2 pr-2">{String(o.total_price)}</td>
                      <td className="py-2 pr-2">
                        <select
                          className="rounded-lg border border-gray-200 bg-bb-input px-2 py-1 text-xs"
                          value={o.status}
                          disabled={busyOrder === o.id}
                          onChange={(e) =>
                            void onOrderStatus(o.id, e.target.value)
                          }
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {ORDER_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 text-xs text-gray-600">
                        {o.created_at
                          ? new Date(o.created_at).toLocaleString("vi-VN")
                          : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalOrderPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                disabled={orderPage <= 1}
                onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
              >
                Trước
              </button>
              <span className="text-gray-600">
                Trang {orderPage}/{totalOrderPages}
              </span>
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                disabled={orderPage >= totalOrderPages}
                onClick={() => setOrderPage((p) => Math.min(totalOrderPages, p + 1))}
              >
                Sau
              </button>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-bb-navy">Lịch làm việc thợ</h2>
          <p className="mb-4 text-sm text-gray-600">
            Thêm / sửa theo cặp thợ + ngày (API{" "}
            <code className="rounded bg-bb-input px-1">/api/manager/working-schedules</code>
            ).
          </p>

          <form
            onSubmit={(e) => void saveSchedule(e)}
            className="mb-6 flex flex-wrap items-end gap-3 rounded-xl bg-bb-input/50 p-4"
          >
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Thợ</span>
              <select
                className="rounded-lg border-0 bg-white px-3 py-2"
                value={scheduleBarber || ""}
                onChange={(e) =>
                  setScheduleBarber(Number(e.target.value) || 0)
                }
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
              <span className="mb-1 block text-gray-600">Ngày</span>
              <input
                type="date"
                required
                className="rounded-lg border-0 bg-white px-3 py-2"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Bắt đầu</span>
              <input
                type="time"
                className="rounded-lg border-0 bg-white px-3 py-2"
                value={startT}
                onChange={(e) => setStartT(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Kết thúc</span>
              <input
                type="time"
                className="rounded-lg border-0 bg-white px-3 py-2"
                value={endT}
                onChange={(e) => setEndT(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={dayOff}
                onChange={(e) => setDayOff(e.target.checked)}
              />
              Nghỉ cả ngày
            </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={isRepeatWeekly}
                  onChange={(e) => setIsRepeatWeekly(e.target.checked)}
                />
                Lặp lại cả tuần
              </label>
              {isRepeatWeekly && (
                <div className="flex w-full flex-wrap gap-2 pt-2">
                  {[
                    { val: 1, label: "T2" },
                    { val: 2, label: "T3" },
                    { val: 3, label: "T4" },
                    { val: 4, label: "T5" },
                    { val: 5, label: "T6" },
                    { val: 6, label: "T7" },
                    { val: 0, label: "CN" },
                  ].map((wd) => (
                    <label key={wd.val} className="flex items-center gap-1 text-sm bg-white rounded-md px-2 py-1 shadow-sm">
                      <input
                        type="checkbox"
                        checked={selectedWeekDays.includes(wd.val)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedWeekDays([...selectedWeekDays, wd.val]);
                          else setSelectedWeekDays(selectedWeekDays.filter(d => d !== wd.val));
                        }}
                      />
                      {wd.label}
                    </label>
                  ))}
                </div>
              )}
            <button
              type="submit"
              disabled={savingSchedule || !scheduleBarber}
              className="rounded-xl bg-bb-yellow px-4 py-2 text-sm font-bold text-black/80 disabled:opacity-50"
            >
              {savingSchedule ? "Đang lưu…" : "Lưu lịch"}
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600">
                  <th className="py-2 pr-2">Thợ</th>
                  <th className="py-2 pr-2">Ngày</th>
                  <th className="py-2 pr-2">Giờ</th>
                  <th className="py-2 pr-2">Nghỉ</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {schedules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-500">
                      Chưa có lịch.
                    </td>
                  </tr>
                ) : (
                  schedules.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100">
                      <td className="py-2 pr-2">
                        {barbers.find((b) => b.barber_id === s.barber_id)
                          ?.full_name ?? `#${s.barber_id}`}
                      </td>
                      <td className="py-2 pr-2">{String(s.work_date)}</td>
                      <td className="py-2 pr-2">
                        {String(s.start_time).slice(0, 5)} –{" "}
                        {String(s.end_time).slice(0, 5)}
                      </td>
                      <td className="py-2 pr-2">
                        {s.is_day_off ? "Có" : "Không"}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          className="text-xs text-red-600 underline"
                          onClick={() => void removeSchedule(s.id)}
                        >
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

        <p className="text-center text-xs text-gray-500">
          Web: đơn shop, lịch thợ, lịch hẹn chi nhánh (
          <code className="rounded bg-gray-200 px-1">/api/manager/*</code>
          ). Manager cần{" "}
          <code className="rounded bg-gray-200 px-1">users.branch_id</code>{" "}
          khớp chi nhánh; thợ cần{" "}
          <code className="rounded bg-gray-200 px-1">barbers.branch_id</code>{" "}
          tương ứng.
        </p>
      </main>

      {selectedAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-bb-navy">Chi tiết lịch hẹn #{selectedAppt?.id}</h3>
              <button className="text-gray-500 hover:text-black" onClick={() => setSelectedAppt(null)}>✕</button>
            </div>
            <div className="space-y-3 text-sm text-gray-700">
              <p><strong>Khách hàng:</strong> {selectedAppt?.customer_name ?? "—"} ({selectedAppt?.customer_phone ?? "—"})</p>
              <p><strong>Thợ:</strong> {selectedAppt?.barber_name ?? "—"}</p>
              <p><strong>Dịch vụ:</strong> {selectedAppt?.service_name ?? "—"}</p>
              <p><strong>Ngày giờ:</strong> {selectedAppt?.appt_date} {String(selectedAppt?.start_time || "").slice(0, 5)} - {String(selectedAppt?.end_time || "").slice(0, 5)}</p>
              <p><strong>Giá:</strong> {selectedAppt?.total_price} đ</p>
              <p><strong>Ghi chú:</strong> {selectedAppt?.note || "—"}</p>
              <div>
                <strong className="block mb-1">Trạng thái:</strong>
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                  value={selectedAppt?.status}
                  disabled={busyAppt === selectedAppt?.id}
                  onChange={(e) => {
                    if (selectedAppt) {
                      void onAppointmentStatus(selectedAppt.id, e.target.value);
                    }
                  }}
                >
                  {APPOINTMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-300" onClick={() => setSelectedAppt(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-gray-800 px-6 py-2.5 text-sm font-medium text-white shadow-xl/50 transition-all duration-300">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
