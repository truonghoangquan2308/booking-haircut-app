const pool = require('../db');

const EXPECTED_COLUMNS = [
  { name: 'id' },
  { name: 'branch_id' },
  { name: 'start_date' },
  { name: 'end_date' },
  { name: 'closure_type' },
  { name: 'start_time' },
  { name: 'end_time' },
  { name: 'reason' },
  { name: 'created_by' },
  { name: 'created_at' },
  { name: 'updated_at' },
  { name: 'canceled_at' },
  { name: 'canceled_by' },
];

async function ensureBranchClosuresTable() {
  // Create table if missing with the expected schema (safe no-op if exists)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS branch_closures (
      id INT AUTO_INCREMENT PRIMARY KEY,
      branch_id INT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      closure_type ENUM('holiday','incident','maintenance','temporary_close') NOT NULL DEFAULT 'temporary_close',
      -- if both start_time/end_time are NULL then treat as full-day closure for all affected dates
      start_time TIME NULL,
      end_time TIME NULL,
      reason TEXT NULL,
      created_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
      canceled_at DATETIME NULL,
      canceled_by INT NULL,
      INDEX idx_branch_closures_branch_dates (branch_id, start_date, end_date),
      CONSTRAINT fk_branch_closures_branch FOREIGN KEY (branch_id)
        REFERENCES branches(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Ensure missing columns are added (handles older installations)
  const [cols] = await pool.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branch_closures'`
  );
  const existing = new Set((cols || []).map((r) => r.COLUMN_NAME));

  const alterStmts = [];
  if (!existing.has('start_date')) alterStmts.push("ADD COLUMN start_date DATE NULL AFTER branch_id");
  if (!existing.has('end_date')) alterStmts.push("ADD COLUMN end_date DATE NULL AFTER start_date");
  if (!existing.has('closure_type')) alterStmts.push("ADD COLUMN closure_type ENUM('holiday','incident','maintenance','temporary_close') NOT NULL DEFAULT 'temporary_close' AFTER end_date");
  if (!existing.has('start_time')) alterStmts.push('ADD COLUMN start_time TIME NULL AFTER closure_type');
  if (!existing.has('end_time')) alterStmts.push('ADD COLUMN end_time TIME NULL AFTER start_time');
  if (!existing.has('reason')) alterStmts.push('ADD COLUMN reason TEXT NULL AFTER end_time');
  if (!existing.has('created_by')) alterStmts.push('ADD COLUMN created_by INT NULL AFTER reason');
  if (!existing.has('created_at')) alterStmts.push("ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_by");
  if (!existing.has('updated_at')) alterStmts.push("ADD COLUMN updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP AFTER created_at");
  if (!existing.has('canceled_at')) alterStmts.push('ADD COLUMN canceled_at DATETIME NULL AFTER updated_at');
  if (!existing.has('canceled_by')) alterStmts.push('ADD COLUMN canceled_by INT NULL AFTER canceled_at');

  if (alterStmts.length > 0) {
    const sql = `ALTER TABLE branch_closures ${alterStmts.join(', ')}`;
    try {
      await pool.execute(sql);
    } catch (e) {
      // best-effort: if ALTER with multiple clauses fails, try each individually
      for (const s of alterStmts) {
        try {
          await pool.execute(`ALTER TABLE branch_closures ${s}`);
        } catch (ee) {
          console.error('Failed to apply alter clause for branch_closures:', s, ee?.message || ee);
        }
      }
    }
  }

  // If older schema used 'closure_date' and/or 'is_full_day', map data into new columns.
  // Do not drop legacy columns to remain backward compatible; just copy values when target columns are empty.
  const hasClosureDate = existing.has('closure_date');
  const hasIsFullDay = existing.has('is_full_day');

  if (hasClosureDate) {
    try {
      // Only update rows where start_date IS NULL or start_date = '0000-00-00'
      // Guard against legacy zero-date values ('0000-00-00') which are invalid
      // in strict SQL modes by treating them as NULL via NULLIF and excluding
      // them from the WHERE clause.
      await pool.execute(`
        UPDATE branch_closures
        SET start_date = COALESCE(start_date, NULLIF(closure_date, '0000-00-00')),
            end_date = COALESCE(end_date, NULLIF(closure_date, '0000-00-00'))
        WHERE (start_date IS NULL OR DATE(start_date) = '0000-00-00')
          AND closure_date IS NOT NULL
          AND closure_date <> '0000-00-00'
      `);

      if (hasIsFullDay) {
        // For full-day closures, clear partial times
        await pool.execute(`
          UPDATE branch_closures
          SET start_time = NULL, end_time = NULL
          WHERE is_full_day = 1
        `);
      } else {
        // if no is_full_day column, leave times as-is (they may be NULL or already present)
      }
    } catch (e) {
      console.error('Error migrating legacy branch_closures closure_date -> start_date:', e?.message || e);
    }
  }

  // Ensure index exists
  try {
    await pool.execute(`CREATE INDEX IF NOT EXISTS idx_branch_closures_branch_dates ON branch_closures (branch_id, start_date, end_date)`);
  } catch (e) {
    // MySQL older versions may not support CREATE INDEX IF NOT EXISTS; ignore duplicate index errors
    // Attempt to create normally and ignore errors
    try {
      await pool.execute('CREATE INDEX idx_branch_closures_branch_dates ON branch_closures (branch_id, start_date, end_date)');
    } catch (ee) {
      // ignore
    }
  }
}

module.exports = { ensureBranchClosuresTable };
