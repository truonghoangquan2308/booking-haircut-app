"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, ToastContainer, useToast } from "@/components/DesignSystemComponents";
import {
  createVnpayPayment,
  fetchManagerAppointments,
  patchAppointmentStatus,
  type ManagerAppointmentRow,
} from "@/lib/managerApi";

type PaymentInvoiceProps = {
  uid: string;
  appointmentId: number;
  branchId: number;
  onSuccess: () => void;
};

export function PaymentInvoice({
  uid,
  appointmentId,
  branchId,
  onSuccess,
}: PaymentInvoiceProps) {
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [appt, setAppt] = useState<ManagerAppointmentRow | null>(null);
  const { toasts, show, remove } = useToast();

  const total = useMemo(() => Number(appt?.total_price ?? 0), [appt?.total_price]);

  const loadDetail = useCallback(async () => {
    setLoadingDetail(true);
    try {
      const today = new Date();
      const fromDate = new Date(today);
      fromDate.setDate(today.getDate() - 30);
      const toDate = new Date(today);
      toDate.setDate(today.getDate() + 30);
      const ymd = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const list = await fetchManagerAppointments(
        uid,
        {
          from: ymd(fromDate),
          to: ymd(toDate),
        },
        branchId,
      );
      setAppt(list.find((x) => x.id === appointmentId) ?? null);
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setLoadingDetail(false);
    }
  }, [uid, branchId, appointmentId, show]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleCashPay = async () => {
    setLoading(true);
    try {
      await patchAppointmentStatus(uid, appointmentId, "completed", branchId);
      show("Đã xác nhận thanh toán tiền mặt.", "success");
      onSuccess();
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVnpay = async () => {
    setLoading(true);
    try {
      const paymentUrl = await createVnpayPayment(uid, appointmentId, branchId);
      window.open(paymentUrl, "_blank", "noopener,noreferrer");
      show("Đã mở trang thanh toán VNPAY.", "success");
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card title="Thanh toán" description="Xử lý thanh toán cho lịch hẹn tại quầy.">
        <div className="space-y-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          <p>
            Appointment:{" "}
            <span style={{ color: "var(--color-text-primary)" }}>#{appointmentId}</span>
          </p>
          {loadingDetail ? (
            <p>Đang tải chi tiết lịch hẹn...</p>
          ) : (
            <>
              <p>
                Khách:{" "}
                <span style={{ color: "var(--color-text-primary)" }}>
                  {appt?.customer_name ?? "—"}
                </span>
              </p>
              <p>
                Dịch vụ:{" "}
                <span style={{ color: "var(--color-text-primary)" }}>
                  {appt?.service_name ?? "—"}
                </span>
              </p>
              <p>
                Thợ:{" "}
                <span style={{ color: "var(--color-text-primary)" }}>
                  {appt?.barber_name ?? "—"}
                </span>
              </p>
              <p>
                Tổng tiền:{" "}
                <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {Number.isFinite(total) ? total.toLocaleString("vi-VN") : "0"}₫
                </span>
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="primary" isLoading={loading} onClick={handleCashPay}>
              Xác nhận tiền mặt
            </Button>
            <Button type="button" variant="secondary" isLoading={loading} onClick={handleVnpay}>
              Thanh toán VNPAY
            </Button>
            <Button type="button" variant="secondary" onClick={() => void loadDetail()}>
              Tải lại
            </Button>
          </div>
        </div>
      </Card>
      <ToastContainer toasts={toasts} onRemove={remove} />
    </>
  );
}

