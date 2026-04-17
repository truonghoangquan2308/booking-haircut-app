"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserByFirebaseUid, getApiBase, readJsonResponse } from "@/lib/api";

type ServiceRow = {
  id: number;
  name: string;
  price: string | number;
  duration: number;
  description?: string | null;
  image_url?: string | null;
  is_active?: number;
};

export default function OwnerServicesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);

  function serviceImageUrl(stored: string | null | undefined): string | null {
    const u = stored?.toString().trim();
    if (!u) return null;
    if (u.startsWith("http")) return u;
    return `${getApiBase()}${u.startsWith("/") ? u : `/${u}`}`;
  }

  const load = useCallback(async () => {
    setError(null);
    const base = getApiBase();
    const res = await fetch(`${base}/api/services`, { cache: "no-store" });
    const data = await readJsonResponse<{
      status?: string;
      data?: ServiceRow[];
      message?: string;
    }>(res);
    if (!res.ok) {
      throw new Error(data.message ?? "Lỗi tải dịch vụ");
    }
    const list = data.data ?? [];
    setRows(Array.isArray(list) ? list : []);
  }, []);

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const base = getApiBase();
      const url = `${base}/api/services`;

      let res: Response;
      if (image) {
        const fd = new FormData();
        fd.set("name", name.trim());
        fd.set("price", String(Number(price)));
        fd.set("duration", String(Number(duration)));
        fd.set("description", description.trim());
        fd.set("is_active", "1");
        fd.set("image", image);
        res = await fetch(url, { method: "POST", body: fd });
      } else {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            price: Number(price),
            duration: Number(duration),
            description: description.trim(),
            is_active: 1,
          }),
        });
      }

      const data = await readJsonResponse<{
        status?: string;
        error?: string;
        message?: string;
      }>(res);
      if (!res.ok) {
        throw new Error(data.error ?? data.message ?? "Không tạo được dịch vụ");
      }
      setName("");
      setPrice("");
      setDuration("30");
      setDescription("");
      setImage(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
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
        <h1 className="text-xl font-bold">Quản lý dịch vụ</h1>
        <p className="text-sm text-white/80">
          Dữ liệu bảng <code className="rounded bg-white/10 px-1">services</code> — app khách
          hiển thị ngay sau khi lưu.
        </p>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-bb-navy">Thêm dịch vụ</h2>
          <form
            onSubmit={(ev) => void onSubmit(ev)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Tên</span>
              <input
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Giá (VNĐ)</span>
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
              <span className="mb-1 block text-gray-600">Thời lượng (phút)</span>
              <input
                required
                type="number"
                min={1}
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
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
                Ảnh dịch vụ (tuỳ chọn, tối đa ~2MB)
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,.heic"
                className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-bb-input file:px-3 file:py-2"
                onChange={(ev) => setImage(ev.target.files?.[0] ?? null)}
              />
              {image ? (
                <p className="mt-1 text-xs text-gray-500">
                  Đã chọn: {image.name}
                </p>
              ) : null}
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-bb-yellow px-5 py-2.5 text-sm font-bold text-black/80 disabled:opacity-50"
              >
                {saving ? "Đang lưu…" : "Thêm dịch vụ"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-bb-navy">Danh sách</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="py-2 pr-2">ID</th>
                  <th className="py-2 pr-2">Ảnh</th>
                  <th className="py-2 pr-2">Tên</th>
                  <th className="py-2 pr-2">Giá</th>
                  <th className="py-2 pr-2">Phút</th>
                  <th className="py-2 pr-2">Mô tả</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      Chưa có dịch vụ.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const img = serviceImageUrl(r.image_url ?? null);
                    return (
                      <tr key={r.id} className="border-b border-gray-100">
                        <td className="py-2 pr-2 font-mono text-gray-400">
                          {r.id}
                        </td>
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
                        <td className="py-2 pr-2 font-medium">{r.name}</td>
                        <td className="py-2 pr-2">{String(r.price)}</td>
                        <td className="py-2 pr-2">{r.duration}</td>
                        <td className="py-2 pr-2 text-gray-600">
                          {r.description ?? "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
