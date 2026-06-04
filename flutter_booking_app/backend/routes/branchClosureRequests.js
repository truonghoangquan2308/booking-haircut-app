const express = require('express');
const pool = require('../db');
const fs = require('fs');
const path = require('path');

const TRACE_DIR = path.join(__dirname, '..', 'tmp');
const TRACE_FILE = path.join(TRACE_DIR, 'closure_trace.log');
function appendTrace(obj) {
  try {
    if (!fs.existsSync(TRACE_DIR)) fs.mkdirSync(TRACE_DIR, { recursive: true });
    fs.appendFileSync(TRACE_FILE, JSON.stringify(Object.assign({ ts: new Date().toISOString() }, obj)) + '\n');
  } catch (e) {
    try { console.error('appendTrace failed:', e?.message || e); } catch (er) {}
  }
}

function formatYmd(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0,10);
  if (d instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  try { return String(d).slice(0,10); } catch (e) { return null; }
}

const router = express.Router();

function fmtDateYMD(d) {
  if (!d) return null;
  try {
    if (d instanceof Date) {
      const pad = (n) => String(n).padStart(2,'0');
      return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
    }
    const s = String(d).slice(0,10);
    if (s.indexOf('-') >= 0) {
      const [y,m,day] = s.split('-');
      if (y && m && day) return `${day}/${m}/${y}`;
    }
    return s;
  } catch (e) { return String(d); }
}

function fmtTimeShort(t) {
  if (!t) return null;
  try { const parts = String(t).split(':'); if (parts.length >= 2) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}`; return String(t); } catch (e) { return String(t); }
}

// GET /api/branch-closure-requests?branch_id=&status=
router.get('/branch-closure-requests', async (req, res) => {
  try {
    console.log('[branchClosureRequests] GET called with query:', req.query);
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;
    const status = req.query.status ? String(req.query.status) : null; // pending/approved/rejected
    const where = [];
    const params = [];
    if (branchId && branchId > 0) { where.push('bcr.branch_id = ?'); params.push(branchId); }
    if (status) { where.push('bcr.status = ?'); params.push(status); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.execute(
      `SELECT bcr.*, b.name AS branch_name, u.full_name AS manager_name FROM branch_closure_requests bcr JOIN branches b ON b.id = bcr.branch_id JOIN users u ON u.id = bcr.manager_id ${whereSql} ORDER BY bcr.created_at DESC`,
      params,
    );
    console.log('[branchClosureRequests] fetched', (rows || []).length, 'rows');
    // also log pending count for owner visibility
    try {
      const countParams = [];
      let countWhere = '';
      if (branchId && branchId > 0) { countWhere = 'WHERE branch_id = ? AND status = ?'; countParams.push(branchId, 'pending'); }
      else { countWhere = 'WHERE status = ?'; countParams.push('pending'); }
      const [cnt] = await pool.execute(`SELECT COUNT(1) AS pending_count FROM branch_closure_requests ${countWhere}`, countParams);
      console.log('[branchClosureRequests] pending_count:', cnt && cnt[0] ? cnt[0].pending_count : 0);
    } catch (e) { /* ignore */ }
    return res.json({ requests: rows });
  } catch (e) {
    console.error('GET /api/branch-closure-requests', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
});

// POST /api/branch-closure-requests
router.post('/branch-closure-requests', async (req, res) => {
  const {
    branch_id,
    manager_id,
    request_type,
    reason,
    start_date,
    end_date,
    start_time,
    end_time,
    title,
    detailed_reason,
    impact_level,
    estimated_reopen_date,
    attachment_url,
    manager_note,
  } = req.body ?? {};
  const branchId = Number(branch_id);
  let managerId = Number(manager_id);
  // Resolve manager id from x-firebase-uid header when manager_id not provided
  if (!managerId || managerId <= 0) {
    const fu = req.header('x-firebase-uid') || req.body?.firebase_uid || null;
    if (fu) {
      try {
        const [[urow]] = await pool.execute('SELECT id FROM users WHERE firebase_uid = ? LIMIT 1', [fu]);
        if (urow && urow.id) managerId = Number(urow.id);
      } catch (e) { /* ignore */ }
    }
  }
  const sDate = String(start_date || '').slice(0,10) || null;
  const eDate = String(end_date || sDate || '').slice(0,10) || null;
  if (!branchId || branchId <= 0) return res.status(400).json({ error: 'branch_id không hợp lệ' });
  if (!managerId || managerId <= 0) return res.status(400).json({ error: 'manager_id không hợp lệ' });
  if (!sDate) return res.status(400).json({ error: 'start_date bắt buộc' });
  try {
    const [b] = await pool.execute('SELECT id FROM branches WHERE id = ? LIMIT 1', [branchId]);
    if (!b || b.length === 0) return res.status(400).json({ error: 'branch_id không tồn tại' });
    // Insert flexibly: detect which columns exist in branch_closure_requests and only insert those
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branch_closure_requests'`
    );
    const avail = new Set((cols || []).map((c) => c.COLUMN_NAME));
    const colsIns = [];
    const placeholders = [];
    const params = [];
    function push(col, val) { colsIns.push(col); placeholders.push('?'); params.push(val); }
    push('branch_id', branchId);
    push('manager_id', managerId);
    if (avail.has('request_type')) push('request_type', request_type ?? 'incident');
    if (avail.has('title')) push('title', title ?? null);
    // keep old 'reason' for backward compat
    if (avail.has('reason')) push('reason', reason ?? detailed_reason ?? null);
    if (avail.has('detailed_reason')) push('detailed_reason', detailed_reason ?? null);
    if (avail.has('impact_level')) push('impact_level', impact_level ?? null);
    if (avail.has('start_date')) push('start_date', sDate);
    if (avail.has('end_date')) push('end_date', eDate);
    if (avail.has('estimated_reopen_date')) push('estimated_reopen_date', formatYmd(estimated_reopen_date));
    if (avail.has('start_time')) push('start_time', start_time ?? null);
    if (avail.has('end_time')) push('end_time', end_time ?? null);
    if (avail.has('attachment_url')) push('attachment_url', attachment_url ?? null);
    if (avail.has('manager_note')) push('manager_note', manager_note ?? null);

    const sql = `INSERT INTO branch_closure_requests (${colsIns.join(',')}) VALUES (${placeholders.join(',')})`;
    const [ins] = await pool.execute(sql, params);
    const requestId = ins.insertId;
    console.log('[branchClosureRequests] created request id=', requestId, 'branch_id=', branchId, 'manager_id=', managerId);
    try {
      await pool.execute("INSERT INTO admin_audit_logs (actor_id, action, object_type, object_id, meta) VALUES (?, 'branch.closure_request.create', 'branch_closure_request', ?, ?)", [managerId ?? null, requestId, JSON_OBJECT('branch_id', branchId, 'manager_id', managerId)]);
    } catch (e) { /* ignore */ }
    const [[row]] = await pool.execute('SELECT bcr.*, b.name AS branch_name, u.full_name AS manager_name FROM branch_closure_requests bcr JOIN branches b ON b.id = bcr.branch_id JOIN users u ON u.id = bcr.manager_id WHERE bcr.id = ? LIMIT 1', [requestId]);
    return res.status(201).json({ request: row });
  } catch (e) {
    console.error('POST /api/branch-closure-requests', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
});

