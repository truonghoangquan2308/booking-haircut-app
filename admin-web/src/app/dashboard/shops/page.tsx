"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { AdminHeader } from "@/components/AdminHeader";
import { useAdminSession } from "@/hooks/useAdminSession";
import { fetchAdminShops, patchShop, type ShopRow } from "@/lib/shopsApi";

const SHOP_PAGE_SIZE = 20;

export default function AdminShopsPage() {
  const { user, uid, error, setError, logout } = useAdminSession();
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editManagerForShop, setEditManagerForShop] = useState<ShopRow | null>(
    null,
  );
  const [managerUserIdInput, setManagerUserIdInput] = useState("");
  const [busyManagerShopId, setBusyManagerShopId] = useState<number | null>(
    null,
  );

  const [shopInputQ, setShopInputQ] = useState("");
  const [shopAppliedQ, setShopAppliedQ] = useState("");
  const [shopPage, setShopPage] = useState(1);
  const [shopTotal, setShopTotal] = useState(0);

  const loadShops = useCallback(
    async (firebaseUid: string) => {
      const r = await fetchAdminShops(firebaseUid, {
        q: shopAppliedQ || undefined,
        page: shopPage,
        page_size: SHOP_PAGE_SIZE,
      });
      setShops(r.shops);
      setShopTotal(r.total);
    },
    [shopAppliedQ, shopPage],
  );

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void (async () => {
      try {
        await loadShops(uid);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, loadShops, setError]);

  function applyShopFilters() {
    setShopAppliedQ(shopInputQ.trim());
    setShopPage(1);
  }

  async function act(
    shopId: number,
    body: { approval_status?: string; is_blocked?: boolean },
  ) {
    const fb = auth.currentUser;
    if (!fb) return;
    setBusyId(shopId);
    setError(null);
    try {
      await patchShop(fb.uid, shopId, body);
      await loadShops(fb.uid);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  function openEditManager(s: ShopRow) {
    setEditManagerForShop(s);
    setManagerUserIdInput(
      s.manager_user_id != null ? String(s.manager_user_id) : "",
    );
    setError(null);
  }

  function closeEditManager() {
    setEditManagerForShop(null);
    setManagerUserIdInput("");
  }

  async function saveBranchManager() {
    const fb = auth.currentUser;
    const shop = editManagerForShop;
    if (!fb || !shop) return;
    const trimmed = managerUserIdInput.trim();
    if (!trimmed) {
      setError("Nhập ID user (cột ID trong bảng Tài khoản hệ thống).");
      return;
    }
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n < 1) {
      setError("ID user không hợp lệ.");
      return;
    }
    setBusyManagerShopId(shop.id);
    setError(null);
    try {
      await patchShop(fb.uid, shop.id, { manager_user_id: n });
      await loadShops(fb.uid);
      closeEditManager();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyManagerShopId(null);
    }
  }

  async function clearBranchManager() {
    const fb = auth.currentUser;
    const shop = editManagerForShop;
    if (!fb || !shop) return;
    setBusyManagerShopId(shop.id);
    setError(null);
    try {
      await patchShop(fb.uid, shop.id, { manager_user_id: null });
      await loadShops(fb.uid);
      closeEditManager();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyManagerShopId(null);
    }
  }

  const shopTotalPages = Math.max(1, Math.ceil(shopTotal / SHOP_PAGE_SIZE));

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
        title="Cửa hàng / chi nhánh"
        subtitle="Duyệt, chặn, gán Manager"
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
            Danh sách cửa hàng / chi nhánh (tìm &amp; phân trang)
          </h2>
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Tìm (tên / mô tả / email owner)</span>
              <input
                type="search"
                value={shopInputQ}
                onChange={(e) => setShopInputQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyShopFilters()}
                className="min-w-[220px] rounded-lg border border-gray-200 px-3 py-2"
                placeholder="Nhập từ khóa…"
              />
            </label>
            <button
              type="button"
              onClick={applyShopFilters}
              className="rounded-xl bg-bb-navy px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Áp dụng
            </button>
            <p className="text-xs text-gray-500">
              Tổng: <strong>{shopTotal}</strong> · Trang {shopPage}/{shopTotalPages}
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-bb-input text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Tên</th>
                  <th className="px-4 py-3">Manager (chi nhánh)</th>
                  <th className="px-4 py-3">Duyệt</th>
                  <th className="px-4 py-3">Chặn</th>
                  <th className="px-4 py-3">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-gray-100 hover:bg-bb-surface/80"
                  >
                    <td className="px-4 py-3 font-mono text-gray-400">{s.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{s.name}</div>
                      {s.description && (
                        <div className="text-xs text-gray-500">{s.description}</div>
                      )}
                    </td>
                    <td className="max-w-[240px] px-4 py-3 text-xs">
                      {s.manager_user_id ? (
                        <div>
                          {s.manager_name && (
                            <div className="font-medium text-gray-900">{s.manager_name}</div>
                          )}
                          <div className="text-gray-600">
                            {s.manager_email ?? s.manager_phone ?? "—"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-amber-800">
                          Chưa có phân tài khoản Manager nào là hoạt động ở chi nhánh đó
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          s.approval_status === "approved"
                            ? "font-semibold text-emerald-600"
                            : s.approval_status === "rejected"
                              ? "font-semibold text-red-600"
                              : "font-semibold text-amber-600"
                        }
                      >
                        {s.approval_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.is_blocked ? (
                        <span className="text-red-400">blocked</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === s.id || busyManagerShopId === s.id}
                          onClick={() => openEditManager(s)}
                          className="rounded-lg border border-bb-navy/40 bg-white px-3 py-1 text-xs font-semibold text-bb-navy hover:bg-bb-surface disabled:opacity-50"
                        >
                          Chỉnh sửa
                        </button>
                        <button
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() => void act(s.id, { approval_status: "approved" })}
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Duyệt
                        </button>
                        <button
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() => void act(s.id, { approval_status: "rejected" })}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Từ chối
                        </button>
                        <button
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() => void act(s.id, { approval_status: "pending" })}
                          className="rounded-lg bg-bb-yellow px-3 py-1 text-xs font-semibold text-black/80 hover:brightness-95 disabled:opacity-50"
                        >
                          Chờ
                        </button>
                        <button
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() =>
                            void act(s.id, {
                              is_blocked: !Boolean(s.is_blocked),
                            })
                          }
                          className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                        >
                          {s.is_blocked ? "Bỏ chặn" : "Chặn"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shops.length === 0 && (
              <p className="p-8 text-center text-sm text-gray-500">
                Chưa có shop hoặc không khớp tìm kiếm.
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={shopPage <= 1}
              onClick={() => setShopPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
            >
              ← Trước
            </button>
            <button
              type="button"
              disabled={shopPage >= shopTotalPages}
              onClick={() => setShopPage((p) => p + 1)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Sau →
            </button>
          </div>
        </section>
      </main>

      {editManagerForShop && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mgr-dialog-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 id="mgr-dialog-title" className="text-lg font-bold text-bb-navy">
              Gán / đổi Manager chi nhánh
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {editManagerForShop.name}{" "}
              <span className="font-mono text-gray-400">(#{editManagerForShop.id})</span>
            </p>
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              Nhập <strong>ID user</strong> trong bảng &quot;Tài khoản hệ thống&quot;. User phải tồn
              tại, chưa khóa, không phải admin hoặc owner. Đăng nhập manager-web vẫn dùng tài khoản Firebase của
              user đó — chỉ đổi <strong>ai</strong> được gán quản lý chi nhánh.
            </p>
            <label className="mt-4 block text-sm">
              <span className="mb-1 block text-gray-700">ID user (Manager)</span>
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
                value={managerUserIdInput}
                onChange={(e) => setManagerUserIdInput(e.target.value)}
                placeholder="Ví dụ: 3"
              />
            </label>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void saveBranchManager()}
                disabled={busyManagerShopId === editManagerForShop.id}
                className="rounded-xl bg-bb-navy px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                Lưu
              </button>
              <button
                type="button"
                onClick={() => void clearBranchManager()}
                disabled={busyManagerShopId === editManagerForShop.id}
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                Gỡ Manager
              </button>
              <button
                type="button"
                onClick={closeEditManager}
                disabled={busyManagerShopId === editManagerForShop.id}
                className="ml-auto rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
