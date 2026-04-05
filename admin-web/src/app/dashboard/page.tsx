"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/AdminHeader";
import { useAdminSession } from "@/hooks/useAdminSession";
import { fetchPlatformStats, type PlatformStats } from "@/lib/platformApi";

export default function AdminHomePage() {
  const router = useRouter();
  const { user, uid, error, setError, logout } = useAdminSession();
  const [stats, setStats] = useState<PlatformStats | null>(null);

  const loadStats = useCallback(async (firebaseUid: string) => {
    const s = await fetchPlatformStats(firebaseUid);
    setStats(s);
  }, []);

  function fmtMoney(value: number | undefined | null) {
    if (value == null || Number.isNaN(Number(value))) return "—";
    return new Intl.NumberFormat("vi-VN").format(Number(value)) + " đ";
  }

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void (async () => {
      try {
        await loadStats(uid);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, loadStats, setError]);

  if (error && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bb-yellow p-6 text-red-700">
        {error}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bb-surface text-bb-navy">
        <div className="h-10 w-10 animate-pulse rounded-full bg-bb-yellow/50" />
        <p className="font-medium">Đang tải…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bb-surface text-gray-900">
      <AdminHeader
        user={user}
        title="Tổng quan"
        subtitle="Báo cáo & vận hành — Admin"
        onLogout={logout}
      />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <p className="text-sm text-gray-600">
          Dùng thanh menu phía trên để mở nhanh{" "}
          <strong>Tài khoản</strong>, <strong>Cửa hàng / chi nhánh</strong>,{" "}
          <strong>Nhật ký</strong>.
        </p>

        {stats && (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { label: "Người dùng", value: stats.users_total, href: "/dashboard/users" },
                { label: "Cửa hàng", value: stats.shops_total, href: "/dashboard/shops" },
                { label: "Chờ duyệt", value: stats.shops_pending, href: "/dashboard/shops" },
                { label: "Đã duyệt", value: stats.shops_approved ?? stats.shops_total - stats.shops_pending, href: "/dashboard/shops" },
                { label: "Lịch hẹn", value: stats.appointments_total, href: "/dashboard/shops" },
                { label: "Đơn shop", value: stats.shop_orders_total, href: "/dashboard/shops" },
                { label: "Owner", value: stats.owners, href: "/dashboard/users" },
                { label: "Manager", value: stats.managers, href: "/dashboard/users" },
                { label: "Thợ", value: stats.barbers, href: "/dashboard/users" },
                { label: "Doanh thu hôm nay", value: fmtMoney(stats.revenue_today), href: "/dashboard" },
                { label: "Doanh thu tháng này", value: fmtMoney(stats.revenue_month), href: "/dashboard" },
              ] as const
            ).map(({ label, value, href }) => (
              <button
                key={label}
                type="button"
                onClick={() => router.push(href)}
                className="group rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs text-gray-500 group-hover:text-bb-navy">{label}</p>
                <p className="mt-2 text-2xl font-bold text-bb-navy">{value}</p>
              </button>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
