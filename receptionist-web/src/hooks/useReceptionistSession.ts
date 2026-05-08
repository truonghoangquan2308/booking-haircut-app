"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, type StaffUser } from "@/lib/api";
import { fetchManagerBranchList, type ManagerBranchRow } from "@/lib/managerApi";

const BRANCH_STORAGE_KEY = "receptionist-web-branch-id";
const LOGIN_WEB_URL = process.env.NEXT_PUBLIC_LOGIN_URL ?? "http://localhost:3005";

export function useReceptionistSession() {
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [branches, setBranches] = useState<ManagerBranchRow[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
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
        if (!["owner", "manager", "receptionist"].includes(row.role)) {
          localStorage.removeItem("bb_firebase_uid");
          localStorage.removeItem("bb_firebase_token");
          router.replace("/");
          return;
        }
        if (row.is_locked === 1 || row.is_locked === true) {
          setError("Tài khoản đã bị khóa.");
          return;
        }
        const branchRows = await fetchManagerBranchList(storedUid);
        if (cancelled) return;
        setUser(row);
        setUid(storedUid);
        setBranches(branchRows);

        if (branchRows.length) {
          const saved = Number(localStorage.getItem(BRANCH_STORAGE_KEY) ?? "");
          const defaultBranch =
            row.role === "owner"
              ? branchRows.some((b) => b.id === saved)
                ? saved
                : branchRows[0].id
              : branchRows[0].id;
          setSelectedBranchId(defaultBranch);
          localStorage.setItem(BRANCH_STORAGE_KEY, String(defaultBranch));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const onBranchChange = useCallback(
    (nextId: number) => {
      if (user?.role !== "owner") return;
      setSelectedBranchId(nextId);
      try {
        localStorage.setItem(BRANCH_STORAGE_KEY, String(nextId));
      } catch {}
    },
    [user?.role],
  );

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } finally {
      localStorage.removeItem("bb_firebase_token");
      localStorage.removeItem("bb_firebase_uid");
      window.location.replace(LOGIN_WEB_URL);
    }
  }, []);

  return {
    user,
    uid,
    branches,
    selectedBranchId,
    loading,
    error,
    setError,
    onBranchChange,
    logout,
  };
}
