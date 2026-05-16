"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ReceptionistShell } from "@/components/ReceptionistShell";
import PageHeader from "@/components/PageHeader";
import { useReceptionistSession } from "@/hooks/useReceptionistSession";
import { getApiBase, readJsonResponse } from "@/lib/api";
import {
  fetchManagerOrders,
  patchOrderStatus,
  type ShopOrderRow,
} from "@/lib/managerApi";

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipping",
  "delivered",
  "completed",
  "cancelled",
] as const;

type ShopProductRow = {
  id: number;
  sku: string;
  name: string;
  category_name: string;
  price: number;
  stock: number;
  unit: string | null;
};

type CartItem = {
  id: number;
  sku: string;
  name: string;
  unit_price: number;
  quantity: number;
};

type PromotionOffer = {
  id: number;
  title: string;
  discount_percent: number;
  usage_type: string;
};

export default function ReceptionistShopPage() {
  const {
    user,
    uid,
    branches,
    selectedBranchId,
    loading,
    error,
    setError,
    onBranchChange,
    logout,
  } = useReceptionistSession();
  const [orders, setOrders] = useState<ShopOrderRow[]>([]);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  const [products, setProducts] = useState<ShopProductRow[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedPromotion, setAppliedPromotion] = useState<PromotionOffer | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!uid || !selectedBranchId) return;
    try {
      const rows = await fetchManagerOrders(uid, selectedBranchId);
      setOrders(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [uid, selectedBranchId, setError]);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setProductSearch((prev) => prev ?? "");
    try {
      const url = new URL(`${getApiBase()}/api/products`);
      url.searchParams.set("limit", "200");
      if (productSearch.trim()) {
        url.searchParams.set("search", productSearch.trim());
      }
      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await readJsonResponse<{ products?: ShopProductRow[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Lỗi tải sản phẩm");
      setProducts(data.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingProducts(false);
    }
  }, [productSearch, setError]);

  useEffect(() => {
    void loadOrders();
    void loadProducts();
  }, [loadOrders, loadProducts]);

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
    [cartItems],
  );

  const discountAmount = appliedPromotion
    ? Math.round((cartTotal * appliedPromotion.discount_percent) / 100)
    : 0;

  const orderTotal = Math.max(0, cartTotal - discountAmount);

  function addToCart(product: ShopProductRow) {
    setCartItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...current,
        {
          id: product.id,
          sku: product.sku,
          name: product.name,
          unit_price: Number(product.price || 0),
          quantity: 1,
        },
      ];
    });
  }

  function updateCartQuantity(itemId: number, quantity: number) {
    setCartItems((current) =>
      current
        .map((item) =>
          item.id === itemId ? { ...item, quantity: Math.max(1, quantity) } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function removeCartItem(itemId: number) {
    setCartItems((current) => current.filter((item) => item.id !== itemId));
  }

  async function applyVoucher() {
    setVoucherError(null);
    if (!voucherCode.trim()) {
      setVoucherError("Nhập mã giảm giá");
      return;
    }
    setLoadingProducts(true);
    try {
      const res = await fetch(`${getApiBase()}/api/offers`, { cache: "no-store" });
      const data = await readJsonResponse<{
        offers?: PromotionOffer[];
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Lỗi kiểm tra mã giảm giá");
      const offer = (data.offers ?? []).find(
        (row) => row.title?.trim().toLowerCase() === voucherCode.trim().toLowerCase(),
      );
      if (!offer) {
        setAppliedPromotion(null);
        setVoucherError("Mã giảm giá không hợp lệ hoặc đã hết hạn");
        return;
      }
      setAppliedPromotion(offer);
      setVoucherError(null);
    } catch (e) {
      setAppliedPromotion(null);
      setVoucherError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingProducts(false);
    }
  }

  async function onCheckout() {
    if (!selectedBranchId) {
      setError("Chọn chi nhánh trước khi thanh toán");
      return;
    }
    if (!customerName.trim()) {
      setError("Nhập họ tên khách hàng");
      return;
    }
    if (!customerPhone.trim()) {
      setError("Nhập số điện thoại khách hàng");
      return;
    }
    if (cartItems.length === 0) {
      setError("Giỏ hàng trống");
      return;
    }

    setCheckoutLoading(true);
    setError(null);
    setCheckoutSuccess(null);

    try {
      const noteLines = [orderNote.trim()];
      if (appliedPromotion) {
        noteLines.push(
          `Mã giảm giá: ${appliedPromotion.title} (${appliedPromotion.discount_percent}% )`,
        );
      }
      const res = await fetch(`${getApiBase()}/api/shop/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: customerName.trim(),
          phone: customerPhone.trim(),
          branch_id: selectedBranchId,
          note: noteLines.filter(Boolean).join("\n"),
          items: cartItems.map((item) => ({
            name: item.name,
            unit_price: item.unit_price,
            quantity: item.quantity,
          })),
        }),
      });
      const data = await readJsonResponse<{
        order_id?: number;
        total_price?: number;
        warning?: string;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Thanh toán thất bại");

      const receipt = `Đặt hàng thành công #${data.order_id}. Tổng: ${orderTotal.toLocaleString("vi-VN")} đ`;
      setCheckoutSuccess(receipt);
      setCartItems([]);
      setVoucherCode("");
      setAppliedPromotion(null);
      setOrderNote("");
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function onUpdateStatus(orderId: number, status: string) {
    if (!uid || !selectedBranchId) return;
    setBusyOrderId(orderId);
    setError(null);
    try {
      await patchOrderStatus(uid, orderId, status, selectedBranchId);
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyOrderId(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-gray-600">Đang tải dữ liệu...</div>;
  }

  return (
    <ReceptionistShell
      user={user}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onBranchChange={onBranchChange}
      onLogout={() => void logout()}
    >
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {checkoutSuccess && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{checkoutSuccess}</p>
      )}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm mb-6">
        <PageHeader title="Bán hàng tại quầy" />
        <p className="mb-4 text-sm text-gray-600">Chọn sản phẩm, nhập thông tin khách và thanh toán đơn hàng.</p>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700">Danh sách sản phẩm</p>
                <p className="text-xs text-gray-500">Hiển thị sản phẩm có thể bán.</p>
              </div>
              <div className="flex gap-2">
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Tìm kiếm sản phẩm"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm sm:w-72"
                />
                <button
                  type="button"
                  onClick={() => void loadProducts()}
                  className="rounded-md px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  Tìm
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full min-w-[720px] text-left text-sm text-gray-700">
                <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
                  <tr>
                    <th className="py-2 pr-2">SKU</th>
                    <th className="py-2 pr-2">Tên</th>
                    <th className="py-2 pr-2">Giá</th>
                    <th className="py-2 pr-2">Tồn</th>
                    <th className="py-2">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingProducts ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500">
                        Đang tải sản phẩm...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500">
                        Không tìm thấy sản phẩm.
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="border-b border-gray-100">
                        <td className="py-2 pr-2 font-mono text-xs text-slate-700">{product.sku}</td>
                        <td className="py-2 pr-2">{product.name}</td>
                        <td className="py-2 pr-2">{Number(product.price).toLocaleString("vi-VN")} đ</td>
                        <td className="py-2 pr-2">{product.stock}</td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => addToCart(product)}
                            className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
                            style={{ backgroundColor: 'var(--brand-accent)' }}
                          >
                            Thêm vào hóa đơn
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-gray-700">Thông tin đơn hàng</p>
            <div className="space-y-3">
              <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                Khách hàng
              </label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Họ tên khách"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              />
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Số điện thoại"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              />
              <textarea
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                rows={3}
                placeholder="Ghi chú đơn hàng"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              />
            </div>

            <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Giỏ hàng</span>
                <span>{cartItems.length} sản phẩm</span>
              </div>
              <div className="mt-3 space-y-3">
                {cartItems.length === 0 ? (
                  <p className="text-sm text-gray-500">Giỏ hàng trống.</p>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-slate-50 px-3 py-3">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.sku}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                          className="rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateCartQuantity(item.id, Number(e.target.value))}
                          className="w-14 rounded border border-gray-200 bg-white px-2 py-1 text-center text-sm text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                          className="rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.id)}
                          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>Tạm tính</span>
                  <span>{cartTotal.toLocaleString("vi-VN")} đ</span>
                </div>
                {appliedPromotion ? (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>Giảm {appliedPromotion.discount_percent}%</span>
                    <span>-{discountAmount.toLocaleString("vi-VN")} đ</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-gray-200 pt-3 font-semibold">
                  <span>Tổng đơn</span>
                  <span>{orderTotal.toLocaleString("vi-VN")} đ</span>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    placeholder="Mã giảm giá"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={applyVoucher}
                    className="rounded-lg bg-bb-navy px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Áp dụng
                  </button>
                </div>
                {voucherError && <p className="text-sm text-red-600">{voucherError}</p>}
                {appliedPromotion && (
                  <p className="text-sm text-emerald-700">Áp dụng: {appliedPromotion.title}</p>
                )}
              </div>

              <button
                type="button"
                onClick={onCheckout}
                disabled={checkoutLoading || cartItems.length === 0}
                className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {checkoutLoading ? "Đang thanh toán..." : "Thanh toán và tạo đơn"}
              </button>
            </div>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-bb-navy">Quản lý shop</h1>
        <p className="mb-4 text-sm text-gray-600">Theo dõi và cập nhật trạng thái đơn hàng tại chi nhánh.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-600">
              <tr>
                <th className="py-2 pr-2">#Đơn</th>
                <th className="py-2 pr-2">Khách hàng</th>
                <th className="py-2 pr-2">Tổng tiền</th>
                <th className="py-2 pr-2">Trạng thái</th>
                <th className="py-2 pr-2">Địa chỉ / Ghi chú</th>
                <th className="py-2">Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">
                    Chưa có đơn hàng nào.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-gray-100">
                    <td className="py-2 pr-2 font-mono">{o.id}</td>
                    <td className="py-2 pr-2">
                      <div className="font-medium">{o.customer_name ?? "Khách vãng lai"}</div>
                      <div className="text-xs text-gray-500">{o.customer_phone ?? "—"}</div>
                    </td>
                    <td className="py-2 pr-2 font-semibold">{Number(o.total_price || 0).toLocaleString("vi-VN")} đ</td>
                    <td className="py-2 pr-2">
                      <select
                        className="rounded-lg border border-gray-200 bg-bb-input px-2 py-1 text-xs"
                        value={o.status}
                        disabled={busyOrderId === o.id}
                        onChange={(e) => void onUpdateStatus(o.id, e.target.value)}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2 text-xs text-gray-600">
                      <div>{o.shipping_address || "—"}</div>
                      <div>{o.note || ""}</div>
                    </td>
                    <td className="py-2 text-xs text-gray-600">
                      {o.created_at ? new Date(o.created_at).toLocaleString("vi-VN") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </ReceptionistShell>
  );
}
