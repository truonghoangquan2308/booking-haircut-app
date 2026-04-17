"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, getApiBase } from "@/lib/api";
import { BbLoginLayout } from "@/components/BbLoginLayout";

const EXPECTED_ROLE = "admin";

export default function AdminLoginPage() {
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
      if (user.role !== EXPECTED_ROLE) {
        await signOut(auth);
        setError(
          `Tài khoản không phải Admin (role hiện tại: ${user.role ?? "?"})`,
        );
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
      } else if (msg.includes("auth/too-many-requests")) {
        msg = "Thử quá nhiều lần, đợi vài phút rồi thử lại.";
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
      title="Đăng nhập Admin"
      subtitle="Quản trị nền tảng — tách biệt app khách"
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
      {process.env.NEXT_PUBLIC_API_URL?.includes("3080") ? (
        <p className="mt-2 text-center text-xs text-amber-800">
          Đã tự đổi port <strong>3080</strong> → <strong>3000</strong> (đúng với{" "}
          <code className="rounded bg-amber-100 px-1">node server.js</code>).
          Sửa <code className="rounded bg-amber-100 px-1">.env.local</code> và
          restart <code className="rounded bg-amber-100 px-1">npm run dev</code>{" "}
          cho khớp.
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border-0 bg-bb-input px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-bb-navy/30"
          placeholder="admin@gmail.com"
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
          {loading ? "Đang đăng nhập…" : "Đăng nhập Admin"}
        </button>
      </form>
    </BbLoginLayout>
  );
}
