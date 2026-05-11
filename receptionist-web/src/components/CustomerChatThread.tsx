"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchManagerChatMessages, postManagerChatMessage, type ChatMessage } from "@/lib/managerApi";

type CustomerChatThreadProps = {
  uid: string;
  branchId: number;
  customerId: number;
  customerName: string | null;
  customerPhone: string | null;
  onClose: () => void;
};

export function CustomerChatThread({
  uid,
  branchId,
  customerId,
  customerName,
  customerPhone,
  onClose,
}: CustomerChatThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchManagerChatMessages(uid, branchId, customerId);
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [uid, branchId, customerId]);

  useEffect(() => {
    void loadMessages();
    const interval = setInterval(() => {
      void loadMessages();
    }, 4000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text) return;
    setNewMessage("");
    try {
      await postManagerChatMessage(uid, branchId, customerId, text);
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const formattedName = customerName || "Khách hàng";
  const formattedPhone = customerPhone ? `(${customerPhone})` : "";

  const lastSeen = useMemo(() => {
    if (!messages.length) return "Chưa có tin nhắn";
    return `Cập nhật ${new Date(messages[messages.length - 1].created_at).toLocaleString("vi-VN")}`;
  }, [messages]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Chat với {formattedName}</h2>
          <p className="text-sm text-slate-500">{formattedPhone}</p>
          <p className="mt-2 text-xs text-slate-400">{lastSeen}</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          onClick={onClose}
        >
          Đóng
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="max-h-[420px] overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-4">
        {loading ? (
          <div className="text-center text-sm text-slate-500">Đang tải tin nhắn...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-slate-500">Chưa có tin nhắn nào trong cuộc trò chuyện này.</div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isCustomer = message.sender === 'customer';
              const statusText = isCustomer
                ? message.is_read
                  ? 'Đã đọc bởi lễ tân'
                  : 'Chưa đọc'
                : message.is_read
                ? 'Khách đã xem'
                : 'Khách chưa xem';

              return (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm shadow-sm ${
                    isCustomer
                      ? 'bg-orange-50 text-slate-900 self-start'
                      : 'ml-auto bg-slate-900 text-white'
                  }`}
                >
                  <div>{message.message}</div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-slate-300">
                    <span>{new Date(message.created_at).toLocaleString('vi-VN')}</span>
                    <span className="font-medium text-[11px] text-slate-200">{statusText}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          rows={3}
          placeholder="Nhập tin nhắn...
"
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleSend}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Gửi
          </button>
        </div>
      </div>
    </div>
  );
}
