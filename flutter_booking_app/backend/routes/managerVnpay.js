const express = require('express');
const crypto = require('crypto');
const qs = require('qs');
const pool = require('../db');

const router = express.Router();

function formatVnpayDate(date) {
  const pad = (value) => String(value).padStart(2, '0');
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
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  // ✅ Chuyển IPv6 loopback -> IPv4
  return ip === '::1' ? '127.0.0.1' : ip;
}

// ✅ Copy y chang từ official VNPay Node.js demo
function sortObject(obj) {
  const sorted = {};
  const str = Object.keys(obj).map((key) => encodeURIComponent(key));
  str.sort();
  for (const key of str) {
    sorted[key] = encodeURIComponent(obj[decodeURIComponent(key)]).replace(/%20/g, '+');
  }
  return sorted;
}

function buildVnpayQuery(params, secretKey) {
  const data = { ...params };
  delete data.vnp_SecureHash;
  delete data.vnp_SecureHashType;

  const sortedParams = sortObject(data);
  const signData = qs.stringify(sortedParams, { encode: false });

  const hmac = crypto.createHmac('sha512', secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  sortedParams['vnp_SecureHash'] = signed;
  return qs.stringify(sortedParams, { encode: false });
}
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
            'Owner chưa có chi nhánh: đặt branches.owner_id trùng id user owner trong DB.',
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

router.post('/vnpay/checkout', requireManagerOrOwner, requireManagerBranch, async (req, res) => {
  const appointmentId = Number(req.body?.appointment_id);
  if (!appointmentId || appointmentId <= 0) {
    return res.status(400).json({ error: 'appointment_id không hợp lệ' });
  }

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

  try {
    const [[appointment]] = await pool.execute(
      `
      SELECT a.id, a.total_price, a.status, a.branch_id,
             u.full_name AS customer_name, u.phone AS customer_phone,
             s.name AS service_name
      FROM appointments a
      JOIN users u ON u.id = a.customer_id
      JOIN services s ON s.id = a.service_id
      WHERE a.id = ?
      LIMIT 1
      `,
      [appointmentId],
    );

    if (!appointment) {
      return res.status(404).json({ error: 'Không tìm thấy lịch hẹn' });
    }
    if (Number(appointment.branch_id) !== req.managerBranchId) {
      return res.status(403).json({ error: 'Lịch hẹn không thuộc chi nhánh của bạn' });
    }

    const totalPrice = Number(appointment.total_price);
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      return res.status(400).json({ error: 'Giá trị lịch hẹn không hợp lệ' });
    }

    const txnRef = `APPT-${appointmentId}-${Date.now()}`;
    const amount = Math.round(totalPrice) * 100;
    const createDate = formatVnpayDate(new Date());
    const ipAddr = getClientIp(req);

    await pool.execute(
      `
      UPDATE appointments
      SET payment_method = 'vnpay',
          payment_status = CASE WHEN payment_status = 'paid' THEN payment_status ELSE 'pending' END,
          payment_txn_ref = ?
      WHERE id = ?
      `,
      [txnRef, appointmentId],
    );

    const params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: vnpayTmnCode,
      vnp_Amount: String(amount),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Thanh toán lịch hẹn ${appointmentId} - ${appointment.service_name}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: vnpayReturnUrl,
      vnp_CreateDate: createDate,
      vnp_IpAddr: ipAddr,
    };

    const query = buildVnpayQuery(params, vnpaySecret);
    const paymentUrl = `${vnpayUrl}?${query}`;
    console.log('\n=== VNPAY PAYMENT URL ===');
    console.log(paymentUrl);
    console.log('========================\n');
    return res.json({ payment_url: paymentUrl });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Lỗi tạo thanh toán VNPAY' });
  }
});

router.get('/appointments/:id/payment-status', requireManagerOrOwner, requireManagerBranch, async (req, res) => {
  const appointmentId = Number(req.params.id);
  if (!appointmentId || appointmentId <= 0) {
    return res.status(400).json({ error: 'appointment_id không hợp lệ' });
  }
  try {
    const [[row]] = await pool.execute(
      `
      SELECT id, branch_id, status, payment_method, payment_status, payment_txn_ref, paid_at
      FROM appointments
      WHERE id = ?
      LIMIT 1
      `,
      [appointmentId],
    );
    if (!row) return res.status(404).json({ error: 'Không tìm thấy lịch hẹn' });
    if (Number(row.branch_id) !== req.managerBranchId) {
      return res.status(403).json({ error: 'Lịch hẹn không thuộc chi nhánh của bạn' });
    }
    return res.json({ appointment: row });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Lỗi tải trạng thái thanh toán' });
  }
});

module.exports = router;
