"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { AdminHeader } from "@/components/AdminHeader";
import { useAdminSession } from "@/hooks/useAdminSession";
import {
  fetchPlatformUsers,
  patchPlatformUser,
  type PlatformUser,
} from "@/lib/platformApi";

const USER_PAGE_SIZE = 20;
const ROLES = ["", "customer", "barber", "manager", "owner", "admin"] as const;

export default function AdminUsersPage() {
  const { user, uid, error, setError, logout } = useAdminSession();
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);

  const [userInputQ, setUserInputQ] = useState("");
  const [userInputRole, setUserInputRole] = useState("");
  const [userAppliedQ, setUserAppliedQ] = useState("");
  const [userAppliedRole, setUserAppliedRole] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);

  const loadUsers = useCallback(
    async (firebaseUid: string) => {
      const r = await fetchPlatformUsers(firebaseUid, {
        q: userAppliedQ || undefined,
        role: userAppliedRole || undefined,
        page: userPage,
        page_size: USER_PAGE_SIZE,
      });
      setPlatformUsers(r.users);
      setUserTotal(r.total);
    },
    [userAppliedQ, userAppliedRole, userPage],
  );

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void (async () => {
      try {
        await loadUsers(uid);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, loadUsers, setError]);

  function applyUserFilters() {
    setUserAppliedQ(userInputQ.trim());
    setUserAppliedRole(userInputRole);
    setUserPage(1);
  }

  async function toggleUserLock(u: PlatformUser) {
    const fb = auth.currentUser;
    if (!fb) return;
    setBusyUserId(u.id);
    setError(null);
    try {
      await patchPlatformUser(fb.uid, u.id, {
        is_locked: Number(u.is_locked) !== 1,
      });
      await loadUsers(fb.uid);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyUserId(null);
    }
  }

  const userTotalPages = Math.max(1, Math.ceil(userTotal / USER_PAGE_SIZE));

  if (error && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bb-yellow p-6 text-red-700">
        {error}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bb-surface text-bb-navy">
        <div className="h-10 w-10 animate-pulse rounded-full bg-bb-yellow/50" />
        <p className="font-medium">Đang tải…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bb-surface text-gray-900">
      <AdminHeader
        user={user}
        title="Tài khoản hệ thống"
        subtitle="Lọc / khóa user"
        onLogout={logout}
      />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <section>
          <h2 className="mb-4 text-lg font-bold text-bb-navy">
            Tài khoản hệ thống (lọc / tìm kiếm / phân trang)
          </h2>
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Tìm (email / SĐT / tên)</span>
              <input
                type="search"
                value={userInputQ}
                onChange={(e) => setUserInputQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyUserFilters()}
                className="min-w-[200px] rounded-lg border border-gray-200 px-3 py-2"
                placeholder="Nhập từ khóa…"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Role</span>
              <select
                value={userInputRole}
                onChange={(e) => setUserInputRole(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2"
              >
                {ROLES.map((r) => (
                  <option key={r === "" ? "__all__" : r} value={r}>
                    {r || "Tất cả"}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={applyUserFilters}
              className="rounded-xl bg-bb-navy px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Áp dụng lọc
            </button>
            <p className="text-xs text-gray-500">
              Tổng khớp: <strong>{userTotal}</strong> · Trang {userPage}/{userTotalPages}
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-bb-input text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Email/SĐT</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Ngày tạo</th>
                  <th className="px-4 py-3">Khóa</th>
                  <th className="px-4 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {platformUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="cursor-pointer border-b border-gray-100 hover:bg-bb-surface/80"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      setSelectedUser(u);
                    }}
                  >
                    <td className="cursor-pointer px-4 py-3 font-mono text-gray-400">{u.id}</td>
                    <td className="cursor-pointer px-4 py-3">{u.email ?? u.phone ?? "—"}</td>
                    <td className="cursor-pointer px-4 py-3">{u.role}</td>
                    <td className="cursor-pointer px-4 py-3 text-sm text-gray-500">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="cursor-pointer px-4 py-3">
                      {Number(u.is_locked) === 1 ? (
                        <span className="text-red-400">có</span>
                      ) : (
                        <span className="text-gray-500">không</span>
                      )}
                    </td>
                    <td className="cursor-pointer px-4 py-3">
                      <button
                        type="button"
                        disabled={busyUserId === u.id || u.id === user.id}
                        title={u.id === user.id ? "Không thể khóa tài khoản đang đăng nhập" : undefined}
                        onClick={() => void toggleUserLock(u)}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold text-white disabled:opacity-50 ${
                          Number(u.is_locked) === 1
                            ? 'bg-emerald-600 hover:bg-emerald-500'
                            : 'bg-bb-navy hover:brightness-110'
                        }`}
                      >
                        {Number(u.is_locked) === 1 ? "Mở khóa" : "Khóa"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
                <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-bb-navy">Chi tiết tài khoản</h3>
                      <p className="text-sm text-gray-500">Thông tin user hiện có trong bảng.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Đóng
                    </button>
                  </div>
                  <div className="grid gap-4 rounded-3xl border border-gray-200 bg-bb-surface/80 p-4">
                    <div className="grid gap-1">
                      <span className="text-xs uppercase tracking-wide text-gray-500">ID</span>
                      <span className="text-sm font-medium text-gray-900">{selectedUser.id}</span>
                    </div>
                    <div className="grid gap-1">
                      <span className="text-xs uppercase tracking-wide text-gray-500">Email / SĐT</span>
                      <span className="text-sm text-gray-900">{selectedUser.email ?? selectedUser.phone ?? '—'}</span>
                    </div>
                    <div className="grid gap-1">
                      <span className="text-xs uppercase tracking-wide text-gray-500">Role</span>
                      <span className="text-sm text-gray-900">{selectedUser.role}</span>
                    </div>
                    <div className="grid gap-1">
                      <span className="text-xs uppercase tracking-wide text-gray-500">Trạng thái khóa</span>
                      <span className="text-sm text-gray-900">
                        {Number(selectedUser.is_locked) === 1 ? 'Đang khóa' : 'Không khóa'}
                      </span>
                    </div>
                    <div className="grid gap-1">
                      <span className="text-xs uppercase tracking-wide text-gray-500">Ngày tạo</span>
                      <span className="text-sm text-gray-900">
                        {selectedUser.created_at
                          ? new Date(selectedUser.created_at).toLocaleString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </span>
                    </div>
                    <div className="grid gap-1">
                      <span className="text-xs uppercase tracking-wide text-gray-500">Chi nhánh liên kết</span>
                      <span className="text-sm text-gray-900">{selectedUser.status ?? '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {platformUsers.length === 0 && (
              <p className="p-6 text-center text-sm text-gray-500">
                Không có bản ghi (hoặc không khớp lọc).
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={userPage <= 1}
              onClick={() => setUserPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
            >
              ← Trước
            </button>
            <button
              type="button"
              disabled={userPage >= userTotalPages}
              onClick={() => setUserPage((p) => p + 1)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Sau →
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
