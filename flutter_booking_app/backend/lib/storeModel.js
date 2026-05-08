const pool = require('../db');

/** @type {'branches' | 'shops' | 'none' | null} */
let cache = null;

/**
 * Schema mới: bảng `branches` (chi nhánh). Schema cũ: bảng `shops` (duyệt/chặn).
 * Admin/Owner API dùng chung hình dạng "shop" ở JSON.
 */
async function storeModel() {
  if (cache) return cache;
  const [b] = await pool.execute(
    `
    SELECT COUNT(*) AS c FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'branches'
    `,
  );
  const [s] = await pool.execute(
    `
    SELECT COUNT(*) AS c FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'shops'
    `,
  );
  const hasBranches = Number(b[0]?.c) > 0;
  const hasShops = Number(s[0]?.c) > 0;
  if (hasBranches) cache = 'branches';
  else if (hasShops) cache = 'shops';
  else cache = 'none';
  return cache;
}

function resetStoreModelCache() {
  cache = null;
}

module.exports = { storeModel, resetStoreModelCache };
