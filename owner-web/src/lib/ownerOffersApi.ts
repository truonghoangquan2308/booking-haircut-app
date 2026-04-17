import { getApiBase, readJsonResponse } from "./api";

export type OfferRow = {
  id: number;
  title: string;
  description: string | null;
  discount_percent: number;
  usage_type: "unlimited" | "single_customer";
  assigned_customer_id: number | null;
  expires_at: string;
  accent_color: string;
  is_active: number;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  usageCount?: number;
  assignedCustomerName?: string | null;
};

export type Customer = {
  id: number;
  full_name: string;
  phone: string | null;
};

export type UsageHistory = {
  id: number;
  promotion_id?: number;
  customer_id: number;
  full_name: string;
  phone: string | null;
  title?: string;
  discount_percent?: number;
  order_id: number | null;
  used_at: string;
};

function headers(uid: string, json = false): HeadersInit {
  const h: Record<string, string> = { "x-firebase-uid": uid };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export async function fetchOwnerOffers(firebaseUid: string): Promise<OfferRow[]> {
  const res = await fetch(`${getApiBase()}/api/owner/offers`, {
    headers: headers(firebaseUid),
    cache: "no-store",
  });
  const data = await readJsonResponse<{ offers?: OfferRow[]; error?: string }>(
    res,
  );
  if (!res.ok) throw new Error(data.error ?? "Lỗi tải ưu đãi");
  return data.offers ?? [];
}

export async function createOwnerOffer(
  firebaseUid: string,
  body: {
    title: string;
    description?: string;
    discount_percent: number;
    usage_type: "unlimited" | "single_customer";
    assigned_customer_id?: number | null;
    expires_at: string;
    accent_color?: string;
    is_active?: number;
    sort_order?: number;
  },
): Promise<OfferRow> {
  const res = await fetch(`${getApiBase()}/api/owner/offers`, {
    method: "POST",
    headers: headers(firebaseUid, true),
    body: JSON.stringify(body),
  });
  const data = await readJsonResponse<{ offer?: OfferRow; error?: string }>(
    res,
  );
  if (!res.ok || !data.offer) throw new Error(data.error ?? "Không tạo được");
  return data.offer;
}

export async function updateOwnerOffer(
  firebaseUid: string,
  id: number,
  body: Partial<{
    title: string;
    description: string;
    discount_percent: number;
    usage_type: string;
    assigned_customer_id: number | null;
    expires_at: string;
    accent_color: string;
    is_active: number;
    sort_order: number;
  }>,
): Promise<OfferRow> {
  const res = await fetch(`${getApiBase()}/api/owner/offers/${id}`, {
    method: "PATCH",
    headers: headers(firebaseUid, true),
    body: JSON.stringify(body),
  });
  const data = await readJsonResponse<{ offer?: OfferRow; error?: string }>(
    res,
  );
  if (!res.ok || !data.offer) throw new Error(data.error ?? "Cập nhật thất bại");
  return data.offer;
}

export async function deleteOwnerOffer(
  firebaseUid: string,
  id: number,
): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/owner/offers/${id}`, {
    method: "DELETE",
    headers: headers(firebaseUid),
  });
  const data = await readJsonResponse<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "Xóa thất bại");
}

export async function fetchCustomers(
  firebaseUid: string,
  query?: string
): Promise<Customer[]> {
  const url = new URL(`${getApiBase()}/api/owner/customers`);
  if (query) url.searchParams.set("q", query);

  const res = await fetch(url.toString(), {
    headers: headers(firebaseUid),
    cache: "no-store",
  });
  const data = await readJsonResponse<{ customers?: Customer[]; error?: string }>(
    res,
  );
  if (!res.ok) throw new Error(data.error ?? "Lỗi tải khách hàng");
  return data.customers ?? [];
}

export async function fetchUsageHistory(
  firebaseUid: string,
  offerId?: number
): Promise<UsageHistory[]> {
  let url = `${getApiBase()}/api/owner/offers`;
  if (offerId) {
    url += `/${offerId}/usage-history`;
  } else {
    url += `-history/all`;
  }

  const res = await fetch(url, {
    headers: headers(firebaseUid),
    cache: "no-store",
  });
  const data = await readJsonResponse<{ history?: UsageHistory[]; error?: string }>(
    res,
  );
  if (!res.ok) throw new Error(data.error ?? "Lỗi tải lịch sử");
  return data.history ?? [];
}

