"use client";

import { useEffect } from "react";

const LOGIN_WEB_URL =
  process.env.NEXT_PUBLIC_LOGIN_URL ?? "http://localhost:3005";

/**
 * Trang gốc (/) của manager-web.
 * Nếu đã có token → /dashboard, chưa có → login-web
 */
export default function ManagerRootPage() {
  useEffect(() => {
    const token = localStorage.getItem("bb_firebase_token");
    if (token) {
      window.location.replace("/dashboard");
    } else {
      window.location.replace(LOGIN_WEB_URL);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-[#003366] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Đang chuyển hướng…</p>
      </div>
    </div>
  );
}
