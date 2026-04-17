const express = require('express');
const pool = require('../db');

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

// GET /api/owner/offers — tất cả (kể cả hết hạn / tắt)
router.get('/offers', requireOwner, async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT 
        id, title, description, discount_percent, usage_type, assigned_customer_id,
        expires_at, accent_color, is_active, sort_order, created_at, updated_at
      FROM offers
      ORDER BY sort_order ASC, id DESC
      `,
    );

    // Thêm info về số lượt dùng và tên khách được gán
    const enriched = await Promise.all(
      rows.map(async (row) => {
        let usageCount = 0;
        let assignedCustomerName = null;

        if (row.usage_type === 'single_customer') {
          // Đếm số khách đã dùng phiếu này
          const [[countRow]] = await pool.execute(
            `SELECT COUNT(DISTINCT customer_id) as cnt FROM used_promotions WHERE promotion_id = ?`,
            [row.id]
          );
          usageCount = countRow?.cnt || 0;

          // Nếu gán cho khách cụ thể, lấy tên khách
          if (row.assigned_customer_id) {
            const [[customer]] = await pool.execute(
              `SELECT full_name FROM users WHERE id = ? LIMIT 1`,
              [row.assigned_customer_id]
            );
            assignedCustomerName = customer?.full_name || 'N/A';
          }
        } else {
          // unlimited: đếm tổng lượt sử dụng
          const [[countRow]] = await pool.execute(
            `SELECT COUNT(*) as cnt FROM used_promotions WHERE promotion_id = ?`,
            [row.id]
          );
          usageCount = countRow?.cnt || 0;
        }

        return {
          ...row,
          usageCount,
          assignedCustomerName,
        };
      })
    );

    return res.json({ offers: enriched });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

// POST /api/owner/offers
router.post('/offers', requireOwner, async (req, res) => {
  try {
    const {
      title,
      description,
      discount_percent,
      usage_type,
      assigned_customer_id,
      expires_at,
      accent_color,
      is_active,
      sort_order,
    } = req.body ?? {};

    if (!title || String(title).trim().length === 0) {
      return res.status(400).json({ error: 'Thiếu title' });
    }
    if (!expires_at || String(expires_at).trim().length < 8) {
      return res.status(400).json({ error: 'Thiếu expires_at (YYYY-MM-DD)' });
    }
    if (!discount_percent || Number(discount_percent) < 1 || Number(discount_percent) > 100) {
      return res.status(400).json({ error: 'discount_percent phải từ 1 đến 100' });
    }

    const uType = usage_type && ['unlimited', 'single_customer'].includes(String(usage_type).trim())
      ? String(usage_type).trim()
      : 'single_customer';
    
    let assignedCustId = null;
    if (uType === 'single_customer' && assigned_customer_id) {
      assignedCustId = Number(assigned_customer_id);
      if (!assignedCustId) {
        return res.status(400).json({ error: 'assigned_customer_id không hợp lệ' });
      }
    }

    const active = is_active === undefined || is_active === null ? 1 : Number(is_active) ? 1 : 0;
    const sort = sort_order === undefined || sort_order === null ? 0 : Number(sort_order);
    const color = accent_color && String(accent_color).trim()
      ? String(accent_color).trim().slice(0, 16)
      : '#FF6B6B';
    const discount = Number(discount_percent) || 10;

    const [result] = await pool.execute(
      `
      INSERT INTO offers 
        (title, description, discount_percent, usage_type, assigned_customer_id, 
         points_reward, expires_at, accent_color, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        String(title).trim(),
        description != null ? String(description) : '',
        discount,
        uType,
        assignedCustId,
        0,
        String(expires_at).trim().slice(0, 10),
        color,
        active,
        Number.isFinite(sort) ? sort : 0,
      ],
    );

    const id = result.insertId;
    const [[row]] = await pool.execute('SELECT * FROM offers WHERE id = ?', [id]);
    return res.status(201).json({ offer: row });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

