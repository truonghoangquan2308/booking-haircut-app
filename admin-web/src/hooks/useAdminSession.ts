"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, type StaffUser } from "@/lib/api";

export function useAdminSession() {
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Thay vì dùng onAuthStateChanged (không chia sẻ qua port), ta dùng localStorage
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

        if (row.role !== "admin") {
          localStorage.removeItem("bb_firebase_token");
          localStorage.removeItem("bb_firebase_uid");
          router.replace("/");
          return;
        }
        if (row.is_locked === 1 || row.is_locked === true) {
          setError("Tài khoản Admin đã bị khóa.");
          return;
        }
        setUser(row);
        setUid(storedUid);
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

  const logout = useCallback(async () => {
    await signOut(auth);
    localStorage.removeItem("bb_firebase_token");
    localStorage.removeItem("bb_firebase_uid");
    router.replace("/");
  }, [router]);

  return { user, uid, error, setError, logout };
}
