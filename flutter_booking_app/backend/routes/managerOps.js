const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/manager/branches — chi nhánh user được quản lý (Manager: 1; Owner: tất cả)
router.get('/branches', async (req, res) => {
  const uid = (req.headers['x-firebase-uid'] || '').trim();
  if (!uid) return res.status(401).json({ error: 'Thiếu x-firebase-uid' });
  try {
    const [rows] = await pool.execute(
      'SELECT id, role, COALESCE(is_locked, 0) AS is_locked, branch_id FROM users WHERE firebase_uid = ? LIMIT 1',
      [uid],
    );
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy user' });
    if (Number(rows[0].is_locked) === 1) {
      return res.status(403).json({ error: 'Tài khoản đã bị khóa' });
    }
    const role = rows[0].role;
    const userId = rows[0].id;

    if (role === 'manager' || role === 'receptionist') {
      const bid = rows[0].branch_id != null ? Number(rows[0].branch_id) : null;
      if (!bid || bid <= 0) return res.json({ branches: [] });
      const [br] = await pool.execute(
        'SELECT id, name, address, phone FROM branches WHERE id = ? LIMIT 1',
        [bid],
      );
      return res.json({ branches: br.length ? br : [] });
    }

    if (role === 'owner') {
      const [branches] = await pool.execute(
        'SELECT id, name, address, phone FROM branches WHERE owner_id = ? ORDER BY id ASC',
        [userId],
      );
      return res.json({ branches });
    }

    return res.status(403).json({ error: 'Chỉ Manager, Receptionist hoặc Owner' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

const APPOINTMENT_STATUSES = new Set([
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
]);

/** Manager: branch_id từ users.branch_id. Owner: chi nhánh đầu tiên có branches.owner_id = user.id. */
async function requireManagerOrOwner(req, res, next) {
  const uid = (req.headers['x-firebase-uid'] || '').trim();
  if (!uid) return res.status(401).json({ error: 'Thiếu x-firebase-uid' });
  try {
    const [rows] = await pool.execute(
      'SELECT id, role, COALESCE(is_locked, 0) AS is_locked, branch_id FROM users WHERE firebase_uid = ? LIMIT 1',
      [uid],
    );
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy user' });
    if (Number(rows[0].is_locked) === 1) {
      return res.status(403).json({ error: 'Tài khoản đã bị khóa' });
    }
    const role = rows[0].role;
    req.managerUserId = rows[0].id;

    if (role === 'manager' || role === 'receptionist') {
      req.managerBranchId = rows[0].branch_id != null ? Number(rows[0].branch_id) : null;
      return next();
    }

    if (role === 'owner') {
      const [branches] = await pool.execute(
        'SELECT id FROM branches WHERE owner_id = ? ORDER BY id ASC',
        [rows[0].id],
      );
      if (!branches.length) {
        return res.status(403).json({
          error:
            'Owner chưa có chi nhánh: đặt branches.owner_id trùng id user owner trong DB (hoặc dùng tài khoản Manager đã gán branch_id).',
        });
      }
      const validIds = new Set(branches.map((b) => Number(b.id)));
      const requested = Number((req.headers['x-manager-branch-id'] || '').trim());
      if (Number.isFinite(requested) && requested > 0 && validIds.has(requested)) {
        req.managerBranchId = requested;
      } else {
        req.managerBranchId = Number(branches[0].id);
      }
      return next();
    }

    return res.status(403).json({ error: 'Chỉ Manager, Receptionist hoặc Owner' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

function requireManagerBranch(req, res, next) {
  if (req.managerBranchId == null || !Number.isFinite(req.managerBranchId) || req.managerBranchId <= 0) {
    return res.status(403).json({
      error:
        'Chưa xác định được chi nhánh: Quản lý/Lễ tân cần users.branch_id; Owner cần ít nhất một branches.owner_id trỏ tới id owner.',
    });
  }
  next();
}

// GET /api/manager/barbers — thợ thuộc đúng chi nhánh của manager
router.get('/barbers', requireManagerOrOwner, requireManagerBranch, async (req, res) => {
  const bid = req.managerBranchId;
  try {
    const [rows] = await pool.execute(
      `
      SELECT b.id AS barber_id, u.full_name
      FROM barbers b
      JOIN users u ON u.id = b.user_id
      WHERE b.branch_id = ?
      ORDER BY u.full_name ASC, b.id ASC
      `,
      [bid],
    );
    return res.json({ barbers: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/manager/appointments?from=&to=&status=
router.get('/appointments', requireManagerOrOwner, requireManagerBranch, async (req, res) => {
  const bid = req.managerBranchId;
  const from = req.query.from;
  const to = req.query.to;
  const status = req.query.status ? String(req.query.status).trim() : '';
  const barberId = req.query.barber_id ? Number(req.query.barber_id) : null;
  const serviceId = req.query.service_id ? Number(req.query.service_id) : null;
  try {
    let sql = `
      SELECT
        a.id,
        a.customer_id,
        a.barber_id,
        a.service_id,
        a.appt_date,
        a.start_time,
        a.end_time,
        a.total_price,
        a.status,
        a.note,
        a.created_at,
        u.full_name AS customer_name,
        u.phone AS customer_phone,
        s.name AS service_name,
        bu.full_name AS barber_name
      FROM appointments a
      JOIN users u ON u.id = a.customer_id
      JOIN services s ON s.id = a.service_id
      JOIN barbers br ON br.id = a.barber_id
      LEFT JOIN users bu ON bu.id = br.user_id
      WHERE a.branch_id = ?
    `;
    const params = [bid];
    if (from) {
      sql += ' AND a.appt_date >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND a.appt_date <= ?';
      params.push(to);
    }
    if (status && APPOINTMENT_STATUSES.has(status)) {
      sql += ' AND a.status = ?';
      params.push(status);
    }
    if (barberId && barberId > 0) {
      sql += ' AND a.barber_id = ?';
      params.push(barberId);
    }
    if (serviceId && serviceId > 0) {
      sql += ' AND a.service_id = ?';
      params.push(serviceId);
    }
    sql += ' ORDER BY a.appt_date DESC, a.start_time DESC LIMIT 300';
    const [rows] = await pool.execute(sql, params);
    return res.json({ appointments: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// PATCH /api/manager/appointments/:id/status
router.patch('/appointments/:id/status', requireManagerOrOwner, requireManagerBranch, async (req, res) => {
  const bid = req.managerBranchId;
  const id = Number(req.params.id);
  const { status } = req.body ?? {};
  if (!id || !status || !APPOINTMENT_STATUSES.has(status)) {
    return res.status(400).json({ error: 'id hoặc status không hợp lệ' });
  }
  try {
    const [[row]] = await pool.execute(
      'SELECT id, branch_id FROM appointments WHERE id = ? LIMIT 1',
      [id],
    );
    if (!row) return res.status(404).json({ error: 'Không tìm thấy lịch' });
    if (Number(row.branch_id) !== bid) {
      return res.status(403).json({ error: 'Lịch không thuộc chi nhánh của bạn' });
    }
    await pool.execute('UPDATE appointments SET status = ? WHERE id = ?', [status, id]);
    const [[updated]] = await pool.execute(
      `
      SELECT
        a.id,
        a.customer_id,
        a.barber_id,
        a.service_id,
        a.appt_date,
        a.start_time,
        a.end_time,
        a.total_price,
        a.status,
        a.note,
        a.created_at,
        u.full_name AS customer_name,
        u.phone AS customer_phone,
        s.name AS service_name,
        bu.full_name AS barber_name
      FROM appointments a
      JOIN users u ON u.id = a.customer_id
      JOIN services s ON s.id = a.service_id
      JOIN barbers br ON br.id = a.barber_id
      LEFT JOIN users bu ON bu.id = br.user_id
      WHERE a.id = ?
      LIMIT 1
      `,
      [id],
    );
    return res.json({ appointment: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/manager/working-schedules?barber_id=&from=&to=
router.get('/working-schedules', requireManagerOrOwner, requireManagerBranch, async (req, res) => {
  const branchId = req.managerBranchId;
  const barberId = req.query.barber_id ? Number(req.query.barber_id) : null;
  const from = req.query.from;
  const to = req.query.to;
  try {
    let sql = `
      SELECT ws.id, ws.barber_id, ws.work_date, ws.start_time, ws.end_time, ws.is_day_off, ws.created_at
      FROM working_schedules ws
      INNER JOIN barbers b ON b.id = ws.barber_id AND b.branch_id = ?
      WHERE 1=1
    `;
    const params = [branchId];
    if (barberId && barberId > 0) {
      sql += ' AND ws.barber_id = ?';
      params.push(barberId);
    }
    if (from) {
      sql += ' AND ws.work_date >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND ws.work_date <= ?';
      params.push(to);
    }
    sql += ' ORDER BY ws.work_date ASC, ws.start_time ASC';
    const [rows] = await pool.execute(sql, params);
    return res.json({ schedules: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/manager/working-schedules  (upsert theo barber_id + work_date)
router.post('/working-schedules', requireManagerOrOwner, requireManagerBranch, async (req, res) => {
  const branchId = req.managerBranchId;
  const { barber_id, work_date, start_time, end_time, is_day_off } = req.body ?? {};
  const bid = Number(barber_id);
  if (!bid || !work_date) {
    return res.status(400).json({ error: 'Thiếu barber_id hoặc work_date' });
  }
  const st = start_time || '09:00:00';
  const et = end_time || '18:00:00';
  const off = is_day_off ? 1 : 0;
  try {
    const [[owns]] = await pool.execute(
      'SELECT id FROM barbers WHERE id = ? AND branch_id = ? LIMIT 1',
      [bid, branchId],
    );
    if (!owns) {
      return res.status(400).json({ error: 'Thợ không thuộc chi nhánh của bạn' });
    }
    await pool.execute(
      `
      INSERT INTO working_schedules (barber_id, work_date, start_time, end_time, is_day_off)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        start_time = VALUES(start_time),
        end_time = VALUES(end_time),
        is_day_off = VALUES(is_day_off)
      `,
      [bid, work_date, st, et, off],
    );
    const [[row]] = await pool.execute(
      'SELECT * FROM working_schedules WHERE barber_id = ? AND work_date = ? LIMIT 1',
      [bid, work_date],
    );
    return res.status(201).json({ schedule: row });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// DELETE /api/manager/working-schedules/:id
router.delete('/working-schedules/:id', requireManagerOrOwner, requireManagerBranch, async (req, res) => {
  const branchId = req.managerBranchId;
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id không hợp lệ' });
  try {
    const [[ws]] = await pool.execute(
      `
      SELECT ws.id FROM working_schedules ws
      INNER JOIN barbers b ON b.id = ws.barber_id AND b.branch_id = ?
      WHERE ws.id = ?
      LIMIT 1
      `,
      [branchId, id],
    );
    if (!ws) return res.status(404).json({ error: 'Không tìm thấy lịch hoặc không thuộc chi nhánh' });
    await pool.execute('DELETE FROM working_schedules WHERE id = ?', [id]);
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/manager/stats?from=YYYY-MM-DD&to=YYYY-MM-DD — doanh thu + thống kê theo chi nhánh
router.get('/stats', requireManagerOrOwner, requireManagerBranch, async (req, res) => {
  const bid = req.managerBranchId;
  let from = String(req.query.from ?? '').trim().slice(0, 10);
  let to = String(req.query.to ?? '').trim().slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  if (!to) to = ymd(today);
  if (!from) {
    const d0 = new Date(today);
    d0.setDate(d0.getDate() - 29);
    from = ymd(d0);
  }
  if (from.length < 8 || to.length < 8 || from > to) {
    return res.status(400).json({ error: 'from / to không hợp lệ (YYYY-MM-DD, from <= to)' });
  }

  try {
    const [[summary]] = await pool.execute(
      `
      SELECT
        COUNT(*) AS appointment_count,
        COALESCE(SUM(CASE WHEN a.status = 'completed' THEN CAST(a.total_price AS DECIMAL(15,2)) ELSE 0 END), 0) AS revenue_completed
      FROM appointments a
      WHERE a.branch_id = ? AND a.appt_date >= ? AND a.appt_date <= ?
      `,
      [bid, from, to],
    );

    const [byStatus] = await pool.execute(
      `
      SELECT a.status, COUNT(*) AS cnt
      FROM appointments a
      WHERE a.branch_id = ? AND a.appt_date >= ? AND a.appt_date <= ?
      GROUP BY a.status
      ORDER BY cnt DESC
      `,
      [bid, from, to],
    );

    const [apptByDay] = await pool.execute(
      `
      SELECT
        DATE(a.appt_date) AS d,
        COUNT(*) AS appointments,
        COALESCE(SUM(CASE WHEN a.status = 'completed' THEN CAST(a.total_price AS DECIMAL(15,2)) ELSE 0 END), 0) AS revenue
      FROM appointments a
      WHERE a.branch_id = ? AND a.appt_date >= ? AND a.appt_date <= ?
      GROUP BY DATE(a.appt_date)
      ORDER BY d ASC
      `,
      [bid, from, to],
    );

    let shopOrdersScope = 'global';
    let shopByDay = [];
    let revenue_shop = 0;
    try {
      const [colCheck] = await pool.execute(
        `
        SELECT 1 AS ok FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'branch_id'
        LIMIT 1
        `,
      );
      if (colCheck.length) {
        shopOrdersScope = 'branch';
        const [rows] = await pool.execute(
          `
          SELECT
            DATE(created_at) AS d,
            COUNT(*) AS orders,
            COALESCE(SUM(total_price), 0) AS revenue
          FROM shop_orders
          WHERE branch_id = ?
            AND DATE(created_at) >= ? AND DATE(created_at) <= ?
          GROUP BY DATE(created_at)
          ORDER BY d ASC
          `,
          [bid, from, to],
        );
        shopByDay = rows;
        const [[sr]] = await pool.execute(
          `
          SELECT COALESCE(SUM(total_price), 0) AS rev
          FROM shop_orders
          WHERE branch_id = ?
            AND DATE(created_at) >= ? AND DATE(created_at) <= ?
            AND status IN ('delivered', 'completed')
          `,
          [bid, from, to],
        );
        revenue_shop = Number(sr?.rev) || 0;
      } else {
        const [rows] = await pool.execute(
          `
          SELECT
            DATE(created_at) AS d,
            COUNT(*) AS orders,
            COALESCE(SUM(total_price), 0) AS revenue
          FROM shop_orders
          WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
          GROUP BY DATE(created_at)
          ORDER BY d ASC
          `,
          [from, to],
        );
        shopByDay = rows;
        const [[sr]] = await pool.execute(
          `
          SELECT COALESCE(SUM(total_price), 0) AS rev
          FROM shop_orders
          WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
            AND status IN ('delivered', 'completed')
          `,
          [from, to],
        );
        revenue_shop = Number(sr?.rev) || 0;
      }
    } catch (e) {
      console.error('manager stats shop_orders', e);
      shopByDay = [];
    }

    return res.json({
      branch_id: bid,
      from,
      to,
      summary: {
        appointment_count: Number(summary?.appointment_count) || 0,
        revenue_completed: Number(summary?.revenue_completed) || 0,
        revenue_shop,
      },
      appointments_by_status: byStatus,
      appointments_by_day: apptByDay,
      shop_orders_by_day: shopByDay,
      shop_orders_scope: shopOrdersScope,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

// GET /api/manager/shop-orders — đơn shop theo chi nhánh (khi DB có shop_orders.branch_id)
router.get('/shop-orders', requireManagerOrOwner, requireManagerBranch, async (req, res) => {
  const bid = req.managerBranchId;
  try {
    const [colCheck] = await pool.execute(
      `
      SELECT 1 AS ok FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'branch_id'
      LIMIT 1
      `,
    );
    const hasBranch = colCheck.length > 0;

    let sql = `
      SELECT
        o.id, o.customer_id, o.total_price, o.shipping_address, o.note, o.status, o.created_at,
        u.full_name AS customer_name, u.phone AS customer_phone, u.email AS customer_email
      FROM shop_orders o
      LEFT JOIN users u ON u.id = o.customer_id
    `;
    const params = [];
    // Đơn cũ / seed chưa gán branch_id (NULL) vẫn hiển thị; đơn đã gán branch_id chỉ đúng chi nhánh.
    if (hasBranch) {
      sql += ' WHERE (o.branch_id = ? OR o.branch_id IS NULL)';
      params.push(bid);
    }
    sql += ' ORDER BY o.created_at DESC LIMIT 200';

    const [rows] = await pool.execute(sql, params);
    return res.json({ orders: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// PATCH /api/manager/shop-orders/:id/status
router.patch(
  '/shop-orders/:id/status',
  requireManagerOrOwner,
  requireManagerBranch,
  async (req, res) => {
    const id = Number(req.params.id);
    const bid = req.managerBranchId;
    const { status } = req.body ?? {};
    const allowed = new Set([
      'pending',
      'confirmed',
      'shipping',
      'delivered',
      'completed',
      'cancelled',
    ]);
    if (!id || !status || !allowed.has(status)) {
      return res.status(400).json({ error: 'status không hợp lệ' });
    }
    try {
      const [colCheck] = await pool.execute(
        `
        SELECT 1 AS ok FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'branch_id'
        LIMIT 1
        `,
      );
      const hasBranch = colCheck.length > 0;

      if (hasBranch) {
        const [[row]] = await pool.execute(
          'SELECT id, branch_id FROM shop_orders WHERE id = ? LIMIT 1',
          [id],
        );
        if (!row) return res.status(404).json({ error: 'Không tìm thấy đơn' });
        if (row.branch_id != null && Number(row.branch_id) !== Number(bid)) {
          return res.status(403).json({ error: 'Đơn không thuộc chi nhánh của bạn' });
        }
      }

      await pool.execute('UPDATE shop_orders SET status = ? WHERE id = ?', [status, id]);
      const [[orderRow]] = await pool.execute('SELECT * FROM shop_orders WHERE id = ?', [id]);
      return res.json({ order: orderRow });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  },
);

const { normalizeVietnamPhone } = require('../lib/phoneVn');

// GET /api/manager/customers — Lấy DS khách đã đặt lịch tại chi nhánh
router.get('/customers', requireManagerOrOwner, requireManagerBranch, async (req, res) => {
  const bid = req.managerBranchId;
  try {
    const [rows] = await pool.execute(
      `
      SELECT u.id, u.full_name, u.phone, u.avatar_url, MAX(a.appt_date) AS last_booking
      FROM users u
      JOIN appointments a ON a.customer_id = u.id
      WHERE a.branch_id = ?
      GROUP BY u.id
      ORDER BY last_booking DESC
      LIMIT 200
      `,
      [bid]
    );
    return res.json({ customers: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/manager/appointments-on-behalf — Lễ tân / Quản lý tạo lịch hộ
router.post('/appointments-on-behalf', requireManagerOrOwner, requireManagerBranch, async (req, res) => {
  const branchId = req.managerBranchId;
  const {
    customer_phone,
    customer_name,
    barber_id,
    service_id,
    time_slot_id,
    appt_date,
    start_time,
    end_time,
    total_price,
    note,
  } = req.body ?? {};

  const bId = Number(barber_id);
  const sId = Number(service_id);
  const tsId = Number(time_slot_id);
  const price = Number(total_price) || 0;
  const cPhone = normalizeVietnamPhone(customer_phone ?? '');

  if (!cPhone) return res.status(400).json({ error: 'SĐT khách không hợp lệ' });
  if (!bId || !sId || !tsId || !appt_date || !start_time || !end_time) {
    return res.status(400).json({ error: 'Thiếu thông tin tạo lịch' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Lấy hoặc tạo user
    let customerId;
    const [uRows] = await conn.execute('SELECT id, full_name FROM users WHERE phone = ? LIMIT 1', [cPhone]);
    if (uRows.length > 0) {
      customerId = uRows[0].id;
      // Cập nhật tên nếu chưa có or khách mới
      if (!uRows[0].full_name && customer_name) {
        await conn.execute('UPDATE users SET full_name = ? WHERE id = ?', [customer_name, customerId]);
      }
    } else {
      const [uIns] = await conn.execute(
        'INSERT INTO users (phone, full_name, role) VALUES (?, ?, "customer")',
        [cPhone, customer_name || null]
      );
      customerId = uIns.insertId;
    }

    // 2. Validate time slot
    const [slotRows] = await conn.execute(
      'SELECT id, is_booked FROM time_slots WHERE id = ? AND barber_id = ? LIMIT 1',
      [tsId, bId]
    );
    if (!slotRows.length) throw new Error('Không tìm thấy khung giờ');
    if (Number(slotRows[0].is_booked) === 1) throw new Error('Khung giờ đã được đặt');

    // 3. Kiểm tra cột receptionist_id (database của user có thể đã update schema)
    let hasRecCol = false;
    try {
      const [cols] = await conn.execute(
        "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments' AND COLUMN_NAME = 'receptionist_id' LIMIT 1"
      );
      hasRecCol = cols.length > 0;
    } catch(e) {}

    let queryStr = `INSERT INTO appointments
      (customer_id, barber_id, branch_id, service_id, time_slot_id, appt_date, start_time, end_time, total_price, note, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`;
    let params = [customerId, bId, branchId, sId, tsId, appt_date, start_time, end_time, price, note ?? null];

    if (hasRecCol) {
      queryStr = `INSERT INTO appointments
      (customer_id, barber_id, branch_id, service_id, time_slot_id, receptionist_id, appt_date, start_time, end_time, total_price, note, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`;
      params = [customerId, bId, branchId, sId, tsId, req.managerUserId, appt_date, start_time, end_time, price, note ?? null];
    }

    const [insAppt] = await conn.execute(queryStr, params);

    await conn.execute('UPDATE time_slots SET is_booked = 1 WHERE id = ?', [tsId]);

    await conn.commit();
    return res.status(201).json({ status: 'success', appointment_id: insAppt.insertId });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
