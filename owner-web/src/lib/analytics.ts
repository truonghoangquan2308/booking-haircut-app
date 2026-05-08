import { getApiBase, readJsonResponse } from "./api";

export type OwnerAnalytics = {
  generatedAt: string;
  kpis: {
    total_appointments: number;
    completed_appointments: number;
    total_revenue: string | number;
    /** Tổng doanh thu đơn shop (đã giao / hoàn thành) */
    shop_revenue: string | number;
    customers: number;
    barbers: number;
    active_shops: number;
  };
  appointmentsByDay: { d: string; appointments: number }[];
  revenueByDay: { d: string; revenue: string | number }[];
  appointmentsByStatus: { status: string; cnt: number }[];
  topServices: {
    service_name: string;
    cnt: number;
    revenue: string | number;
  }[];
  shopOrdersByMonth: { ym: string; orders: number; revenue: string | number }[];
  revenueByMonth: { ym: string; revenue: string | number }[];
  barberLeaderboard: {
    barber_id: number;
    barber_name: string | null;
    rating: string | number | null;
    total_reviews: number | null;
    appointment_count: number;
    revenue: string | number;
  }[];
  revenueByShop: {
    shop_id: number;
    shop_name: string;
    appointment_count: number;
    revenue: string | number;
  }[];
};

export async function fetchOwnerAnalytics(firebaseUid: string): Promise<OwnerAnalytics> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/owner/analytics`, {
    cache: "no-store",
    headers: { "x-firebase-uid": firebaseUid },
  });
  const data = await readJsonResponse<OwnerAnalytics & { error?: string }>(
    res,
  );
  if (!res.ok) {
    throw new Error(data.error ?? "Không tải được analytics");
  }
  return data as OwnerAnalytics;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [
    headers.map(esc).join(","),
    ...rows.map((r) => r.map(esc).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
