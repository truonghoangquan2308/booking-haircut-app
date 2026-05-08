const pool = require('../db');

/**
 * - users.is_locked: Admin khóa tài khoản
 * - barbers.shop_id: chỉ thêm nếu có bảng shops và barbers chưa dùng branch_id
 */
async function ensureSchemaExtensions() {
  const [userCols] = await pool.execute('SHOW COLUMNS FROM users');
  const userFields = new Set(userCols.map((c) => c.Field));
  if (!userFields.has('is_locked')) {
    await pool.execute(
      'ALTER TABLE users ADD COLUMN is_locked TINYINT(1) NOT NULL DEFAULT 0',
    );
  }

  const [barberCols] = await pool.execute('SHOW COLUMNS FROM barbers');
  const barberFields = new Set(barberCols.map((c) => c.Field));
  if (barberFields.has('branch_id') || barberFields.has('shop_id')) {
    return;
  }

  const [[{ sc }]] = await pool.execute(
    `
    SELECT COUNT(*) AS sc FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'shops'
    `,
  );
  if (Number(sc) === 0) return;

  await pool.execute(
    `
    ALTER TABLE barbers
    ADD COLUMN shop_id INT NULL,
    ADD CONSTRAINT fk_barbers_shop FOREIGN KEY (shop_id) REFERENCES shops(id)
      ON DELETE SET NULL ON UPDATE CASCADE
    `,
  );
}

/**
 * shop_orders.branch_id — gán chi nhánh nhận hàng (Flutter đặt hàng → manager-web lọc đơn).
 */
async function ensureShopOrdersBranchId() {
  const [[t]] = await pool.execute(
    `
    SELECT COUNT(*) AS c FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'shop_orders'
    `,
  );
  if (!t || Number(t.c) === 0) return;

  const [[tb]] = await pool.execute(
    `
    SELECT COUNT(*) AS c FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'branches'
    `,
  );
  if (!tb || Number(tb.c) === 0) return;

  const [cols] = await pool.execute('SHOW COLUMNS FROM shop_orders');
  const fields = new Set(cols.map((c) => c.Field));
  if (fields.has('branch_id')) return;

  await pool.execute(
    `
    ALTER TABLE shop_orders
    ADD COLUMN branch_id INT NULL,
    ADD CONSTRAINT fk_shop_orders_branch
      FOREIGN KEY (branch_id) REFERENCES branches(id)
      ON DELETE SET NULL ON UPDATE CASCADE
    `,
  );
}

/** Thêm trạng thái `completed` (Hoàn thành) cho đơn shop. */
async function ensureShopOrdersStatusEnumCompleted() {
  const [[t]] = await pool.execute(
    `
    SELECT COUNT(*) AS c FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'shop_orders'
    `,
  );
  if (!t || Number(t.c) === 0) return;

  const [[row]] = await pool.execute(
    `
    SELECT COLUMN_TYPE AS ct FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'status'
    LIMIT 1
    `,
  );
  const ct = String(row?.ct ?? '');
  if (ct.includes("'completed'")) return;

  await pool.execute(
    `
    ALTER TABLE shop_orders
    MODIFY COLUMN status
      ENUM('pending','confirmed','shipping','delivered','completed','cancelled')
      NOT NULL DEFAULT 'pending'
    `,
  );
}

/** Tạo bảng stock_history để theo dõi thay đổi tồn kho. */
async function ensureStockHistoryTable() {
  const [[t]] = await pool.execute(
    `
    SELECT COUNT(*) AS c FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'stock_history'
    `,
  );
  if (Number(t.c) > 0) return;

  await pool.execute(
    `
    CREATE TABLE stock_history (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      product_id  INT NOT NULL,
      change_type ENUM('import', 'export', 'adjust') NOT NULL,
      quantity    INT NOT NULL,
      previous_stock INT NOT NULL,
      new_stock   INT NOT NULL,
      note        TEXT NULL,
      user_id     INT NULL,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_stock_history_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_stock_history_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
      INDEX idx_stock_history_product (product_id),
      INDEX idx_stock_history_created (created_at)
    ) ENGINE=InnoDB
    `,
  );
}

module.exports = {
  ensureSchemaExtensions,
  ensureShopOrdersBranchId,
  ensureShopOrdersStatusEnumCompleted,
  ensureStockHistoryTable,
};
