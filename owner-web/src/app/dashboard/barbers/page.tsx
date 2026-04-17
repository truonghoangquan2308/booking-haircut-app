"use client";

import { FormEvent, useCallback, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid } from "@/lib/api";
import { fetchManagerBranchList, type ManagerBranchRow } from "@/lib/managerApi";
import {
  createOwnerBarber,
  fetchOwnerBarbers,
  fetchOwnerBarbersStats,
  patchOwnerBarber,
  type OwnerBarberRow,
} from "@/lib/ownerBarbersApi";

/** Giống app Flutter: 09… → +849… */
function normalizeVnPhone(raw: string): string {
  const p = raw.trim().replace(/\s/g, "");
  if (p.startsWith("+")) return p;
  if (p.startsWith("0")) return `+84${p.slice(1)}`;
  return `+84${p}`;
}

function IconPencil(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className ?? "h-4 w-4"}
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

export default function OwnerBarbersPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [branches, setBranches] = useState<ManagerBranchRow[]>([]);
  const [rows, setRows] = useState<OwnerBarberRow[]>([]);
  const [stats, setStats] = useState<{
    total_barbers: number;
    working_today: number;
    off_today: number;
    avg_rating: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Search & filters
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "off" | "other">("all");
  const [bioFilter, setBioFilter] = useState<"all" | string>("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [modalMode, setModalMode] = useState<"closed" | "add" | "edit" | "changeBranch" | "toggleStatus">("closed");
  const [editBarberId, setEditBarberId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formBranchId, setFormBranchId] = useState<number | "">("");
  const [formBio, setFormBio] = useState("");
  const [formAvail, setFormAvail] = useState(true);
  const [formInitialStatus, setFormInitialStatus] = useState<"available" | "off">("available");

  const load = useCallback(async (firebaseUid: string) => {
    setError(null);
    const [list, br, st] = await Promise.all([
      fetchOwnerBarbers(firebaseUid),
      fetchManagerBranchList(firebaseUid),
      fetchOwnerBarbersStats(firebaseUid),
    ]);
    setRows(list);
    setBranches(br);
    setStats(st);
  }, []);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((b) => {
      const matchesSearch =
        !searchQuery ||
        (b.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         b.phone?.includes(searchQuery));
      const matchesBranch = branchFilter === "" || b.branch_id === branchFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "available" && b.status === "available") ||
        (statusFilter === "off" && b.status === "off") ||
        (statusFilter === "other" && !["available", "off"].includes(b.status));
      const matchesBio = bioFilter === "all" || b.bio === bioFilter;
      return matchesSearch && matchesBranch && matchesStatus && matchesBio;
    });
  }, [rows, searchQuery, branchFilter, statusFilter, bioFilter]);

  // Paginated rows
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(start, start + itemsPerPage);
  }, [filteredRows, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, branchFilter, statusFilter, bioFilter]);

  function openAddModal() {
    setError(null);
    setModalMode("add");
    setEditBarberId(null);
    setFormName("");
    setFormPhone("");
    setFormBio("");
    setFormAvail(true);
    setFormInitialStatus("available");
    const first = branches[0]?.id;
    setFormBranchId(first !== undefined ? first : "");
  }

  function openEditModal(b: OwnerBarberRow) {
    setError(null);
    setModalMode("edit");
    setEditBarberId(b.barber_id);
    setFormName(b.full_name ?? "");
    setFormPhone(b.phone ?? "");
    setFormBio(b.bio ?? "");
    setFormAvail(Number(b.is_available) === 1);
    setFormBranchId(b.branch_id ?? "");
    setFormInitialStatus(b.status === "available" ? "available" : "off");
  }

  function openChangeBranchModal(b: OwnerBarberRow) {
    setError(null);
    setModalMode("changeBranch");
    setEditBarberId(b.barber_id);
    setFormBranchId(b.branch_id ?? "");
  }

  function openToggleStatusModal(b: OwnerBarberRow) {
    setError(null);
    setModalMode("toggleStatus");
    setEditBarberId(b.barber_id);
  }

  function closeModal() {
    setModalMode("closed");
    setEditBarberId(null);
  }

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

  async function onSubmitModal(e: FormEvent) {
    e.preventDefault();
    if (!uid) return;
    if (modalMode === "add" || modalMode === "edit") {
      if (formBranchId === "" || !Number(formBranchId)) {
        setError("Chọn chi nhánh.");
        return;
      }
      if (modalMode === "add") {
        if (!formPhone.trim()) {
          setError("Nhập số điện thoại.");
          return;
        }
      }
    }
    setSaving(true);
    setError(null);
    try {
      if (modalMode === "add") {
        await createOwnerBarber(uid, {
          full_name: formName.trim() || undefined,
          phone: normalizeVnPhone(formPhone),
          branch_id: Number(formBranchId),
          bio: formBio.trim() || undefined,
          is_available: formAvail ? 1 : 0,
        });
      } else if (modalMode === "edit" && editBarberId != null) {
        const updated = await patchOwnerBarber(uid, editBarberId, {
          full_name: formName.trim() || null,
          branch_id: Number(formBranchId),
          bio: formBio.trim() || null,
          is_available: formAvail ? 1 : 0,
        });
        setRows((prev) =>
          prev.map((r) => (r.barber_id === updated.barber_id ? updated : r)),
        );
      } else if (modalMode === "changeBranch" && editBarberId != null) {
        const updated = await patchOwnerBarber(uid, editBarberId, {
          branch_id: Number(formBranchId),
        });
        setRows((prev) =>
          prev.map((r) => (r.barber_id === updated.barber_id ? updated : r)),
        );
      } else if (modalMode === "toggleStatus" && editBarberId != null) {
        const current = rows.find((r) => r.barber_id === editBarberId);
        if (!current) return;
        const newStatus = current.status === "available" ? "off" : "available";
        const updated = await patchOwnerBarber(uid, editBarberId, {
          is_available: newStatus === "available" ? 1 : 0,
        });
        setRows((prev) =>
          prev.map((r) => (r.barber_id === updated.barber_id ? updated : r)),
        );
      }
      closeModal();
      await load(uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bb-surface text-bb-navy">
        <div className="h-10 w-10 animate-pulse rounded-full bg-bb-yellow/50" />
        <p className="font-medium">Đang tải…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bb-surface text-gray-900">
      <header className="border-b border-white/10 bg-bb-navy px-6 py-4 text-white shadow">
        <h1 className="text-xl font-bold">Quản lý thợ</h1>
        <p className="text-sm text-white/80">
          Dữ liệu lấy từ MySQL qua <code className="rounded bg-white/10 px-1">GET /api/owner/barbers</code> (thợ có
          chi nhánh trùng <code className="rounded bg-white/10 px-1">branches.owner_id</code> của bạn).
        </p>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Thống kê tổng */}
        {stats && (
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-center">
              <div className="text-3xl font-bold text-bb-navy">{stats.total_barbers}</div>
              <div className="text-sm text-gray-600">Tổng số thợ</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-center">
              <div className="text-3xl font-bold text-green-600">{stats.working_today}</div>
              <div className="text-sm text-gray-600">Đang làm việc hôm nay</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-center">
              <div className="text-3xl font-bold text-yellow-600">{stats.off_today}</div>
              <div className="text-sm text-gray-600">Đang nghỉ hôm nay</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.avg_rating.toFixed(1)} ★</div>
              <div className="text-sm text-gray-600">Đánh giá trung bình toàn hệ thống</div>
            </div>
          </section>
        )}

        {branches.length === 0 && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Chưa có chi nhánh (cần <strong>branches.owner_id</strong> trùng Owner). Tạo chi nhánh trong DB hoặc
            liên hệ admin.
          </p>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-bb-navy">Danh sách thợ</h2>
            <button
              type="button"
              disabled={branches.length === 0}
              onClick={() => openAddModal()}
              className="rounded-xl bg-bb-yellow px-4 py-2 text-sm font-bold text-black/80 disabled:opacity-50"
            >
              Thêm thợ
            </button>
          </div>

          {/* Thanh tìm kiếm & lọc */}
          <div className="mb-4 grid gap-3 md:grid-cols-5">
            <input
              type="text"
              placeholder="Tìm theo tên thợ, SĐT"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value ? Number(e.target.value) : "")}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Tất cả chi nhánh</option>
              {branches.map((br) => (
                <option key={br.id} value={br.id}>
                  {br.name ?? `#${br.id}`}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "available" | "off" | "other")}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="available">Đang làm việc</option>
              <option value="off">Nghỉ phép</option>
              <option value="other">Đã nghỉ việc</option>
            </select>
            <select
              value={bioFilter}
              onChange={(e) => setBioFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="all">Tất cả phong cách</option>
              <option value="thợ hiện đại">Thợ hiện đại</option>
              <option value="thợ cổ điển">Thợ cổ điển</option>
              <option value="thợ phong cách hàn quốc">Thợ phong cách Hàn Quốc</option>
            </select>
            <div className="text-sm text-gray-500">
              Hiển thị {paginatedRows.length} / {filteredRows.length} thợ
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Thợ</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2">Lịch hôm nay</th>
                  <th className="px-3 py-2">Doanh thu tháng</th>
                  <th className="px-3 py-2">Chi nhánh</th>
                  <th className="px-3 py-2">Nhận lịch</th>
                  <th className="px-3 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((b) => (
                  <tr key={b.barber_id} className="border-b border-gray-100">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={b.avatar_url || "/default-avatar.png"}
                          alt="Avatar"
                          className="h-8 w-8 rounded-full border border-gray-200"
                        />
                        <div>
                          <div className="font-medium">{b.full_name ?? "—"}</div>
                          {b.bio && (
                            <div className="text-xs text-gray-500 bg-gray-100 px-1 py-0.5 rounded">
                              {b.bio}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {b.status === "available" ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Đang làm việc
                        </span>
                      ) : b.status === "off" ? (
                        <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                          Nghỉ phép
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          Đã nghỉ việc
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center font-medium">{b.appointments_today}</td>
                    <td className="px-3 py-2 font-mono text-sm">
                      {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(b.revenue_month)}
                    </td>
                    <td className="max-w-[200px] px-3 py-2 text-gray-700">
                      {b.branch_name ?? (b.branch_id != null ? `#${b.branch_id}` : "—")}
                    </td>
                    <td className="px-3 py-2">
                      {Number(b.is_available) === 1 ? (
                        <span className="text-emerald-700">Có</span>
                      ) : (
                        <span className="text-gray-500">Không</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/barbers/${b.barber_id}`)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-bb-navy hover:bg-gray-50"
                          title="Xem hồ sơ"
                        >
                          👁️ Hồ sơ
                        </button>
                        <button
                          type="button"
                          onClick={() => openChangeBranchModal(b)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-bb-navy hover:bg-gray-50"
                          title="Đổi chi nhánh"
                        >
                          🏢 Chi nhánh
                        </button>
                        <button
                          type="button"
                          onClick={() => openToggleStatusModal(b)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-bb-navy hover:bg-gray-50"
                          title="Kích hoạt / Vô hiệu hoá"
                        >
                          {b.status === "available" ? "🚫 Vô hiệu" : "✅ Kích hoạt"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(b)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-bb-navy hover:bg-gray-50"
                          title="Chỉnh sửa thông tin thợ"
                        >
                          <IconPencil />
                          Sửa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {paginatedRows.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-500">
                {filteredRows.length === 0 ? "Không tìm thấy thợ nào khớp với bộ lọc." : "Chưa có dòng nào trong DB."}
              </p>
            )}
          </div>

          {/* Phân trang */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="rounded-lg border border-gray-200 px-3 py-1 text-sm disabled:opacity-50"
              >
                Trước
              </button>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`rounded-lg border px-3 py-1 text-sm ${
                      page === currentPage
                        ? "border-bb-navy bg-bb-navy text-white"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="rounded-lg border border-gray-200 px-3 py-1 text-sm disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          )}
        </section>
      </main>

      {modalMode !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="barber-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 id="barber-modal-title" className="text-lg font-bold text-bb-navy">
              {modalMode === "add" ? "Thêm thợ" : modalMode === "edit" ? "Chỉnh sửa thợ" : modalMode === "changeBranch" ? "Đổi chi nhánh" : "Xác nhận thay đổi trạng thái"}
            </h3>
            <form onSubmit={(ev) => void onSubmitModal(ev)} className="mt-4 grid gap-3">
              {modalMode === "add" && (
                <>
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-600">Họ tên (tuỳ chọn)</span>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Để trống cũng được — sửa sau khi biết tên"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-600">Số điện thoại (bắt buộc)</span>
                    <input
                      required
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="09… hoặc +849…"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-600">Chi nhánh</span>
                    <select
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      value={formBranchId === "" ? "" : String(formBranchId)}
                      onChange={(e) =>
                        setFormBranchId(e.target.value ? Number(e.target.value) : "")
                      }
                      required
                      disabled={branches.length === 0}
                    >
                      {branches.map((br) => (
                        <option key={br.id} value={br.id}>
                          {br.name ?? `#${br.id}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-600">Phong cách</span>
                    <select
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      value={formBio}
                      onChange={(e) => setFormBio(e.target.value)}
                    >
                      <option value="">(Chưa chọn)</option>
                      <option value="thợ hiện đại">Thợ hiện đại</option>
                      <option value="thợ cổ điển">Thợ cổ điển</option>
                      <option value="thợ phong cách hàn quốc">Thợ phong cách Hàn Quốc</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-600">Trạng thái ban đầu</span>
                    <select
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      value={formInitialStatus}
                      onChange={(e) => setFormInitialStatus(e.target.value as "available" | "off")}
                    >
                      <option value="available">Đang làm việc</option>
                      <option value="off">Nghỉ phép</option>
                    </select>
                  </label>
                </>
              )}
              {modalMode === "edit" && (
                <>
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-600">Họ tên</span>
                    <input
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-600">Chi nhánh</span>
                    <select
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      value={formBranchId === "" ? "" : String(formBranchId)}
                      onChange={(e) =>
                        setFormBranchId(e.target.value ? Number(e.target.value) : "")
                      }
                      required
                      disabled={branches.length === 0}
                    >
                      {editBarberId != null &&
                        (() => {
                          const b = rows.find((r) => r.barber_id === editBarberId);
                          const bid = b?.branch_id;
                          if (bid == null || branches.some((br) => br.id === bid)) return null;
                          return (
                            <option key={`orphan-${bid}`} value={bid}>
                              Chi nhánh #{bid}
                            </option>
                          );
                        })()}
                      {branches.map((br) => (
                        <option key={br.id} value={br.id}>
                          {br.name ?? `#${br.id}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-600">Phong cách</span>
                    <select
                      className="w-full rounded-lg border border-gray-200 px-3 py-2"
                      value={formBio}
                      onChange={(e) => setFormBio(e.target.value)}
                    >
                      <option value="">(Chưa chọn)</option>
                      <option value="thợ hiện đại">Thợ hiện đại</option>
                      <option value="thợ cổ điển">Thợ cổ điển</option>
                      <option value="thợ phong cách hàn quốc">Thợ phong cách Hàn Quốc</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formAvail}
                      onChange={(e) => setFormAvail(e.target.checked)}
                    />
                    Đang nhận lịch
                  </label>
                </>
              )}
              {modalMode === "changeBranch" && (
                <label className="text-sm">
                  <span className="mb-1 block text-gray-600">Chọn chi nhánh mới</span>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-3 py-2"
                    value={formBranchId === "" ? "" : String(formBranchId)}
                    onChange={(e) =>
                      setFormBranchId(e.target.value ? Number(e.target.value) : "")
                    }
                    required
                  >
                    {branches.map((br) => (
                      <option key={br.id} value={br.id}>
                        {br.name ?? `#${br.id}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {modalMode === "toggleStatus" && editBarberId != null && (
                <p className="text-sm text-gray-700">
                  Bạn có chắc muốn{" "}
                  {rows.find((r) => r.barber_id === editBarberId)?.status === "available" ? "vô hiệu hoá" : "kích hoạt"}{" "}
                  thợ này?
                </p>
              )}
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => closeModal()}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-bb-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saving ? "Đang lưu…" : modalMode === "toggleStatus" ? "Xác nhận" : "Lưu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
