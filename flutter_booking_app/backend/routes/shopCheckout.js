const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { normalizeVietnamPhone } = require('../lib/phoneVn');

const router = express.Router();

function formatVnpayDate(date) {
  const pad = (v) => String(v).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  return req.ip || req.connection.remoteAddress || '127.0.0.1';
}

function buildVnpayQuery(params, secretKey) {
  const data = { ...params };
  delete data.vnp_SecureHash;
  delete data.vnp_SecureHashType;
  const sortedKeys = Object.keys(data).sort();
  const rawData = sortedKeys
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&');
  const secureHash = crypto.createHmac('sha512', secretKey).update(rawData).digest('hex').toUpperCase();
  const query = sortedKeys
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&');
  return `${query}&vnp_SecureHashType=SHA512&vnp_SecureHash=${secureHash}`;
}

function verifyVnpaySignature(query, secretKey) {
  const data = { ...query };
  const received = String(data.vnp_SecureHash || '').toLowerCase();
  delete data.vnp_SecureHash;
  delete data.vnp_SecureHashType;
  const sortedKeys = Object.keys(data).sort();
  const rawData = sortedKeys
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&');
  const expected = crypto.createHmac('sha512', secretKey).update(rawData).digest('hex').toLowerCase();
  return received && expected === received;
}

function parseTxnRef(ref) {
  const m = String(ref || '').match(/^(APPT|SHOP)-(\d+)-/);
  if (!m) return null;
  return { kind: m[1], id: Number(m[2]) };
}

async function resolvePaymentByTxnRef(txnRef) {
  const parsed = parseTxnRef(txnRef);
  if (!parsed) return null;
  if (parsed.kind === 'APPT') {
    const [[row]] = await pool.execute(
      'SELECT id, total_price, payment_status, status FROM appointments WHERE id = ? LIMIT 1',
      [parsed.id],
    );
    if (!row) return null;
    return { ...parsed, table: 'appointments', row };
  }
  const [[row]] = await pool.execute(
    'SELECT id, total_price, payment_status, status FROM shop_orders WHERE id = ? LIMIT 1',
    [parsed.id],
  );
  if (!row) return null;
  return { ...parsed, table: 'shop_orders', row };
}

