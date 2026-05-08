const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// GET /services
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM services WHERE is_active = 1');
    res.json({ status: 'success', data: rows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /services (tạo dịch vụ mới)
// Supports:
// - JSON body (no image): { name, price, duration, description, is_active }
// - Multipart/form-data: fields above + file field name: "image"
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir, // multer sẽ dùng filename mặc định trong một số trường hợp; vẫn ok cho việc test
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const mt = (file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const imgExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic'].includes(ext);
    const ok =
      mt.startsWith('image/') ||
      mt === 'application/octet-stream' ||
      (mt === '' && imgExt);
    cb(null, ok);
  },
});

router.post('/', async (req, res) => {
  const isMultipart = req.is('multipart/form-data');

  const run = async () => {
    try {
      const {
        name,
        price,
        duration,
        description,
        is_active,
      } = req.body || {};

      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Thiếu name' });
      }

      const priceNum = Number(price);
      const durationNum = parseInt(duration, 10);
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        return res.status(400).json({ error: 'Giá không hợp lệ' });
      }
      if (!Number.isFinite(durationNum) || durationNum <= 0) {
        return res.status(400).json({ error: 'Thời gian không hợp lệ' });
      }

      const activeNum = is_active === undefined || is_active === null
        ? 1
        : (String(is_active) === '0' ? 0 : 1);

      const imageUrl = req.file
        ? `/uploads/${req.file.filename}`
        : null;

      // Dùng INSERT + SELECT lại để trả về object ngay cho app
      const [result] = await pool.execute(
        `
        INSERT INTO services (name, price, duration, description, image_url, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          String(name).trim(),
          priceNum,
          durationNum,
          description ? String(description) : '',
          imageUrl,
          activeNum,
        ],
      );

      const insertedId = result && result.insertId ? result.insertId : null;
      if (!insertedId) {
        return res.status(201).json({ status: 'success' });
      }

      const [rows] = await pool.execute(
        'SELECT * FROM services WHERE id = ? LIMIT 1',
        [insertedId],
      );
      return res.status(201).json({ status: 'success', service: rows[0] });
    } catch (err) {
      return res.status(500).json({ status: 'error', message: err.message });
    }
  };

  if (!isMultipart) {
    return run();
  }

  // Chỉ chạy Multer khi request đúng kiểu multipart
  upload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    return run();
  });
});

module.exports = router;