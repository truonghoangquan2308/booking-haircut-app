import { getApiBase } from "./api";

export function resolveAvatarUrl(raw?: string | null): string {
  if (!raw) return "/default-avatar.svg";
  let s = String(raw).trim();
  if (!s) return "/default-avatar.svg";

  // Normalize backslashes to forward slashes (Windows paths from app)
  s = s.replace(/\\+/g, "/");

  // If it's a full URL already
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      // Android emulator often uploads using host 10.0.2.2 to reach host machine.
      // Replace that with the configured API base so the browser can fetch it.
      if (u.hostname === '10.0.2.2') {
        const base = getApiBase().replace(/\/+$/, "");
        return `${base}${u.pathname}${u.search}`;
      }
    } catch {
      // fallthrough
    }
    return s;
  }

  // If it's an absolute path on the server (starts with /), use as-is
  if (s.startsWith("/")) return s;

  // If it looks like a Windows absolute path like C:/ or C:\, bail to default
  if (/^[a-zA-Z]:\//.test(s)) return "/default-avatar.svg";

  // Otherwise treat as relative path under API base (e.g. uploads/...) and join
  const base = getApiBase().replace(/\/+$/, "");
  return `${base}/${s.replace(/^\/+/, "")}`;
}

export default resolveAvatarUrl;