async function applyPaymentResult({ txnRef, success }) {
  const payment = await resolvePaymentByTxnRef(txnRef);
  if (!payment) return { ok: false, code: '01', message: 'Order not found' };

  if (success) {
    if (payment.table === 'appointments') {
      await pool.execute(
        `
        UPDATE appointments
        SET payment_method = 'vnpay',
            payment_status = 'paid',
            payment_txn_ref = ?,
            paid_at = COALESCE(paid_at, NOW()),
            status = CASE WHEN status = 'cancelled' THEN status ELSE 'completed' END
        WHERE id = ? AND payment_status <> 'paid'
        `,
        [txnRef, payment.id],
      );
    } else {
      await pool.execute(
        `
        UPDATE shop_orders
        SET payment_method = 'vnpay',
            payment_status = 'paid',
            payment_txn_ref = ?,
            paid_at = COALESCE(paid_at, NOW())
        WHERE id = ? AND payment_status <> 'paid'
        `,
        [txnRef, payment.id],
      );
    }
    return { ok: true, code: '00', message: 'Confirm Success' };
  }

  if (payment.table === 'appointments') {
    await pool.execute(
      `
      UPDATE appointments
      SET payment_method = 'vnpay',
          payment_status = CASE WHEN payment_status = 'paid' THEN payment_status ELSE 'failed' END,
          payment_txn_ref = COALESCE(payment_txn_ref, ?)
      WHERE id = ?
      `,
      [txnRef, payment.id],
    );
  } else {
    await pool.execute(
      `
      UPDATE shop_orders
      SET payment_method = 'vnpay',
          payment_status = CASE WHEN payment_status = 'paid' THEN payment_status ELSE 'failed' END,
          payment_txn_ref = COALESCE(payment_txn_ref, ?)
      WHERE id = ?
      `,
      [txnRef, payment.id],
    );
  }
  return { ok: true, code: '00', message: 'Confirm Success' };
}

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
  const paymentMethod = String(body.payment_method || 'cod').trim().toLowerCase();

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
  if (!new Set(['cod', 'vnpay']).has(paymentMethod)) {
    return res.status(400).json({ error: 'payment_method không hợp lệ (cod|vnpay)' });
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

    const isVnpay = paymentMethod === 'vnpay';
    const paymentStatus = isVnpay ? 'pending' : 'unpaid';
    let txnRef = null;
    if (hasBranchCol) {
      const [insOrder] = await conn.execute(
        `
        INSERT INTO shop_orders (
          customer_id, total_price, shipping_address, note, status, branch_id,
          payment_method, payment_status, payment_txn_ref
        )
        VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)
        `,
        [
          customerId,
          total,
          shippingAddress,
          noteFull || null,
          branchId,
          paymentMethod,
          paymentStatus,
          txnRef,
        ],
      );
      if (isVnpay) {
        txnRef = `SHOP-${insOrder.insertId}-${Date.now()}`;
        await conn.execute('UPDATE shop_orders SET payment_txn_ref = ? WHERE id = ?', [
          txnRef,
          insOrder.insertId,
        ]);
      }
      const response = {
        ok: true,
        order_id: insOrder.insertId,
        total_price: total,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
      };
      if (isVnpay) {
        const vnpayUrl = process.env.VNPAY_URL?.trim();
        const vnpayTmnCode = process.env.VNPAY_TMNCODE?.trim();
        const vnpaySecret = process.env.VNPAY_HASHSECRET?.trim();
        const vnpayReturnUrl = process.env.VNPAY_RETURN_URL?.trim();
        if (!vnpayUrl || !vnpayTmnCode || !vnpaySecret || !vnpayReturnUrl) {
          return res.status(500).json({
            error:
              'Thiếu cấu hình VNPAY. Vui lòng đặt VNPAY_URL, VNPAY_TMNCODE, VNPAY_HASHSECRET và VNPAY_RETURN_URL trong .env.',
          });
        }
        const params = {
          vnp_Version: '2.1.0',
          vnp_Command: 'pay',
          vnp_TmnCode: vnpayTmnCode,
          vnp_Amount: String(Math.round(total) * 100),
          vnp_CurrCode: 'VND',
          vnp_TxnRef: txnRef,
          vnp_OrderInfo: `Thanh toán đơn hàng #${insOrder.insertId}`,
          vnp_OrderType: 'other',
          vnp_Locale: 'vn',
          vnp_ReturnUrl: vnpayReturnUrl,
          vnp_CreateDate: formatVnpayDate(new Date()),
          vnp_IpAddr: getClientIp(req),
          vnp_SecureHashType: 'SHA512',
        };
        response.payment_url = `${vnpayUrl}?${buildVnpayQuery(params, vnpaySecret)}`;
      }
      return res.status(201).json(response);
    }

    const [insOrder] = await conn.execute(
      `
      INSERT INTO shop_orders (
        customer_id, total_price, shipping_address, note, status,
        payment_method, payment_status, payment_txn_ref
      )
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
      `,
      [customerId, total, shippingAddress, noteFull || null, paymentMethod, paymentStatus, null],
    );
    if (isVnpay) {
      txnRef = `SHOP-${insOrder.insertId}-${Date.now()}`;
      await conn.execute('UPDATE shop_orders SET payment_txn_ref = ? WHERE id = ?', [
        txnRef,
        insOrder.insertId,
      ]);
    }
    const response = {
      ok: true,
      order_id: insOrder.insertId,
      total_price: total,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      warning: 'shop_orders chưa có cột branch_id — chạy lại backend để migrate',
    };
    if (isVnpay) {
      const vnpayUrl = process.env.VNPAY_URL?.trim();
      const vnpayTmnCode = process.env.VNPAY_TMNCODE?.trim();
      const vnpaySecret = process.env.VNPAY_HASHSECRET?.trim();
      const vnpayReturnUrl = process.env.VNPAY_RETURN_URL?.trim();
      if (!vnpayUrl || !vnpayTmnCode || !vnpaySecret || !vnpayReturnUrl) {
        return res.status(500).json({
          error:
            'Thiếu cấu hình VNPAY. Vui lòng đặt VNPAY_URL, VNPAY_TMNCODE, VNPAY_HASHSECRET và VNPAY_RETURN_URL trong .env.',
        });
      }
      const params = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: vnpayTmnCode,
        vnp_Amount: String(Math.round(total) * 100),
        vnp_CurrCode: 'VND',
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: `Thanh toán đơn hàng #${insOrder.insertId}`,
        vnp_OrderType: 'other',
        vnp_Locale: 'vn',
        vnp_ReturnUrl: vnpayReturnUrl,
        vnp_CreateDate: formatVnpayDate(new Date()),
        vnp_IpAddr: getClientIp(req),
        vnp_SecureHashType: 'SHA512',
      };
      response.payment_url = `${vnpayUrl}?${buildVnpayQuery(params, vnpaySecret)}`;
    }
    return res.status(201).json(response);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? 'Lỗi server' });
  } finally {
    conn.release();
  }
});

