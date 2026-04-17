/**
 * Chuẩn hoá SĐT Việt Nam khi lưu / tra cứu users.phone (tránh trùng +84 vs 0).
 * Ví dụ: +84901234567, 84901234567, 0901234567 → 0901234567
 */
function normalizeVietnamPhone(raw) {
  if (raw == null) return '';
  let s = String(raw).trim();
  if (!s) return '';
  if (s.startsWith('+')) s = s.slice(1);
  let d = s.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('84') && d.length >= 10) {
    d = `0${d.slice(2)}`;
  }
  if (!d.startsWith('0') && d.length === 9) {
    d = `0${d}`;
  }
  return d;
}

module.exports = { normalizeVietnamPhone };
