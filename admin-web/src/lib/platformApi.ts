import { getApiBase, readJsonResponse } from "./api";

export type PlatformStats = {
  users_total: number;
  customers: number;
  owners: number;
  managers: number;
  barbers: number;
  shops_total: number;
  shops_pending: number;
  shops_approved?: number;
  appointments_total: number;
  shop_orders_total: number;
  revenue_today?: number;
  revenue_month?: number;
};

export type PlatformUser = {
  id: number;
  phone: string | null;
  email: string | null;
  full_name: string | null;
  role: string;
  status: string;
  is_locked: number;
  created_at: string;
};

export type PlatformUsersResult = {
  users: PlatformUser[];
  total: number;
  page: number;
  page_size: number;
};

export type AuditLogRow = {
  id: number;
  admin_user_id: number;
  action: string;
  target_type: string | null;
  target_id: number | null;
  detail: string | null;
  created_at: string;
  admin_email: string | null;
  admin_name: string | null;
};

export async function fetchPlatformStats(firebaseUid: string): Promise<PlatformStats> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/admin/platform/stats`, {
    cache: "no-store",
    headers: { "x-firebase-uid": firebaseUid },
  });
  const data = await readJsonResponse<{ stats?: PlatformStats; error?: string }>(
    res,
  );
  if (!res.ok || !data.stats) throw new Error(data.error ?? "Lỗi stats");
  return data.stats;
}

export async function fetchPlatformUsers(
  firebaseUid: string,
  params?: { role?: string; q?: string; page?: number; page_size?: number },
): Promise<PlatformUsersResult> {
  const base = getApiBase();
  const q = new URLSearchParams();
  if (params?.role) q.set("role", params.role);
  if (params?.q) q.set("q", params.q);
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  const res = await fetch(
    `${base}/api/admin/platform/users?${q.toString()}`,
    {
      cache: "no-store",
      headers: { "x-firebase-uid": firebaseUid },
    },
  );
  const data = await readJsonResponse<{
    users?: PlatformUser[];
    total?: number;
    page?: number;
    page_size?: number;
    error?: string;
  }>(res);
  if (!res.ok) throw new Error(data.error ?? "Lỗi users");
  return {
    users: data.users ?? [],
    total: Number(data.total) || 0,
    page: Number(data.page) || 1,
    page_size: Number(data.page_size) || 20,
  };
}

export async function patchPlatformUser(
  firebaseUid: string,
  userId: number,
  body: { is_locked?: boolean; role?: string },
): Promise<PlatformUser> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/admin/platform/users/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-firebase-uid": firebaseUid,
    },
    body: JSON.stringify(body),
  });
  const data = await readJsonResponse<{ user?: PlatformUser; error?: string }>(
    res,
  );
  if (!res.ok || !data.user) throw new Error(data.error ?? "Cập nhật thất bại");
  return data.user;
}

export async function fetchAuditLogs(
  firebaseUid: string,
  params?: {
    page?: number;
    page_size?: number;
    q?: string;
    action?: string;
    from?: string;
    to?: string;
  },
): Promise<{ logs: AuditLogRow[]; total: number; page: number; page_size: number }> {
  const base = getApiBase();
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  if (params?.q) q.set("q", params.q);
  if (params?.action) q.set("action", params.action);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  const res = await fetch(
    `${base}/api/admin/platform/audit-log?${q.toString()}`,
    {
      cache: "no-store",
      headers: { "x-firebase-uid": firebaseUid },
    },
  );
  const data = await readJsonResponse<{
    logs?: AuditLogRow[];
    total?: number;
    page?: number;
    page_size?: number;
    error?: string;
  }>(res);
  if (!res.ok) throw new Error(data.error ?? "Lỗi audit log");
  return {
    logs: data.logs ?? [],
    total: Number(data.total) || 0,
    page: Number(data.page) || 1,
    page_size: Number(data.page_size) || 25,
  };
}
