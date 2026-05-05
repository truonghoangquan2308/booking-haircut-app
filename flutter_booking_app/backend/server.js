// server.js
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const pool    = require('./db');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swaggerSpec');
const { normalizeVietnamPhone } = require('./lib/phoneVn');
const { ensureShopsTable } = require('./lib/ensureShopsTable');
const {
  ensureSchemaExtensions,
  ensureShopOrdersBranchId,
  ensureShopOrdersStatusEnumCompleted,
  ensureStockHistoryTable,
} = require('./lib/ensureSchemaExtensions');
const { runUserPhoneDedupeAndNormalize } = require('./lib/migrateUserPhones');
const { syncBarberRatingsFromReviews } = require('./lib/syncBarberRatings');
const { ensureOffersTable } = require('./lib/ensureOffersTable');
const { ensureUsedPromotionsTable } = require('./lib/ensureUsedPromotionsTable');
const { ensureAdminAuditLogTable } = require('./lib/adminAuditLog');
const { normalizeBarberBio } = require('./lib/barberBio');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const uploadStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `user_${req.params.id}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const mt = (file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const imgExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic'].includes(ext);
    // Flutter/Android thường gửi application/octet-stream; đôi khi MIME rỗng (file tạm không đuôi)
    const ok =
      mt.startsWith('image/') ||
      mt === 'application/octet-stream' ||
      (mt === '' && imgExt);
    cb(null, ok);
  },
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

// Swagger UI for API testing (group operations by OpenAPI tags)
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: { docExpansion: 'list' },
  }),
);

app.use('/api/services', require('./routes/services'));
// Đăng ký trước các router /api khác để GET /api/branches luôn khớp (tránh 404).
app.use('/api', require('./routes/branchesPublic'));
app.use('/api', require('./routes/shopCheckout'));
app.use('/api', require('./routes/shopProductsRoutesFixed'));
app.use('/api', require('./routes/appointments'));
app.use('/api/owner', require('./routes/ownerAnalytics'));
app.use('/api/owner', require('./routes/ownerOffers'));
app.use('/api/owner', require('./routes/ownerBarbers'));
app.use('/api', require('./routes/offersPublic'));
app.use('/api/admin', require('./routes/adminShopsApi'));
app.use('/api/admin', require('./routes/adminPlatform'));
app.use('/api/manager', require('./routes/managerOps'));

// ─────────────────────────────────────────────
// BARBERS (theo schema: barbers JOIN users)
// ─────────────────────────────────────────────

// GET /api/barbers?branch_id=
// Trả về danh sách thợ: barber_id + user info + is_available + rating...
app.get('/api/barbers', async (req, res) => {
  try {
    // DB mới: `users.status` ENUM('available','off'), không còn `users.is_available`.
    const [cols] = await pool.execute('SHOW COLUMNS FROM users');
    const colNames = cols.map((c) => c.Field);
    if (!colNames.includes('status')) {
      await pool.execute(
        "ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'available'",
      );
    }

    // Nếu có user role=barber nhưng chưa có dòng `barbers`, tự tạo để luồng đặt lịch chạy được.
    await pool.execute(
      `
      INSERT INTO barbers (user_id, bio, is_available)
      SELECT
        u.id AS user_id,
        NULL AS bio,
        CASE
          WHEN u.status IN ('available', 'Đang Làm') THEN 1
          ELSE 0
        END AS is_available
      FROM users u
      LEFT JOIN barbers b ON b.user_id = u.id
      WHERE u.role = 'barber' AND b.id IS NULL
      `,
    );

    const [branchCol] = await pool.execute(
      `
      SELECT 1 AS ok FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'barbers' AND COLUMN_NAME = 'branch_id'
      LIMIT 1
      `,
    );
    const hasBranchId = branchCol.length > 0;
    const branchFilter = req.query.branch_id != null && String(req.query.branch_id).trim() !== ''
      ? Number(req.query.branch_id)
      : NaN;
    const useBranchFilter = hasBranchId && Number.isFinite(branchFilter) && branchFilter > 0;

    const branchSelect = hasBranchId ? 'b.branch_id     AS branch_id,\n        ' : '';
    const whereBranch = useBranchFilter ? ' AND b.branch_id = ?' : '';
    const params = useBranchFilter ? [branchFilter] : [];

    const [rows] = await pool.execute(
      `
      SELECT
        b.id            AS barber_id,
        ${branchSelect}b.user_id       AS user_id,
        b.bio           AS bio,
        b.rating        AS rating,
        b.total_reviews AS total_reviews,
        b.is_available  AS is_available,
        u.full_name     AS full_name,
        u.phone         AS phone,
        u.avatar_url    AS avatar_url,
        u.status        AS status,
        (CASE WHEN u.status = 'available' OR u.status = 'Đang Làm' THEN 1 ELSE 0 END) AS user_is_available,
        u.created_at    AS created_at
      FROM barbers b
      JOIN users u ON u.id = b.user_id
      WHERE 1=1${whereBranch}
      ORDER BY b.created_at DESC
      `,
      params,
    );
    return res.status(200).json({ status: 'success', data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/barbers/by-user/:userId — một dòng thợ theo users.id (app thợ: tránh GET /api/barbers nặng)
app.get('/api/barbers/by-user/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (!userId || userId <= 0) {
    return res.status(400).json({ error: 'userId không hợp lệ' });
  }
  try {
    const [branchCol] = await pool.execute(
      `
      SELECT 1 AS ok FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'barbers' AND COLUMN_NAME = 'branch_id'
      LIMIT 1
      `,
    );
    const hasBranchId = branchCol.length > 0;
    const branchSelect = hasBranchId ? 'b.branch_id     AS branch_id,\n        ' : '';

    const [rows] = await pool.execute(
      `
      SELECT
        b.id            AS barber_id,
        ${branchSelect}b.user_id       AS user_id,
        b.bio           AS bio,
        b.rating        AS rating,
        b.total_reviews AS total_reviews,
        b.is_available  AS is_available,
        u.full_name     AS full_name,
        u.phone         AS phone,
        u.avatar_url    AS avatar_url,
        u.status        AS status,
        (CASE WHEN u.status = 'available' OR u.status = 'Đang Làm' THEN 1 ELSE 0 END) AS user_is_available,
        u.created_at    AS created_at
      FROM barbers b
      JOIN users u ON u.id = b.user_id
      WHERE b.user_id = ?
      LIMIT 1
      `,
      [userId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thợ theo user_id' });
    }
    return res.status(200).json({ status: 'success', barber: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/barbers
// Body: { full_name, phone, is_available, status, bio, branch_id? }
// branch_id (tuỳ chọn): gán chi nhánh để GET /api/owner/barbers hiển thị đúng (INNER JOIN theo owner)
app.post('/api/barbers', async (req, res) => {
  const { full_name, phone, bio, is_available, branch_id } = req.body;
  const bioNorm = normalizeBarberBio(bio);

  const phoneNorm = normalizeVietnamPhone(phone);
  if (!phoneNorm) return res.status(400).json({ error: 'Thiếu phone' });

  const available = `${is_available ?? '1'}` === '1' ? 1 : 0;
  let branchIdVal = null;
  if (branch_id != null && String(branch_id).trim() !== '') {
    const n = Number(branch_id);
    if (Number.isFinite(n) && n > 0) branchIdVal = n;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) upsert user theo phone (role barber)
    const [existUsers] = await conn.execute(
      'SELECT * FROM users WHERE phone = ? LIMIT 1',
      [phoneNorm],
    );

    let userId;
    if (existUsers.length > 0) {
      userId = existUsers[0].id;
      if (branchIdVal != null) {
        await conn.execute(
          'UPDATE users SET role = ?, full_name = COALESCE(?, full_name), branch_id = ? WHERE id = ?',
          ['barber', full_name ?? null, branchIdVal, userId],
        );
      } else {
        await conn.execute(
          'UPDATE users SET role = ?, full_name = COALESCE(?, full_name) WHERE id = ?',
          ['barber', full_name ?? null, userId],
        );
      }
    } else {
      if (branchIdVal != null) {
        const [ins] = await conn.execute(
          'INSERT INTO users (phone, full_name, role, branch_id) VALUES (?, ?, ?, ?)',
          [phoneNorm, full_name ?? null, 'barber', branchIdVal],
        );
        userId = ins.insertId;
      } else {
        const [ins] = await conn.execute(
          'INSERT INTO users (phone, full_name, role) VALUES (?, ?, ?)',
          [phoneNorm, full_name ?? null, 'barber'],
        );
        userId = ins.insertId;
      }
    }

    // 2) ensure barbers row
    const [existBarbers] = await conn.execute(
      'SELECT * FROM barbers WHERE user_id = ? LIMIT 1',
      [userId],
    );

    let barberId;
    if (existBarbers.length > 0) {
      barberId = existBarbers[0].id;
      if (branchIdVal != null) {
        await conn.execute(
          'UPDATE barbers SET branch_id = ?, is_available = ?, bio = COALESCE(?, bio) WHERE id = ?',
          [branchIdVal, available, bioNorm, barberId],
        );
      } else {
        await conn.execute(
          'UPDATE barbers SET is_available = ?, bio = COALESCE(?, bio) WHERE id = ?',
          [available, bioNorm, barberId],
        );
      }
    } else {
      const [insB] = await conn.execute(
        'INSERT INTO barbers (user_id, branch_id, bio, is_available) VALUES (?, ?, ?, ?)',
        [userId, branchIdVal, bioNorm, available],
      );
      barberId = insB.insertId;
    }

    await conn.execute('UPDATE users SET status = ? WHERE id = ?', [
      available ? 'available' : 'off',
      userId,
    ]);

    await conn.commit();

    const [rows] = await conn.execute(
      `
      SELECT
        b.id            AS barber_id,
        b.user_id       AS user_id,
        b.bio           AS bio,
        b.rating        AS rating,
        b.total_reviews AS total_reviews,
        b.is_available  AS is_available,
        u.full_name     AS full_name,
        u.phone         AS phone,
        u.avatar_url    AS avatar_url,
        u.status        AS status,
        (CASE WHEN u.status = 'available' OR u.status = 'Đang Làm' THEN 1 ELSE 0 END) AS user_is_available,
        u.created_at    AS created_at
      FROM barbers b
      JOIN users u ON u.id = b.user_id
      WHERE b.id = ?
      LIMIT 1
      `,
      [barberId],
    );

    return res.status(201).json({ status: 'success', barber: rows[0] });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// PUT /api/barbers/:barberId/availability
// Body: { is_available: 0|1 }
app.put('/api/barbers/:barberId/availability', async (req, res) => {
  const { barberId } = req.params;
  const { is_available } = req.body;

  const available = `${is_available ?? ''}` === '1' ? 1 : 0;

  try {
    await pool.execute(
      'UPDATE barbers SET is_available = ? WHERE id = ?',
      [available, barberId],
    );

    const [[bu]] = await pool.execute(
      'SELECT user_id FROM barbers WHERE id = ? LIMIT 1',
      [barberId],
    );
    if (bu?.user_id != null) {
      await pool.execute('UPDATE users SET status = ? WHERE id = ?', [
        available ? 'available' : 'off',
        bu.user_id,
      ]);
    }

    const [rows] = await pool.execute(
      `
      SELECT
        b.id            AS barber_id,
        b.user_id       AS user_id,
        b.bio           AS bio,
        b.rating        AS rating,
        b.total_reviews AS total_reviews,
        b.is_available  AS is_available,
        u.full_name     AS full_name,
        u.phone         AS phone,
        u.avatar_url    AS avatar_url,
        u.status        AS status,
        (CASE WHEN u.status = 'available' OR u.status = 'Đang Làm' THEN 1 ELSE 0 END) AS user_is_available,
        u.created_at    AS created_at
      FROM barbers b
      JOIN users u ON u.id = b.user_id
      WHERE b.id = ?
      LIMIT 1
      `,
      [barberId],
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy barber' });
    return res.status(200).json({ status: 'success', barber: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/users/verify
// ─────────────────────────────────────────────
app.post('/api/users/verify', async (req, res) => {
  const { phone, firebase_uid, role: rawRole = 'customer' } = req.body;
  const allowedRoles = new Set(['customer', 'barber', 'receptionist', 'manager', 'owner', 'admin']);
  const role = allowedRoles.has(String(rawRole || '').toLowerCase())
    ? String(rawRole).toLowerCase()
    : 'customer';

  const phoneNorm = normalizeVietnamPhone(phone);
  if (!phoneNorm || !firebase_uid) {
    return res.status(400).json({ error: 'Thiếu phone hoặc firebase_uid' });
  }

  try {
    await pool.execute(
      `INSERT INTO users (phone, firebase_uid, role, status)
       VALUES (?, ?, ?, 'available')
       ON DUPLICATE KEY UPDATE firebase_uid = VALUES(firebase_uid)`,
      [phoneNorm, firebase_uid, role],
    );

    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE phone = ?',
      [phoneNorm],
    );

    return res.status(200).json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('Chi tiết lỗi:', err.code, err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/users/by-firebase/:firebaseUid
// 员工门户 Web：Firebase 登录后用 UID 对齐数据库角色（须注册在 /api/users/:phone 之前）
// ─────────────────────────────────────────────
app.get('/api/users/by-firebase/:firebaseUid', async (req, res) => {
  const firebaseUid = decodeURIComponent(req.params.firebaseUid || '').trim();
  if (!firebaseUid) {
    return res.status(400).json({ error: 'Thiếu firebase_uid' });
  }
  try {
    const [rows] = await pool.execute(
      `
      SELECT id, phone, email, firebase_uid, full_name, avatar_url, role, status,
             branch_id,
             COALESCE(is_locked, 0) AS is_locked,
             created_at
      FROM users
      WHERE firebase_uid = ?
      LIMIT 1
      `,
      [firebaseUid],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy user trong hệ thống' });
    }
    return res.status(200).json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message ?? 'Lỗi server' });
  }
});

// ─────────────────────────────────────────────
// GET /api/users/:phone
// ─────────────────────────────────────────────
app.get('/api/users/:phone', async (req, res) => {
  let rawPhone = String(req.params.phone ?? '').trim();
  const normalizedPhone = normalizeVietnamPhone(rawPhone);
  
  // LOGGING FOR DIAGNOSIS
  try {
    const logPath = path.join(__dirname, 'backend_debug.log');
    const logTime = new Date().toISOString();
    fs.appendFileSync(logPath, `[${logTime}] GET /api/users/:phone -> raw: ${rawPhone}, norm: ${normalizedPhone}\n`);
  } catch (_) {}

  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE phone = ?',
      [normalizedPhone],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy user' });
    }

    return res.status(200).json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─────────────────────────────────────────────
// GET /api/users?role=barber
// Lấy danh sách user theo role (customer/barber/admin)
// ─────────────────────────────────────────────
app.get('/api/users', async (req, res) => {
  const { role } = req.query;

  if (!role) {
    return res.status(400).json({ error: 'Thiếu role' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE role = ? ORDER BY created_at DESC',
      [role],
    );

    return res.status(200).json({ status: 'success', users: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Alias cho admin panel (nếu frontend gọi /api/admin/users)
app.get('/api/admin/users', async (req, res) => {
  const { role } = req.query;

  if (!role) {
    return res.status(400).json({ error: 'Thiếu role' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE role = ? ORDER BY created_at DESC',
      [role],
    );

    return res.status(200).json({ status: 'success', users: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// PUT /api/users/:id
// Cập nhật thông tin user
// Body: { full_name, avatar_url, date_of_birth, phone }
// ─────────────────────────────────────────────
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { full_name, avatar_url, date_of_birth, phone } = req.body;
  const phoneNorm =
    phone != null && String(phone).trim() !== ''
      ? normalizeVietnamPhone(phone)
      : null;

  try {
    await pool.execute(
      `UPDATE users SET
        full_name     = COALESCE(?, full_name),
        avatar_url    = COALESCE(?, avatar_url),
        date_of_birth = COALESCE(?, date_of_birth),
        phone         = COALESCE(?, phone)
       WHERE id = ?`,
      [
        full_name ?? null,
        avatar_url ?? null,
        date_of_birth ?? null,
        phoneNorm,
        id,
      ],
    );

    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy user' });
    }

    return res.status(200).json({ success: true, user: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// PUT /api/users/:id/status
// Cập nhật trạng thái thợ (barber) trong users table
// Body: { status: 'available' | 'off' }
// ─────────────────────────────────────────────
app.put('/api/users/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['available', 'off'].includes(status)) {
    return res.status(400).json({ error: 'status phải là available hoặc off' });
  }

  try {
    const [cols] = await pool.execute('SHOW COLUMNS FROM users');
    const colNames = cols.map((c) => c.Field);
    if (!colNames.includes('status')) {
      await pool.execute(
        "ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'available'",
      );
    }

    await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);

    const barberAvail = status === 'available' ? 1 : 0;
    await pool.execute(
      'UPDATE barbers SET is_available = ? WHERE user_id = ?',
      [barberAvail, id],
    );

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy user' });

    return res.status(200).json({ success: true, user: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/users/:id/avatar  (multipart field name: avatar)
// ─────────────────────────────────────────────
app.post('/api/users/:id/avatar', upload.single('avatar'), async (req, res) => {
  const { id } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'Thiếu file ảnh hoặc định dạng không hợp lệ' });
  }
  const host = req.get('host') || `localhost:${PORT}`;
  const publicUrl = `${req.protocol}://${host}/uploads/${req.file.filename}`;
  try {
    await pool.execute(
      'UPDATE users SET avatar_url = ? WHERE id = ?',
      [publicUrl, id],
    );
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy user' });
    }
    return res.status(200).json({ success: true, user: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// REVIEWS
// POST /api/reviews
// Body: { appointment_id, customer_id, barber_id, rating, comment }
// ─────────────────────────────────────────────
app.get('/api/reviews', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT
        r.id,
        r.appointment_id,
        r.customer_id,
        r.barber_id,
        r.rating,
        r.comment,
        r.created_at,
        uc.full_name AS customer_name,
        uc.avatar_url AS customer_avatar_url,
        ub.full_name AS barber_name
      FROM reviews r
      LEFT JOIN users uc ON uc.id = r.customer_id
      LEFT JOIN barbers b ON b.id = r.barber_id
      LEFT JOIN users ub ON ub.id = b.user_id
      ORDER BY r.created_at DESC
      `,
    );
    return res.status(200).json({ reviews: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message ?? 'Server error' });
  }
});

app.get('/api/reviews/barber/:barberId', async (req, res) => {
  const barberId = Number(req.params.barberId);
  if (!Number.isFinite(barberId) || barberId <= 0) {
    return res.status(400).json({ error: 'barberId không hợp lệ' });
  }

  try {
    const [rows] = await pool.execute(
      `
      SELECT
        r.id,
        r.appointment_id,
        r.customer_id,
        r.barber_id,
        r.rating,
        r.comment,
        r.created_at,
        uc.full_name AS customer_name,
        uc.avatar_url AS customer_avatar_url
      FROM reviews r
      LEFT JOIN users uc ON uc.id = r.customer_id
      WHERE r.barber_id = ?
      ORDER BY r.created_at DESC
      `,
      [barberId],
    );
    return res.status(200).json({ reviews: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message ?? 'Server error' });
  }
});

app.post('/api/reviews', async (req, res) => {
  const {
    appointment_id,
    customer_id,
    barber_id,
    rating,
    comment,
  } = req.body ?? {};

  const appointmentId = Number(appointment_id);
  const customerId = Number(customer_id);
  const barberId = Number(barber_id);
  const ratingNum = Number(rating);

  if (!appointmentId || appointmentId <= 0) {
    return res.status(400).json({ error: 'Thiếu appointment_id' });
  }
  if (!customerId || customerId <= 0) {
    return res.status(400).json({ error: 'Thiếu customer_id' });
  }
  if (!barberId || barberId <= 0) {
    return res.status(400).json({ error: 'Thiếu barber_id' });
  }
  if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'rating phải từ 1 đến 5' });
  }

  try {
    await pool.execute(
      `
      INSERT INTO reviews (appointment_id, customer_id, barber_id, rating, comment)
      VALUES (?, ?, ?, ?, ?)
      `,
      [appointmentId, customerId, barberId, Math.floor(ratingNum), comment ?? null],
    );

    const [aggRows] = await pool.execute(
      `
      SELECT
        ROUND(COALESCE(AVG(rating), 0), 1) AS avgRating,
        COUNT(*) AS totalReviews
      FROM reviews
      WHERE barber_id = ?
      `,
      [barberId],
    );
    const row = aggRows[0] ?? {};
    const avgRating = Number(row.avgRating ?? row.avg_rating ?? 0);
    const totalReviews = Number(row.totalReviews ?? row.total_reviews ?? 0);

    await pool.execute(
      `UPDATE barbers SET rating = ?, total_reviews = ? WHERE id = ?`,
      [avgRating, totalReviews, barberId],
    );

    return res.status(201).json({ status: 'success' });
  } catch (err) {
    const msg = (err?.message ?? '').toLowerCase();
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return res.status(400).json({ error: 'Lịch này đã được đánh giá' });
    }
    console.error(err);
    return res.status(500).json({ error: err.message ?? 'Server error' });
  }
});

// ─────────────────────────────────────────────
app.get('/test', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  try {
    await ensureShopsTable();
    console.log('Đã chạy ensureShopsTable (bỏ qua nếu DB dùng bảng branches).');
  } catch (e) {
    console.error('ensureShopsTable:', e.message);
  }
  try {
    await ensureSchemaExtensions();
    console.log('Đã chạy ensureSchemaExtensions (is_locked; shop_id chỉ khi có shops).');
  } catch (e) {
    console.error('ensureSchemaExtensions:', e.message);
  }
  try {
    await ensureShopOrdersBranchId();
    console.log('Đã chạy ensureShopOrdersBranchId (shop_orders.branch_id).');
  } catch (e) {
    console.error('ensureShopOrdersBranchId:', e.message);
  }
  try {
    await ensureShopOrdersStatusEnumCompleted();
    console.log('Đã chạy ensureShopOrdersStatusEnumCompleted (completed trong ENUM).');
  } catch (e) {
    console.error('ensureShopOrdersStatusEnumCompleted:', e.message);
  }
  try {
    await ensureStockHistoryTable();
    console.log('Đã chạy ensureStockHistoryTable (bảng stock_history).');
  } catch (e) {
    console.error('ensureStockHistoryTable:', e.message);
  }
  try {
    await runUserPhoneDedupeAndNormalize(pool);
    console.log('Đã chạy gộp SĐT trùng (customer) + chuẩn hoá users.phone.');
  } catch (e) {
    console.error('runUserPhoneDedupeAndNormalize:', e.message);
  }
  try {
    await syncBarberRatingsFromReviews();
    console.log('Đã đồng bộ barbers.rating / total_reviews từ reviews.');
  } catch (e) {
    console.error('syncBarberRatingsFromReviews:', e.message);
  }
  try {
    await ensureOffersTable();
    console.log('Đã chạy ensureOffersTable (offers).');
  } catch (e) {
    console.error('ensureOffersTable:', e.message);
  }
  try {
    await ensureUsedPromotionsTable();
    console.log('Đã chạy ensureUsedPromotionsTable (used_promotions).');
  } catch (e) {
    console.error('ensureUsedPromotionsTable:', e.message);
  }
  try {
    await ensureAdminAuditLogTable();
    console.log('Đã chạy ensureAdminAuditLogTable (admin_audit_logs).');
  } catch (e) {
    console.error('ensureAdminAuditLogTable:', e.message);
  }
  app.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
  });
}

start();
process.stdin.resume();