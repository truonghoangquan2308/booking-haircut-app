"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LOGIN_WEB_URL =
  process.env.NEXT_PUBLIC_LOGIN_URL ?? "http://localhost:3000";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get("token");
    const uidFromUrl = urlParams.get("uid");

    if (tokenFromUrl) {
      localStorage.setItem("bb_firebase_token", tokenFromUrl);
    }
    if (uidFromUrl) {
      localStorage.setItem("bb_firebase_uid", uidFromUrl);
    }

    if (tokenFromUrl || uidFromUrl) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }

    const storedToken = localStorage.getItem("bb_firebase_token");
    if (!storedToken) {
      window.location.href = LOGIN_WEB_URL;
    } else {
      setToken(storedToken);
    }
  }, [router]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Đang kiểm tra phiên đăng nhập…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
