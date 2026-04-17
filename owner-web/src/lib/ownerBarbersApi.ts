import { getApiBase, readJsonResponse } from "./api";

export type OwnerBarberRow = {
  barber_id: number;
  branch_id: number | null;
  branch_name: string | null;
  user_id: number;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  /** Có sau khi thợ đăng nhập app (OTP Firebase); chưa có = chưa gắn tài khoản Firebase */
  firebase_uid: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  status: string;
  bio: string | null;
  is_available: number;
  rating: string | number | null;
  total_reviews: number | null;
  appointments_today: number;
  revenue_month: number;
};

function headers(uid: string, json = false): HeadersInit {
  const h: Record<string, string> = { "x-firebase-uid": uid };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export async function fetchOwnerBarbers(firebaseUid: string): Promise<OwnerBarberRow[]> {
  const res = await fetch(`${getApiBase()}/api/owner/barbers`, {
    headers: headers(firebaseUid),
    cache: "no-store",
  });
  const data = await readJsonResponse<{
    barbers?: OwnerBarberRow[];
    error?: string;
  }>(res);
  if (!res.ok) throw new Error(data.error ?? "Lỗi tải danh sách thợ");
  return data.barbers ?? [];
}

export async function fetchOwnerBarbersStats(firebaseUid: string): Promise<{
  total_barbers: number;
  working_today: number;
  off_today: number;
  avg_rating: number;
}> {
  const res = await fetch(`${getApiBase()}/api/owner/barbers/stats`, {
    headers: headers(firebaseUid),
    cache: "no-store",
  });
  const data = await readJsonResponse<{
    total_barbers: number;
    working_today: number;
    off_today: number;
    avg_rating: number;
    error?: string;
  }>(res);
  if (!res.ok) throw new Error(data.error ?? "Lỗi tải thống kê thợ");
  return {
    total_barbers: data.total_barbers,
    working_today: data.working_today,
    off_today: data.off_today,
    avg_rating: data.avg_rating,
  };
}

export type BarberDetails = {
  barber: OwnerBarberRow & { user_created_at: string };
  stats: {
    total_appointments: number;
    revenue_month: number;
    avg_rating: number;
    cancel_rate: number;
  };
  appointments: Array<{
    id: number;
    appt_date: string;
    start_time: string;
    end_time: string;
    total_price: number;
    status: string;
    service_name: string;
    customer_name: string;
  }>;
  reviews: Array<{
    rating: number;
    comment: string | null;
    created_at: string;
    customer_name: string;
  }>;
};

export async function fetchOwnerBarberDetails(firebaseUid: string, barberId: number): Promise<BarberDetails> {
  const res = await fetch(`${getApiBase()}/api/owner/barbers/${barberId}/details`, {
    headers: headers(firebaseUid),
    cache: "no-store",
  });
  const data = await readJsonResponse<BarberDetails & { error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "Lỗi tải chi tiết thợ");
  return data;
}

export async function createOwnerBarber(
  firebaseUid: string,
  body: {
    full_name?: string;
    phone: string;
    branch_id: number;
    bio?: string;
    is_available?: number;
  },
): Promise<OwnerBarberRow> {
  const res = await fetch(`${getApiBase()}/api/owner/barbers`, {
    method: "POST",
    headers: headers(firebaseUid, true),
    body: JSON.stringify(body),
  });
  const data = await readJsonResponse<{ barber?: OwnerBarberRow; error?: string }>(
    res,
  );
  if (!res.ok || !data.barber) throw new Error(data.error ?? "Không tạo được thợ");
  return data.barber;
}

export async function patchOwnerBarber(
  firebaseUid: string,
  barberId: number,
  body: Partial<{
    full_name: string | null;
    branch_id: number | null;
    bio: string | null;
    is_available: number;
  }>,
): Promise<OwnerBarberRow> {
  const res = await fetch(`${getApiBase()}/api/owner/barbers/${barberId}`, {
    method: "PATCH",
    headers: headers(firebaseUid, true),
    body: JSON.stringify(body),
  });
  const data = await readJsonResponse<{ barber?: OwnerBarberRow; error?: string }>(
    res,
  );
  if (!res.ok || !data.barber) throw new Error(data.error ?? "Cập nhật thất bại");
  return data.barber;
}
