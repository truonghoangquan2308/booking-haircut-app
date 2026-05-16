"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, getRedirectUrlForRole } from "@/lib/api";

// ─── Danh sách vai trò ──────────────────────────────────────────────────────
const ROLES = [
  {
    key: "admin",
    label: "Admin",
    description: "Quản trị toàn hệ thống",
    icon: "🛡️",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#c4b5fd",
  },
  {
    key: "owner",
    label: "Owner",
    description: "Chủ chuỗi",
    icon: "👑",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fcd34d",
  },
  {
    key: "manager",
    label: "Manager",
    description: "Quản lý chi nhánh",
    icon: "🏪",
    color: "#0369a1",
    bg: "#eff6ff",
    border: "#93c5fd",
  },
  {
    key: "receptionist",
    label: "Receptionist",
    description: "Tiếp nhận & đặt lịch",
    icon: "📋",
    color: "#047857",
    bg: "#ecfdf5",
    border: "#6ee7b7",
  },
] as const;

type RoleKey = (typeof ROLES)[number]["key"];

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedRoleInfo = ROLES.find((r) => r.key === selectedRole);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedRole) {
      setError("Vui lòng chọn vai trò trước khi đăng nhập.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      // 1. Đăng nhập Firebase
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;

      // 2. Lấy thông tin user từ backend
      const user = await fetchUserByFirebaseUid(uid);

      // 3. Kiểm tra role có khớp không
      // owner được phép vào manager; manager được phép vào receptionist
      const roleAccess: Record<RoleKey, string[]> = {
        admin: ["admin"],
        owner: ["owner"],
        manager: ["manager"],
        receptionist: ["receptionist"],
      };

      if (!roleAccess[selectedRole].includes(user.role)) {
        await signOut(auth);
        setError(
          `Tài khoản này có vai trò "${user.role}", không phải "${selectedRole}". Hãy chọn đúng vai trò.`
        );
        return;
      }

      // 4. Kiểm tra tài khoản bị khoá
      if (user.is_locked === 1 || user.is_locked === true) {
        await signOut(auth);
        setError("Tài khoản đã bị khoá. Liên hệ Admin để được hỗ trợ.");
        return;
      }

      // 5. Lấy Firebase ID token và gửi kèm khi redirect
      const token = await cred.user.getIdToken();

      // 6. Lưu token vào localStorage để web đích đọc (nếu chạy chung domain)
      localStorage.setItem("bb_firebase_token", token);
      localStorage.setItem("bb_firebase_uid", uid);
      localStorage.setItem("bb_user_role", user.role);
      localStorage.setItem("bb_user_id", String(user.id));
      localStorage.setItem(
        "bb_user_name",
        user.full_name ?? user.email ?? "User"
      );

      // 7. Redirect sang web tương ứng (kèm token vì localStorage không chia sẻ qua port khác)
      const redirectUrl = getRedirectUrlForRole(user.role);
      if (!redirectUrl) {
        setError(`Không tìm thấy URL cho vai trò "${user.role}".`);
        return;
      }

      // Chuyển token qua URL hash để tránh lộ trong server/proxy logs.
      window.location.href = `${redirectUrl}/dashboard#token=${encodeURIComponent(token)}&uid=${encodeURIComponent(uid)}`;
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("auth/invalid-credential") ||
        msg.includes("auth/wrong-password") ||
        msg.includes("auth/user-not-found")
      ) {
        msg = "Sai email hoặc mật khẩu.";
      } else if (msg.includes("auth/too-many-requests")) {
        msg = "Thử quá nhiều lần. Vui lòng đợi vài phút và thử lại.";
      } else if (msg.includes("auth/invalid-email")) {
        msg = "Định dạng email không hợp lệ.";
      }
      setError(msg);
      try {
        await signOut(auth);
      } catch {
        /* ignore */
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003366] via-[#004488] to-[#1a5276] flex items-center justify-center p-4">
      {/* Background decorative circles */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.02]" />
      </div>

      <div className="relative w-full max-w-[520px]">
        {/* Logo + Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[20px] bg-white/90 shadow-lg">
            <Image
              src="/images/skibidi-logo.png"
              alt="Skibidi Barber"
              width={64}
              height={64}
              className="rounded-xl object-contain"
            />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70 mb-2">
            Skibidi Barber
          </p>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Skibidi BBShop
          </h1>
          <p className="mt-2 text-white/70 text-base">
            Đăng nhập để quản lý chuỗi và báo cáo
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Step 1 — Chọn vai trò */}
          <div className="px-7 pt-7 pb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Bước 1 — Chọn vai trò của bạn
            </p>
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map((role) => (
                <button
                  key={role.key}
                  type="button"
                  id={`role-btn-${role.key}`}
                  onClick={() => {
                    setSelectedRole(role.key);
                    setError(null);
                  }}
                  className="role-card rounded-2xl p-4 text-left transition-all"
                  style={{
                    backgroundColor:
                      selectedRole === role.key ? role.bg : "#f9fafb",
                    borderColor:
                      selectedRole === role.key ? role.border : "transparent",
                    borderWidth: "2px",
                    borderStyle: "solid",
                  }}
                  aria-pressed={selectedRole === role.key}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{role.icon}</span>
                    {selectedRole === role.key && (
                      <span
                        className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: role.color,
                          color: "#fff",
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                  <p
                    className="font-bold text-sm"
                    style={{ color: selectedRole === role.key ? role.color : "#1a2e4a" }}
                  >
                    {role.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-tight">
                    {role.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="mx-7 border-t border-gray-100" />

          {/* Step 2 — Nhập thông tin */}
          <div className="px-7 pt-5 pb-7">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Bước 2 — Nhập thông tin đăng nhập
            </p>

            {/* Selected role indicator */}
            {selectedRoleInfo ? (
              <div
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 mb-4 text-sm font-medium"
                style={{
                  backgroundColor: selectedRoleInfo.bg,
                  color: selectedRoleInfo.color,
                }}
              >
                <span>{selectedRoleInfo.icon}</span>
                <span>
                  Đăng nhập với tư cách:{" "}
                  <strong>{selectedRoleInfo.label}</strong>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 mb-4 text-sm text-gray-400 bg-gray-50">
                <span>👆</span>
                <span>Vui lòng chọn vai trò ở trên trước</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  selectedRoleInfo
                    ? `Email ${selectedRoleInfo.label.toLowerCase()}@gmail.com`
                    : "Email"
                }
                className="w-full rounded-[8px] border-[1.5px] border-[#E5E7EB] bg-white px-4 py-3 text-gray-900 text-sm outline-none transition focus:border-[#F5A623] focus:shadow-[0_0_0_3px_rgba(245,166,35,0.15)] placeholder:text-gray-400"
              />
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                className="w-full rounded-[8px] border-[1.5px] border-[#E5E7EB] bg-white px-4 py-3 text-gray-900 text-sm outline-none transition focus:border-[#F5A623] focus:shadow-[0_0_0_3px_rgba(245,166,35,0.15)] placeholder:text-gray-400"
              />

              {error && (
                <div
                  className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
                  role="alert"
                >
                  ⚠️ {error}
                </div>
              )}

              <button
                id="login-submit"
                type="submit"
                disabled={loading || !selectedRole}
                className="w-full rounded-[8px] bg-[#F5A623] px-6 py-3.5 text-base font-semibold text-[#111827] shadow-sm transition hover:bg-[#E09610] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? "Đang đăng nhập…"
                  : selectedRoleInfo
                  ? `Đăng nhập ${selectedRoleInfo.label}`
                  : "Chọn vai trò trước"}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/40 mt-6">
          SKIBIDI — Haircut Booking App © 2026
        </p>
      </div>
    </div>
  );
}
