const express = require('express');
const pool = require('../db');
const { storeModel } = require('../lib/storeModel');
const { logAdminAction } = require('../lib/adminAuditLog');

const router = express.Router();

async function requireAdmin(req, res, next) {
  const uid = (req.headers['x-firebase-uid'] || '').trim();
  if (!uid) return res.status(401).json({ error: 'Thiếu x-firebase-uid' });
  try {
    const [rows] = await pool.execute(
      `
      SELECT id, COALESCE(is_locked, 0) AS is_locked
      FROM users WHERE firebase_uid = ? AND role = ? LIMIT 1
      `,
      [uid, 'admin'],
    );
    if (!rows.length) return res.status(403).json({ error: 'Chỉ admin' });
    if (Number(rows[0].is_locked) === 1) {
      return res.status(403).json({ error: 'Tài khoản admin bị khóa' });
    }
    req.adminId = rows[0].id;
    next();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

// GET /api/admin/platform/stats
router.get('/platform/stats', requireAdmin, async (_req, res) => {
  try {
    const model = await storeModel();
    let shopsTotalSql;
    let shopsPendingSql;
    if (model === 'branches') {
      shopsTotalSql = '(SELECT COUNT(*) FROM branches)';
      shopsPendingSql = '(SELECT 0)';
    } else if (model === 'shops') {
      shopsTotalSql = '(SELECT COUNT(*) FROM shops)';
      shopsPendingSql =
        "(SELECT COUNT(*) FROM shops WHERE approval_status = 'pending')";
    } else {
      shopsTotalSql = '(SELECT 0)';
      shopsPendingSql = '(SELECT 0)';
    }

    const [[u]] = await pool.execute(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users_total,
        (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers,
        (SELECT COUNT(*) FROM users WHERE role = 'owner') AS owners,
        (SELECT COUNT(*) FROM users WHERE role = 'manager') AS managers,
        (SELECT COUNT(*) FROM users WHERE role = 'barber') AS barbers,
        ${shopsTotalSql} AS shops_total,
        ${shopsPendingSql} AS shops_pending,
        (${shopsTotalSql}) - ${shopsPendingSql} AS shops_approved,
        (SELECT COUNT(*) FROM appointments) AS appointments_total,
        (SELECT COUNT(*) FROM shop_orders) AS shop_orders_total,
        (SELECT COALESCE(SUM(CASE WHEN status = 'completed' AND DATE(created_at) = CURDATE() THEN total_price ELSE 0 END), 0) FROM appointments) AS revenue_today,
        (SELECT COALESCE(SUM(CASE WHEN status = 'completed' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN total_price ELSE 0 END), 0) FROM appointments) AS revenue_month
    `);
    return res.json({ stats: u });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/platform/users?role=&q=&page=&page_size=
router.get('/platform/users', requireAdmin, async (req, res) => {
  const role = req.query.role ? String(req.query.role).trim() : '';
  const q = (req.query.q || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size) || 20));
  const offset = (page - 1) * pageSize;
  try {
    let where = ' WHERE 1=1';
    const params = [];
    if (role) {
      where += ' AND role = ?';
      params.push(role);
    }
    if (q) {
      where += ' AND (email LIKE ? OR phone LIKE ? OR full_name LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM users ${where}`,
      params,
    );
    // LIMIT/OFFSET as strings — MySQL 8.0.22+ can throw "Incorrect arguments to mysqld_stmt_execute"
    // when binding numeric LIMIT/OFFSET in prepared statements (node-mysql2).
    const [rows] = await pool.execute(
      `
      SELECT id, phone, email, firebase_uid, full_name, role, status, is_locked, created_at
      FROM users
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, String(pageSize), String(offset)],
    );
    return res.json({
      users: rows,
      total: Number(total) || 0,
      page,
      page_size: pageSize,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// PATCH /api/admin/platform/users/:id
router.patch('/platform/users/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { is_locked, role } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id không hợp lệ' });
  const allowedRoles = new Set(['customer', 'barber', 'manager', 'owner', 'admin']);
  const sets = [];
  const vals = [];
  if (is_locked !== undefined) {
    sets.push('is_locked = ?');
    vals.push(is_locked ? 1 : 0);
  }
  if (role !== undefined) {
    if (!allowedRoles.has(role)) {
      return res.status(400).json({ error: 'role không hợp lệ' });
    }
    sets.push('role = ?');
    vals.push(role);
  }
  if (!sets.length) return res.status(400).json({ error: 'Không có trường cập nhật' });
  vals.push(id);
  try {
    await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
    const detail = {};
    if (is_locked !== undefined) detail.is_locked = Boolean(is_locked);
    if (role !== undefined) detail.role = role;
    await logAdminAction({
      adminId: req.adminId,
      action: 'user.update',
      targetType: 'user',
      targetId: id,
      detail: Object.keys(detail).length ? detail : null,
    });
    const [[row]] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    return res.json({ user: row });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/platform/notifications?limit=
router.get('/platform/notifications', requireAdmin, async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  try {
    const [rows] = await pool.execute(
      `
      SELECT n.id, n.user_id, n.title, n.message, n.type, n.is_read, n.created_at,
             u.email AS user_email, u.full_name AS user_name
      FROM notifications n
      LEFT JOIN users u ON u.id = n.user_id
      ORDER BY n.created_at DESC
      LIMIT ?
      `,
      [String(limit)],
    );
    return res.json({ notifications: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/platform/audit-log?page=&page_size=
router.get('/platform/audit-log', requireAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size) || 25));
  const offset = (page - 1) * pageSize;
  const q = (req.query.q || '').trim();
  const action = (req.query.action || '').trim();
  const from = (req.query.from || '').trim();
  const to = (req.query.to || '').trim();
  try {
    let where = ' WHERE 1=1';
    const params = [];
    if (q) {
      where += ' AND u.email LIKE ?';
      params.push(`%${q}%`);
    }
    if (action) {
      where += ' AND l.action = ?';
      params.push(action);
    }
    if (from) {
      where += ' AND l.created_at >= ?';
      params.push(`${from} 00:00:00`);
    }
    if (to) {
      where += ' AND l.created_at <= ?';
      params.push(`${to} 23:59:59`);
    }
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM admin_audit_logs l LEFT JOIN users u ON u.id = l.admin_user_id ${where}`,
      params,
    );
    const [rows] = await pool.execute(
      `
      SELECT
        l.id,
        l.admin_user_id,
        l.action,
        l.target_type,
        l.target_id,
        l.detail,
        l.created_at,
        u.email AS admin_email,
        u.full_name AS admin_name
      FROM admin_audit_logs l
      LEFT JOIN users u ON u.id = l.admin_user_id
      ${where}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, String(pageSize), String(offset)],
    );
    return res.json({
      logs: rows,
      total: Number(total) || 0,
      page,
      page_size: pageSize,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
