// server.js
const express = require('express');
const cors    = require('cors');
const pool    = require('./db');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// SQL khởi tạo bảng (chạy 1 lần)
// ─────────────────────────────────────────────
// CREATE TABLE IF NOT EXISTS users (
//   id           INT AUTO_INCREMENT PRIMARY KEY,
//   phone        VARCHAR(20) UNIQUE NOT NULL,
//   firebase_uid VARCHAR(128) UNIQUE,
//   role         ENUM('customer','barber') DEFAULT 'customer',
//   created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
// );

// ─────────────────────────────────────────────
// POST /api/users/verify
// Gọi sau khi Firebase OTP xác minh thành công
// Body: { phone, firebase_uid, role }
// ─────────────────────────────────────────────
app.post('/api/users/verify', async (req, res) => {
  const { phone, firebase_uid, role = 'customer' } = req.body;

  if (!phone || !firebase_uid) {
    return res.status(400).json({ error: 'Thiếu phone hoặc firebase_uid' });
  }

  try {
    // Upsert: nếu đã có thì cập nhật firebase_uid, chưa có thì tạo mới
    await pool.execute(
      `INSERT INTO users (phone, firebase_uid, role)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE firebase_uid = VALUES(firebase_uid)`,
      [phone, firebase_uid, role],
    );

    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE phone = ?',
      [phone],
    );

    return res.status(200).json({ success: true, user: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Lỗi server' });
  }
});

// ─────────────────────────────────────────────
// GET /api/users/:phone
// Lấy thông tin user theo số điện thoại
// ─────────────────────────────────────────────
app.get('/api/users/:phone', async (req, res) => {
  const { phone } = req.params;

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE phone = ?',
      [phone],
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

app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});