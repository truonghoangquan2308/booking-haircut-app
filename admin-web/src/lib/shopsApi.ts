import { getApiBase, readJsonResponse } from "./api";

export type ShopRow = {
  id: number;
  name: string;
  description: string | null;
  is_blocked: number | boolean;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
  owner_user_id: number | null;
  manager_user_id: number | null;
  owner_name?: string | null;
  owner_email?: string | null;
  manager_name?: string | null;
  manager_email?: string | null;
  manager_phone?: string | null;
};

export type AdminShopsResult = {
  shops: ShopRow[];
  total: number;
  page: number;
  page_size: number;
};

export async function fetchAdminShops(
  firebaseUid: string,
  params?: { q?: string; page?: number; page_size?: number },
): Promise<AdminShopsResult> {
  const base = getApiBase();
  const q = new URLSearchParams();
  if (params?.q) q.set("q", params.q);
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  const res = await fetch(`${base}/api/admin/shops?${q.toString()}`, {
    cache: "no-store",
    headers: { "x-firebase-uid": firebaseUid },
  });
  const data = await readJsonResponse<{
    shops?: ShopRow[];
    total?: number;
    page?: number;
    page_size?: number;
    error?: string;
  }>(res);
  if (!res.ok) throw new Error(data.error ?? "Lỗi tải shops");
  return {
    shops: data.shops ?? [],
    total: Number(data.total) || 0,
    page: Number(data.page) || 1,
    page_size: Number(data.page_size) || 20,
  };
}

export async function patchShop(
  firebaseUid: string,
  shopId: number,
  body: {
    approval_status?: string;
    is_blocked?: boolean;
    /** Gán user làm Manager chi nhánh / shop (hoặc null để gỡ). */
    manager_user_id?: number | null;
  },
): Promise<ShopRow> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/admin/shops/${shopId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-firebase-uid": firebaseUid,
    },
    body: JSON.stringify(body),
  });
  const data = await readJsonResponse<{ shop?: ShopRow; error?: string }>(
    res,
  );
  if (!res.ok) throw new Error(data.error ?? "Cập nhật thất bại");
  return data.shop as ShopRow;
}
