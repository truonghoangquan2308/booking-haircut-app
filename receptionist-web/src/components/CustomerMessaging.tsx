"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Button } from "@/components/DesignSystemComponents";
import { fetchManagerCustomers, type CustomerRow } from "@/lib/managerApi";

type AutoReplyMessagingProps = {
  uid: string;
  branchId: number;
};

export function AutoReplyMessaging({ uid, branchId }: AutoReplyMessagingProps) {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchManagerCustomers(uid, branchId);
      setCustomers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [uid, branchId]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    if (!query.trim()) return customers;
    const q = query.toLowerCase().trim();
    return customers.filter((customer) => {
      const name = customer.full_name?.toLowerCase() ?? "";
      const phone = customer.phone?.toLowerCase() ?? "";
      return name.includes(q) || phone.includes(q);
    });
  }, [customers, query]);

  async function copyPhone(phone: string | null) {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
    } catch {
      setError("Không thể sao chép số điện thoại.");
    }
  }

  return (
    <Card
      title="Tin nhắn khách hàng"
      description="Danh sách khách hàng chi nhánh để gọi điện, SMS hoặc copy số nhanh. Chat sẽ được tích hợp tiếp theo."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-slate-500">
            UID: <span className="font-medium text-slate-900">{uid}</span>
          </div>
          <div className="text-sm text-slate-500">
            Branch: <span className="font-medium text-slate-900">{branchId}</span>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
            onClick={() => void loadCustomers()}
          >
            Tải lại danh sách
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Tìm theo tên hoặc số điện thoại"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-[260px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
          <Button type="button" variant="secondary" onClick={() => void loadCustomers()}>
            Làm mới
          </Button>
        </div>

        {error ? (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Đang tải khách hàng...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Chưa có khách hàng phù hợp hoặc chi nhánh chưa có dữ liệu.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="py-3 px-3 font-medium">#ID</th>
                  <th className="py-3 px-3 font-medium">Khách hàng</th>
                  <th className="py-3 px-3 font-medium">SĐT</th>
                  <th className="py-3 px-3 font-medium">Lần đặt gần nhất</th>
                  <th className="py-3 px-3 font-medium">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-slate-100">
                    <td className="py-3 px-3 font-mono text-slate-700">{customer.id}</td>
                    <td className="py-3 px-3 font-medium text-slate-900">{customer.full_name ?? "Không tên"}</td>
                    <td className="py-3 px-3 text-slate-700">{customer.phone ?? "—"}</td>
                    <td className="py-3 px-3 text-slate-600">{customer.last_booking ? new Date(customer.last_booking).toLocaleString("vi-VN") : "Chưa đặt"}</td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={customer.phone ? `tel:${customer.phone}` : "#"}
                          className={`rounded-lg px-2 py-1 text-xs font-semibold ${customer.phone ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400 pointer-events-none"}`}
                        >
                          Gọi
                        </a>
                        <a
                          href={customer.phone ? `sms:${customer.phone}` : "#"}
                          className={`rounded-lg px-2 py-1 text-xs font-semibold ${customer.phone ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400 pointer-events-none"}`}
                        >
                          SMS
                        </a>
                        <button
                          type="button"
                          onClick={() => void copyPhone(customer.phone)}
                          className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
                        >
                          Copy
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

