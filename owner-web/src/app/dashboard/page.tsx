"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, type StaffUser } from "@/lib/api";
import { fetchOwnerAnalytics, type OwnerAnalytics } from "@/lib/analytics";
import { OwnerAnalyticsBoard } from "@/components/OwnerAnalyticsBoard";

const LOGIN_WEB_URL = process.env.NEXT_PUBLIC_LOGIN_URL ?? "http://localhost:3005";

export default function OwnerDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [analytics, setAnalytics] = useState<OwnerAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedUid = localStorage.getItem("bb_firebase_uid");

    if (!storedUid) {
      router.replace("/");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const row = await fetchUserByFirebaseUid(storedUid);
        if (cancelled) return;

        if (row.role === "manager") {
          router.replace("/dashboard/stats");
          return;
        }
        if (row.role !== "owner") {
          localStorage.removeItem("bb_firebase_token");
          localStorage.removeItem("bb_firebase_uid");
          router.replace("/");
          return;
        }
        if (row.is_locked === 1 || row.is_locked === true) {
          setError("Tài khoản Owner đã bị khóa.");
          return;
        }
        setUser(row);
        const data = await fetchOwnerAnalytics(storedUid);
        if (!cancelled) setAnalytics(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout() {
    try {
      await signOut(auth);
    } finally {
      localStorage.removeItem("bb_firebase_token");
      localStorage.removeItem("bb_firebase_uid");
      window.location.replace(LOGIN_WEB_URL);
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bb-yellow p-6 text-red-700">
        {error}
      </div>
    );
  }

  if (!user || !analytics) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bb-surface text-bb-navy">
        <div className="h-10 w-10 animate-pulse rounded-full bg-bb-yellow/50" />
        <p className="font-medium">Đang tải báo cáo…</p>
      </div>
    );
  }

  const label = [user.full_name, user.email].filter(Boolean).join(" · ");

  return (
    <OwnerAnalyticsBoard
      analytics={analytics}
      userLabel={label || "Owner"}
      onLogout={() => void logout()}
    />
  );
}
