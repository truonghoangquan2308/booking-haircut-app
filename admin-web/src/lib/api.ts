const DEFAULT_API_BASE = "http://localhost:3000";

/**
 * Chuẩn hóa base URL API.
 * Nhiều máy nhầm **3080** với **3000** (Express trong `flutter_booking_app/backend` mặc định :3000).
 */
export function getApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return DEFAULT_API_BASE;
  let base = raw.replace(/\/+$/, "");
  try {
    const u = new URL(base);
    const h = u.hostname.toLowerCase();
    if ((h === "localhost" || h === "127.0.0.1") && u.port === "3080") {
      u.port = "3000";
      return u.origin;
    }
  } catch {
    /* giữ nguyên nếu không parse được URL */
  }
  return base;
}

/** Đọc JSON; nếu server trả HTML (404 Next / proxy sai) thì báo lỗi rõ. */
export async function readJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const t = text.trim();
  if (t.startsWith("<") || t.startsWith("<!")) {
    throw new Error(
      "API trả về HTML thay vì JSON. Chạy backend Node (flutter_booking_app/backend, port 3000) và trong admin-web tạo .env.local: NEXT_PUBLIC_API_URL=http://localhost:3000",
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Phản hồi không phải JSON (status ${res.status}). Kiểm tra URL backend.`,
    );
  }
}

export type StaffUser = {
  id: number;
  role: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  is_locked?: number | boolean | null;
};

export async function fetchUserByFirebaseUid(uid: string): Promise<StaffUser> {
  const base = getApiBase();
  const url = `${base}/api/users/by-firebase/${encodeURIComponent(uid)}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    throw new Error(
      `Không kết nối được ${base}. Hãy chạy backend: flutter_booking_app/backend → node server.js (port 3000).`,
    );
  }
  const data = await readJsonResponse<{ user?: StaffUser; error?: string }>(
    res,
  );
  if (!res.ok || !data.user) {
    if (res.status === 404) {
      throw new Error(
        `${data.error ?? "Không tìm thấy user trong DB"}. Trong MySQL bảng users, dòng admin cần firebase_uid = UID Firebase của tài khoản này và role = 'admin'.`,
      );
    }
    throw new Error(data.error ?? `Lỗi API (${res.status})`);
  }
  return data.user;
}
