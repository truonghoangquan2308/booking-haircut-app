const express = require('express');
const pool = require('../db');
const { normalizeVietnamPhone } = require('../lib/phoneVn');

const router = express.Router();

/**
 * POST /api/shop/checkout
 * Body: { full_name, phone, note?, branch_id, items: [{ name, unit_price, quantity }], firebase_uid? }
 * Tạo / cập nhật khách (users.role = customer), ghi shop_orders (branch_id) để manager-web hiển thị.
 */
router.post('/shop/checkout', async (req, res) => {
  const body = req.body ?? {};
  const fullName = String(body.full_name ?? '').trim();
  let phone = normalizeVietnamPhone(body.phone);
  const note = body.note != null ? String(body.note).trim() : '';
  const branchId = Number(body.branch_id);
  const firebaseUid =
    typeof body.firebase_uid === 'string' && body.firebase_uid.trim()
      ? body.firebase_uid.trim()
      : null;
  const items = Array.isArray(body.items) ? body.items : [];

  if (!fullName) {
    return res.status(400).json({ error: 'Vui lòng nhập họ tên' });
  }
  if (!phone || phone.length < 9) {
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
  }
  if (!Number.isFinite(branchId) || branchId <= 0) {
    return res.status(400).json({ error: 'Chọn chi nhánh nhận hàng' });
  }
  if (items.length === 0) {
    return res.status(400).json({ error: 'Giỏ hàng trống' });
  }

  let total = 0;
  const lines = [];
  for (const row of items) {
    const name = String(row?.name ?? '').trim();
    const unitPrice = Number(row?.unit_price);
    const qty = Number(row?.quantity);
    if (!name || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(qty) || qty < 1) {
      return res.status(400).json({ error: 'Dòng hàng không hợp lệ' });
    }
    const line = Math.round(unitPrice) * Math.round(qty);
    total += line;
    lines.push(`${name} × ${Math.round(qty)} = ${line.toLocaleString('vi-VN')}đ`);
  }
  if (total <= 0) {
    return res.status(400).json({ error: 'Tổng đơn không hợp lệ' });
  }

  const conn = await pool.getConnection();
  try {
    const [[br]] = await conn.execute(
      'SELECT id, name, address, phone FROM branches WHERE id = ? AND status = ? LIMIT 1',
      [branchId, 'active'],
    );
    if (!br) {
      return res.status(400).json({ error: 'Chi nhánh không tồn tại hoặc đã ngưng' });
    }

    const shippingAddress = [
      `Nhận tại chi nhánh: ${br.name ?? ''}`.trim(),
      br.address ? String(br.address) : '',
      br.phone ? `ĐT cửa hàng: ${br.phone}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    let noteFull = note;
    if (lines.length) {
      noteFull = [note, '---', 'Chi tiết:', ...lines].filter((s) => s !== '').join('\n');
    }

    const [[existing]] = await conn.execute(
      'SELECT id FROM users WHERE phone = ? LIMIT 1',
      [phone],
    );

    let customerId;
    if (existing) {
      customerId = existing.id;
      if (firebaseUid) {
        await conn.execute(
          'UPDATE users SET full_name = ?, firebase_uid = ? WHERE id = ?',
          [fullName, firebaseUid, customerId],
        );
      } else {
        await conn.execute('UPDATE users SET full_name = ? WHERE id = ?', [fullName, customerId]);
      }
    } else {
      const [ins] = await conn.execute(
        `
        INSERT INTO users (phone, full_name, role, status, firebase_uid)
        VALUES (?, ?, 'customer', 'available', ?)
        `,
        [phone, fullName, firebaseUid],
      );
      customerId = ins.insertId;
    }

    const [colCheck] = await conn.execute(
      `
      SELECT 1 AS ok FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'branch_id'
      LIMIT 1
      `,
    );
    const hasBranchCol = colCheck.length > 0;

    if (hasBranchCol) {
      const [insOrder] = await conn.execute(
        `
        INSERT INTO shop_orders (customer_id, total_price, shipping_address, note, status, branch_id)
        VALUES (?, ?, ?, ?, 'pending', ?)
        `,
        [customerId, total, shippingAddress, noteFull || null, branchId],
      );
      return res.status(201).json({
        ok: true,
        order_id: insOrder.insertId,
        total_price: total,
      });
    }

    const [insOrder] = await conn.execute(
      `
      INSERT INTO shop_orders (customer_id, total_price, shipping_address, note, status)
      VALUES (?, ?, ?, ?, 'pending')
      `,
      [customerId, total, shippingAddress, noteFull || null],
    );
    return res.status(201).json({
      ok: true,
      order_id: insOrder.insertId,
      total_price: total,
      warning: 'shop_orders chưa có cột branch_id — chạy lại backend để migrate',
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? 'Lỗi server' });
  } finally {
    conn.release();
  }
});

module.exports = router;
