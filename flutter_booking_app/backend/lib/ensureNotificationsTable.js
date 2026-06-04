const pool = require('../db');

async function ensureNotificationsTable() {
  // create table with index on created_at for efficient cleanup
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_type (type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Try to create a MySQL EVENT to automatically delete notifications older than 10 days.
  // Not all MySQL setups allow EVENT creation; ignore errors and fallback to app-level cleanup if needed.
  try {
    await pool.execute(`
      CREATE EVENT IF NOT EXISTS notifications_cleanup_10d
      ON SCHEDULE EVERY 1 DAY
      DO
        DELETE FROM notifications WHERE created_at < (NOW() - INTERVAL 10 DAY)
    `);
  } catch (e) {
    console.error('create event notifications_cleanup_10d:', e?.message || e);
  }
}

module.exports = { ensureNotificationsTable };