router.get('/shop/orders/:id/payment-status', async (req, res) => {
  const orderId = Number(req.params.id);
  if (!orderId || orderId <= 0) return res.status(400).json({ error: 'order_id không hợp lệ' });
  try {
    const [[row]] = await pool.execute(
      `
      SELECT id, status, payment_method, payment_status, payment_txn_ref, paid_at
      FROM shop_orders
      WHERE id = ?
      LIMIT 1
      `,
      [orderId],
    );
    if (!row) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    return res.json({ order: row });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message ?? 'Lỗi server' });
  }
});

router.get('/shop/vnpay/ipn', async (req, res) => {
  const vnpaySecret = process.env.VNPAY_HASHSECRET?.trim();
  if (!vnpaySecret) return res.json({ RspCode: '97', Message: 'Missing config' });
  try {
    const validSign = verifyVnpaySignature(req.query, vnpaySecret);
    if (!validSign) return res.json({ RspCode: '97', Message: 'Invalid signature' });

    const txnRef = String(req.query.vnp_TxnRef || '');
    const amount = Number(req.query.vnp_Amount || 0);
    const responseCode = String(req.query.vnp_ResponseCode || '');
    const txnStatus = String(req.query.vnp_TransactionStatus || '');
    const payment = await resolvePaymentByTxnRef(txnRef);
    if (!payment) return res.json({ RspCode: '01', Message: 'Order not found' });

    const expectedAmount = Math.round(Number(payment.row.total_price || 0)) * 100;
    if (expectedAmount <= 0 || expectedAmount !== amount) {
      return res.json({ RspCode: '04', Message: 'Invalid amount' });
    }
    const success = responseCode === '00' && txnStatus === '00';
    const applied = await applyPaymentResult({ txnRef, success });
    return res.json({ RspCode: applied.code, Message: applied.message });
  } catch (e) {
    console.error(e);
    return res.json({ RspCode: '99', Message: 'Unknown error' });
  }
});

router.get('/shop/vnpay/return', async (req, res) => {
  const vnpaySecret = process.env.VNPAY_HASHSECRET?.trim();
  if (!vnpaySecret) return res.status(500).json({ error: 'Thiếu cấu hình VNPAY_HASHSECRET' });
  try {
    const validSign = verifyVnpaySignature(req.query, vnpaySecret);
    if (!validSign) return res.status(400).json({ ok: false, message: 'Sai chữ ký VNPAY' });

    const txnRef = String(req.query.vnp_TxnRef || '');
    const responseCode = String(req.query.vnp_ResponseCode || '');
    const txnStatus = String(req.query.vnp_TransactionStatus || '');
    const success = responseCode === '00' && txnStatus === '00';
    const applied = await applyPaymentResult({ txnRef, success });
    if (!applied.ok) return res.status(404).json({ ok: false, message: applied.message });
    return res.json({
      ok: success,
      txn_ref: txnRef,
      payment_status: success ? 'paid' : 'failed',
      vnp_response_code: responseCode,
      vnp_transaction_status: txnStatus,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: e.message ?? 'Lỗi xử lý return VNPAY' });
  }
});

module.exports = router;
