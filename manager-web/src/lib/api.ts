const DEFAULT_API_BASE = "http://localhost:3000";

export function getApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return DEFAULT_API_BASE;
  const base = raw.replace(/\/+$/, "");
  try {
    const u = new URL(base);
    const h = u.hostname.toLowerCase();
    if ((h === "localhost" || h === "127.0.0.1") && u.port === "3080") {
      u.port = "3000";
      return u.origin;
    }
  } catch {
    /* ignore */
  }
  return base;
}

export async function readJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const t = text.trim();
  if (t.startsWith("<") || t.startsWith("<!")) {
    throw new Error(
      "API trả HTML. Chạy backend (port 3000) và đặt NEXT_PUBLIC_API_URL trong .env.local.",
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Phản hồi không phải JSON (status ${res.status}).`);
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
      `Không kết nối ${base}. Chạy: flutter_booking_app/backend → node server.js`,
    );
  }
  const data = await readJsonResponse<{ user?: StaffUser; error?: string }>(
    res,
  );
  if (!res.ok || !data.user) {
    if (res.status === 404) {
      throw new Error(
        `${data.error ?? "Không tìm thấy user"}. Cần firebase_uid + role manager trong MySQL.`,
      );
    }
    throw new Error(data.error ?? `Lỗi API (${res.status})`);
  }
  return data.user;
}
