"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, ToastContainer, useToast } from "@/components/DesignSystemComponents";
import {
  createAppointmentOnBehalf,
  fetchBarberTimeSlots,
  fetchManagerBarbers,
  fetchManagerServices,
  type BarberOption,
  type ServiceOption,
} from "@/lib/managerApi";

type WalkInProps = {
  uid: string;
  branchId: number;
  onSuccess: (appointmentId: number) => void;
};

export function WalkIn({ uid, branchId, onSuccess }: WalkInProps) {
  const today = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }, []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [slots, setSlots] = useState<Array<{ id: number; start_time: string; end_time: string; is_booked: number }>>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [serviceId, setServiceId] = useState<number>(0);
  const [barberId, setBarberId] = useState<number>(0);
  const [apptDate, setApptDate] = useState(today);
  const [slotId, setSlotId] = useState<number>(0);
  const [note, setNote] = useState("");

  const { toasts, show, remove } = useToast();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [b, s] = await Promise.all([
          fetchManagerBarbers(uid, branchId),
          fetchManagerServices(),
        ]);
        if (cancelled) return;
        setBarbers(b);
        setServices(s);
        if (b.length) setBarberId(b[0].barber_id);
        if (s.length) setServiceId(s[0].id);
      } catch (e) {
        if (!cancelled) show(e instanceof Error ? e.message : String(e), "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, branchId, show]);

  useEffect(() => {
    if (!barberId || !apptDate) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchBarberTimeSlots(barberId, apptDate);
        if (cancelled) return;
        setSlots(list);
        const first = list.find((x) => Number(x.is_booked) !== 1);
        setSlotId(first ? first.id : 0);
      } catch (e) {
        if (!cancelled) {
          show(e instanceof Error ? e.message : String(e), "error");
          setSlots([]);
          setSlotId(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [barberId, apptDate, show]);

  const selectedService = services.find((s) => s.id === serviceId);

  const handleCreate = async () => {
    if (!customerPhone.trim()) {
      show("Nhập SĐT khách.", "warning");
      return;
    }
    if (!serviceId || !barberId || !slotId) {
      show("Chọn dịch vụ, thợ và giờ.", "warning");
      return;
    }
    const slot = slots.find((x) => x.id === slotId);
    if (!slot) {
      show("Khung giờ không hợp lệ.", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await createAppointmentOnBehalf(
        uid,
        {
          customer_phone: customerPhone.trim(),
          customer_name: customerName.trim() || undefined,
          barber_id: barberId,
          service_id: serviceId,
          time_slot_id: slotId,
          appt_date: apptDate,
          start_time: String(slot.start_time).slice(0, 8),
          end_time: String(slot.end_time).slice(0, 8),
          total_price: Number(selectedService?.price ?? 0) || 0,
          note: note.trim() || undefined,
        },
        branchId,
      );
      show(`Đã tạo walk-in #${res.appointment_id}`, "success");
      onSuccess(res.appointment_id);
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card title="Walk-in" description="Tiếp nhận khách tới trực tiếp và tạo lịch ngay tại quầy.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              SĐT
            </span>
            <input
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="09xxxxxxxx"
              disabled={loading}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              Tên khách (tuỳ chọn)
            </span>
            <input
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={loading}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              Ngày
            </span>
            <input
              type="date"
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
              value={apptDate}
              onChange={(e) => setApptDate(e.target.value)}
              disabled={loading}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              Dịch vụ
            </span>
            <select
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
              value={serviceId}
              onChange={(e) => setServiceId(Number(e.target.value))}
              disabled={loading}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
              value={barberId}
              onChange={(e) => setBarberId(Number(e.target.value))}
              disabled={loading}
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
              value={slotId}
              onChange={(e) => setSlotId(Number(e.target.value))}
              disabled={loading}
            >
              {slots
                .filter((x) => Number(x.is_booked) !== 1)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {String(x.start_time).slice(0, 5)}-{String(x.end_time).slice(0, 5)}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block" style={{ color: "var(--color-text-secondary)" }}>
              Ghi chú khách
            </span>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
            />
          </label>
        </div>
        <div className="mt-4">
          <Button type="button" variant="primary" isLoading={saving} onClick={handleCreate}>
            Tạo walk-in và sang Thanh toán
          </Button>
        </div>
      </Card>
      <ToastContainer toasts={toasts} onRemove={remove} />
    </>
  );
}

