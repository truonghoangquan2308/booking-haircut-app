import { getApiBase } from './api';

export type ClosureType = 'temporary_close'|'holiday'|'incident'|'maintenance';

export type BranchClosureRow = {
  id: number;
  branch_id: number;
  start_date: string;
  end_date: string;
  closure_type: ClosureType;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  canceled_at?: string | null;
};

export async function fetchBranchClosures(branchId: number, from?: string, to?: string, includeCancelled = false): Promise<BranchClosureRow[]> {
  const params = new URLSearchParams();
  if (branchId) params.set('branch_id', String(branchId));
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (includeCancelled) params.set('include_cancelled', '1');
  const res = await fetch(`${getApiBase()}/api/branch-closures?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Lỗi tải closures (${res.status})`);
  const data = await res.json();
  return data.closures ?? [];
}

export async function createBranchClosure(payload: Partial<BranchClosureRow>) {
  const res = await fetch(`${getApiBase()}/api/branch-closures`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi tạo closure');
  return data.closure as BranchClosureRow;
}

export async function updateBranchClosure(id: number, payload: Partial<BranchClosureRow>) {
  const res = await fetch(`${getApiBase()}/api/branch-closures/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi cập nhật closure');
  return data.closure as BranchClosureRow;
}

export async function cancelBranchClosure(id: number) {
  const res = await fetch(`${getApiBase()}/api/branch-closures/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi huỷ closure');
  return data;
}
