import { getApiBase } from './api';

export type BCRequestRow = {
  id: number;
  branch_id: number;
  branch_name?: string;
  manager_id: number;
  manager_name?: string;
  request_type: string;
  reason?: string;
  title?: string | null;
  detailed_reason?: string | null;
  impact_level?: string | null;
  estimated_reopen_date?: string | null;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  status: 'pending'|'approved'|'rejected';
  approved_by?: number | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at?: string;
};

export async function fetchBranchClosureRequests(branchId?: number, status?: string) {
  const params = new URLSearchParams();
  if (branchId) params.set('branch_id', String(branchId));
  if (status) params.set('status', status);
  const res = await fetch(`${getApiBase()}/api/branch-closure-requests?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Lỗi tải yêu cầu');
  const data = await res.json();
  return data.requests as BCRequestRow[];
}

export async function createBranchClosureRequest(payload: Partial<BCRequestRow>) {
  const res = await fetch(`${getApiBase()}/api/branch-closure-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi tạo yêu cầu');
  return data.request as BCRequestRow;
}

export async function approveBranchClosureRequest(id: number, approved_by?: number) {
  const res = await fetch(`${getApiBase()}/api/branch-closure-requests/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved_by }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi phê duyệt');
  return data;
}

export async function rejectBranchClosureRequest(id: number, rejected_by?: number, rejection_reason?: string) {
  const res = await fetch(`${getApiBase()}/api/branch-closure-requests/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rejected_by, rejection_reason }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi từ chối');
  return data;
}
