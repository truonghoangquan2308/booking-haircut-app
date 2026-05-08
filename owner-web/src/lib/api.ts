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
      "API trả về HTML thay vì JSON. Chạy backend Node (port 3000) và đặt NEXT_PUBLIC_API_URL=http://localhost:3000 trong owner-web/.env.local",
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
  const res = await fetch(
    `${base}/api/users/by-firebase/${encodeURIComponent(uid)}`,
    { cache: "no-store" },
  );
  const data = await readJsonResponse<{ user?: StaffUser; error?: string }>(
    res,
  );
  if (!res.ok || !data.user) {
    throw new Error(data.error ?? "Không tìm thấy user trong hệ thống");
  }
  return data.user;
}
