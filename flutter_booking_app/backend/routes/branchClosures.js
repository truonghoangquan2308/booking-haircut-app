const express = require('express');
const pool = require('../db');

const router = express.Router();

function fmtDateYMD(d) {
  if (!d) return null;
  try {
    if (d instanceof Date) {
      const pad = (n) => String(n).padStart(2,'0');
      return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
    }
    const s = String(d).slice(0,10);
    // expect YYYY-MM-DD
    if (s.indexOf('-') >= 0) {
      const [y,m,day] = s.split('-');
      if (y && m && day) return `${day}/${m}/${y}`;
    }
    return s;
  } catch (e) { return String(d); }
}

function fmtTimeShort(t) {
  if (!t) return null;
  try {
    // accept HH:MM:SS or HH:MM
    const parts = String(t).split(':');
    if (parts.length >= 2) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}`;
    return String(t);
  } catch (e) { return String(t); }
}

function enrichClosureRow(row) {
  if (!row) return row;
  const startDate = row.start_date ? fmtDateYMD(row.start_date) : null;
  const endDate = row.end_date ? fmtDateYMD(row.end_date) : null;
  const timeRange = (row.start_time || row.end_time) ? `${fmtTimeShort(row.start_time) || ''}${row.start_time && row.end_time ? ' - ' + fmtTimeShort(row.end_time) : ''}` : null;
  const dateRange = startDate && endDate && startDate !== endDate ? `${startDate} - ${endDate}` : startDate || null;
  return Object.assign({}, row, { display_start_date: startDate, display_end_date: endDate, display_date_range: dateRange, display_time_range: timeRange });
}

// GET /api/branch-closures?branch_id=&from=&to=&include_cancelled=1
// Returns closures that overlap the [from,to] range (or all if omitted)
router.get('/branch-closures', async (req, res) => {
  try {
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;
    const from = req.query.from || null; // yyyy-mm-dd
    const to = req.query.to || null; // yyyy-mm-dd
    const includeCancelled = req.query.include_cancelled === '1' || req.query.include_cancelled === 'true';

    const where = [];
    const params = [];
    if (branchId && branchId > 0) {
      where.push('bc.branch_id = ?');
      params.push(branchId);
    }
    if (from && to) {
      // overlap condition: NOT (existing.end_date < from OR existing.start_date > to)
      where.push('NOT (bc.end_date < ? OR bc.start_date > ?)');
      params.push(from, to);
    } else if (from) {
      where.push('bc.end_date >= ?');
      params.push(from);
    } else if (to) {
      where.push('bc.start_date <= ?');
      params.push(to);
    }
    if (!includeCancelled) {
      where.push('bc.canceled_at IS NULL');
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.execute(
      `SELECT id, branch_id, start_date, end_date, closure_type, start_time, end_time, reason, created_by, created_at, updated_at, canceled_at, canceled_by FROM branch_closures bc ${whereSql} ORDER BY start_date DESC`,
      params,
    );

    const enriched = (rows || []).map(enrichClosureRow);
    return res.json({ closures: enriched });
  } catch (e) {
    console.error('GET /api/branch-closures', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
});

// POST /api/branch-closures
// Body: { branch_id, start_date, end_date?, closure_type?, start_time?, end_time?, reason?, created_by? }
router.post('/branch-closures', async (req, res) => {
  const { branch_id, start_date, end_date, closure_type, start_time, end_time, reason, created_by } = req.body ?? {};
  const branchId = Number(branch_id);
  const sDate = String(start_date || '').slice(0, 10) || null;
  const eDate = String(end_date || sDate || '').slice(0, 10) || null;
  const ctype = String(closure_type || 'temporary_close');

  if (!branchId || branchId <= 0) return res.status(400).json({ error: 'branch_id không hợp lệ' });
  if (!sDate) return res.status(400).json({ error: 'start_date bắt buộc' });
  if (eDate < sDate) return res.status(400).json({ error: 'end_date phải >= start_date' });

  try {
    // 1) ensure branch exists
    const [[b]] = await pool.execute('SELECT id FROM branches WHERE id = ? LIMIT 1', [branchId]);
    if (!b) return res.status(400).json({ error: 'branch_id không tồn tại' });

    // 2) start_date không nhỏ hơn ngày hiện tại (allow same day)
    const nowDate = new Date();
    const todayStr = nowDate.toISOString().slice(0, 10);
    if (eDate < todayStr) return res.status(400).json({ error: 'Khoảng thời gian phải kết thúc >= ngày hiện tại' });

    // 3) check overlapping closures for the branch
    // Any existing non-cancelled closure whose date range overlaps -> conflict
    const [exRows] = await pool.execute(
      `SELECT id, start_date, end_date, start_time, end_time FROM branch_closures WHERE branch_id = ? AND NOT (end_date < ? OR start_date > ?) AND canceled_at IS NULL`,
      [branchId, sDate, eDate],
    );
    if (exRows && exRows.length > 0) {
      // if either existing or new closure is full-day (no times) -> conflict
      for (const ex of exRows) {
        const exFullDay = !ex.start_time && !ex.end_time;
        const newFullDay = !start_time && !end_time;
        if (exFullDay || newFullDay) {
          return res.status(400).json({ error: 'Đã tồn tại closure chồng lên ngày/khung giờ này' });
        }
        // both have times -> check if any of overlapping days have time overlap
        // For simplicity assume same time ranges apply per-day; check time overlap
        if (!(end_time <= ex.start_time || ex.end_time <= start_time)) {
          return res.status(400).json({ error: 'Đã tồn tại closure trùng/đè lên khoảng thời gian này' });
        }
      }
    }

    // 4) insert
    const [result] = await pool.execute(
      `INSERT INTO branch_closures (branch_id, start_date, end_date, closure_type, start_time, end_time, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [branchId, sDate, eDate, ctype, start_time ?? null, end_time ?? null, reason ?? null, created_by ?? null],
    );
    const closureId = result.insertId;

    // 5) notify all barbers of this branch
    try {
      const [barbers] = await pool.execute('SELECT b.id AS barber_id, b.user_id FROM barbers b JOIN users u ON u.id = b.user_id WHERE u.branch_id = ?', [branchId]);
      for (const br of barbers) {
        if (br.user_id) {
          const dispStart = fmtDateYMD(sDate);
          const dispEnd = eDate && eDate !== sDate ? fmtDateYMD(eDate) : null;
          const timePart = start_time && end_time ? ` ${fmtTimeShort(start_time)} - ${fmtTimeShort(end_time)}` : '';
          const dateText = dispEnd ? `${dispStart} - ${dispEnd}` : dispStart;
          const msg = `Chi nhánh đóng cửa từ ${dateText}${timePart}` + (reason ? `.
Lý do: ${reason}` : '');
          await pool.execute('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [br.user_id, 'branch_closure', 'Chi nhánh đóng cửa', msg]);
        }
      }
    } catch (e) {
      console.error('notify branch closure:', e?.message || e);
    }

    // 5b) notify customers who are associated with this branch
    // Strategy: notify customers who either have `users.branch_id = branchId` OR
    // have an appointment at this branch within the last/next 30 days.
    try {
      const [customers] = await pool.execute(
        `
        SELECT DISTINCT u.id FROM users u
        LEFT JOIN appointments a ON a.customer_id = u.id
        WHERE u.role = 'customer' AND (
          u.branch_id = ? OR (a.branch_id = ? AND a.appt_date >= (CURDATE() - INTERVAL 30 DAY))
        )
        `,
        [branchId, branchId],
      );
      for (const c of customers) {
        if (c.id) {
          const dispStart = fmtDateYMD(sDate);
          const dispEnd = eDate && eDate !== sDate ? fmtDateYMD(eDate) : null;
          const timePart = start_time && end_time ? ` ${fmtTimeShort(start_time)} - ${fmtTimeShort(end_time)}` : '';
          const dateText = dispEnd ? `${dispStart} - ${dispEnd}` : dispStart;
          const msg = `Chi nhánh đóng cửa từ ${dateText}${timePart}` + (reason ? `.
Lý do: ${reason}` : '');
          await pool.execute('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [c.id, 'branch_closure', 'Chi nhánh đóng cửa', msg]);
        }
      }
    } catch (e) {
      console.error('notify customers branch closure:', e?.message || e);
    }

    // 6) admin log if exists
    try {
      await pool.execute("INSERT INTO admin_audit_logs (actor_id, action, object_type, object_id, meta) VALUES (?, 'branch.closure.create', 'branch_closure', ?, ?)", [created_by ?? null, closureId, JSON_OBJECT('branch_id', branchId, 'start_date', sDate, 'end_date', eDate)]);
    } catch (e) {
      // ignore if table not exists
    }

    const [[row]] = await pool.execute('SELECT id, branch_id, start_date, end_date, closure_type, start_time, end_time, reason, created_by, created_at FROM branch_closures WHERE id = ? LIMIT 1', [closureId]);
    return res.status(201).json({ closure: enrichClosureRow(row) });
  } catch (e) {
    console.error('POST /api/branch-closures', e?.message || e);
    if ((e?.message || '').toLowerCase().includes('duplicate') || (e?.code && e.code === 'ER_DUP_ENTRY')) {
      return res.status(400).json({ error: 'Đã tồn tại closure trùng' });
    }
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
});

// POST /api/branch-closures/:id/cancel
router.post('/branch-closures/:id/cancel', async (req, res) => {
  const id = Number(req.params.id);
  const { canceled_by } = req.body ?? {};
  if (!id || id <= 0) return res.status(400).json({ error: 'id không hợp lệ' });
  try {
    const [[row]] = await pool.execute('SELECT id, branch_id, start_date, end_date, canceled_at FROM branch_closures WHERE id = ? LIMIT 1', [id]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy closure' });
    if (row.canceled_at) return res.status(400).json({ error: 'Closure đã được hủy trước đó' });

    await pool.execute('UPDATE branch_closures SET canceled_at = NOW(), canceled_by = ? WHERE id = ?', [canceled_by ?? null, id]);

    // notify barbers: branch active again
    try {
      const [barbers] = await pool.execute('SELECT b.id AS barber_id, b.user_id FROM barbers b JOIN users u ON u.id = b.user_id WHERE u.branch_id = ?', [row.branch_id]);
      for (const br of barbers) {
        if (br.user_id) {
          const msg = `Chi nhánh hoạt động trở lại (dự kiến ${row.start_date}${row.end_date && row.end_date !== row.start_date ? ` - ${row.end_date}` : ''})`;
          await pool.execute('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [br.user_id, 'branch_closure', 'Chi nhánh hoạt động lại', msg]);
        }
      }
    } catch (e) {
      console.error('notify closure cancel:', e?.message || e);
    }

    // notify customers: branch active again (same selection strategy as above)
    try {
      const [customers] = await pool.execute(
        `
        SELECT DISTINCT u.id FROM users u
        LEFT JOIN appointments a ON a.customer_id = u.id
        WHERE u.role = 'customer' AND (
          u.branch_id = ? OR (a.branch_id = ? AND a.appt_date >= (CURDATE() - INTERVAL 30 DAY))
        )
        `,
        [row.branch_id, row.branch_id],
      );
      for (const c of customers) {
        if (c.id) {
          const msg = `Chi nhánh hoạt động trở lại (dự kiến ${row.start_date}${row.end_date && row.end_date !== row.start_date ? ` - ${row.end_date}` : ''})`;
          await pool.execute('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [c.id, 'branch_closure', 'Chi nhánh hoạt động lại', msg]);
        }
      }
    } catch (e) {
      console.error('notify customers closure cancel:', e?.message || e);
    }

    try {
      await pool.execute("INSERT INTO admin_audit_logs (actor_id, action, object_type, object_id, meta) VALUES (?, 'branch.closure.cancel', 'branch_closure', ?, ?)", [canceled_by ?? null, id, JSON_OBJECT('branch_id', row.branch_id, 'start_date', row.start_date, 'end_date', row.end_date)]);
    } catch (e) {
      // ignore
    }

    return res.json({ success: true });
  } catch (e) {
    console.error('POST /api/branch-closures/:id/cancel', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
});

// PUT /api/branch-closures/:id
// Body: { start_date, end_date?, closure_type?, start_time?, end_time?, reason?, updated_by? }
router.put('/branch-closures/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { start_date, end_date, closure_type, start_time, end_time, reason, updated_by } = req.body ?? {};
  if (!id || id <= 0) return res.status(400).json({ error: 'id không hợp lệ' });
  const sDate = String(start_date || '').slice(0, 10) || null;
  const eDate = String(end_date || sDate || '').slice(0, 10) || null;
  const ctype = String(closure_type || 'temporary_close');
  if (!sDate) return res.status(400).json({ error: 'start_date bắt buộc' });
  if (eDate < sDate) return res.status(400).json({ error: 'end_date phải >= start_date' });

  try {
    const [[row]] = await pool.execute('SELECT id, branch_id, start_date, end_date, canceled_at FROM branch_closures WHERE id = ? LIMIT 1', [id]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy closure' });
    if (row.canceled_at) return res.status(400).json({ error: 'Closure đã được hủy' });

    // check overlap with other closures (exclude self)
    const [exRows] = await pool.execute(
      `SELECT id, start_date, end_date, start_time, end_time FROM branch_closures WHERE branch_id = ? AND id != ? AND NOT (end_date < ? OR start_date > ?) AND canceled_at IS NULL`,
      [row.branch_id, id, sDate, eDate],
    );
    if (exRows && exRows.length > 0) {
      for (const ex of exRows) {
        const exFullDay = !ex.start_time && !ex.end_time;
        const newFullDay = !start_time && !end_time;
        if (exFullDay || newFullDay) return res.status(400).json({ error: 'Đã tồn tại closure chồng lên ngày/khung giờ này' });
        if (!(end_time <= ex.start_time || ex.end_time <= start_time)) return res.status(400).json({ error: 'Đã tồn tại closure trùng/đè lên khoảng thời gian này' });
      }
    }

    await pool.execute(
      `UPDATE branch_closures SET start_date = ?, end_date = ?, closure_type = ?, start_time = ?, end_time = ?, reason = ?, updated_at = NOW() WHERE id = ?`,
      [sDate, eDate, ctype, start_time ?? null, end_time ?? null, reason ?? null, id],
    );

    // notify barbers about update
    try {
      const [barbers] = await pool.execute('SELECT b.id AS barber_id, b.user_id FROM barbers b JOIN users u ON u.id = b.user_id WHERE u.branch_id = ?', [row.branch_id]);
      for (const br of barbers) {
        if (br.user_id) {
          const dispStart = fmtDateYMD(sDate);
          const dispEnd = eDate && eDate !== sDate ? fmtDateYMD(eDate) : null;
          const timePart = start_time && end_time ? ` ${fmtTimeShort(start_time)} - ${fmtTimeShort(end_time)}` : '';
          const dateText = dispEnd ? `${dispStart} - ${dispEnd}` : dispStart;
          const msg = `Chi nhánh cập nhật lịch đóng cửa từ ${dateText}${timePart}` + (reason ? `.
Lý do: ${reason}` : '');
          await pool.execute('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [br.user_id, 'branch_closure', 'Cập nhật đóng cửa', msg]);
        }
      }
    } catch (e) {
      console.error('notify branch closure update:', e?.message || e);
    }

    // notify customers about update (same selection strategy)
    try {
      const [customers] = await pool.execute(
        `
        SELECT DISTINCT u.id FROM users u
        LEFT JOIN appointments a ON a.customer_id = u.id
        WHERE u.role = 'customer' AND (
          u.branch_id = ? OR (a.branch_id = ? AND a.appt_date >= (CURDATE() - INTERVAL 30 DAY))
        )
        `,
        [row.branch_id, row.branch_id],
      );
      for (const c of customers) {
        if (c.id) {
          const dispStart = fmtDateYMD(sDate);
          const dispEnd = eDate && eDate !== sDate ? fmtDateYMD(eDate) : null;
          const timePart = start_time && end_time ? ` ${fmtTimeShort(start_time)} - ${fmtTimeShort(end_time)}` : '';
          const dateText = dispEnd ? `${dispStart} - ${dispEnd}` : dispStart;
          const msg = `Chi nhánh cập nhật lịch đóng cửa từ ${dateText}${timePart}` + (reason ? `.
Lý do: ${reason}` : '');
          await pool.execute('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [c.id, 'branch_closure', 'Cập nhật đóng cửa', msg]);
        }
      }
    } catch (e) {
      console.error('notify customers branch closure update:', e?.message || e);
    }

    try {
      await pool.execute("INSERT INTO admin_audit_logs (actor_id, action, object_type, object_id, meta) VALUES (?, 'branch.closure.update', 'branch_closure', ?, ?)", [updated_by ?? null, id, JSON_OBJECT('branch_id', row.branch_id, 'start_date', sDate, 'end_date', eDate)]);
    } catch (e) {
      // ignore
    }

    const [[updated]] = await pool.execute('SELECT id, branch_id, start_date, end_date, closure_type, start_time, end_time, reason, updated_at FROM branch_closures WHERE id = ? LIMIT 1', [id]);
    return res.json({ closure: enrichClosureRow(updated) });
  } catch (e) {
    console.error('PUT /api/branch-closures/:id', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
});

module.exports = router;
