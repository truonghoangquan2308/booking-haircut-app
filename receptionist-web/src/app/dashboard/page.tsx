"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, type StaffUser } from "@/lib/api";
import { fetchManagerBranchList, type ManagerBranchRow } from "@/lib/managerApi";
import { ReceptionistHeader } from "@/components/ReceptionistHeader";
import { type TabType } from "@/components/ReceptionistTabBar";
import { ScheduleView } from "@/components/ScheduleView";
import { WorkingScheduleManagement } from "@/components/WorkingScheduleManagement";
import { WalkIn } from "@/components/WalkIn";
import { PaymentInvoice } from "@/components/PaymentInvoice";
import { AutoReplyMessaging } from "@/components/CustomerMessaging";

export default function ReceptionistDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<ManagerBranchRow[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("schedule");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);

  const BRANCH_STORAGE_KEY = "receptionist-web-branch-id";

  // Lưu token/uid từ URL (lần đầu từ login-web chuyển sang), sau đó load data
  // Không dùng onAuthStateChanged vì kiến trúc này không sign-in Firebase phía client
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    const uidParam = params.get("uid");

    if (tokenParam && uidParam) {
      localStorage.setItem("bb_firebase_token", tokenParam);
      localStorage.setItem("bb_firebase_uid", uidParam);
      window.history.replaceState({}, document.title, "/dashboard");
    }

    const storedUid = localStorage.getItem("bb_firebase_uid");
    const storedToken = localStorage.getItem("bb_firebase_token");

    if (!storedUid || !storedToken) {
      router.replace("/");
      return;
    }

    setUid(storedUid);

    const loadData = async () => {
      try {
        const userData = await fetchUserByFirebaseUid(storedUid);
        setUser(userData);

        const branchList = await fetchManagerBranchList(storedUid);
        setBranches(branchList);

        let branchId: number | null = null;
        if (branchList.length > 0) {
          const stored = localStorage.getItem(BRANCH_STORAGE_KEY);
          if (stored) {
            branchId = Number(stored);
            if (!branchList.find((b) => b.id === branchId)) {
              branchId = branchList[0].id;
            }
          } else {
            branchId = branchList[0].id;
          }
        }
        setSelectedBranchId(branchId);
        setBranchesLoaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu người dùng");
      }
    };

    loadData();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("bb_firebase_token");
      localStorage.removeItem("bb_firebase_uid");
      router.replace("/");
    } catch {
      setError("Lỗi đăng xuất");
    }
  };

  const handleBranchChange = (branchId: number) => {
    setSelectedBranchId(branchId);
    try {
      localStorage.setItem(BRANCH_STORAGE_KEY, String(branchId));
    } catch { }
  };

  // Loading state
  if (!uid || !branchesLoaded) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3"
        style={{ backgroundColor: "var(--color-bg-page)", color: "var(--color-text-primary)" }}
      >
        <div
          className="h-10 w-10 animate-pulse rounded-full"
          style={{ backgroundColor: "rgba(245,166,35,0.3)" }}
        />
        <p className="font-medium">Đang tải…</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--color-bg-page)", color: "var(--color-text-primary)" }}
    >
      {/* Header (giống layout trong ảnh): user + tabs + chi nhánh + đăng xuất */}
      {user && (
        <ReceptionistHeader
          user={user}
          branches={branches}
          selectedBranchId={selectedBranchId}
          onBranchChange={handleBranchChange}
          onLogout={handleLogout}
          activeTab={activeTab}
          onTabChange={(tab) => {
            if (tab === "shop") {
              router.push("/dashboard/shop");
              return;
            }
            setActiveTab(tab);
          }}
        />
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        {error && (
          <p
            className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Tab Content */}
        {activeTab === "schedule" && uid && selectedBranchId && (
          <ScheduleView
            uid={uid}
            branchId={selectedBranchId}
            onPay={(apptId) => {
              setSelectedAppointmentId(apptId);
              setActiveTab("payment");
            }}
            key={selectedBranchId}
          />
        )}

        {activeTab === "book" && uid && selectedBranchId && (
          <WorkingScheduleManagement uid={uid} branchId={selectedBranchId} key={selectedBranchId} />
        )}

        {activeTab === "walkin" && uid && selectedBranchId && (
          <WalkIn
            uid={uid}
            branchId={selectedBranchId}
            onSuccess={(apptId: number) => {
              setSelectedAppointmentId(apptId);
              setActiveTab("payment");
            }}
            key={selectedBranchId}
          />
        )}

        {activeTab === "payment" && uid && selectedBranchId && selectedAppointmentId && (
          <PaymentInvoice
            uid={uid}
            appointmentId={selectedAppointmentId}
            branchId={selectedBranchId}
            onSuccess={() => {
              setActiveTab("schedule");
              setSelectedAppointmentId(null);
            }}
            key={selectedAppointmentId}
          />
        )}

        {activeTab === "messages" && uid && selectedBranchId && (
          <AutoReplyMessaging uid={uid} branchId={selectedBranchId} key={selectedBranchId} />
        )}
      </main>
    </div>
  );
}
