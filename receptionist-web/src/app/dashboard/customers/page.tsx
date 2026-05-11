"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ReceptionistShell } from "@/components/ReceptionistShell";
import { useReceptionistSession } from "@/hooks/useReceptionistSession";
import { fetchManagerCustomers, type CustomerRow } from "@/lib/managerApi";
import { CustomerChatThread } from "@/components/CustomerChatThread";

export default function ReceptionistCustomersPage() {
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
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);

  const loadCustomers = useCallback(async () => {
    if (!uid || !selectedBranchId) return;
    try {
      const data = await fetchManagerCustomers(uid, selectedBranchId);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [uid, selectedBranchId, setError]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (r.full_name ?? "").toLowerCase().includes(q) || (r.phone ?? "").includes(q));
  }, [rows, query]);

  async function copyPhone(phone: string | null) {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
    } catch {
      setError("Không thể sao chép số điện thoại.");
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
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-bb-navy">Liên hệ với khách hàng</h1>
        <p className="mb-4 text-sm text-gray-600">Tìm nhanh khách hàng để chat hoặc copy số điện thoại.</p>
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Tìm theo tên hoặc số điện thoại"
            className="min-w-[260px] flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" onClick={() => void loadCustomers()}>
            Tải lại
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-600">
              <tr>
                <th className="py-2 pr-2">#ID</th>
                <th className="py-2 pr-2">Khách hàng</th>
                <th className="py-2 pr-2">Số điện thoại</th>
                <th className="py-2 pr-2">Lần đặt gần nhất</th>
                <th className="py-2">Liên hệ</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    Không có khách hàng phù hợp.
                  </td>
                </tr>
              ) : (
                filteredRows.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-2 pr-2 font-mono">{c.id}</td>
                    <td className="py-2 pr-2 font-medium">{c.full_name ?? "Khách chưa cập nhật tên"}</td>
                    <td className="py-2 pr-2">{c.phone ?? "—"}</td>
                    <td className="py-2 pr-2 text-xs text-gray-600">
                      {c.last_booking ? new Date(c.last_booking).toLocaleString("vi-VN") : "Chưa có lịch đặt"}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void copyPhone(c.phone)}
                          className="rounded-lg bg-bb-input px-2 py-1 text-xs font-semibold text-bb-navy"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(c)}
                          className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white"
                        >
                          Chat
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      {selectedCustomer && selectedBranchId ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <CustomerChatThread
            uid={uid ?? ''}
            branchId={selectedBranchId}
            customerId={selectedCustomer.id}
            customerName={selectedCustomer.full_name}
            customerPhone={selectedCustomer.phone}
            onClose={() => setSelectedCustomer(null)}
          />
        </section>
      ) : null}
    </ReceptionistShell>
  );
}
