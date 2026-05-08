const pool = require('../db');

async function ensureAdminAuditLogTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      admin_user_id INT NOT NULL,
      action VARCHAR(64) NOT NULL,
      target_type VARCHAR(32) NULL,
      target_id BIGINT NULL,
      detail TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_admin (admin_user_id),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

/**
 * Ghi log hoạt động admin (không throw để không làm hỏng luồng chính).
 */
async function logAdminAction({
  adminId,
  action,
  targetType = null,
  targetId = null,
  detail = null,
}) {
  if (!adminId || !action) return;
  try {
    const d =
      detail != null && typeof detail === 'object'
        ? JSON.stringify(detail)
        : detail != null
          ? String(detail)
          : null;
    await pool.execute(
      `
      INSERT INTO admin_audit_logs (admin_user_id, action, target_type, target_id, detail)
      VALUES (?, ?, ?, ?, ?)
      `,
      [adminId, action, targetType, targetId, d],
    );
  } catch (e) {
    console.error('logAdminAction', e.message);
  }
}

module.exports = { ensureAdminAuditLogTable, logAdminAction };