// POST /api/branch-closure-requests/:id/approve
router.post('/branch-closure-requests/:id/approve', async (req, res) => {
  const id = Number(req.params.id);
  const { approved_by } = req.body ?? {};
  const approver = Number(approved_by);
  if (!id || id <= 0) return res.status(400).json({ error: 'id không hợp lệ' });
  try {
    console.log('[branchClosureRequests] approve called id=', id, 'approved_by=', approver);
    const [[r]] = await pool.execute('SELECT * FROM branch_closure_requests WHERE id = ? LIMIT 1', [id]);
    if (!r) return res.status(404).json({ error: 'Không tìm thấy request' });
    if (r.status !== 'pending') return res.status(400).json({ error: 'Request không ở trạng thái pending' });
    // Detect schema of branch_closures table (presence of closure_date, start_date, end_date)
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branch_closures' AND COLUMN_NAME IN ('closure_date','start_date','end_date')`
    );
    let hasClosureDate = false;
    let closureDateNotNull = false;
    let hasStartDate = false;
    let hasEndDate = false;
    for (const c of cols) {
      if (c.COLUMN_NAME === 'closure_date') { hasClosureDate = true; if (c.IS_NULLABLE === 'NO') closureDateNotNull = true; }
      if (c.COLUMN_NAME === 'start_date') hasStartDate = true;
      if (c.COLUMN_NAME === 'end_date') hasEndDate = true;
    }
    console.log('[branchClosureRequests] schema detect:', { hasClosureDate, closureDateNotNull, hasStartDate, hasEndDate });

    // Build INSERT compatible with detected schema
    const colsIns = [];
    const params = [];
    const placeholders = [];
    function pushCol(col, val) { if (colsIns.includes(col)) { return; } colsIns.push(col); placeholders.push('?'); params.push(val); }

    pushCol('branch_id', r.branch_id);
    // helper to normalize date to YYYY-MM-DD regardless of input type
    function formatYmd(d) {
      if (!d) return null;
      if (typeof d === 'string') return d.slice(0,10);
      if (d instanceof Date) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      }
      try { return String(d).slice(0,10); } catch (e) { return null; }
    }
    const normStart = formatYmd(r.start_date);
    const normEnd = formatYmd(r.end_date) || normStart;

    if (hasStartDate) pushCol('start_date', normStart);
    if (hasEndDate) pushCol('end_date', normEnd);
    // if legacy closure_date exists and is NOT NULL, ensure we set it from start_date
    if (hasClosureDate && closureDateNotNull) {
      pushCol('closure_date', normStart);
    } else if (hasClosureDate) {
      // optional closure_date present; set it too for backward compatibility
      pushCol('closure_date', normStart);
    }

    // include additional fields from request when available
    pushCol('closure_type', r.request_type ?? r.request_type ?? null);
    pushCol('start_time', r.start_time ?? null);
    pushCol('end_time', r.end_time ?? null);
    pushCol('reason', r.reason ?? r.detailed_reason ?? null);
    // map extra fields if branch_closures table has them
    const [bcols] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branch_closures'`
    );
    const bpack = new Set((bcols || []).map((c) => c.COLUMN_NAME));
    if (bpack.has('impact_level') && r.impact_level) { pushCol('impact_level', r.impact_level); }
    if (bpack.has('title') && r.title) { pushCol('title', r.title); }
    if (bpack.has('detailed_reason') && r.detailed_reason) { pushCol('detailed_reason', r.detailed_reason); }
    if (bpack.has('estimated_reopen_date') && r.estimated_reopen_date) { pushCol('estimated_reopen_date', formatYmd(r.estimated_reopen_date)); }
    if (bpack.has('attachment_url') && r.attachment_url) { pushCol('attachment_url', r.attachment_url); }
    if (bpack.has('manager_note') && r.manager_note) { pushCol('manager_note', r.manager_note); }
    pushCol('created_by', approver ?? null);

    // created_at use NOW() in SQL
    try { appendTrace({ event: 'colsIns_before_insert', cols: colsIns }); } catch (e) {}
    const sql = `INSERT INTO branch_closures (${colsIns.join(',')}, created_at) VALUES (${placeholders.join(',')}, NOW())`;
    console.log('[branchClosureRequests] executing INSERT:', sql, 'params=', params);
    const [ins] = await pool.execute(sql, params);
    const closureId = ins.insertId;

    // update request status
    await pool.execute('UPDATE branch_closure_requests SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?', ['approved', approver ?? null, new Date(), id]);

    // notify barbers
    try {
      const [barbers] = await pool.execute('SELECT b.id AS barber_id, b.user_id FROM barbers b JOIN users u ON u.id = b.user_id WHERE u.branch_id = ?', [r.branch_id]);
      for (const br of barbers) {
        if (br.user_id) {
          const dispStart = fmtDateYMD(normStart);
          const dispEnd = normEnd && normEnd !== normStart ? fmtDateYMD(normEnd) : null;
          const est = r.estimated_reopen_date ? `\nDự kiến mở lại: ${fmtDateYMD(r.estimated_reopen_date)}` : '';
          const titlePart = r.title ? `${r.title} — ` : '';
          const dateText = dispEnd ? `${dispStart} - ${dispEnd}` : dispStart;
          const timePart = r.start_time && r.end_time ? `\nGiờ: ${fmtTimeShort(r.start_time)} - ${fmtTimeShort(r.end_time)}` : '';
          const msg = `${titlePart}Chi nhánh sẽ đóng cửa từ ${dateText}.${timePart}${est}\nLý do: ${r.detailed_reason || r.reason || 'Không có'}`;
          await pool.execute('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [br.user_id, 'branch_closure', 'Chi nhánh tạm đóng cửa', msg]);
        }
      }
    } catch (e) { console.error('notify approve:', e?.message || e); }

    try { await pool.execute("INSERT INTO admin_audit_logs (actor_id, action, object_type, object_id, meta) VALUES (?, 'branch.closure_request.approve', 'branch_closure_request', ?, ?)", [approver ?? null, id, JSON_OBJECT('branch_id', r.branch_id, 'closure_id', closureId)]); } catch (e) {}

    // handle affected appointments: mark cancelled and notify customers
    try {
        const [acol] = await pool.execute(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments' AND COLUMN_NAME = 'closure_id'`);
        const hasClosureId = acol && acol.length > 0;
        // Build update WHERE clause
        const whereParts = ['branch_id = ?', 'appt_date BETWEEN ? AND ?'];
        const whereParams = [r.branch_id, normStart, normEnd];
        if (r.start_time && r.end_time) {
          whereParts.push('NOT (end_time <= ? OR ? <= start_time)');
          whereParams.push(r.start_time, r.end_time);
        }
        // avoid touching already-cancelled/completed appointments
        whereParts.push("status NOT IN ('cancelled','cancelled_by_branch','completed')");

        const noteMsg = `${r.title ? r.title + ' — ' : ''}Bị ảnh hưởng bởi đóng cửa chi nhánh ${normStart}${normEnd && normEnd !== normStart ? ` - ${normEnd}` : ''}. Lý do: ${r.detailed_reason || r.reason || ''}` + (r.estimated_reopen_date ? ` Dự kiến mở lại: ${String(r.estimated_reopen_date).slice(0,10)}.` : '');

        let updateSql;
        const updateParams = [];
        if (hasClosureId) {
          updateSql = `UPDATE appointments SET status = ?, note = CONCAT(COALESCE(note, ''), ?), closure_id = ? WHERE ${whereParts.join(' AND ')}`;
          updateParams.push('cancelled_by_branch', `\n${noteMsg}`, closureId, ...whereParams);
        } else {
          updateSql = `UPDATE appointments SET status = ?, note = CONCAT(COALESCE(note, ''), ?) WHERE ${whereParts.join(' AND ')}`;
          updateParams.push('cancelled_by_branch', `\n${noteMsg}`, ...whereParams);
        }

        // TRACE: log update intent
        try {
          const info = {
            event: 'before_update',
            closureId: closureId ?? null,
            branch_id: r.branch_id,
            start_date: normStart,
            end_date: normEnd,
            hasClosureId,
            updateSql: updateSql.replace(/\s+/g, ' ').trim(),
            updateParamsCount: updateParams.length,
          };
          console.log('[branchClosureRequests][TRACE] about to update appointments', info);
          appendTrace(info);
        } catch (e) {}

        const [uRes] = await pool.execute(updateSql, updateParams);

        // TRACE: report update result
        try {
          const info = { event: 'after_update', affectedRows: uRes.affectedRows ?? 0, closureId: closureId ?? null, branch_id: r.branch_id, start_date: normStart, end_date: normEnd };
          console.log('[branchClosureRequests][TRACE] update result', info);
          appendTrace(info);
        } catch (e) {}

        // TRACE: select updated appointment ids to confirm exact rows updated
        try {
          const selWhere = ['branch_id = ?', 'appt_date BETWEEN ? AND ?'];
          const selParams = [r.branch_id, normStart, normEnd];
          if (r.start_time && r.end_time) {
            selWhere.push('NOT (end_time <= ? OR ? <= start_time)');
            selParams.push(r.start_time, r.end_time);
          }
          if (hasClosureId) {
            selWhere.push('closure_id = ?');
            selParams.push(closureId);
          } else {
            selWhere.push("status = 'cancelled_by_branch'");
          }
          const selSql = `SELECT id FROM appointments WHERE ${selWhere.join(' AND ')}`;
          const [updatedRows] = await pool.execute(selSql, selParams);
          const updatedIds = (updatedRows || []).map((u) => u.id);
          const info = { event: 'updated_ids', ids: updatedIds, count: updatedIds.length, closureId: closureId ?? null, branch_id: r.branch_id, start_date: normStart, end_date: normEnd };
          console.log('[branchClosureRequests][TRACE] updated appointment ids:', updatedIds, 'count=', updatedIds.length);
          appendTrace(info);
        } catch (e) {
          console.error('[branchClosureRequests][TRACE] selecting updated appointments failed:', e?.message || e);
        }

        // Notify affected customers (select updated rows)
        try {
          const selSql = `SELECT id, customer_id FROM appointments WHERE branch_id = ? AND appt_date BETWEEN ? AND ?` + (r.start_time && r.end_time ? ' AND NOT (end_time <= ? OR ? <= start_time)' : '');
          const selParams = [r.branch_id, normStart, normEnd];
          if (r.start_time && r.end_time) selParams.push(r.start_time, r.end_time);
          const [affected] = await pool.execute(selSql, selParams);
                for (const a of affected) {
            try {
              if (a.customer_id) {
                const title = 'Lịch hẹn bị hủy';
                const dispStart = fmtDateYMD(normStart);
                const dispEnd = normEnd && normEnd !== normStart ? fmtDateYMD(normEnd) : null;
                const dateText = dispEnd ? `${dispStart} - ${dispEnd}` : dispStart;
                const message = `Lịch hẹn ngày ${dateText} của bạn đã bị hủy do chi nhánh tạm đóng cửa.\n\nLý do:\n${r.detailed_reason || r.reason || ''}`;
                await pool.execute('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [a.customer_id, 'appointment', title, message]);
              }
            } catch (e) { console.error('notify customer:', e?.message || e); }
          }
        } catch (e) { console.error('select affected appointments failed:', e?.message || e); }
    } catch (e) {
      console.error('handling affected appointments failed:', e?.message || e);
    }

    const [[newReq]] = await pool.execute('SELECT bcr.*, b.name AS branch_name, u.full_name AS manager_name FROM branch_closure_requests bcr JOIN branches b ON b.id = bcr.branch_id JOIN users u ON u.id = bcr.manager_id WHERE bcr.id = ? LIMIT 1', [id]);
    return res.json({ request: newReq, closure_id: closureId });
  } catch (e) {
    console.error('POST /api/branch-closure-requests/:id/approve', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
});

// POST /api/branch-closure-requests/:id/reject
router.post('/branch-closure-requests/:id/reject', async (req, res) => {
  const id = Number(req.params.id);
  const { rejected_by, rejection_reason } = req.body ?? {};
  const rejector = Number(rejected_by);
  if (!id || id <= 0) return res.status(400).json({ error: 'id không hợp lệ' });
  try {
    const [[r]] = await pool.execute('SELECT * FROM branch_closure_requests WHERE id = ? LIMIT 1', [id]);
    if (!r) return res.status(404).json({ error: 'Không tìm thấy request' });
    if (r.status !== 'pending') return res.status(400).json({ error: 'Request không ở trạng thái pending' });
    if (!rejection_reason || String(rejection_reason).trim().length === 0) return res.status(400).json({ error: 'rejection_reason bắt buộc khi từ chối' });
    await pool.execute('UPDATE branch_closure_requests SET status = ?, rejection_reason = ?, approved_by = ?, approved_at = ? WHERE id = ?', ['rejected', rejection_reason ?? null, rejector ?? null, new Date(), id]);
    try { await pool.execute("INSERT INTO admin_audit_logs (actor_id, action, object_type, object_id, meta) VALUES (?, 'branch.closure_request.reject', 'branch_closure_request', ?, ?)", [rejector ?? null, id, JSON_OBJECT('branch_id', r.branch_id, 'rejection_reason', rejection_reason ?? null)]); } catch (e) {}
    // notify manager (include branch name when possible)
    try {
      if (r.manager_id) {
        let branchName = '';
        try { const [[b]] = await pool.execute('SELECT name FROM branches WHERE id = ? LIMIT 1', [r.branch_id]); branchName = b?.name || ''; } catch (e) {}
        const title = 'Yêu cầu đóng cửa bị từ chối';
        const message = `Chi nhánh: ${branchName || ''}\n\nLý do từ chối:\n${rejection_reason ?? 'Không có'}\n\nVui lòng chỉnh sửa và gửi lại yêu cầu.`;
        await pool.execute('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [r.manager_id, 'branch_closure', title, message]);
      }
    } catch (e) { }
    const [[newReq]] = await pool.execute('SELECT bcr.*, b.name AS branch_name, u.full_name AS manager_name FROM branch_closure_requests bcr JOIN branches b ON b.id = bcr.branch_id JOIN users u ON u.id = bcr.manager_id WHERE bcr.id = ? LIMIT 1', [id]);
    return res.json({ request: newReq });
  } catch (e) {
    console.error('POST /api/branch-closure-requests/:id/reject', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
});

module.exports = router;
