"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, getApiBase } from "@/lib/api";
import { BbLoginLayout } from "@/components/BbLoginLayout";

const ALLOWED_ROLES = new Set(["manager", "owner"]);

export default function ManagerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const uid = cred.user.uid;
      const user = await fetchUserByFirebaseUid(uid);
      if (!ALLOWED_ROLES.has(user.role)) {
        await signOut(auth);
        setError(
          `Cần tài khoản Manager hoặc Owner (role hiện tại: ${user.role ?? "?"})`,
        );
        return;
      }
      if (user.is_locked === 1 || user.is_locked === true) {
        await signOut(auth);
        setError("Tài khoản đã bị khóa.");
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      let msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("auth/invalid-credential") ||
        msg.includes("auth/wrong-password") ||
        msg.includes("auth/user-not-found")
      ) {
        msg = "Sai email hoặc mật khẩu Firebase.";
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
    <BbLoginLayout
      title="Đăng nhập Quản lý"
      subtitle="Web chi nhánh — cùng giao diện Owner/Admin"
    >
      <h2 className="text-center text-[26px] font-extrabold text-black/87">
        Email &amp; mật khẩu
      </h2>
      <p className="mt-2 text-center text-sm text-gray-600">
        API:{" "}
        <code className="rounded bg-bb-input px-1.5 py-0.5 text-xs">
          {getApiBase()}
        </code>
      </p>
      <p className="mt-2 text-center text-xs text-gray-500">
        Chạy:{" "}
        <code className="rounded bg-bb-input px-1">npm run dev</code> tại{" "}
        <strong>manager-web</strong> (port 3004).
      </p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border-0 bg-bb-input px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-bb-navy/30"
          placeholder="manager@gmail.com"
        />
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border-0 bg-bb-input px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-bb-navy/30"
          placeholder="Mật khẩu"
        />
        {error && (
          <p className="text-center text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-bb-yellow py-3.5 text-lg font-bold text-black/80 shadow-sm hover:brightness-95 disabled:opacity-50"
        >
          {loading ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </BbLoginLayout>
  );
}
