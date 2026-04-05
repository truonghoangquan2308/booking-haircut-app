"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { useAdminSession } from "@/hooks/useAdminSession";
import { fetchAuditLogs, type AuditLogRow } from "@/lib/platformApi";

const AUDIT_PAGE_SIZE = 25;

export default function AdminAuditPage() {
  const { user, uid, error, setError, logout } = useAdminSession();
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditInputAdmin, setAuditInputAdmin] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");

  const loadAudit = useCallback(
    async (firebaseUid: string) => {
      const r = await fetchAuditLogs(firebaseUid, {
        page: auditPage,
        page_size: AUDIT_PAGE_SIZE,
        q: auditInputAdmin || undefined,
        action: auditAction || undefined,
        from: auditFrom || undefined,
        to: auditTo || undefined,
      });
      setAuditLogs(r.logs);
      setAuditTotal(r.total);
    },
    [auditPage, auditInputAdmin, auditAction, auditFrom, auditTo],
  );

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void (async () => {
      try {
        await loadAudit(uid);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, loadAudit, setError]);

  function formatAuditDetail(detail: string | null): string {
    if (!detail) return "—";
    try {
      const parsed = JSON.parse(detail);
      if (typeof parsed === "object" && parsed !== null) {
        return Object.entries(parsed)
          .map(([key, value]) => {
            const label = key
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());
            return `${label}: ${value}`;
          })
          .join(", ");
      }
      return String(parsed);
    } catch {
      return detail;
    }
  }

  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / AUDIT_PAGE_SIZE));

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
        title="Nhật ký hoạt động"
        subtitle="Audit admin"
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
            Nhật ký hoạt động (admin làm gì, lúc nào)
          </h2>
          <p className="mb-3 text-sm text-gray-600">
            Ghi khi khóa/mở user, duyệt/chặn shop hoặc chi nhánh. Trang {auditPage}/{auditTotalPages} · Tổng{" "}
            <strong>{auditTotal}</strong> bản ghi.
          </p>
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="min-w-[220px] text-sm">
              <span className="mb-1 block text-gray-600">Tìm theo admin (email)</span>
              <input
                type="search"
                value={auditInputAdmin}
                onChange={(e) => {
                  setAuditInputAdmin(e.target.value);
                  setAuditPage(1);
                }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
                placeholder="Email admin…"
              />
            </label>
            <label className="min-w-[220px] text-sm">
              <span className="mb-1 block text-gray-600">Hành động</span>
              <select
                value={auditAction}
                onChange={(e) => {
                  setAuditAction(e.target.value);
                  setAuditPage(1);
                }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
              >
                <option value="">Tất cả</option>
                {Array.from(new Set([auditAction, ...auditLogs.map((log) => log.action)])).map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Từ ngày</span>
              <input
                type="date"
                value={auditFrom}
                onChange={(e) => {
                  setAuditFrom(e.target.value);
                  setAuditPage(1);
                }}
                className="rounded-lg border border-gray-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Đến ngày</span>
              <input
                type="date"
                value={auditTo}
                onChange={(e) => {
                  setAuditTo(e.target.value);
                  setAuditPage(1);
                }}
                className="rounded-lg border border-gray-200 px-3 py-2"
              />
            </label>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-bb-input text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Hành động</th>
                  <th className="px-4 py-3">Đối tượng</th>
                  <th className="px-4 py-3">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-600">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString("vi-VN")
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium">{log.admin_email ?? `#${log.admin_user_id}`}</div>
                      {log.admin_name && (
                        <div className="text-xs text-gray-500">{log.admin_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                    <td className="px-4 py-2 text-xs">
                      {log.target_type ?? "—"} {log.target_id != null ? `#${log.target_id}` : ""}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-2 text-xs text-gray-600" title={log.detail ?? ""}>
                      {formatAuditDetail(log.detail)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {auditLogs.length === 0 && (
              <p className="p-6 text-center text-sm text-gray-500">
                Chưa có log (hoặc bảng mới tạo — thao tác trên user/shop để ghi).
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={auditPage <= 1}
              onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
            >
              ← Trước
            </button>
            <button
              type="button"
              disabled={auditPage >= auditTotalPages}
              onClick={() => setAuditPage((p) => p + 1)}
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
