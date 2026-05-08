const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/offers — ưu đãi đang hiệu lực (app khách)
router.get('/offers', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT id, title, description, discount_percent, usage_type, expires_at, accent_color, sort_order
      FROM offers
      WHERE is_active = 1 AND expires_at >= CURDATE()
      ORDER BY sort_order ASC, id DESC
      `,
    );
    return res.json({ offers: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

// POST /api/promotions/validate — kiểm tra phiếu có hợp lệ không
router.post('/promotions/validate', async (req, res) => {
  const { code, customer_id } = req.body ?? {};

  if (!code || !customer_id) {
    return res.status(400).json({ error: 'Thiếu code hoặc customer_id' });
  }

  try {
    // Tìm phiếu theo tiêu đề (giả định code = title)
    const [[offer]] = await pool.execute(
      `SELECT * FROM offers WHERE title = ? OR id = ? LIMIT 1`,
      [code, Number(code) || null]
    );

    if (!offer) {
      return res.status(404).json({ error: 'Phiếu không tồn tại' });
    }

    // Kiểm tra hạn sử dụng
    if (!offer.is_active || new Date(offer.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Phiếu đã hết hạn' });
    }

    // Nếu là "single_customer", kiểm tra xem customer này đã dùng chưa
    if (offer.usage_type === 'single_customer') {
      // Nếu gán cho khách cụ thể, chỉ khách đó mới dùng được
      if (offer.assigned_customer_id && offer.assigned_customer_id !== Number(customer_id)) {
        return res.status(403).json({ error: 'Phiếu này không áp dụng cho bạn' });
      }

      // Kiểm tra đã dùng chưa
      const [[used]] = await pool.execute(
        'SELECT id FROM used_promotions WHERE promotion_id = ? AND customer_id = ? LIMIT 1',
        [offer.id, customer_id]
      );
      if (used) {
        return res.status(409).json({ error: 'Phiếu này bạn đã sử dụng' });
      }
    }

    return res.json({
      valid: true,
      offer: {
        id: offer.id,
        title: offer.title,
        discount_percent: offer.discount_percent,
        usage_type: offer.usage_type,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

// GET /api/promotions/usage-history — lịch sử sử dụng
router.get('/promotions/usage-history', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT 
        up.id, up.promotion_id, o.title, o.discount_percent,
        up.customer_id, u.full_name, u.phone,
        up.order_id, up.used_at
      FROM used_promotions up
      JOIN offers o ON o.id = up.promotion_id
      JOIN users u ON u.id = up.customer_id
      ORDER BY up.used_at DESC
      LIMIT 1000
      `
    );
    return res.json({ history: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? 'Server error' });
  }
});

module.exports = router;
