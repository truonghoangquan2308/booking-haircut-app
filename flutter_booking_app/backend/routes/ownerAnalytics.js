const express = require('express');
const pool = require('../db');
const { storeModel } = require('../lib/storeModel');

const router = express.Router();

async function requireStaffRole(req, res, next, role) {
  const uid = (req.headers['x-firebase-uid'] || '').trim();
  if (!uid) {
    return res.status(401).json({ error: 'Thiếu header x-firebase-uid' });
  }
  try {
    const [rows] = await pool.execute(
      `
      SELECT id, role, full_name, email, COALESCE(is_locked, 0) AS is_locked
      FROM users WHERE firebase_uid = ? LIMIT 1
      `,
      [uid],
    );
    if (!rows.length || rows[0].role !== role) {
      return res.status(403).json({ error: `Chỉ tài khoản ${role} mới xem được` });
    }
    if (Number(rows[0].is_locked) === 1) {
      return res.status(403).json({ error: 'Tài khoản đã bị khóa' });
    }
    req.staffUser = rows[0];
    next();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

const requireOwner = (req, res, next) => requireStaffRole(req, res, next, 'owner');

// GET /api/owner/analytics — dữ liệu biểu đồ + export (Owner)
router.get('/analytics', requireOwner, async (_req, res) => {
  try {
    const [byDay] = await pool.execute(
      `
      SELECT DATE(appt_date) AS d, COUNT(*) AS appointments
      FROM appointments
      WHERE appt_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(appt_date)
      ORDER BY d ASC
      `,
    );

    const [revenueByDay] = await pool.execute(
      `
      SELECT DATE(appt_date) AS d, COALESCE(SUM(total_price), 0) AS revenue
      FROM appointments
      WHERE status = 'completed'
        AND appt_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(appt_date)
      ORDER BY d ASC
      `,
    );

    const [byStatus] = await pool.execute(
      `
      SELECT status, COUNT(*) AS cnt
      FROM appointments
      GROUP BY status
      `,
    );

    const [topServices] = await pool.execute(
      `
      SELECT s.name AS service_name, COUNT(*) AS cnt,
             COALESCE(SUM(a.total_price), 0) AS revenue
      FROM appointments a
      JOIN services s ON s.id = a.service_id
      GROUP BY s.id, s.name
      ORDER BY cnt DESC
      LIMIT 10
      `,
    );

    let shopOrdersByMonth = [];
    try {
      const [rows] = await pool.execute(
        `
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym,
               COUNT(*) AS orders,
               COALESCE(SUM(total_price), 0) AS revenue
        FROM shop_orders
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY ym ASC
        `,
      );
      shopOrdersByMonth = rows;
    } catch {
      /* bảng có thể chưa có ở DB cũ */
    }

    const [revenueByMonth] = await pool.execute(
      `
      SELECT DATE_FORMAT(appt_date, '%Y-%m') AS ym,
             COALESCE(SUM(total_price), 0) AS revenue
      FROM appointments
      WHERE status = 'completed'
        AND appt_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(appt_date, '%Y-%m')
      ORDER BY ym ASC
      `,
    );

    const [barberLeaderboard] = await pool.execute(
      `
      SELECT
        b.id AS barber_id,
        u.full_name AS barber_name,
        b.rating,
        b.total_reviews,
        COUNT(a.id) AS appointment_count,
        COALESCE(SUM(CASE WHEN a.status = 'completed' THEN a.total_price ELSE 0 END), 0) AS revenue
      FROM barbers b
      JOIN users u ON u.id = b.user_id
      LEFT JOIN appointments a ON a.barber_id = b.id
      GROUP BY b.id, u.full_name, b.rating, b.total_reviews
      ORDER BY revenue DESC, b.rating DESC
      LIMIT 20
      `,
    );

    let revenueByShop = [];
    const model = await storeModel();
    try {
      if (model === 'branches') {
        const [rbs] = await pool.execute(
          `
          SELECT
            br.id AS shop_id,
            br.name AS shop_name,
            COUNT(DISTINCT a.id) AS appointment_count,
            COALESCE(SUM(CASE WHEN a.status = 'completed' THEN a.total_price ELSE 0 END), 0) AS revenue
          FROM branches br
          LEFT JOIN barbers b ON b.branch_id = br.id
          LEFT JOIN appointments a ON a.barber_id = b.id
          GROUP BY br.id, br.name
          ORDER BY revenue DESC
          `,
        );
        revenueByShop = rbs;
      } else if (model === 'shops') {
        const [rbs] = await pool.execute(
          `
          SELECT
            sh.id AS shop_id,
            sh.name AS shop_name,
            COUNT(DISTINCT a.id) AS appointment_count,
            COALESCE(SUM(CASE WHEN a.status = 'completed' THEN a.total_price ELSE 0 END), 0) AS revenue
          FROM shops sh
          LEFT JOIN barbers b ON b.shop_id = sh.id
          LEFT JOIN appointments a ON a.barber_id = b.id
          GROUP BY sh.id, sh.name
          ORDER BY revenue DESC
          `,
        );
        revenueByShop = rbs;
      }
    } catch {
      revenueByShop = [];
    }

    const activeShopsSql =
      model === 'branches'
        ? "(SELECT COUNT(*) FROM branches WHERE status = 'active')"
        : model === 'shops'
          ? "(SELECT COUNT(*) FROM shops WHERE approval_status = 'approved' AND is_blocked = 0)"
          : '(SELECT 0)';

    const [[kpis]] = await pool.execute(
      `
      SELECT
        (SELECT COUNT(*) FROM appointments) AS total_appointments,
        (SELECT COUNT(*) FROM appointments WHERE status = 'completed') AS completed_appointments,
        (SELECT COALESCE(SUM(total_price), 0) FROM appointments WHERE status = 'completed') AS total_revenue,
        (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers,
        (SELECT COUNT(*) FROM barbers) AS barbers,
        ${activeShopsSql} AS active_shops
      `,
    );

    let shop_revenue = 0;
    try {
      const [[sr]] = await pool.execute(
        `
        SELECT COALESCE(SUM(total_price), 0) AS rev
        FROM shop_orders
        WHERE status IN ('delivered', 'completed')
        `,
      );
      shop_revenue = Number(sr?.rev) || 0;
    } catch {
      shop_revenue = 0;
    }

    return res.json({
      generatedAt: new Date().toISOString(),
      kpis: { ...kpis, shop_revenue },
      appointmentsByDay: byDay,
      revenueByDay,
      appointmentsByStatus: byStatus,
      topServices,
      shopOrdersByMonth,
      revenueByMonth,
      barberLeaderboard,
      revenueByShop,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
