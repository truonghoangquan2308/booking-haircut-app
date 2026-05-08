const pool = require('../db');

/**
 * Bảng ưu đãi (owner quản lý). 
 * - discount_percent: phần trăm giảm giá (1-100)
 * - usage_type: 'unlimited' (dùng nhiều lần) | 'single_customer' (dùng 1 lần/khách)
 * - assigned_customer_id: khách được gán phiếu (chỉ khi usage_type='single_customer' và gán cụ thể)
 * - points_reward: giữ trong DB (mặc định 0) để tương thích cài đặt cũ
 */
async function ensureOffersTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS offers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT NULL,
      discount_percent INT NOT NULL DEFAULT 10,
      usage_type ENUM('unlimited', 'single_customer') NOT NULL DEFAULT 'single_customer',
      assigned_customer_id INT NULL,
      points_reward INT NOT NULL DEFAULT 0,
      expires_at DATE NOT NULL,
      accent_color VARCHAR(16) NOT NULL DEFAULT '#FF6B6B',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_usage_type (usage_type),
      INDEX idx_assigned_customer (assigned_customer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Thêm cột nếu chưa tồn tại
  try {
    await pool.execute(`
      ALTER TABLE offers 
      ADD COLUMN discount_percent INT NOT NULL DEFAULT 10
    `);
  } catch (e) {
    // Cột đã tồn tại hoặc lỗi khác
  }

  try {
    await pool.execute(`
      ALTER TABLE offers 
      ADD COLUMN usage_type ENUM('unlimited', 'single_customer') NOT NULL DEFAULT 'single_customer'
    `);
  } catch (e) {
    // Cột đã tồn tại hoặc lỗi khác
  }

  try {
    await pool.execute(`
      ALTER TABLE offers 
      ADD COLUMN assigned_customer_id INT NULL
    `);
  } catch (e) {
    // Cột đã tồn tại hoặc lỗi khác
  }
}

module.exports = { ensureOffersTable };
