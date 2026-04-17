const express = require('express');
const pool = require('../db');
const { storeModel } = require('../lib/storeModel');
const { logAdminAction } = require('../lib/adminAuditLog');

const router = express.Router();

async function requireAdmin(req, res, next) {
  const uid = (req.headers['x-firebase-uid'] || '').trim();
  if (!uid) {
    return res.status(401).json({ error: 'Thiếu header x-firebase-uid' });
  }
  try {
    const [rows] = await pool.execute(
      `
      SELECT id, role, COALESCE(is_locked, 0) AS is_locked
      FROM users WHERE firebase_uid = ? LIMIT 1
      `,
      [uid],
    );
    if (!rows.length || rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin' });
    }
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

// GET /api/admin/shops?q=&page=&page_size=
router.get('/shops', requireAdmin, async (req, res) => {
  const q = (req.query.q || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size) || 20));
  const offset = (page - 1) * pageSize;
  const like = q ? `%${q}%` : null;
  try {
    const model = await storeModel();
    let shops;
    let total = 0;
    if (model === 'branches') {
      const where = q
        ? ` WHERE (b.name LIKE ? OR IFNULL(b.address,'') LIKE ? OR IFNULL(uo.email,'') LIKE ? OR IFNULL(uo.full_name,'') LIKE ?)`
        : '';
      const countParams = q ? [like, like, like, like] : [];
      const [[c]] = await pool.execute(
        `
        SELECT COUNT(*) AS total
        FROM branches b
        LEFT JOIN users uo ON uo.id = b.owner_id
        ${where}
        `,
        countParams,
      );
      total = Number(c?.total) || 0;
      const listParams = q
        ? [...countParams, String(pageSize), String(offset)]
        : [String(pageSize), String(offset)];
      const [rows] = await pool.execute(
        `
        SELECT
          b.id,
          b.name,
          b.address AS description,
          CASE WHEN b.status = 'blocked' THEN 1 ELSE 0 END AS is_blocked,
          'approved' AS approval_status,
          b.created_at,
          b.created_at AS updated_at,
          b.owner_id AS owner_user_id,
          um.id AS manager_user_id,
          uo.full_name AS owner_name,
          uo.email AS owner_email,
          um.full_name AS manager_name,
          um.email AS manager_email,
          um.phone AS manager_phone
        FROM branches b
        LEFT JOIN users uo ON uo.id = b.owner_id
        LEFT JOIN users um ON um.id = (
          SELECT u2.id FROM users u2
          WHERE u2.branch_id = b.id AND u2.role = 'manager' AND COALESCE(u2.is_locked, 0) = 0
          ORDER BY u2.id ASC
          LIMIT 1
        )
        ${where}
        ORDER BY b.created_at DESC
        LIMIT ? OFFSET ?
        `,
        listParams,
      );
      shops = rows;
    } else if (model === 'shops') {
      const where = q
        ? ` WHERE (s.name LIKE ? OR IFNULL(s.description,'') LIKE ? OR IFNULL(uo.email,'') LIKE ? OR IFNULL(uo.full_name,'') LIKE ?)`
        : '';
      const countParams = q ? [like, like, like, like] : [];
      const [[c]] = await pool.execute(
        `
        SELECT COUNT(*) AS total
        FROM shops s
        LEFT JOIN users uo ON uo.id = s.owner_user_id
        ${where}
        `,
        countParams,
      );
      total = Number(c?.total) || 0;
      const listParams = q
        ? [...countParams, String(pageSize), String(offset)]
        : [String(pageSize), String(offset)];
      const [rows] = await pool.execute(
        `
        SELECT
          s.id, s.name, s.description, s.is_blocked, s.approval_status,
          s.created_at, s.updated_at,
          s.owner_user_id,
          um.id AS manager_user_id,
          uo.full_name AS owner_name, uo.email AS owner_email,
          um.full_name AS manager_name, um.email AS manager_email,
          um.phone AS manager_phone
        FROM shops s
        LEFT JOIN users uo ON uo.id = s.owner_user_id
        LEFT JOIN users um ON um.id = s.manager_user_id AND COALESCE(um.is_locked, 0) = 0
        ${where}
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?
        `,
        listParams,
      );
      shops = rows;
    } else {
      shops = [];
    }
    return res.json({ shops, total, page, page_size: pageSize });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

async function selectBranchShopRow(branchId) {
  const [rows] = await pool.execute(
    `
        SELECT
          b.id, b.name, b.address AS description,
          CASE WHEN b.status = 'blocked' THEN 1 ELSE 0 END AS is_blocked,
          'approved' AS approval_status,
          b.created_at, b.created_at AS updated_at,
          b.owner_id AS owner_user_id,
          um.id AS manager_user_id,
          um.full_name AS manager_name,
          um.email AS manager_email,
          um.phone AS manager_phone
        FROM branches b
        LEFT JOIN users um ON um.id = (
          SELECT u2.id FROM users u2
          WHERE u2.branch_id = b.id AND u2.role = 'manager' AND COALESCE(u2.is_locked, 0) = 0
          ORDER BY u2.id ASC
          LIMIT 1
        )
        WHERE b.id = ?
        `,
    [branchId],
  );
  return rows[0];
}

/** Gán / gỡ Manager cho chi nhánh (users.branch_id + role = manager). */
async function assignBranchManager(branchId, managerUserId) {
  const [bRows] = await pool.execute('SELECT id FROM branches WHERE id = ? LIMIT 1', [
    branchId,
  ]);
  if (!bRows[0]) {
    return { error: 'Không tìm thấy chi nhánh' };
  }

  if (managerUserId === null || managerUserId === '') {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        `UPDATE users SET branch_id = NULL WHERE branch_id = ? AND role = 'manager'`,
        [branchId],
      );
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    return { ok: true };
  }

  const mid = parseInt(managerUserId, 10);
  if (!mid || mid < 1) {
    return { error: 'manager_user_id không hợp lệ' };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [uRows] = await conn.execute(
      `SELECT id, role, COALESCE(is_locked, 0) AS is_locked FROM users WHERE id = ? LIMIT 1`,
      [mid],
    );
    const u = uRows[0];
    if (!u) {
      await conn.rollback();
      return { error: 'Không tìm thấy user' };
    }
    if (Number(u.is_locked) === 1) {
      await conn.rollback();
      return { error: 'Tài khoản đang bị khóa' };
    }
    if (u.role === 'admin') {
      await conn.rollback();
      return { error: 'Không gán admin làm manager chi nhánh' };
    }
    if (u.role === 'owner') {
      await conn.rollback();
      return { error: 'Không gán owner làm manager chi nhánh' };
    }

    await conn.execute(
      `UPDATE users SET branch_id = NULL WHERE id = ? AND role = 'manager'`,
      [mid],
    );
    await conn.execute(
      `UPDATE users SET branch_id = NULL WHERE branch_id = ? AND role = 'manager'`,
      [branchId],
    );
    await conn.execute(
      `UPDATE users SET branch_id = ?, role = 'manager' WHERE id = ?`,
      [branchId, mid],
    );
    await conn.commit();
    return { ok: true };
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    conn.release();
  }
}

// PATCH /api/admin/shops/:id  body: { approval_status?, is_blocked?, manager_user_id? }
router.patch('/shops/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'id không hợp lệ' });

  const { approval_status, is_blocked, manager_user_id } = req.body || {};
  const model = await storeModel();

  if (model === 'branches' && manager_user_id !== undefined) {
    try {
      const result = await assignBranchManager(id, manager_user_id);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      await logAdminAction({
        adminId: req.adminId,
        action: 'branch.manager_assign',
        targetType: 'branch',
        targetId: id,
        detail: { manager_user_id },
      });
      const row = await selectBranchShopRow(id);
      return res.json({ shop: row });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (model === 'branches') {
    let nextStatus = null;
    if (is_blocked === true) nextStatus = 'blocked';
    else if (is_blocked === false) nextStatus = 'active';
    else if (approval_status === 'rejected') nextStatus = 'blocked';
    else if (approval_status === 'approved') nextStatus = 'active';
    if (nextStatus === null) {
      return res.status(400).json({
        error:
          'Branches: gửi is_blocked (boolean), approval_status approved/rejected, hoặc manager_user_id',
      });
    }
    try {
      await pool.execute('UPDATE branches SET status = ? WHERE id = ?', [
        nextStatus,
        id,
      ]);
      await logAdminAction({
        adminId: req.adminId,
        action: 'branch.update',
        targetType: 'branch',
        targetId: id,
        detail: { approval_status, is_blocked, nextStatus },
      });
      const row = await selectBranchShopRow(id);
      return res.json({ shop: row });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (model !== 'shops') {
    return res.status(503).json({ error: 'Chưa có bảng shops/branches' });
  }

  if (manager_user_id !== undefined) {
    const mid =
      manager_user_id === null || manager_user_id === ''
        ? null
        : parseInt(manager_user_id, 10);
    if (mid !== null && (!mid || mid < 1)) {
      return res.status(400).json({ error: 'manager_user_id không hợp lệ' });
    }
    try {
      if (mid !== null) {
        const [uRows] = await pool.execute(
          `SELECT id, role, COALESCE(is_locked, 0) AS is_locked FROM users WHERE id = ? LIMIT 1`,
          [mid],
        );
        const u = uRows[0];
        if (!u) return res.status(400).json({ error: 'Không tìm thấy user' });
        if (Number(u.is_locked) === 1) {
          return res.status(400).json({ error: 'Tài khoản đang bị khóa' });
        }
        if (u.role === 'admin') {
          return res.status(400).json({ error: 'Không gán admin làm manager shop' });
        }
        if (u.role === 'owner') {
          return res.status(400).json({ error: 'Không gán owner làm manager shop' });
        }
      }
      await pool.execute('UPDATE shops SET manager_user_id = ? WHERE id = ?', [mid, id]);
      await logAdminAction({
        adminId: req.adminId,
        action: 'shop.manager_assign',
        targetType: 'shop',
        targetId: id,
        detail: { manager_user_id: mid },
      });
      const [sRows] = await pool.execute(
        `
        SELECT
          s.id, s.name, s.description, s.is_blocked, s.approval_status,
          s.created_at, s.updated_at,
          s.owner_user_id,
          um.id AS manager_user_id,
          uo.full_name AS owner_name, uo.email AS owner_email,
          um.full_name AS manager_name, um.email AS manager_email,
          um.phone AS manager_phone
        FROM shops s
        LEFT JOIN users uo ON uo.id = s.owner_user_id
        LEFT JOIN users um ON um.id = s.manager_user_id AND COALESCE(um.is_locked, 0) = 0
        WHERE s.id = ?
        `,
        [id],
      );
      return res.json({ shop: sRows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  const allowed = new Set(['pending', 'approved', 'rejected']);
  const sets = [];
  const vals = [];

  if (approval_status !== undefined) {
    if (!allowed.has(approval_status)) {
      return res.status(400).json({ error: 'approval_status không hợp lệ' });
    }
    sets.push('approval_status = ?');
    vals.push(approval_status);
  }
  if (is_blocked !== undefined) {
    sets.push('is_blocked = ?');
    vals.push(is_blocked ? 1 : 0);
  }
  if (!sets.length) {
    return res.status(400).json({ error: 'Không có trường cập nhật' });
  }

  vals.push(id);
  try {
    await pool.execute(
      `UPDATE shops SET ${sets.join(', ')} WHERE id = ?`,
      vals,
    );
    await logAdminAction({
      adminId: req.adminId,
      action: 'shop.update',
      targetType: 'shop',
      targetId: id,
      detail: { approval_status, is_blocked },
    });
    const [[shop]] = await pool.execute('SELECT * FROM shops WHERE id = ?', [id]);
    return res.json({ shop });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
