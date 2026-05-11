const express = require('express');
const pool = require('../db');
const { normalizeVietnamPhone } = require('../lib/phoneVn');

const router = express.Router();

async function resolveCustomer({ firebaseUid, phone, fullName }) {
  let customerId = null;
  let customerPhone = phone ? normalizeVietnamPhone(phone) : null;

  if (firebaseUid && firebaseUid.trim()) {
    const [rows] = await pool.execute(
      'SELECT id, phone FROM users WHERE firebase_uid = ? LIMIT 1',
      [firebaseUid.trim()],
    );
    if (rows.length > 0) {
      customerId = rows[0].id;
      if (!customerPhone && rows[0].phone) {
        customerPhone = rows[0].phone;
      }
    }
  }

  if (!customerId && customerPhone) {
    const [rows] = await pool.execute(
      'SELECT id FROM users WHERE phone = ? LIMIT 1',
      [customerPhone],
    );
    if (rows.length > 0) {
      customerId = rows[0].id;
    }
  }

  if (!customerId) {
    if (!customerPhone && (!firebaseUid || !firebaseUid.trim())) {
      return null;
    }
    const [insertResult] = await pool.execute(
      'INSERT INTO users (phone, full_name, firebase_uid, role) VALUES (?, ?, ?, "customer")',
      [customerPhone || null, fullName || null, firebaseUid || null],
    );
    customerId = insertResult.insertId;
  } else if (firebaseUid && firebaseUid.trim()) {
    await pool.execute(
      'UPDATE users SET firebase_uid = ? WHERE id = ? AND (firebase_uid IS NULL OR firebase_uid = "")',
      [firebaseUid.trim(), customerId],
    );
  }

  return customerId;
}

function formatMessage(row) {
  return {
    id: row.id,
    sender: row.sender,
    message: row.message,
    is_read: row.is_read === 1,
    created_at: row.created_at,
  };
}

router.post('/', async (req, res) => {
  const { branch_id: branchId, message, firebase_uid: firebaseUid, phone, full_name: fullName } = req.body ?? {};
  if (!branchId || !message || !message.toString().trim()) {
    return res.status(400).json({ error: 'branch_id và message là bắt buộc' });
  }

  try {
    const [branchRows] = await pool.execute('SELECT id FROM branches WHERE id = ? LIMIT 1', [branchId]);
    if (!branchRows.length) {
      return res.status(404).json({ error: 'Chi nhánh không tồn tại' });
    }

    const customerId = await resolveCustomer({ firebaseUid, phone, fullName });
    if (!customerId) {
      return res.status(400).json({ error: 'Không xác định được khách hàng (firebase_uid hoặc phone required)' });
    }

    await pool.execute(
      'INSERT INTO chat_messages (branch_id, customer_id, sender, message) VALUES (?, ?, "customer", ?)',
      [branchId, customerId, message.toString().trim()],
    );

    const [rows] = await pool.execute(
      `SELECT id, sender, message, created_at
       FROM chat_messages
       WHERE branch_id = ? AND customer_id = ?
       ORDER BY created_at ASC, id ASC`,
      [branchId, customerId],
    );

    return res.json({
      customer_id: customerId,
      messages: rows.map(formatMessage),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

router.get('/', async (req, res) => {
  const branchId = Number(req.query.branch_id || 0);
  const firebaseUid = String(req.query.firebase_uid || '').trim();
  const customerId = Number(req.query.customer_id || 0);
  const phone = String(req.query.phone || '').trim();

  if (!branchId) {
    return res.status(400).json({ error: 'branch_id là bắt buộc' });
  }

  try {
    let resolvedCustomerId = customerId > 0 ? customerId : null;
    if (!resolvedCustomerId) {
      resolvedCustomerId = await resolveCustomer({ firebaseUid, phone });
    }
    if (!resolvedCustomerId) {
      return res.status(400).json({ error: 'Không xác định được khách hàng' });
    }

    await pool.execute(
      'UPDATE chat_messages SET is_read = 1 WHERE branch_id = ? AND customer_id = ? AND sender = "receptionist" AND is_read = 0',
      [branchId, resolvedCustomerId],
    );

    const [rows] = await pool.execute(
      `SELECT id, sender, message, is_read, created_at
       FROM chat_messages
       WHERE branch_id = ? AND customer_id = ?
       ORDER BY created_at ASC, id ASC`,
      [branchId, resolvedCustomerId],
    );

    return res.json({
      customer_id: resolvedCustomerId,
      messages: rows.map(formatMessage),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
