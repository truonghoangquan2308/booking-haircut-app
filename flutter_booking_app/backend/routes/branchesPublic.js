const express = require('express');
const pool = require('../db');
const { haversineKm } = require('../lib/geoHaversine');

const router = express.Router();

const OPENING_HOURS_NOTE =
  'Giờ mở cửa có thể khác nhau — vui lòng gọi chi nhánh để xác nhận trước khi đến.';

// GET /branches/nearest?lat=&lng=&limit=3 — Haversine, chỉ chi nhánh active + có tọa độ
router.get('/branches/nearest', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  let limit = parseInt(String(req.query.limit ?? '3'), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 3;
  limit = Math.min(limit, 10);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Thiếu hoặc không hợp lệ: lat, lng' });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'lat/lng nằm ngoài phạm vi hợp lệ' });
  }

  try {
    const [t] = await pool.execute(
      `
      SELECT 1 AS ok FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branches'
      LIMIT 1
      `,
    );
    if (!t.length) {
      return res.json({
        user_lat: lat,
        user_lng: lng,
        branches: [],
        message: 'Chưa có bảng chi nhánh.',
      });
    }

    const [bCols] = await pool.execute('SHOW COLUMNS FROM branches');
    const bFields = new Set(bCols.map((c) => c.Field));
    if (!bFields.has('latitude') || !bFields.has('longitude')) {
      return res.json({
        user_lat: lat,
        user_lng: lng,
        branches: [],
        message: 'Chi nhánh chưa có cột tọa độ (latitude/longitude).',
      });
    }

    const [rows] = await pool.execute(
      `
      SELECT id, name, address, phone, latitude, longitude
      FROM branches
      WHERE status = 'active'
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      `,
    );

    const enriched = (rows || [])
      .map((r) => {
        const plat = parseFloat(r.latitude);
        const plng = parseFloat(r.longitude);
        if (!Number.isFinite(plat) || !Number.isFinite(plng)) return null;
        const distanceKm = haversineKm(lat, lng, plat, plng);
        return {
          id: r.id,
          name: r.name,
          address: r.address,
          phone: r.phone,
          latitude: plat,
          longitude: plng,
          distance_km: Math.round(distanceKm * 10) / 10,
          opening_hours_note: OPENING_HOURS_NOTE,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);

    return res.json({
      user_lat: lat,
      user_lng: lng,
      branches: enriched,
      message:
        enriched.length === 0
          ? 'Không có chi nhánh nào có tọa độ để tính khoảng cách.'
          : undefined,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /branches — mount tại app.use('/api', ...) → /api/branches
router.get('/branches', async (_req, res) => {
  try {
    const [t] = await pool.execute(
      `
      SELECT 1 AS ok FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branches'
      LIMIT 1
      `,
    );
    if (!t.length) return res.json({ branches: [] });
    const [bCols] = await pool.execute('SHOW COLUMNS FROM branches');
    const bFields = new Set(bCols.map((c) => c.Field));
    const geo =
      bFields.has('latitude') && bFields.has('longitude')
        ? ', latitude, longitude'
        : '';
    const [rows] = await pool.execute(
      `
      SELECT id, name, address, phone${geo}
      FROM branches
      WHERE status = 'active'
      ORDER BY name ASC
      `,
    );
    return res.json({ branches: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
