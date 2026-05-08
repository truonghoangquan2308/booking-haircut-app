const express = require('express');
const pool = require('../db');
const { normalizeVietnamPhone } = require('../lib/phoneVn');
const { normalizeBarberBio } = require('../lib/barberBio');

const router = express.Router();

async function requireOwner(req, res, next) {
  const uid = (req.headers['x-firebase-uid'] || '').trim();
  if (!uid) return res.status(401).json({ error: 'Thiếu header x-firebase-uid' });
  try {
    const [rows] = await pool.execute(
      `
      SELECT id, role, COALESCE(is_locked, 0) AS is_locked
      FROM users WHERE firebase_uid = ? LIMIT 1
      `,
      [uid],
    );
    if (!rows.length || rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Chỉ Owner' });
    }
    if (Number(rows[0].is_locked) === 1) {
      return res.status(403).json({ error: 'Tài khoản đã bị khóa' });
    }
    req.ownerUserId = rows[0].id;
    next();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

async function assertBranchOwned(ownerId, branchId) {
  if (branchId == null || branchId === '') return { ok: true, branch: null };
  const bid = Number(branchId);
  if (!Number.isFinite(bid) || bid <= 0) return { ok: false, error: 'branch_id không hợp lệ' };
  const [r] = await pool.execute(
    'SELECT id, name FROM branches WHERE id = ? AND owner_id = ? LIMIT 1',
    [bid, ownerId],
  );
  if (!r.length) return { ok: false, error: 'Chi nhánh không thuộc Owner' };
  return { ok: true, branch: r[0] };
}

/** Thợ nằm trong phạm vi Owner: ít nhất một trong barbers.branch_id / users.branch_id trỏ tới chi nhánh của owner */
async function assertBarberInOwnerScope(ownerId, barberId) {
  const [r] = await pool.execute(
    `
    SELECT 1
    FROM barbers b
    JOIN users u ON u.id = b.user_id
    WHERE b.id = ?
      AND (
        b.branch_id IN (SELECT id FROM branches WHERE owner_id = ?)
        OR u.branch_id IN (SELECT id FROM branches WHERE owner_id = ?)
      )
    LIMIT 1
    `,
    [barberId, ownerId, ownerId],
  );
  return r.length > 0;
}

// GET /api/owner/barbers/stats — thống kê tổng cho owner
router.get('/barbers/stats', requireOwner, async (req, res) => {
  const ownerId = req.ownerUserId;
  try {
    const [stats] = await pool.execute(
      `
      SELECT
        COUNT(DISTINCT b.id) AS total_barbers,
        SUM(CASE WHEN u.status = 'available' THEN 1 ELSE 0 END) AS working_today,
        SUM(CASE WHEN u.status = 'off' THEN 1 ELSE 0 END) AS off_today,
        ROUND(AVG(b.rating), 1) AS avg_rating
      FROM barbers b
      INNER JOIN users u ON u.id = b.user_id
      WHERE
        b.branch_id IN (SELECT id FROM branches WHERE owner_id = ?)
        OR u.branch_id IN (SELECT id FROM branches WHERE owner_id = ?)
      `,
      [ownerId, ownerId],
    );
    const row = stats[0];
    return res.json({
      total_barbers: Number(row.total_barbers) || 0,
      working_today: Number(row.working_today) || 0,
      off_today: Number(row.off_today) || 0,
      avg_rating: Number(row.avg_rating) || 0,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/owner/barbers/:barberId/details — chi tiết thợ + lịch hẹn + reviews
router.get('/barbers/:barberId/details', requireOwner, async (req, res) => {
  const ownerId = req.ownerUserId;
  const barberId = parseInt(req.params.barberId, 10);
  if (!barberId) return res.status(400).json({ error: 'barberId không hợp lệ' });

  try {
    const inScope = await assertBarberInOwnerScope(ownerId, barberId);
    if (!inScope) {
      return res.status(403).json({ error: 'Thợ không thuộc phạm vi Owner' });
    }

    // Thông tin thợ
    const [barberRows] = await pool.execute(
      `
      SELECT
        b.id AS barber_id,
        b.branch_id,
        br.name AS branch_name,
        b.user_id,
        u.full_name,
        u.phone,
        u.email,
        u.firebase_uid,
        u.avatar_url,
        u.date_of_birth,
        u.status,
        b.bio,
        b.is_available,
        b.rating,
        b.total_reviews,
        u.created_at AS user_created_at
      FROM barbers b
      JOIN users u ON u.id = b.user_id
      LEFT JOIN branches br ON br.id = b.branch_id
      WHERE b.id = ?
      LIMIT 1
      `,
      [barberId],
    );
    if (!barberRows.length) return res.status(404).json({ error: 'Không tìm thấy thợ' });
    const barber = barberRows[0];

    // Thống kê cá nhân
    const [statsRows] = await pool.execute(
      `
      SELECT
        COUNT(DISTINCT a.id) AS total_appointments,
        COALESCE(SUM(CASE WHEN a.status = 'completed' AND YEAR(a.created_at) = YEAR(CURDATE()) AND MONTH(a.created_at) = MONTH(CURDATE()) THEN a.total_price ELSE 0 END), 0) AS revenue_month,
        COALESCE(AVG(r.rating), 0) AS avg_rating_personal,
        ROUND(
          (COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) * 100.0 / NULLIF(COUNT(a.id), 0)),
          1
        ) AS cancel_rate
      FROM appointments a
      LEFT JOIN reviews r ON r.appointment_id = a.id
      WHERE a.barber_id = ?
      `,
      [barberId],
    );
    const stats = statsRows[0];

    // Lịch hẹn gần nhất 20
    const [apptRows] = await pool.execute(
      `
      SELECT
        a.id,
        DATE_FORMAT(a.appt_date, '%Y-%m-%d') AS appt_date,
        a.start_time,
        a.end_time,
        a.total_price,
        a.status,
        s.name AS service_name,
        uC.full_name AS customer_name
      FROM appointments a
      JOIN services s ON s.id = a.service_id
      JOIN users uC ON uC.id = a.customer_id
      WHERE a.barber_id = ?
      ORDER BY a.created_at DESC
      LIMIT 20
      `,
      [barberId],
    );

    // Reviews gần nhất
    const [reviewRows] = await pool.execute(
      `
      SELECT
        r.rating,
        r.comment,
        r.created_at,
        uC.full_name AS customer_name
      FROM reviews r
      JOIN appointments a ON a.id = r.appointment_id
      JOIN users uC ON uC.id = r.customer_id
      WHERE r.barber_id = ?
      ORDER BY r.created_at DESC
      LIMIT 20
      `,
      [barberId],
    );

    return res.json({
      barber,
      stats: {
        total_appointments: Number(stats.total_appointments) || 0,
        revenue_month: Number(stats.revenue_month) || 0,
        avg_rating: Number(stats.avg_rating_personal) || 0,
        cancel_rate: Number(stats.cancel_rate) || 0,
      },
      appointments: apptRows,
      reviews: reviewRows,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/owner/barbers — đọc trực tiếp từ DB: bảng barbers + users, lọc theo chi nhánh có branches.owner_id = Owner
// (Không bắt buộc users.role = 'barber' — tránh ẩn dòng khi role trong DB chưa đồng bộ)
router.get('/barbers', requireOwner, async (req, res) => {
  const ownerId = req.ownerUserId;
  try {
    const [rows] = await pool.execute(
      `
      SELECT
        b.id AS barber_id,
        COALESCE(b.branch_id, u.branch_id) AS branch_id,
        br.name AS branch_name,
        b.user_id,
        u.full_name,
        u.phone,
        u.email,
        u.firebase_uid,
        u.avatar_url,
        u.date_of_birth,
        u.status,
        b.bio,
        b.is_available,
        b.rating,
        b.total_reviews,
        COALESCE((
          SELECT COUNT(*)
          FROM appointments a
          WHERE a.barber_id = b.id AND DATE(a.appt_date) = CURDATE()
        ), 0) AS appointments_today,
        COALESCE((
          SELECT SUM(a.total_price)
          FROM appointments a
          WHERE a.barber_id = b.id AND a.status = 'completed'
            AND YEAR(a.created_at) = YEAR(CURDATE()) AND MONTH(a.created_at) = MONTH(CURDATE())
        ), 0) AS revenue_month
      FROM barbers b
      INNER JOIN users u ON u.id = b.user_id
      LEFT JOIN branches br ON br.id = COALESCE(b.branch_id, u.branch_id)
      WHERE
        b.branch_id IN (SELECT id FROM branches WHERE owner_id = ?)
        OR u.branch_id IN (SELECT id FROM branches WHERE owner_id = ?)
      ORDER BY COALESCE(br.name, '') ASC, u.full_name ASC, b.id ASC
      `,
      [ownerId, ownerId],
    );
    return res.json({ barbers: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/owner/barbers — tạo thợ + gán chi nhánh (branch phải thuộc Owner)
router.post('/barbers', requireOwner, async (req, res) => {
  const ownerId = req.ownerUserId;
  const { full_name, phone, branch_id, bio, is_available } = req.body ?? {};
  const phoneNorm = normalizeVietnamPhone(phone);
  if (!phoneNorm) {
    return res.status(400).json({ error: 'Thiếu phone' });
  }
  const brCheck = await assertBranchOwned(ownerId, branch_id);
  if (!brCheck.ok) {
    return res.status(400).json({ error: brCheck.error });
  }
  if (!brCheck.branch) {
    return res.status(400).json({ error: 'Cần branch_id (chi nhánh của bạn)' });
  }
  const bid = Number(branch_id);
  const available = `${is_available ?? '1'}` === '1' ? 1 : 0;
  const bioNorm = normalizeBarberBio(bio);
  const userStatus = available ? 'available' : 'off';

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [existUsers] = await conn.execute('SELECT * FROM users WHERE phone = ? LIMIT 1', [
      phoneNorm,
    ]);

    let userId;
    if (existUsers.length > 0) {
      userId = existUsers[0].id;
      await conn.execute(
        `UPDATE users SET role = ?, full_name = COALESCE(?, full_name),
         branch_id = ?, status = ? WHERE id = ?`,
        ['barber', full_name ?? null, bid, userStatus, userId],
      );
    } else {
      const [ins] = await conn.execute(
        'INSERT INTO users (phone, full_name, role, branch_id, status) VALUES (?, ?, ?, ?, ?)',
        [phoneNorm, full_name ?? null, 'barber', bid, userStatus],
      );
      userId = ins.insertId;
    }

    const [existBarbers] = await conn.execute(
      'SELECT * FROM barbers WHERE user_id = ? LIMIT 1',
      [userId],
    );

    let barberId;
    if (existBarbers.length > 0) {
      barberId = existBarbers[0].id;
      await conn.execute(
        'UPDATE barbers SET branch_id = ?, is_available = ?, bio = COALESCE(?, bio) WHERE id = ?',
        [bid, available, bioNorm, barberId],
      );
    } else {
      const [insB] = await conn.execute(
        'INSERT INTO barbers (user_id, branch_id, bio, is_available) VALUES (?, ?, ?, ?)',
        [userId, bid, bioNorm, available],
      );
      barberId = insB.insertId;
    }

    await conn.commit();

    const [rows] = await pool.execute(
      `
      SELECT
        b.id AS barber_id,
        b.branch_id,
        br.name AS branch_name,
        b.user_id,
        u.full_name,
        u.phone,
        u.email,
        u.firebase_uid,
        u.avatar_url,
        u.date_of_birth,
        u.status,
        b.bio,
        b.is_available,
        b.rating,
        b.total_reviews
      FROM barbers b
      JOIN users u ON u.id = b.user_id
      INNER JOIN branches br ON br.id = b.branch_id
      WHERE b.id = ? AND br.owner_id = ?
      LIMIT 1
      `,
      [barberId, ownerId],
    );

    if (!rows.length) {
      return res.status(500).json({ error: 'Không đọc lại được thợ vừa tạo' });
    }
    return res.status(201).json({ barber: rows[0] });
  } catch (e) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
    }
    console.error(e);
    return res.status(500).json({ error: e.message });
  } finally {
    if (conn) conn.release();
  }
});

// PATCH /api/owner/barbers/:barberId — đổi họ tên (users) / chi nhánh / khả dụng / bio (trong phạm vi Owner)
router.patch('/barbers/:barberId', requireOwner, async (req, res) => {
  const ownerId = req.ownerUserId;
  const barberId = parseInt(req.params.barberId, 10);
  if (!barberId) return res.status(400).json({ error: 'barberId không hợp lệ' });

  const { branch_id, is_available, bio, full_name } = req.body ?? {};

  try {
    const inScope = await assertBarberInOwnerScope(ownerId, barberId);
    if (!inScope) {
      return res.status(403).json({ error: 'Thợ không thuộc phạm vi Owner (chi nhánh của bạn)' });
    }

    const [bRows] = await pool.execute(
      'SELECT b.id, b.user_id FROM barbers b WHERE b.id = ? LIMIT 1',
      [barberId],
    );
    const row = bRows[0];
    if (!row) return res.status(404).json({ error: 'Không tìm thấy thợ' });

    const sets = [];
    const vals = [];

    if (full_name !== undefined) {
      await pool.execute('UPDATE users SET full_name = ? WHERE id = ?', [
        full_name === '' ? null : full_name,
        row.user_id,
      ]);
    }

    if (branch_id !== undefined) {
      if (branch_id === null || branch_id === '') {
        sets.push('branch_id = NULL');
      } else {
        const brCheck = await assertBranchOwned(ownerId, branch_id);
        if (!brCheck.ok) {
          return res.status(400).json({ error: brCheck.error });
        }
        sets.push('branch_id = ?');
        vals.push(Number(branch_id));
      }
    }
    if (is_available !== undefined) {
      sets.push('is_available = ?');
      vals.push(`${is_available}` === '1' || is_available === true ? 1 : 0);
    }
    if (bio !== undefined) {
      sets.push('bio = ?');
      vals.push(normalizeBarberBio(bio));
    }

    if (sets.length) {
      vals.push(barberId);
      await pool.execute(`UPDATE barbers SET ${sets.join(', ')} WHERE id = ?`, vals);
    }

    if (is_available !== undefined) {
      const on = `${is_available}` === '1' || is_available === true;
      await pool.execute('UPDATE users SET status = ? WHERE id = ?', [
        on ? 'available' : 'off',
        row.user_id,
      ]);
    }

    const [out] = await pool.execute(
      `
      SELECT
        b.id AS barber_id,
        COALESCE(b.branch_id, u.branch_id) AS branch_id,
        br.name AS branch_name,
        b.user_id,
        u.full_name,
        u.phone,
        u.email,
        u.firebase_uid,
        u.avatar_url,
        u.date_of_birth,
        u.status,
        b.bio,
        b.is_available,
        b.rating,
        b.total_reviews
      FROM barbers b
      JOIN users u ON u.id = b.user_id
      LEFT JOIN branches br ON br.id = COALESCE(b.branch_id, u.branch_id)
      WHERE b.id = ?
      LIMIT 1
      `,
      [barberId],
    );

    const b = out[0];
    const stillInScope = await assertBarberInOwnerScope(ownerId, barberId);
    if (!stillInScope) {
      return res.status(403).json({ error: 'Cập nhật khiến thợ ra khỏi phạm vi Owner' });
    }

    return res.json({ barber: b });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
