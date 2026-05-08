const pool = require('../db');

/**
 * Đồng bộ barbers.rating / total_reviews từ bảng reviews (sửa dữ liệu cũ nếu API từng ghi sai 0).
 */
async function syncBarberRatingsFromReviews() {
  const [tableRows] = await pool.execute(
    `
    SELECT COUNT(*) AS c FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'reviews'
    `,
  );
  const t = tableRows[0];
  if (!t || Number(t.c) === 0) return;

  await pool.execute(
    `
    UPDATE barbers b
    INNER JOIN (
      SELECT barber_id, ROUND(AVG(rating), 1) AS avg_r, COUNT(*) AS cnt
      FROM reviews
      GROUP BY barber_id
    ) x ON x.barber_id = b.id
    SET b.rating = x.avg_r, b.total_reviews = x.cnt
    `,
  );

  await pool.execute(
    `
    UPDATE barbers b
    SET b.rating = 0.0, b.total_reviews = 0
    WHERE NOT EXISTS (SELECT 1 FROM reviews r WHERE r.barber_id = b.id)
    `,
  );
}

module.exports = { syncBarberRatingsFromReviews };
