"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, getApiBase, readJsonResponse } from "@/lib/api";
import toast from "react-hot-toast";

type CategoryRow = {
  id: number;
  name: string;
  product_count?: number;
};

type ProductRow = {
  id: number;
  category_id: number;
  category_name?: string;
  name: string;
  price: string | number;
  stock: number;
  unit: string;
  description?: string | null;
  image_url?: string | null;
};

type OrderRow = {
  id: number;
  customer_id: number;
  customer_name: string;
  total_price: number;
  status: string;
  created_at: string;
};

type ShopStats = {
  total_products: number;
  low_stock_products: number;
  monthly_revenue: number;
  orders_today: number;
  top_products: Array<{
    id: number;
    name: string;
    total_sold: number;
  }>;
};

export default function OwnerShopPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Categories
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);

  // Products
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Edit product modal
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("0");
  const [editUnit, setEditUnit] = useState("cái");
  const [editDescription, setEditDescription] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editFileInputKey, setEditFileInputKey] = useState(0);

  // Add product form
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [unit, setUnit] = useState("cái");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  // Stock management
  const [stockProductId, setStockProductId] = useState<number | null>(null);
  const [stockChangeType, setStockChangeType] = useState<'import' | 'export' | 'adjust'>('import');
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockNote, setStockNote] = useState("");

  // Stats
  const [stats, setStats] = useState<ShopStats | null>(null);

  // Orders
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [orderStartDate, setOrderStartDate] = useState("");
  const [orderEndDate, setOrderEndDate] = useState("");
  const [updatingOrder, setUpdatingOrder] = useState<number | null>(null);

  function productImageUrl(stored: string | null | undefined): string | null {
    const u = stored?.toString().trim();
    if (!u) return null;
    if (u.startsWith("http")) return u;
    return `${getApiBase()}${u.startsWith("/") ? u : `/${u}`}`;
  }

  const load = useCallback(async () => {
    setError(null);
    const base = getApiBase();
    try {
      // Load categories with product count
      const [cRes] = await Promise.all([
        fetch(`${base}/api/product-categories`, { cache: "no-store" }),
      ]);
      const cJson = await readJsonResponse<{ categories?: CategoryRow[]; error?: string }>(cRes);
      if (!cRes.ok) throw new Error(cJson.error ?? "Lỗi danh mục");
      const cats = cJson.categories ?? [];
      setCategories(cats);
      setCategoryId((prev) => {
        if (prev) return prev;
        return cats.length ? String(cats[0].id) : "";
      });
      setEditCategoryId((prev) => {
        if (prev) return prev;
        return cats.length ? String(cats[0].id) : "";
      });

      // Load products with filters
      await loadProducts();

      // Load stats
      const sRes = await fetch(`${base}/api/shop/stats`, { cache: "no-store" });
      const sJson = await readJsonResponse<ShopStats>(sRes);
      if (sRes.ok) setStats(sJson);

      // Load orders
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const loadProducts = useCallback(async () => {
    const base = getApiBase();
    const params = new URLSearchParams({
      limit: pageSize.toString(),
      offset: ((currentPage - 1) * pageSize).toString(),
      sort_by: sortBy,
      sort_order: sortOrder,
    });
    if (searchQuery) params.append('search', searchQuery);
    if (selectedCategory) params.append('category_id', selectedCategory);
    if (stockFilter) params.append('stock_filter', stockFilter);

    const pRes = await fetch(`${base}/api/products?${params}`, { cache: "no-store" });
    const pJson = await readJsonResponse<{ products?: ProductRow[]; total?: number; error?: string }>(pRes);
    if (!pRes.ok) throw new Error(pJson.error ?? "Lỗi sản phẩm");
    setProducts(pJson.products ?? []);
    setTotalProducts(pJson.total ?? 0);
  }, [searchQuery, selectedCategory, stockFilter, sortBy, sortOrder, currentPage, pageSize]);

  const loadOrders = useCallback(async () => {
    const base = getApiBase();
    const params = new URLSearchParams({
      limit: '20',
      offset: '0',
    });
    if (orderStatusFilter) params.append('status', orderStatusFilter);
    if (orderStartDate) params.append('start_date', orderStartDate);
    if (orderEndDate) params.append('end_date', orderEndDate);

    const oRes = await fetch(`${base}/api/shop/orders?${params}`, { cache: "no-store" });
    const oJson = await readJsonResponse<{ orders?: OrderRow[]; error?: string }>(oRes);
    if (oRes.ok) setOrders(oJson.orders ?? []);
  }, [orderStatusFilter, orderStartDate, orderEndDate]);

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
        setReady(true);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => unsub();
  }, [router, load]);

  useEffect(() => {
    if (ready) {
      loadProducts();
    }
  }, [ready, loadProducts]);

  useEffect(() => {
    if (ready) {
      loadOrders();
    }
  }, [ready, loadOrders]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const cid = Number(categoryId);
    if (!cid) {
      setError("Chọn danh mục.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const base = getApiBase();
      const fd = new FormData();
      fd.append("category_id", String(cid));
      fd.append("name", name.trim());
      fd.append("price", String(Number(price)));
      fd.append("stock", String(Number(stock)));
      fd.append("unit", unit.trim() || "cái");
      fd.append("description", description.trim());
      fd.append("is_active", "1");
      if (image) {
        fd.append("image", image, image.name || "product.jpg");
      }

      const res = await fetch(`${base}/api/admin/products`, {
        method: "POST",
        body: fd,
      });
      const data = await readJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Không thêm được sản phẩm");

      setName("");
      setPrice("");
      setStock("0");
      setUnit("cái");
      setDescription("");
      setImage(null);
      setFileInputKey((k) => k + 1);
      await loadProducts();
      toast.success("Thêm sản phẩm thành công!");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      toast.error("Thêm sản phẩm thất bại!");
    } finally {
      setSaving(false);
    }
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/admin/product-categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      const data = await readJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Không thêm được danh mục");
      setNewCategoryName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function updateCategory() {
    if (!editingCategory || !editingCategory.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/admin/product-categories/${editingCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingCategory.name.trim() }),
      });
      const data = await readJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Không cập nhật được danh mục");
      setEditingCategory(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(id: number) {
    if (!confirm("Bạn có chắc muốn xóa danh mục này?")) return;
    setSaving(true);
    setError(null);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/admin/product-categories/${id}`, {
        method: "DELETE",
      });
      const data = await readJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Không xóa được danh mục");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function openEditProduct(product: ProductRow) {
    setEditingProduct(product);
    setEditName(product.name);
    setEditCategoryId(String(product.category_id));
    setEditPrice(String(product.price));
    setEditStock(String(product.stock));
    setEditUnit(product.unit);
    setEditDescription(product.description || "");
    setEditImage(null);
    setEditFileInputKey((k) => k + 1);
  }

  async function updateProduct() {
    if (!editingProduct) return;
    const cid = Number(editCategoryId);
    if (!cid) {
      setError("Chọn danh mục.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const base = getApiBase();
      const fd = new FormData();
      fd.append("category_id", String(cid));
      fd.append("name", editName.trim());
      fd.append("price", String(Number(editPrice)));
      fd.append("stock", String(Number(editStock)));
      fd.append("unit", editUnit.trim() || "cái");
      fd.append("description", editDescription.trim());
      fd.append("is_active", "1");
      if (editImage) {
        fd.append("image", editImage, editImage.name || "product.jpg");
      }

      const res = await fetch(`${base}/api/admin/products/${editingProduct.id}`, {
        method: "PUT",
        body: fd,
      });
      const data = await readJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Không cập nhật được sản phẩm");

      setEditingProduct(null);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(id: number) {
    if (!confirm("Bạn có chắc muốn xóa sản phẩm này?")) return;
    setSaving(true);
    setError(null);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/admin/products/${id}`, {
        method: "DELETE",
      });
      const data = await readJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Không xóa được sản phẩm");
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function adjustStock() {
    if (!stockProductId || !stockQuantity) return;
    setSaving(true);
    setError(null);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/admin/products/${stockProductId}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          change_type: stockChangeType,
          quantity: Number(stockQuantity),
          note: stockNote.trim(),
        }),
      });
      const data = await readJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Không điều chỉnh được tồn kho");

      setStockProductId(null);
      setStockQuantity("");
      setStockNote("");
      await loadProducts();
      // Load stock history if needed
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function updateOrderStatus(orderId: number, status: string) {
    setUpdatingOrder(orderId);
    setError(null);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/admin/shop/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await readJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Không cập nhật được trạng thái đơn hàng");
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingOrder(null);
    }
  }

  function getStockStatus(stock: number) {
    if (stock === 0) return { label: "Hết hàng", color: "text-red-600 bg-red-50" };
    if (stock < 5) return { label: "Sắp hết", color: "text-yellow-600 bg-yellow-50" };
    return { label: "Còn hàng", color: "text-green-600 bg-green-50" };
  }

  function categoryName(id: number) {
    return categories.find((c) => c.id === id)?.name ?? `#${id}`;
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
        <h1 className="text-xl font-bold">Quản lý shop</h1>
        <p className="text-sm text-white/80">
          Quản lý sản phẩm, danh mục, tồn kho và đơn hàng.
        </p>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Thống kê shop */}
        {stats && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-2xl font-bold text-bb-navy">{stats.total_products}</div>
              <div className="text-sm text-gray-600">Tổng sản phẩm</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-2xl font-bold text-red-600">{stats.low_stock_products}</div>
              <div className="text-sm text-gray-600">Sắp hết hàng</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-2xl font-bold text-green-600">{stats.monthly_revenue.toLocaleString()}đ</div>
              <div className="text-sm text-gray-600">Doanh thu tháng này</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">{stats.orders_today}</div>
              <div className="text-sm text-gray-600">Đơn hôm nay</div>
            </div>
          </section>
        )}

        {/* Top 5 sản phẩm bán chạy */}
        {stats && stats.top_products.length > 0 && (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-bb-navy">Top 5 sản phẩm bán chạy</h2>
            <div className="space-y-3">
              {stats.top_products.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-bb-yellow text-xs font-bold text-black">
                      {i + 1}
                    </span>
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <span className="text-sm text-gray-600">{p.total_sold} đã bán</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quản lý danh mục */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-bb-navy">Quản lý danh mục</h2>
          
          {/* Form thêm danh mục */}
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              placeholder="Tên danh mục mới"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
            <button
              onClick={addCategory}
              disabled={saving || !newCategoryName.trim()}
              className="rounded-lg bg-bb-yellow px-4 py-2 text-sm font-bold text-black/80 disabled:opacity-50"
            >
              Thêm
            </button>
          </div>

          {/* Bảng danh mục */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="py-2 pr-2">ID</th>
                  <th className="py-2 pr-2">Tên</th>
                  <th className="py-2 pr-2">Số sản phẩm</th>
                  <th className="py-2">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      Chưa có danh mục.
                    </td>
                  </tr>
                ) : (
                  categories.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-mono text-gray-400">{c.id}</td>
                      <td className="py-2 pr-2">
                        {editingCategory?.id === c.id ? (
                          <input
                            type="text"
                            className="w-full rounded border border-gray-200 px-2 py-1"
                            value={editingCategory.name}
                            onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                          />
                        ) : (
                          <span className="font-medium">{c.name}</span>
                        )}
                      </td>
                      <td className="py-2 pr-2">{c.product_count || 0}</td>
                      <td className="py-2">
                        {editingCategory?.id === c.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={updateCategory}
                              disabled={saving}
                              className="rounded bg-green-500 px-2 py-1 text-xs text-white hover:bg-green-600"
                            >
                              Lưu
                            </button>
                            <button
                              onClick={() => setEditingCategory(null)}
                              className="rounded bg-gray-500 px-2 py-1 text-xs text-white hover:bg-gray-600"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingCategory(c)}
                              className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => deleteCategory(c.id)}
                              disabled={saving || (c.product_count || 0) > 0}
                              className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-50"
                            >
                              Xóa
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-bb-navy">Thêm món hàng</h2>
          <form
            onSubmit={(ev) => void onSubmit(ev)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-gray-600">Danh mục</span>
              <select
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.length === 0 ? (
                  <option value="">— chưa có danh mục —</option>
                ) : (
                  categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-gray-600">Tên sản phẩm</span>
              <input
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Giá</span>
              <input
                required
                type="number"
                min={1}
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Tồn kho</span>
              <input
                required
                type="number"
                min={0}
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Đơn vị</span>
              <input
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-gray-600">Mô tả</span>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-gray-600">
                Ảnh (tuỳ chọn, tối đa ~2MB)
              </span>
              <input
                key={fileInputKey}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,.heic,image/*"
                className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-bb-input file:px-3 file:py-2"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              />
              {image ? (
                <p className="mt-1 text-xs text-gray-600">
                  Đã chọn: <span className="font-medium">{image.name}</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">
                  Chọn file ảnh rồi bấm «Thêm món hàng».
                </p>
              )}
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving || categories.length === 0}
                className="rounded-xl bg-bb-yellow px-5 py-2.5 text-sm font-bold text-black/80 disabled:opacity-50"
              >
                {saving ? "Đang lưu…" : "Thêm món hàng"}
              </button>
            </div>
          </form>
        </section>

        {/* Sản phẩm */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-bb-navy">Sản phẩm</h2>

          {/* Thanh tìm kiếm & lọc */}
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <input
              type="text"
              placeholder="Tìm theo tên sản phẩm"
              className="rounded-lg border border-gray-200 px-3 py-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="rounded-lg border border-gray-200 px-3 py-2"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-gray-200 px-3 py-2"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="">Tất cả tồn kho</option>
              <option value="in_stock">Còn hàng</option>
              <option value="low_stock">Sắp hết (&lt; 5)</option>
              <option value="out_of_stock">Hết hàng (= 0)</option>
            </select>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("");
                setStockFilter("");
                setCurrentPage(1);
              }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
            >
              Xóa lọc
            </button>
          </div>

          {/* Bảng sản phẩm */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="cursor-pointer py-2 pr-2 hover:text-gray-700" onClick={() => { setSortBy("id"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                    ID {sortBy === "id" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="py-2 pr-2">Ảnh</th>
                  <th className="cursor-pointer py-2 pr-2 hover:text-gray-700" onClick={() => { setSortBy("name"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                    Tên {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="cursor-pointer py-2 pr-2 hover:text-gray-700" onClick={() => { setSortBy("price"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                    Giá {sortBy === "price" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="cursor-pointer py-2 pr-2 hover:text-gray-700" onClick={() => { setSortBy("stock"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                    Tồn {sortBy === "stock" && (sortOrder === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="py-2 pr-2">Trạng thái</th>
                  <th className="py-2 pr-2">Danh mục</th>
                  <th className="py-2">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      Chưa có sản phẩm.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const img = productImageUrl(p.image_url ?? null);
                    const stockStatus = getStockStatus(p.stock);
                    return (
                      <tr key={p.id} className={`border-b border-gray-100 ${p.stock === 0 ? 'bg-red-50' : p.stock < 5 ? 'bg-yellow-50' : ''}`}>
                        <td className="py-2 pr-2 font-mono text-gray-400">{p.id}</td>
                        <td className="py-2 pr-2">
                          {img ? (
                            <img
                              src={img}
                              alt=""
                              className="h-12 w-12 rounded-md object-cover ring-1 ring-gray-200"
                            />
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-2 font-medium">{p.name}</td>
                        <td className="py-2 pr-2">{String(p.price)}</td>
                        <td className="py-2 pr-2">{p.stock}</td>
                        <td className="py-2 pr-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${stockStatus.color}`}>
                            {stockStatus.label}
                          </span>
                        </td>
                        <td className="py-2 pr-2">{p.category_name || categoryName(p.category_id)}</td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEditProduct(p)}
                              className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => deleteProduct(p.id)}
                              className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang */}
          {totalProducts > pageSize && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-gray-200 px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
              >
                Trước
              </button>
              <span className="text-sm text-gray-600">
                Trang {currentPage} / {Math.ceil(totalProducts / pageSize)}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalProducts / pageSize), p + 1))}
                disabled={currentPage === Math.ceil(totalProducts / pageSize)}
                className="rounded-lg border border-gray-200 px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          )}
        </section>

        {/* Modal edit product */}
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-2xl bg-white p-6">
              <h3 className="mb-4 text-lg font-bold text-bb-navy">Chỉnh sửa sản phẩm</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateProduct();
                }}
                className="space-y-3"
              >
                <label className="block text-sm">
                  <span className="mb-1 block text-gray-600">Danh mục</span>
                  <select
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-gray-600">Tên sản phẩm</span>
                  <input
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-gray-600">Giá</span>
                    <input
                      required
                      type="number"
                      min={1}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-gray-600">Tồn kho</span>
                    <input
                      required
                      type="number"
                      min={0}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      value={editStock}
                      onChange={(e) => setEditStock(e.target.value)}
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="mb-1 block text-gray-600">Đơn vị</span>
                  <input
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-gray-600">Mô tả</span>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-gray-600">Ảnh hiện tại</span>
                  {productImageUrl(editingProduct.image_url ?? null) ? (
                    <img
                      src={productImageUrl(editingProduct.image_url ?? null)!}
                      alt=""
                      className="mb-2 h-20 w-20 rounded-md object-cover ring-1 ring-gray-200"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">Không có ảnh</span>
                  )}
                  <input
                    key={editFileInputKey}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,.heic,image/*"
                    className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-bb-input file:px-3 file:py-2"
                    onChange={(e) => setEditImage(e.target.files?.[0] ?? null)}
                  />
                </label>
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-lg bg-bb-yellow px-4 py-2 text-sm font-bold text-black/80 disabled:opacity-50"
                  >
                    {saving ? "Đang lưu…" : "Lưu thay đổi"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Nhập kho / Xuất kho */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-bb-navy">Điều chỉnh tồn kho</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <select
              className="rounded-lg border border-gray-200 px-3 py-2"
              value={stockProductId || ""}
              onChange={(e) => setStockProductId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Chọn sản phẩm</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-gray-200 px-3 py-2"
              value={stockChangeType}
              onChange={(e) => setStockChangeType(e.target.value as 'import' | 'export' | 'adjust')}
            >
              <option value="import">Nhập kho</option>
              <option value="export">Xuất kho</option>
              <option value="adjust">Điều chỉnh</option>
            </select>
            <input
              type="number"
              placeholder="Số lượng"
              min={0}
              className="rounded-lg border border-gray-200 px-3 py-2"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
            />
            <input
              type="text"
              placeholder="Ghi chú"
              className="rounded-lg border border-gray-200 px-3 py-2"
              value={stockNote}
              onChange={(e) => setStockNote(e.target.value)}
            />
          </div>
          <div className="mt-3">
            <button
              onClick={adjustStock}
              disabled={saving || !stockProductId || !stockQuantity}
              className="rounded-lg bg-bb-yellow px-4 py-2 text-sm font-bold text-black/80 disabled:opacity-50"
            >
              {saving ? "Đang xử lý…" : "Xác nhận"}
            </button>
          </div>
        </section>

        {/* Đơn hàng */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-bb-navy">Đơn hàng</h2>

          {/* Bộ lọc */}
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <select
              className="rounded-lg border border-gray-200 px-3 py-2"
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ xử lý</option>
              <option value="confirmed">Đã xác nhận</option>
              <option value="shipping">Đang giao</option>
              <option value="delivered">Đã giao</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
            </select>
            <input
              type="date"
              className="rounded-lg border border-gray-200 px-3 py-2"
              value={orderStartDate}
              onChange={(e) => setOrderStartDate(e.target.value)}
            />
            <input
              type="date"
              className="rounded-lg border border-gray-200 px-3 py-2"
              value={orderEndDate}
              onChange={(e) => setOrderEndDate(e.target.value)}
            />
          </div>

          {/* Bảng đơn hàng */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Khách</th>
                  <th className="py-2 pr-2">Tổng</th>
                  <th className="py-2 pr-2">Trạng thái</th>
                  <th className="py-2">Ngày</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-500">
                      Chưa có đơn hàng.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-mono">{o.id}</td>
                      <td className="py-2 pr-2">
                        <div className="font-medium">{o.customer_name}</div>
                      </td>
                      <td className="py-2 pr-2">{o.total_price}</td>
                      <td className="py-2 pr-2">
                        <select
                          className="rounded-lg border border-gray-200 bg-bb-input px-2 py-1 text-xs"
                          value={o.status}
                          disabled={updatingOrder === o.id}
                          onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                        >
                          <option value="pending">Chờ xử lý</option>
                          <option value="confirmed">Đã xác nhận</option>
                          <option value="shipping">Đang giao</option>
                          <option value="delivered">Đã giao</option>
                          <option value="completed">Hoàn thành</option>
                          <option value="cancelled">Đã hủy</option>
                        </select>
                      </td>
                      <td className="py-2 text-xs text-gray-600">
                        {o.created_at ? new Date(o.created_at).toLocaleString("vi-VN") : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
