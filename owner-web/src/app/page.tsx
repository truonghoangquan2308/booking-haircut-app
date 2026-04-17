"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid } from "@/lib/api";
import { BbLoginLayout } from "@/components/BbLoginLayout";

const EXPECTED_ROLE = "owner";

export default function OwnerLoginPage() {
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
          `Tài khoản không phải Owner (role hiện tại: ${user.role ?? "?"})`,
        );
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
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
      title="Đăng nhập Owner"
      subtitle="Báo cáo + quản lý chi nhánh, dịch vụ, shop (menu sau khi đăng nhập)"
    >
      <h2 className="text-center text-[26px] font-extrabold text-black/87">
        Email &amp; mật khẩu
      </h2>
      <p className="mt-2 text-center text-sm text-gray-600">
        API:{" "}
        <code className="rounded bg-bb-input px-1.5 py-0.5 text-xs">
          {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}
        </code>
      </p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="block">
          <span className="sr-only">Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border-0 bg-bb-input px-4 py-3 text-gray-900 outline-none ring-0 placeholder:text-gray-400 focus:ring-2 focus:ring-bb-navy/30"
            placeholder="Email (owner@gmail.com)"
          />
        </label>
        <label className="block">
          <span className="sr-only">Mật khẩu</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border-0 bg-bb-input px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-bb-navy/30"
            placeholder="Mật khẩu"
          />
        </label>
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
