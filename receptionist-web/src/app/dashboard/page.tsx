"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, type StaffUser } from "@/lib/api";
import { ManagerDashboardNav } from "@/components/ManagerDashboardNav";
import {
  fetchManagerAppointments,
  fetchManagerBarbers,
  fetchManagerBranchList,
  patchAppointmentStatus,
  fetchManagerServices,
  fetchManagerCustomers,
  createAppointmentOnBehalf,
  fetchBarberTimeSlots,
  type BarberOption,
  type ManagerAppointmentRow,
  type ManagerBranchRow,
  type ServiceOption,
  type CustomerRow,
} from "@/lib/managerApi";

const BRANCH_STORAGE_KEY = "receptionist-web-branch-id";

const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export default function ReceptionistDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<ManagerAppointmentRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [apptFrom, setApptFrom] = useState("");
  const [apptTo, setApptTo] = useState("");
  const [apptStatus, setApptStatus] = useState("");
  const [apptBarberId, setApptBarberId] = useState<number>(0);
  const [apptServiceId, setApptServiceId] = useState<number>(0);
  const [busyAppt, setBusyAppt] = useState<number | null>(null);
  const [branches, setBranches] = useState<ManagerBranchRow[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [apptPage, setApptPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [selectedAppt, setSelectedAppt] = useState<ManagerAppointmentRow | null>(null);
  const [toastMsg, setToastMsg] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newBarberId, setNewBarberId] = useState(0);
  const [newServiceId, setNewServiceId] = useState(0);
  const [newSlotId, setNewSlotId] = useState(0);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [isBooking, setIsBooking] = useState(false);

  const APPT_PAGE_SIZE = 20;
  const CUST_PAGE_SIZE = 20;

  const loadMain = useCallback(async (firebaseUid: string, branchId?: number) => {
    setError(null);
    const errs: string[] = [];

    const [r1, r2, r3] = await Promise.allSettled([
      fetchManagerBarbers(firebaseUid, branchId),
      fetchManagerServices(),
      fetchManagerCustomers(firebaseUid, branchId),
    ]);

    if (r1.status === "fulfilled") setBarbers(r1.value);
    else errs.push(`Thợ: ${r1.reason}`);

    if (r2.status === "fulfilled") setServices(r2.value);
    else errs.push(`Dịch vụ: ${r2.reason}`);

    if (r3.status === "fulfilled") setCustomers(r3.value);
    else errs.push(`Khách hàng: ${r3.reason}`);

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

        if (row.role !== "manager" && row.role !== "receptionist" && row.role !== "owner") {
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
              (row.role === "manager" || row.role === "receptionist")
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
            } catch {}
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

  const loadAppointments = useCallback(async () => {
    if (!uid || !branchesLoaded) return;
    try {
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
      setAppointments(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [uid, branchesLoaded, apptFrom, apptTo, apptStatus, apptBarberId, apptServiceId, selectedBranchId]);

  useEffect(() => {
    setApptPage(1);
    void loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    if (newBarberId && newDate && uid) {
      fetchBarberTimeSlots(newBarberId, newDate).then(setAvailableSlots).catch(() => setAvailableSlots([]));
    } else {
      setAvailableSlots([]);
    }
  }, [newBarberId, newDate, uid]);

  async function onAppointmentStatus(id: number, status: string) {
    if (!uid) return;
    setBusyAppt(id);
    setError(null);
    try {
      await patchAppointmentStatus(uid, id, status, selectedBranchId ?? undefined);
      await loadAppointments();
      if (selectedAppt && selectedAppt.id === id) {
        setSelectedAppt((prev) => prev ? { ...prev, status } : null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyAppt(null);
    }
  }

  async function handleBook() {
    if (!uid) return;
    setIsBooking(true);
    setError(null);
    try {
      const slot = availableSlots.find((s) => s.id === newSlotId);
      if (!slot) throw new Error("Chưa chọn giờ hợp lệ");
      const srv = services.find((s) => s.id === newServiceId);
      if (!srv) throw new Error("Chưa chọn dịch vụ");

      await createAppointmentOnBehalf(
        uid,
        {
          customer_phone: newPhone,
          customer_name: newName,
          barber_id: newBarberId,
          service_id: newServiceId,
          time_slot_id: newSlotId,
          appt_date: newDate,
          start_time: slot.start_time,
          end_time: slot.end_time,
          total_price: 100000, // Giá cố định hoặc có thể điều chỉnh
        },
        selectedBranchId ?? undefined
      );

      setToastMsg("Tạo lịch thành công!");
      setTimeout(() => setToastMsg(""), 3000);
      setShowCreateModal(false);
      setNewPhone("");
      setNewName("");
      setNewDate("");
      setNewSlotId(0);
      await loadAppointments();
      const freshCustomers = await fetchManagerCustomers(uid, selectedBranchId ?? undefined);
      setCustomers(freshCustomers);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setIsBooking(false);
    }
  }

  function onBranchChange(nextId: number) {
    if (user?.role !== "owner") return;
    setSelectedBranchId(nextId);
    try { localStorage.setItem(BRANCH_STORAGE_KEY, String(nextId)); } catch {}
    if (uid) void loadMain(uid, nextId);
  }

  async function logout() {
    await signOut(auth);
    router.replace("/");
  }

  const totalApptPages = Math.max(1, Math.ceil(appointments.length / APPT_PAGE_SIZE));
  const currentAppointments = appointments.slice((apptPage - 1) * APPT_PAGE_SIZE, apptPage * APPT_PAGE_SIZE);

  const totalCustPages = Math.max(1, Math.ceil(customers.length / CUST_PAGE_SIZE));
  const currentCustomers = customers.slice((customerPage - 1) * CUST_PAGE_SIZE, customerPage * CUST_PAGE_SIZE);

  return (
    <div style={{ backgroundColor: 'var(--color-bg-page)' }} className="min-h-screen">
      <header style={{ backgroundColor: 'var(--color-navbar-bg)' }} className="px-4 py-4 text-white shadow">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white/80">
              receptionist-web · Quản lý tại quầy ·{" "}
              Lễ tân
            </p>
            <p className="text-lg font-bold">
              {user?.full_name ?? user?.email ?? "Receptionist"}
            </p>
            <ManagerDashboardNav />
            {branches.length > 0 && selectedBranchId != null && (
              <div className="mt-2 text-sm">
                <span className="mb-1 block text-white/80">Chi nhánh</span>
                {user?.role === "owner" && branches.length > 1 ? (
                  <label className="block">
                    <select
                      className="max-w-[min(100%,20rem)] rounded-lg border-0 bg-white px-3 py-2 text-[var(--color-navbar-bg)]"
                      value={selectedBranchId}
                      onChange={(e) => onBranchChange(Number(e.target.value))}
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
          <button type="button" onClick={() => void logout()} className="btn btn-secondary-light">
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-bb-navy">Trang chủ Lễ Tân</h1>
          <button 
            className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 font-semibold shadow-sm transition"
            onClick={() => setShowCreateModal(true)}
          >
            + Tạo lịch hẹn hộ khách
          </button>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-bb-navy mb-4">Lịch hẹn trong ngày / Gần đây</h2>
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl bg-bb-input/50 p-4">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Ngày</span>
              <input type="date" className="rounded-lg border-0 bg-white px-3 py-2" value={apptFrom} onChange={(e) => { setApptFrom(e.target.value); setApptTo(e.target.value); }} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Trạng thái</span>
              <select className="rounded-lg border-0 bg-white px-3 py-2" value={apptStatus} onChange={(e) => setApptStatus(e.target.value)}>
                <option value="">Tất cả</option>
                {APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
                  <th className="py-2">Hành động (Checkin)</th>
                </tr>
              </thead>
              <tbody>
                {currentAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-500">Chưa có lịch hẹn.</td>
                  </tr>
                ) : (
                  currentAppointments.map((a) => (
                    <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer" onClick={() => setSelectedAppt(a)}>
                      <td className="py-2 pr-2 font-mono">{a.id}</td>
                      <td className="py-2 pr-2">
                        <div className="font-medium">{a.customer_name ?? "—"}</div>
                        <div className="text-xs text-gray-500">{a.customer_phone ?? ""}</div>
                      </td>
                      <td className="py-2 pr-2">{a.barber_name ?? `#${a.barber_id}`}</td>
                      <td className="py-2 pr-2">{a.service_name ?? "—"}</td>
                      <td className="py-2 pr-2 text-xs text-gray-700">
                        {String(a.appt_date)} {String(a.start_time).slice(0, 5)}–{String(a.end_time).slice(0, 5)}
                      </td>
                      <td className="py-2 pr-2">{String(a.total_price)}</td>
                      <td className="py-2 pr-2">
                        <select
                          className="rounded-lg border border-gray-200 bg-bb-input px-2 py-1 text-xs"
                          value={a.status}
                          disabled={busyAppt === a.id}
                          onChange={(e) => void onAppointmentStatus(a.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {APPOINTMENT_STATUSES.map((s) => (
                            <option key={s} value={s}>{s === 'in_progress' ? 'Đã Check-in (In Progress)' : s}</option>
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
              <button disabled={apptPage <= 1} onClick={() => setApptPage(p => p - 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">Trước</button>
              <span className="text-gray-600">Trang {apptPage}/{totalApptPages}</span>
              <button disabled={apptPage >= totalApptPages} onClick={() => setApptPage(p => p + 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">Sau</button>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-bb-navy mb-4">Khách hàng tại chi nhánh</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600">
                  <th className="py-2 pr-2">#ID</th>
                  <th className="py-2 pr-2">Khách</th>
                  <th className="py-2 pr-2">SĐT</th>
                  <th className="py-2 pr-2">Lần đặt cuối</th>
                </tr>
              </thead>
              <tbody>
                {currentCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-500">Chưa có khách hàng nào.</td>
                  </tr>
                ) : (
                  currentCustomers.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-mono">{c.id}</td>
                      <td className="py-2 pr-2 font-medium">{c.full_name ?? "—"}</td>
                      <td className="py-2 pr-2">{c.phone ?? "—"}</td>
                      <td className="py-2 pr-2 text-xs text-gray-500">
                        {c.last_booking ? new Date(c.last_booking).toLocaleDateString("vi-VN") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalCustPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
               <button disabled={customerPage <= 1} onClick={() => setCustomerPage(p => p - 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">Trước</button>
              <span className="text-gray-600">Trang {customerPage}/{totalCustPages}</span>
              <button disabled={customerPage >= totalCustPages} onClick={() => setCustomerPage(p => p + 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">Sau</button>
            </div>
          )}
        </section>

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
            </div>
            <div className="mt-6 flex justify-end">
              <button className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-300" onClick={() => setSelectedAppt(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-bb-navy mb-4">Tạo lịch hẹn hộ khách</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  <span className="text-gray-600">SĐT Khách *</span>
                  <input type="tel" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="0901234567" />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Tên Khách (tùy chọn)</span>
                  <input type="text" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Anh A" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  <span className="text-gray-600">Dịch vụ *</span>
                  <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={newServiceId} onChange={(e) => setNewServiceId(Number(e.target.value))}>
                    <option value={0}>-- Chọn dịch vụ --</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Ngày *</span>
                  <input type="date" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </label>
              </div>
              <label className="block text-sm">
                <span className="text-gray-600">Thợ *</span>
                <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={newBarberId} onChange={(e) => setNewBarberId(Number(e.target.value))}>
                  <option value={0}>-- Chọn thợ --</option>
                  {barbers.map(b => <option key={b.barber_id} value={b.barber_id}>{b.full_name}</option>)}
                </select>
              </label>

              {newBarberId > 0 && newDate && (
                <label className="block text-sm">
                  <span className="text-gray-600">Khung giờ trống *</span>
                  <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" value={newSlotId} onChange={(e) => setNewSlotId(Number(e.target.value))}>
                    <option value={0}>-- Chọn giờ --</option>
                    {availableSlots.length === 0 ? (
                      <option disabled>Không có giờ trống</option>
                    ) : (
                      availableSlots.map(slot => (
                        <option key={slot.id} value={slot.id} disabled={slot.is_booked === 1}>
                          {slot.start_time.slice(0,5)} - {slot.end_time.slice(0,5)} {slot.is_booked ? '(Đã đặt)' : ''}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="rounded-lg bg-gray-200 px-4 py-2 font-semibold hover:bg-gray-300" onClick={() => setShowCreateModal(false)}>Hủy</button>
              <button 
                type="button" 
                className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={!newPhone || !newBarberId || !newServiceId || !newDate || !newSlotId || isBooking}
                onClick={() => void handleBook()}
              >
                {isBooking ? 'Đang tạo...' : 'Tạo lịch'}
              </button>
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
