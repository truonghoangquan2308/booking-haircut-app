const DEFAULT_API_BASE = "http://localhost:3000";

export function getApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return DEFAULT_API_BASE;
  return raw.replace(/\/+$/, "");
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
      `Không kết nối được backend (${base}). Hãy chạy: flutter_booking_app/backend → node server.js`
    );
  }
  const text = await res.text();
  if (text.trim().startsWith("<")) {
    throw new Error("Backend trả HTML thay vì JSON. Kiểm tra NEXT_PUBLIC_API_URL.");
  }
  const data = JSON.parse(text) as { user?: StaffUser; error?: string };
  if (!res.ok || !data.user) {
    throw new Error(data.error ?? `Lỗi API (${res.status})`);
  }
  return data.user;
}

/** Map role → URL của web tương ứng */
export function getRedirectUrlForRole(role: string): string | null {
  const map: Record<string, string | undefined> = {
    admin: process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3002",
    owner: process.env.NEXT_PUBLIC_OWNER_URL ?? "http://localhost:3001",
    manager: process.env.NEXT_PUBLIC_MANAGER_URL ?? "http://localhost:3003",
    receptionist: process.env.NEXT_PUBLIC_RECEPTIONIST_URL ?? "http://localhost:3004",
  };
  return map[role] ?? null;
}
