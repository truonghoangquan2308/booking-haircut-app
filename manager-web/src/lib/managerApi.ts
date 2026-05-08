import { getApiBase, readJsonResponse } from "./api";

export type ShopOrderRow = {
  id: number;
  customer_id: number;
  total_price: string | number;
  shipping_address: string | null;
  note: string | null;
  status: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
};

export type WorkingScheduleRow = {
  id: number;
  barber_id: number;
  work_date: string;
  start_time: string;
  end_time: string;
  is_day_off: number;
  created_at: string;
};

function headers(uid: string, json = false, branchId?: number): HeadersInit {
  const h: Record<string, string> = { "x-firebase-uid": uid };
  if (json) h["Content-Type"] = "application/json";
  if (branchId != null && branchId > 0) {
    h["x-manager-branch-id"] = String(branchId);
  }
  return h;
}

export type ManagerBranchRow = {
  id: number;
  name: string | null;
  address: string | null;
  phone: string | null;
};

/** GET /api/manager/branches */
export async function fetchManagerBranchList(
  uid: string,
): Promise<ManagerBranchRow[]> {
  const res = await fetch(`${getApiBase()}/api/manager/branches`, {
    headers: headers(uid),
    cache: "no-store",
  });
  const data = await readJsonResponse<{
    branches?: ManagerBranchRow[];
    error?: string;
  }>(res);
  if (!res.ok) throw new Error(data.error ?? "Lỗi tải chi nhánh");
  return data.branches ?? [];
}

export async function fetchManagerOrders(
  uid: string,
  branchId?: number,
): Promise<ShopOrderRow[]> {
  const res = await fetch(`${getApiBase()}/api/manager/shop-orders`, {
    headers: headers(uid, false, branchId),
    cache: "no-store",
  });
  const data = await readJsonResponse<{
    orders?: ShopOrderRow[];
    error?: string;
  }>(res);
  if (!res.ok) throw new Error(data.error ?? "Lỗi tải đơn hàng");
  return data.orders ?? [];
}

export async function patchOrderStatus(
  uid: string,
  id: number,
  status: string,
  branchId?: number,
): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/api/manager/shop-orders/${id}/status`,
    {
      method: "PATCH",
      headers: headers(uid, true, branchId),
      body: JSON.stringify({ status }),
    },
  );
  const data = await readJsonResponse<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "Cập nhật thất bại");
}

export async function fetchSchedules(
  uid: string,
  params?: { barber_id?: number; from?: string; to?: string },
  branchId?: number,
): Promise<WorkingScheduleRow[]> {
  const q = new URLSearchParams();
  if (params?.barber_id) q.set("barber_id", String(params.barber_id));
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  const res = await fetch(
    `${getApiBase()}/api/manager/working-schedules?${q.toString()}`,
    { headers: headers(uid, false, branchId), cache: "no-store" },
  );
  const data = await readJsonResponse<{
    schedules?: WorkingScheduleRow[];
    error?: string;
  }>(res);
  if (!res.ok) throw new Error(data.error ?? "Lỗi lịch làm việc");
  return data.schedules ?? [];
}

export async function upsertSchedule(
  uid: string,
  body: Record<string, unknown>,
  branchId?: number,
): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/manager/working-schedules`, {
    method: "POST",
    headers: headers(uid, true, branchId),
    body: JSON.stringify(body),
  });
  const data = await readJsonResponse<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "Lưu lịch thất bại");
}

export async function deleteSchedule(
  uid: string,
  id: number,
  branchId?: number,
): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/api/manager/working-schedules/${id}`,
    { method: "DELETE", headers: headers(uid, false, branchId) },
  );
  const data = await readJsonResponse<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "Xóa thất bại");
}

export type BarberOption = { barber_id: number; full_name: string | null };

export async function fetchManagerBarbers(
  uid: string,
  branchId?: number,
): Promise<BarberOption[]> {
  const res = await fetch(`${getApiBase()}/api/manager/barbers`, {
    headers: headers(uid, false, branchId),
    cache: "no-store",
  });
  const data = await readJsonResponse<{
    barbers?: Array<{ barber_id: number; full_name?: string | null }>;
    error?: string;
  }>(res);
  if (!res.ok) throw new Error(data.error ?? "Lỗi tải danh sách thợ");
  return (data.barbers ?? []).map((b) => ({
    barber_id: b.barber_id,
    full_name: b.full_name ?? null,
  }));
}

export type ManagerAppointmentRow = {
  id: number;
  customer_id: number;
  barber_id: number;
  service_id: number;
  appt_date: string;
  start_time: string;
  end_time: string;
  total_price: string | number;
  status: string;
  note: string | null;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  service_name: string | null;
  barber_name: string | null;
};

export async function fetchManagerAppointments(
  uid: string,
  params?: { from?: string; to?: string; status?: string; barber_id?: number; service_id?: number },
  branchId?: number,
): Promise<ManagerAppointmentRow[]> {
  const q = new URLSearchParams();
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  if (params?.status) q.set("status", params.status);
  if (params?.barber_id) q.set("barber_id", String(params.barber_id));
  if (params?.service_id) q.set("service_id", String(params.service_id));
  const res = await fetch(
    `${getApiBase()}/api/manager/appointments?${q.toString()}`,
    { headers: headers(uid, false, branchId), cache: "no-store" },
  );
  const data = await readJsonResponse<{
    appointments?: ManagerAppointmentRow[];
    error?: string;
  }>(res);
  if (!res.ok) throw new Error(data.error ?? "Lỗi tải lịch hẹn");
  return data.appointments ?? [];
}

export async function patchAppointmentStatus(
  uid: string,
  id: number,
  status: string,
  branchId?: number,
): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/api/manager/appointments/${id}/status`,
    {
      method: "PATCH",
      headers: headers(uid, true, branchId),
      body: JSON.stringify({ status }),
    },
  );
  const data = await readJsonResponse<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "Cập nhật trạng thái thất bại");
}

export type ManagerStatsResponse = {
  branch_id: number;
  from: string;
  to: string;
  summary: {
    appointment_count: number;
    revenue_completed: number;
    /** Đơn shop đã giao / hoàn thành (delivered + completed) trong kỳ */
    revenue_shop: number;
  };
  appointments_by_status: Array<{ status: string; cnt: number }>;
  appointments_by_day: Array<{
    d: string;
    appointments: number;
    revenue: string | number;
  }>;
  shop_orders_by_day: Array<{
    d: string;
    orders: number;
    revenue: string | number;
  }>;
  shop_orders_scope: "global" | "branch";
};

/** GET /api/manager/stats */
export async function fetchManagerStats(
  uid: string,
  branchId: number,
  params?: { from?: string; to?: string },
): Promise<ManagerStatsResponse> {
  const q = new URLSearchParams();
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  const res = await fetch(
    `${getApiBase()}/api/manager/stats?${q.toString()}`,
    { headers: headers(uid, false, branchId), cache: "no-store" },
  );
  const data = await readJsonResponse<{
    error?: string;
  } & Partial<ManagerStatsResponse>>(res);
  if (!res.ok) throw new Error(data.error ?? "Lỗi tải thống kê");
  return data as ManagerStatsResponse;
}

export type ServiceOption = { id: number; name: string };

export async function fetchManagerServices(): Promise<ServiceOption[]> {
  const res = await fetch(`${getApiBase()}/api/services`, {
    cache: "no-store",
  });
  const data = await readJsonResponse<{
    data?: Array<{ id: number; name: string }>;
    error?: string;
  }>(res);
  if (!res.ok) throw new Error(data.error ?? "Lỗi tải dịch vụ");
  return data.data ?? [];
}
