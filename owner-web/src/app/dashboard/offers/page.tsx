"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid } from "@/lib/api";
import {
  createOwnerOffer,
  deleteOwnerOffer,
  fetchOwnerOffers,
  updateOwnerOffer,
  fetchCustomers,
  fetchUsageHistory,
  type OfferRow,
  type Customer,
  type UsageHistory,
} from "@/lib/ownerOffersApi";

export default function OwnerOffersPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountPercent, setDiscountPercent] = useState("10");
  const [usageType, setUsageType] = useState<"unlimited" | "single_customer">(
    "single_customer"
  );
  const [assignedCustomerId, setAssignedCustomerId] = useState<number | null>(null);
  const [assignedCustomerName, setAssignedCustomerName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [accentColor, setAccentColor] = useState("#FF6B6B");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");

  // For customer search
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Usage history
  const [usageHistory, setUsageHistory] = useState<UsageHistory[]>([]);
  const [showUsageHistory, setShowUsageHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async (firebaseUid: string) => {
    setError(null);
    try {
      const list = await fetchOwnerOffers(firebaseUid);
      setRows(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  }, []);

  const loadUsageHistory = useCallback(async () => {
    if (!uid) return;
    setLoadingHistory(true);
    try {
      const history = await fetchUsageHistory(uid, editingId || undefined);
      setUsageHistory(history);
      setShowUsageHistory(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast("error", msg);
    } finally {
      setLoadingHistory(false);
    }
  }, [uid, editingId]);

  const searchCustomers = useCallback(
    async (q: string) => {
      if (!uid) return;
      if (q.trim().length === 0) {
        setCustomers([]);
        return;
      }
      try {
        const list = await fetchCustomers(uid, q);
        setCustomers(list);
      } catch (e) {
        console.error("Error searching customers:", e);
      }
    },
    [uid]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fb) => {
      if (!fb) {
        router.replace("/");
        return;
      }
      try {
        const row = await fetchUserByFirebaseUid(fb.uid);
        if (row.role !== "owner") {
          await signOut(auth);
          router.replace("/");
          return;
        }
        if (row.is_locked === 1 || row.is_locked === true) {
          await signOut(auth);
          setError("Tài khoản đã bị khóa.");
          return;
        }
        setUid(fb.uid);
        setReady(true);
        await load(fb.uid);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => unsub();
  }, [router, load]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setDiscountPercent("10");
    setUsageType("single_customer");
    setAssignedCustomerId(null);
    setAssignedCustomerName("");
    setExpiresAt("");
    setAccentColor("#FF6B6B");
    setIsActive(true);
    setSortOrder("0");
    setCustomerSearchQuery("");
    setShowCustomerDropdown(false);
    setShowUsageHistory(false);
  }

  function fillForm(o: OfferRow) {
    setEditingId(o.id);
    setTitle(o.title);
    setDescription(o.description ?? "");
    setDiscountPercent(String(o.discount_percent ?? 10));
    setUsageType(o.usage_type ?? "single_customer");
    setAssignedCustomerId(o.assigned_customer_id ?? null);
    setAssignedCustomerName(o.assignedCustomerName ?? "");
    const d = o.expires_at?.slice(0, 10) ?? "";
    setExpiresAt(d);
    setAccentColor(o.accent_color?.trim() || "#FF6B6B");
    setIsActive(Number(o.is_active) === 1);
    setSortOrder(String(o.sort_order ?? 0));
    setShowUsageHistory(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!uid) return;

    const d = Number(discountPercent);
    if (d < 1 || d > 100) {
      showToast("error", "% Giảm giá phải từ 1 đến 100");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        discount_percent: d,
        usage_type: usageType,
        assigned_customer_id: usageType === "single_customer" ? assignedCustomerId : null,
        expires_at: expiresAt.trim(),
        accent_color: accentColor.trim(),
        is_active: isActive ? 1 : 0,
        sort_order: Number(sortOrder) || 0,
      };

      if (editingId != null) {
        // Check if offer has been used
        const offer = rows.find((r) => r.id === editingId);
        if (offer && offer.usageCount && offer.usageCount > 0) {
          if (
            !confirm(
              `Phiếu này đã được sử dụng ${offer.usageCount} lần, bạn có chắc muốn sửa không?`
            )
          ) {
            setSaving(false);
            return;
          }
        }
        await updateOwnerOffer(uid, editingId, payload);
        showToast("success", "Cập nhật ưu đãi thành công");
      } else {
        await createOwnerOffer(uid, payload);
        showToast("success", "Thêm ưu đãi thành công");
      }
      resetForm();
      await load(uid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number) {
    if (!uid || !confirm("Xóa ưu đãi này?")) return;
    setError(null);
    try {
      await deleteOwnerOffer(uid, id);
      if (editingId === id) resetForm();
      showToast("success", "Xóa ưu đãi thành công");
      await load(uid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      showToast("error", msg);
    }
  }

  if (!ready && !error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-bb-surface text-bb-navy">
        <p className="font-medium">Đang tải…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bb-surface text-gray-900">
      <header className="border-b border-white/10 bg-bb-navy px-6 py-4 text-white shadow">
        <h1 className="text-xl font-bold">Quản lý ưu đãi</h1>
        <p className="text-sm text-white/80">
          Nâng cấp hệ thống quản lý phiếu ưu đãi và lịch sử sử dụng.
        </p>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        {toast && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium ${
              toast.type === "success"
                ? "border border-green-200 bg-green-50 text-green-700"
                : "border border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {toast.message}
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Form Section */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-bb-navy">
            {editingId != null ? `Sửa ưu đãi #${editingId}` : "Thêm ưu đãi"}
          </h2>
          <form
            onSubmit={(ev) => void onSubmit(ev)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-gray-600">Tiêu đề</span>
              <input
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-gray-600">Mô tả</span>
              <textarea
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-gray-600">% Giảm giá</span>
              <div className="relative">
                <input
                  required
                  type="number"
                  min="1"
                  max="100"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-8"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
              </div>
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Loại phiếu</span>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
                value={usageType}
                onChange={(e) => {
                  setUsageType(e.target.value as "unlimited" | "single_customer");
                  if (e.target.value === "unlimited") {
                    setAssignedCustomerId(null);
                    setAssignedCustomerName("");
                  }
                }}
              >
                <option value="single_customer">Dùng 1 lần / khách</option>
                <option value="unlimited">Dùng nhiều lần</option>
              </select>
            </label>

            {usageType === "single_customer" && (
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-gray-600">
                  Gán cho khách (tùy chọn, để trống áp dụng cho tất cả)
                </span>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                    placeholder="Tìm theo tên hoặc SĐT..."
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      if (e.target.value.trim()) {
                        void searchCustomers(e.target.value);
                        setShowCustomerDropdown(true);
                      } else {
                        setCustomers([]);
                        setShowCustomerDropdown(false);
                      }
                    }}
                    onFocus={() => {
                      if (customerSearchQuery.trim()) {
                        setShowCustomerDropdown(true);
                      }
                    }}
                  />
                  {showCustomerDropdown && customers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg z-10">
                      {customers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-gray-100"
                          onClick={() => {
                            setAssignedCustomerId(c.id);
                            setAssignedCustomerName(c.full_name);
                            setCustomerSearchQuery("");
                            setShowCustomerDropdown(false);
                            setCustomers([]);
                          }}
                        >
                          <div className="font-medium">{c.full_name}</div>
                          <div className="text-sm text-gray-500">{c.phone || "N/A"}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {assignedCustomerId && (
                  <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                    <div className="font-medium">{assignedCustomerName}</div>
                    <button
                      type="button"
                      className="text-xs text-blue-600 underline"
                      onClick={() => {
                        setAssignedCustomerId(null);
                        setAssignedCustomerName("");
                        setCustomerSearchQuery("");
                      }}
                    >
                      Hủy gán
                    </button>
                  </div>
                )}
              </label>
            )}

            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Hạn (YYYY-MM-DD)</span>
              <input
                required
                type="date"
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Màu icon (#hex)</span>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#FF6B6B"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Thứ tự</span>
              <input
                type="number"
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Đang hiển thị (is_active)
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-bb-yellow px-5 py-2.5 text-sm font-bold text-black/80 disabled:opacity-50"
              >
                {saving ? "Đang lưu…" : editingId != null ? "Cập nhật" : "Thêm"}
              </button>
              {editingId != null && (
                <>
                  <button
                    type="button"
                    onClick={() => void loadUsageHistory()}
                    disabled={loadingHistory}
                    className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                  >
                    {loadingHistory ? "Đang tải…" : "Xem lịch sử"}
                  </button>
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold"
                  >
                    Hủy sửa
                  </button>
                </>
              )}
            </div>
          </form>
        </section>

        {/* List Section */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-bb-navy">Danh sách</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="py-2 pr-2">ID</th>
                  <th className="py-2 pr-2">Tiêu đề</th>
                  <th className="py-2 pr-2">% Giảm</th>
                  <th className="py-2 pr-2">Loại</th>
                  <th className="py-2 pr-2">Đã dùng</th>
                  <th className="py-2 pr-2">Khách gán</th>
                  <th className="py-2 pr-2">Hạn</th>
                  <th className="py-2 pr-2">Hiệu lực</th>
                  <th className="py-2 pr-2">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-500">
                      Chưa có ưu đãi.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-mono text-gray-400">{r.id}</td>
                      <td className="py-2 pr-2 font-medium">{r.title}</td>
                      <td className="py-2 pr-2">{r.discount_percent}%</td>
                      <td className="py-2 pr-2">
                        <span
                          className={`rounded px-2 py-1 text-xs font-semibold text-white ${
                            r.usage_type === "unlimited"
                              ? "bg-green-500"
                              : "bg-orange-500"
                          }`}
                        >
                          {r.usage_type === "unlimited" ? "Nhiều lần" : "1 lần / khách"}
                        </span>
                      </td>
                      <td className="py-2 pr-2">{r.usageCount || 0}</td>
                      <td className="py-2 pr-2">
                        {r.assignedCustomerName ? (
                          <span className="text-blue-600">{r.assignedCustomerName}</span>
                        ) : (
                          <span className="text-gray-500">Tất cả</span>
                        )}
                      </td>
                      <td className="py-2 pr-2">{r.expires_at?.slice(0, 10)}</td>
                      <td className="py-2 pr-2">
                        {Number(r.is_active) === 1 ? "Có" : "Không"}
                      </td>
                      <td className="py-2 pr-2">
                        <button
                          type="button"
                          className="mr-2 text-bb-navy underline"
                          onClick={() => fillForm(r)}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="text-red-600 underline"
                          onClick={() => void onDelete(r.id)}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Usage History Modal */}
        {showUsageHistory && (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-bb-navy">Lịch sử dùng phiếu</h2>
              <button
                type="button"
                onClick={() => setShowUsageHistory(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="py-2 pr-2">Thời gian</th>
                    <th className="py-2 pr-2">Khách hàng</th>
                    <th className="py-2 pr-2">SĐT</th>
                    <th className="py-2 pr-2">Đơn hàng</th>
                  </tr>
                </thead>
                <tbody>
                  {usageHistory.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500">
                        Chưa có ai dùng phiếu này.
                      </td>
                    </tr>
                  ) : (
                    usageHistory.map((h) => (
                      <tr key={h.id} className="border-b border-gray-100">
                        <td className="py-2 pr-2">{h.used_at}</td>
                        <td className="py-2 pr-2 font-medium">{h.full_name}</td>
                        <td className="py-2 pr-2 text-gray-600">{h.phone || "N/A"}</td>
                        <td className="py-2 pr-2">
                          {h.order_id ? `#${h.order_id}` : "N/A"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
