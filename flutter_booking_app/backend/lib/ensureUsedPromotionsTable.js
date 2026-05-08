const pool = require('../db');

/**
 * Bảng để track lịch sử dùng phiếu "single_customer"
 * - promotion_id: ID phiếu ưu đãi
 * - customer_id: ID khách sử dụng
 * - order_id: ID đơn hàng (nếu có liên quan)
 * - used_at: thời gian sử dụng
 */
async function ensureUsedPromotionsTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS used_promotions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      promotion_id INT NOT NULL,
      customer_id INT NOT NULL,
      order_id INT NULL,
      used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_promotion_customer (promotion_id, customer_id),
      INDEX idx_customer (customer_id),
      INDEX idx_order (order_id),
      CONSTRAINT fk_used_promo_promotion
        FOREIGN KEY (promotion_id) REFERENCES offers(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_used_promo_customer
        FOREIGN KEY (customer_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

module.exports = { ensureUsedPromotionsTable };