// PATCH /api/owner/offers/:id
router.patch('/offers/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id không hợp lệ' });
  try {
    const {
      title,
      description,
      discount_percent,
      usage_type,
      assigned_customer_id,
      expires_at,
      accent_color,
      is_active,
      sort_order,
    } = req.body ?? {};

    const sets = [];
    const vals = [];

    if (title !== undefined) {
      sets.push('title = ?');
      vals.push(String(title).trim());
    }
    if (description !== undefined) {
      sets.push('description = ?');
      vals.push(String(description));
    }
    if (discount_percent !== undefined) {
      const d = Number(discount_percent);
      if (d < 1 || d > 100) {
        return res.status(400).json({ error: 'discount_percent phải từ 1 đến 100' });
      }
      sets.push('discount_percent = ?');
      vals.push(d);
    }
    if (usage_type !== undefined) {
      const uType = ['unlimited', 'single_customer'].includes(String(usage_type).trim())
        ? String(usage_type).trim()
        : 'single_customer';
      sets.push('usage_type = ?');
      vals.push(uType);
    }
    if (assigned_customer_id !== undefined) {
      if (assigned_customer_id === null) {
        sets.push('assigned_customer_id = ?');
        vals.push(null);
      } else {
        const custId = Number(assigned_customer_id);
        if (!custId) {
          return res.status(400).json({ error: 'assigned_customer_id không hợp lệ' });
        }
        sets.push('assigned_customer_id = ?');
        vals.push(custId);
      }
    }
    if (expires_at !== undefined) {
      sets.push('expires_at = ?');
      vals.push(String(expires_at).trim().slice(0, 10));
    }
    if (accent_color !== undefined) {
      sets.push('accent_color = ?');
      vals.push(String(accent_color).trim().slice(0, 16));
    }
    if (is_active !== undefined) {
      sets.push('is_active = ?');
      vals.push(Number(is_active) ? 1 : 0);
    }
    if (sort_order !== undefined) {
      const s = Number(sort_order);
      sets.push('sort_order = ?');
      vals.push(Number.isFinite(s) ? s : 0);
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'Không có trường cập nhật' });
    }

    vals.push(id);
    await pool.execute(`UPDATE offers SET ${sets.join(', ')} WHERE id = ?`, vals);

    const [[row]] = await pool.execute('SELECT * FROM offers WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy' });
    return res.json({ offer: row });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

// DELETE /api/owner/offers/:id
router.delete('/offers/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id không hợp lệ' });
  try {
    const [r] = await pool.execute('DELETE FROM offers WHERE id = ?', [id]);
    if (r.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy' });
    }
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

// GET /api/owner/customers — lấy danh sách khách (tìm kiếm theo tên/SĐT)
router.get('/customers', requireOwner, async (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    let query = 'SELECT id, full_name, phone FROM users WHERE role = "customer"';
    const params = [];

    if (q) {
      query += ' AND (LOWER(full_name) LIKE ? OR phone LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }

    query += ' ORDER BY full_name ASC LIMIT 100';
    const [rows] = await pool.execute(query, params);
    return res.json({ customers: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

// POST /api/owner/offers/:id/track-usage — track khi customer dùng phiếu
router.post('/offers/:id/track-usage', async (req, res) => {
  const offerId = Number(req.params.id);
  const { customer_id, order_id } = req.body ?? {};

  if (!offerId || !customer_id) {
    return res.status(400).json({ error: 'Thiếu offerId hoặc customer_id' });
  }

  try {
    const [[offer]] = await pool.execute('SELECT * FROM offers WHERE id = ?', [offerId]);
    if (!offer) {
      return res.status(404).json({ error: 'Phiếu không tồn tại' });
    }

    // Nếu là "single_customer", kiểm tra xem đã dùng chưa
    if (offer.usage_type === 'single_customer') {
      const [[used]] = await pool.execute(
        'SELECT id FROM used_promotions WHERE promotion_id = ? AND customer_id = ? LIMIT 1',
        [offerId, customer_id]
      );
      if (used) {
        return res.status(409).json({ error: 'Phiếu này bạn đã sử dụng' });
      }
    }

    // Lưu lại usage
    const orderId = order_id ? Number(order_id) : null;
    await pool.execute(
      'INSERT INTO used_promotions (promotion_id, customer_id, order_id) VALUES (?, ?, ?)',
      [offerId, customer_id, orderId]
    );

    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

// GET /api/owner/offers/:id/usage-history — lịch sử dùng phiếu
router.get('/offers/:id/usage-history', requireOwner, async (req, res) => {
  const offerId = Number(req.params.id);
  if (!offerId) return res.status(400).json({ error: 'id không hợp lệ' });

  try {
    const [rows] = await pool.execute(
      `
      SELECT 
        up.id, up.customer_id, u.full_name, u.phone, 
        up.order_id, up.used_at
      FROM used_promotions up
      JOIN users u ON u.id = up.customer_id
      WHERE up.promotion_id = ?
      ORDER BY up.used_at DESC
      `,
      [offerId]
    );
    return res.json({ history: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

// GET /api/owner/offers/usage-history/all — lịch sử dùng tất cả phiếu
router.get('/usage-history/all', requireOwner, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT 
        up.id, up.promotion_id, o.title, up.customer_id, u.full_name, u.phone,
        up.order_id, up.used_at
      FROM used_promotions up
      JOIN offers o ON o.id = up.promotion_id
      JOIN users u ON u.id = up.customer_id
      ORDER BY up.used_at DESC
      LIMIT 500
      `
    );
    return res.json({ history: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

module.exports = router;
