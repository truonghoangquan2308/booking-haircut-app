"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid } from "@/lib/api";
import { fetchOwnerBarberDetails, type BarberDetails } from "@/lib/ownerBarbersApi";

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

function formatRating(rating: number): string {
  return rating > 0 ? `${rating.toFixed(1)} ★` : "Chưa có";
}

function getBioBadge(bio: string | null): string {
  if (!bio) return "Chưa cập nhật";
  return bio;
}

function getStatusBadge(status: string): { text: string; color: string } {
  switch (status) {
    case "available":
      return { text: "Đang làm việc", color: "bg-green-100 text-green-800" };
    case "off":
      return { text: "Nghỉ phép", color: "bg-yellow-100 text-yellow-800" };
    default:
      return { text: "Đã nghỉ việc", color: "bg-red-100 text-red-800" };
  }
}

function getApptStatusBadge(status: string): { text: string; color: string } {
  switch (status) {
    case "pending":
      return { text: "Chờ xác nhận", color: "bg-yellow-100 text-yellow-800" };
    case "confirmed":
      return { text: "Đã xác nhận", color: "bg-blue-100 text-blue-800" };
    case "in_progress":
      return { text: "Đang thực hiện", color: "bg-purple-100 text-purple-800" };
    case "completed":
      return { text: "Hoàn thành", color: "bg-green-100 text-green-800" };
    case "cancelled":
      return { text: "Đã hủy", color: "bg-red-100 text-red-800" };
    default:
      return { text: status, color: "bg-gray-100 text-gray-800" };
  }
}

export default function BarberDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [barberId, setBarberId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [data, setData] = useState<BarberDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    params.then((p) => setBarberId(parseInt(p.id, 10)));
  }, [params]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fb) => {
      if (!fb) {
        router.replace("/");
        return;
      }
      try {
        const row = await fetchUserByFirebaseUid(fb.uid);
        if (row.role !== "owner") {
          await signOut(auth);
          router.replace("/");
          return;
        }
        if (row.is_locked === 1 || row.is_locked === true) {
          await signOut(auth);
          setError("Tài khoản đã bị khóa.");
          return;
        }
        setUid(fb.uid);
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => unsub();
  }, [router]);

  const loadDetails = useCallback(async () => {
    if (!uid || !barberId) return;
    setLoading(true);
    setError(null);
    try {
      const details = await fetchOwnerBarberDetails(uid, barberId);
      setData(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [uid, barberId]);

  useEffect(() => {
    if (!ready || !uid || !barberId) return;
    loadDetails();
  }, [ready, uid, barberId, loadDetails]);

  if (!ready || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bb-surface text-bb-navy">
        <div className="h-10 w-10 animate-pulse rounded-full bg-bb-yellow/50" />
        <p className="font-medium">Đang tải…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bb-surface text-gray-900">
        <header className="border-b border-white/10 bg-bb-navy px-6 py-4 text-white shadow">
          <h1 className="text-xl font-bold">Chi tiết thợ</h1>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-6">
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        </main>
      </div>
    );
  }

  if (!data) return null;

  const { barber, stats, appointments, reviews } = data;

  return (
    <div className="min-h-screen bg-bb-surface text-gray-900">
      <header className="border-b border-white/10 bg-bb-navy px-6 py-4 text-white shadow">
        <h1 className="text-xl font-bold">Chi tiết thợ</h1>
        <p className="text-sm text-white/80">
          Thông tin chi tiết về thợ #{barber.barber_id}
        </p>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        {/* Thông tin cơ bản */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-bb-navy">Thông tin cơ bản</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-4">
              <img
                src={barber.avatar_url || "/default-avatar.png"}
                alt="Avatar"
                className="h-16 w-16 rounded-full border-2 border-gray-200"
              />
              <div>
                <div className="text-lg font-semibold">{barber.full_name || "Chưa cập nhật"}</div>
                <div className="text-sm text-gray-500">#{barber.barber_id}</div>
                <div className="mt-1">
                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {getBioBadge(barber.bio)}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div><strong>SĐT:</strong> {barber.phone || "—"}</div>
              <div><strong>Chi nhánh:</strong> {barber.branch_name || "—"}</div>
              <div><strong>Ngày vào làm:</strong> {formatDate(barber.user_created_at)}</div>
              <div><strong>Trạng thái:</strong>{" "}
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadge(barber.status).color}`}>
                  {getStatusBadge(barber.status).text}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Thống kê cá nhân */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-bb-navy">Thống kê cá nhân</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
              <div className="text-2xl font-bold text-bb-navy">{stats.total_appointments}</div>
              <div className="text-sm text-gray-600">Tổng lịch đã làm</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
              <div className="text-2xl font-bold text-bb-navy">{formatCurrency(stats.revenue_month)}</div>
              <div className="text-sm text-gray-600">Doanh thu tháng này</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
              <div className="text-2xl font-bold text-bb-navy">{formatRating(stats.avg_rating)}</div>
              <div className="text-sm text-gray-600">Đánh giá trung bình</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
              <div className="text-2xl font-bold text-bb-navy">{stats.cancel_rate}%</div>
              <div className="text-sm text-gray-600">Tỉ lệ huỷ lịch</div>
            </div>
          </div>
        </section>

        {/* Lịch sử lịch hẹn */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-bb-navy">Lịch sử lịch hẹn</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Khách</th>
                  <th className="px-3 py-2">Dịch vụ</th>
                  <th className="px-3 py-2">Ngày giờ</th>
                  <th className="px-3 py-2">Giá</th>
                  <th className="px-3 py-2">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <tr key={appt.id} className="border-b border-gray-100">
                    <td className="px-3 py-2">{appt.customer_name}</td>
                    <td className="px-3 py-2">{appt.service_name}</td>
                    <td className="px-3 py-2">
                      {formatDate(appt.appt_date)} {appt.start_time} - {appt.end_time}
                    </td>
                    <td className="px-3 py-2 font-mono">{formatCurrency(appt.total_price)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getApptStatusBadge(appt.status).color}`}>
                        {getApptStatusBadge(appt.status).text}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {appointments.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-500">Chưa có lịch hẹn nào.</p>
            )}
          </div>
        </section>

        {/* Đánh giá từ khách */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-bb-navy">Đánh giá từ khách</h2>
          <div className="space-y-4">
            {reviews.map((review, idx) => (
              <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{review.customer_name}</div>
                  <div className="text-sm text-gray-500">{formatDate(review.created_at)}</div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-yellow-500">{"★".repeat(review.rating)}</span>
                  <span className="text-sm text-gray-600">({review.rating}/5)</span>
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm text-gray-700">{review.comment}</p>
                )}
              </div>
            ))}
            {reviews.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-500">Chưa có đánh giá nào.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}