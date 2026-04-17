/**
 * Schema MySQL: barbers.bio là ENUM; giá trị khác → NULL (tránh lỗi insert).
 */
const BARBER_BIO_ENUM = new Set([
  'thợ hiện đại',
  'thợ cổ điển',
  'thợ phong cách hàn quốc',
]);

function normalizeBarberBio(bio) {
  if (bio == null) return null;
  const s = String(bio).trim();
  if (!s) return null;
  return BARBER_BIO_ENUM.has(s) ? s : null;
}

module.exports = { BARBER_BIO_ENUM, normalizeBarberBio };
