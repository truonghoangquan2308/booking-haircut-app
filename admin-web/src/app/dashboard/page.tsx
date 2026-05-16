"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/AdminHeader";
import PageHeader from "@/components/PageHeader";
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3" style={{ backgroundColor: 'var(--color-bg-page)', color: 'var(--color-text-primary)' }}>
        <div className="h-10 w-10 animate-pulse rounded-full" style={{ backgroundColor: 'rgba(245,166,35,0.3)' }} />
        <p className="font-medium">Đang tải…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-page)', color: 'var(--color-text-primary)' }}>
      <AdminHeader
        user={user}
        onLogout={logout}
      />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <PageHeader title="Tổng quan hệ thống" />

        {error && (
          <p className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-danger)', backgroundColor: 'rgba(220,38,38,0.05)', color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}

        {stats && (
          <section className="stat-grid">
            {(
              [
                { label: "Người dùng", value: stats.users_total, href: "/dashboard/users" },
                { label: "Cửa hàng", value: stats.shops_total, href: "/dashboard/shops" },
                { label: "Chờ duyệt", value: stats.shops_pending, href: "/dashboard/shops" },
                { label: "Đã duyệt", value: stats.shops_approved ?? stats.shops_total - stats.shops_pending, href: "/dashboard/shops" },
                { label: "Owner", value: stats.owners, href: "/dashboard/users", span: 2 },
                { label: "Manager", value: stats.managers, href: "/dashboard/users", span: 2 },
                { label: "Thợ", value: stats.barbers, href: "/dashboard/users", span: 2 },
              ] as Array<{ label: string; value: number; href: string; span?: number }>
            ).map(({ label, value, href, span }) => (
              <button
                key={label}
                type="button"
                onClick={() => router.push(href)}
                className={`stat-card group transition hover:-translate-y-0.5 hover:shadow-hover ${span === 2 ? 'col-span-2' : ''}`}
              >
                <p className="stat-label group-hover:text-[var(--color-primary)]">{label}</p>
                <p className="stat-value">{value}</p>
              </button>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
