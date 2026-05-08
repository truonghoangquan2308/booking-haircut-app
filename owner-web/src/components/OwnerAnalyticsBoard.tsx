"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OwnerAnalytics } from "@/lib/analytics";
import { downloadCsv } from "@/lib/analytics";

const PIE_COLORS = ["#fbbf24", "#38bdf8", "#a78bfa", "#34d399", "#fb7185", "#94a3b8"];

type Props = {
  analytics: OwnerAnalytics;
  userLabel: string;
  onLogout: () => void;
};

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function OwnerAnalyticsBoard({ analytics, userLabel, onLogout }: Props) {
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const mergedDaily = useMemo(() => {
    const map = new Map<string, { date: string; appointments: number; revenue: number }>();
    for (const r of analytics.appointmentsByDay || []) {
      const key = String(r.d).slice(0, 10);
      map.set(key, {
        date: key,
        appointments: Number(r.appointments) || 0,
        revenue: 0,
      });
    }
    for (const r of analytics.revenueByDay || []) {
      const key = String(r.d).slice(0, 10);
      const cur = map.get(key) ?? { date: key, appointments: 0, revenue: 0 };
      cur.revenue = num(r.revenue);
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [analytics.appointmentsByDay, analytics.revenueByDay]);

  const statusPie = useMemo(
    () =>
      (analytics.appointmentsByStatus || []).map((s) => ({
        name: s.status,
        value: Number(s.cnt) || 0,
      })),
    [analytics.appointmentsByStatus],
  );

  const exportAll = useCallback(() => {
    downloadCsv(
      `bbshop-appointments-by-day.csv`,
      ["date", "appointments", "revenue"],
      mergedDaily.map((r) => [r.date, r.appointments, r.revenue]),
    );
    downloadCsv(
      `bbshop-appointments-by-status.csv`,
      ["status", "count"],
      (analytics.appointmentsByStatus || []).map((s) => [s.status, s.cnt]),
    );
    downloadCsv(
      `bbshop-top-services.csv`,
      ["service", "bookings", "revenue"],
      (analytics.topServices || []).map((s) => [
        s.service_name,
        s.cnt,
        num(s.revenue),
      ]),
    );
    downloadCsv(
      `bbshop-shop-orders-by-month.csv`,
      ["month", "orders", "revenue"],
      (analytics.shopOrdersByMonth || []).map((s) => [
        s.ym,
        s.orders,
        num(s.revenue),
      ]),
    );
    setExportMsg("Đã tải 4 file CSV (mở thư mục Downloads).");
    setTimeout(() => setExportMsg(null), 4000);
  }, [analytics, mergedDaily]);

  const k = analytics.kpis;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-page)' }}>
      <header style={{ backgroundColor: 'var(--color-navbar-bg)', borderColor: 'var(--color-border)' }} className="sticky top-0 z-10 shadow-md border-b">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" style={{ color: 'var(--color-primary)' }} fill="currentColor" aria-hidden>
                <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.7)' }}>
                GROUP 5 · Owner
              </p>
              <h1 className="text-xl font-bold md:text-2xl" style={{ color: 'var(--color-navbar-text)' }}>
                Báo cáo &amp; vận hành
              </h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{userLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportAll}
              className="btn btn-primary"
            >
              Xuất báo cáo CSV (gói nhanh)
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="btn btn-secondary-light"
            >
              Đăng xuất
            </button>
          </div>
        </div>
        {exportMsg && (
          <p className="border-t px-6 py-2 text-center text-sm font-medium" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(0,0,0,0.1)', color: 'var(--color-primary)' }}>
            {exportMsg}
          </p>
        )}
      </header>

      <main className="mx-auto max-w-[1920px] space-y-6 px-6 py-8">
        <section className="stat-grid">
          {[
            ["Tổng lịch hẹn", num(k?.total_appointments)],
            ["Hoàn thành", num(k?.completed_appointments)],
            ["Doanh thu (đặt lịch)", num(k?.total_revenue)],
            ["Doanh thu bán hàng (shop)", num(k?.shop_revenue)],
            ["Khách hàng", num(k?.customers)],
            ["Thợ", num(k?.barbers)],
            ["Cửa hàng hoạt động", num(k?.active_shops)],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="stat-card"
            >
              <div className="stat-label">
                {label}
              </div>
              <div className="stat-value">{value}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">Lịch hẹn theo ngày (30 ngày)</h2>
              <button
                type="button"
                className="text-xs font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}
                onClick={() =>
                  downloadCsv(
                    "appointments-30d.csv",
                    ["date", "appointments"],
                    mergedDaily.map((r) => [r.date, r.appointments]),
                  )
                }
              >
                CSV
              </button>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mergedDaily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="appointments"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    name="Số lịch"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">Doanh thu hoàn thành (30 ngày)</h2>
              <button
                type="button"
                className="text-xs font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}
                onClick={() =>
                  downloadCsv(
                    "revenue-30d.csv",
                    ["date", "revenue"],
                    mergedDaily.map((r) => [r.date, r.revenue]),
                  )
                }
              >
                CSV
              </button>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mergedDaily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="revenue" fill="var(--color-info)" name="Doanh thu" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <div className="card xl:col-span-1">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">Trạng thái lịch</h2>
              <button
                type="button"
                className="text-xs font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}
                onClick={() =>
                  downloadCsv(
                    "status-breakdown.csv",
                    ["status", "count"],
                    (analytics.appointmentsByStatus || []).map((s) => [
                      s.status,
                      s.cnt,
                    ]),
                  )
                }
              >
                CSV
              </button>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) =>
                      `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {statusPie.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card lg:col-span-2 xl:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">Top dịch vụ</h2>
              <button
                type="button"
                className="text-xs font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}
                onClick={() =>
                  downloadCsv(
                    "top-services.csv",
                    ["service", "bookings", "revenue"],
                    (analytics.topServices || []).map((s) => [
                      s.service_name,
                      s.cnt,
                      num(s.revenue),
                    ]),
                  )
                }
              >
                CSV
              </button>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(analytics.topServices || []).map((s) => ({
                    name:
                      s.service_name.length > 18
                        ? s.service_name.slice(0, 16) + "…"
                        : s.service_name,
                    bookings: s.cnt,
                  }))}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="bookings" fill="#a78bfa" name="Lượt đặt" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {(analytics.shopOrdersByMonth || []).length > 0 && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Đơn hàng shop (theo tháng)</h2>
              <button
                type="button"
                className="text-xs font-semibold text-bb-navy hover:underline"
                onClick={() =>
                  downloadCsv(
                    "shop-orders-monthly.csv",
                    ["month", "orders", "revenue"],
                    (analytics.shopOrdersByMonth || []).map((s) => [
                      s.ym,
                      s.orders,
                      num(s.revenue),
                    ]),
                  )
                }
              >
                CSV
              </button>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.shopOrdersByMonth || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="ym" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="orders"
                    stroke="#34d399"
                    name="Số đơn"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#fb7185"
                    name="Doanh thu"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {(analytics.revenueByMonth || []).length > 0 && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Doanh thu đặt lịch (theo tháng)</h2>
              <button
                type="button"
                className="text-xs font-semibold text-bb-navy hover:underline"
                onClick={() =>
                  downloadCsv(
                    "revenue-by-month.csv",
                    ["month", "revenue"],
                    (analytics.revenueByMonth || []).map((r) => [
                      r.ym,
                      num(r.revenue),
                    ]),
                  )
                }
              >
                CSV
              </button>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.revenueByMonth || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="ym" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#fbbf24"
                    strokeWidth={2}
                    name="Doanh thu"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {(analytics.barberLeaderboard || []).length > 0 && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-gray-900">Thợ — hiệu suất &amp; rating</h2>
              <button
                type="button"
                className="text-xs font-semibold text-bb-navy hover:underline"
                onClick={() =>
                  downloadCsv(
                    "barber-leaderboard.csv",
                    ["barber_id", "name", "rating", "reviews", "appointments", "revenue"],
                    (analytics.barberLeaderboard || []).map((b) => [
                      b.barber_id,
                      b.barber_name ?? "",
                      num(b.rating),
                      b.total_reviews ?? 0,
                      b.appointment_count,
                      num(b.revenue),
                    ]),
                  )
                }
              >
                CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-gray-500">
                  <tr>
                    <th className="py-2 pr-4">Thợ</th>
                    <th className="py-2 pr-4">Rating</th>
                    <th className="py-2 pr-4">Lịch</th>
                    <th className="py-2">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics.barberLeaderboard || []).map((b) => (
                    <tr key={b.barber_id} className="border-t border-gray-200">
                      <td className="py-2 pr-4 text-gray-900">{b.barber_name ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {num(b.rating)} ({b.total_reviews ?? 0} đánh giá)
                      </td>
                      <td className="py-2 pr-4">{b.appointment_count}</td>
                      <td className="py-2">{num(b.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {(analytics.revenueByShop || []).length > 0 && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-900">
              Doanh thu theo chi nhánh (cần gán <code className="rounded bg-bb-yellow/30 px-1 text-bb-navy">barbers.shop_id</code>)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-gray-500">
                  <tr>
                    <th className="py-2 pr-4">Chi nhánh</th>
                    <th className="py-2 pr-4">Lịch</th>
                    <th className="py-2">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics.revenueByShop || []).map((s) => (
                    <tr key={s.shop_id} className="border-t border-gray-200">
                      <td className="py-2 pr-4 text-gray-900">{s.shop_name}</td>
                      <td className="py-2 pr-4">{s.appointment_count}</td>
                      <td className="py-2">{num(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <p className="text-center text-xs text-gray-500">
          Cập nhật: {new Date(analytics.generatedAt).toLocaleString("vi-VN")} — Backend{" "}
          <code className="rounded bg-gray-200 px-1 text-gray-800">/api/owner/analytics</code>
        </p>
      </main>
    </div>
  );
}
