"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, type StaffUser } from "@/lib/api";
import { fetchOwnerAnalytics, type OwnerAnalytics } from "@/lib/analytics";
import { OwnerAnalyticsBoard } from "@/components/OwnerAnalyticsBoard";

export default function OwnerDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [analytics, setAnalytics] = useState<OwnerAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fb) => {
      if (!fb) {
        router.replace("/");
        return;
      }
      try {
        const row = await fetchUserByFirebaseUid(fb.uid);
        if (row.role === "manager") {
          router.replace("/dashboard/stats");
          return;
        }
        if (row.role !== "owner") {
          await signOut(auth);
          router.replace("/");
          return;
        }
        if (row.is_locked === 1 || row.is_locked === true) {
          await signOut(auth);
          setError("Tài khoản Owner đã bị khóa.");
          return;
        }
        setUser(row);
        const data = await fetchOwnerAnalytics(fb.uid);
        setAnalytics(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => unsub();
  }, [router]);

  async function logout() {
    await signOut(auth);
    router.replace("/");
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
