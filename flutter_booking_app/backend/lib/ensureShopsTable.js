const pool = require('../db');

/**
 * Bảng shops: cửa hàng / chi nhánh cần Admin duyệt, có thể bị chặn.
 * Nếu DB đã dùng bảng `branches` (schema reset mới) thì **không** tạo `shops`.
 */
async function ensureShopsTable() {
  const [[{ c }]] = await pool.execute(
    `
    SELECT COUNT(*) AS c FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'branches'
    `,
  );
  if (Number(c) > 0) {
    return;
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS shops (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      description TEXT NULL,
      owner_user_id INT NULL,
      manager_user_id INT NULL,
      is_blocked TINYINT(1) NOT NULL DEFAULT 0,
      approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_shops_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_shops_manager FOREIGN KEY (manager_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB
  `);

  const [[{ cnt }]] = await pool.execute('SELECT COUNT(*) AS cnt FROM shops');
  if (Number(cnt) === 0) {
    await pool.execute(
      `
      INSERT INTO shops (name, description, approval_status, is_blocked)
      VALUES
        ('BB Shop — Chi nhánh Trung tâm', 'Cửa hàng demo', 'pending', 0),
        ('BB Shop — Chi nhánh Tây Hồ', 'Đang chờ duyệt', 'pending', 0),
        ('BB Shop — Chi nhánh Cầu Giấy', 'Đã duyệt', 'approved', 0)
      `,
    );
  }
}

module.exports = { ensureShopsTable };
