const fs = require('fs');
const path = require('path');
const pool = require('../db');
(async ()=>{
  try {
    console.log('Running migration 004 (stepwise)...');
    const alts = [
      "ALTER TABLE branch_closure_requests ADD COLUMN title VARCHAR(255) NULL",
      "ALTER TABLE branch_closure_requests ADD COLUMN detailed_reason TEXT NULL",
      "ALTER TABLE branch_closure_requests ADD COLUMN impact_level ENUM('low','medium','high','critical') NULL",
      "ALTER TABLE branch_closure_requests ADD COLUMN estimated_reopen_date DATE NULL",
      "ALTER TABLE branch_closure_requests ADD COLUMN attachment_url VARCHAR(1024) NULL",
      "ALTER TABLE branch_closure_requests ADD COLUMN manager_note TEXT NULL",

      "ALTER TABLE branch_closures ADD COLUMN title VARCHAR(255) NULL",
      "ALTER TABLE branch_closures ADD COLUMN detailed_reason TEXT NULL",
      "ALTER TABLE branch_closures ADD COLUMN impact_level ENUM('low','medium','high','critical') NULL",
      "ALTER TABLE branch_closures ADD COLUMN estimated_reopen_date DATE NULL",
      "ALTER TABLE branch_closures ADD COLUMN attachment_url VARCHAR(1024) NULL",
      "ALTER TABLE branch_closures ADD COLUMN manager_note TEXT NULL",

      "ALTER TABLE appointments ADD COLUMN closure_id INT NULL",
      "ALTER TABLE appointments ADD COLUMN cancelled_by_branch_at DATETIME NULL",
      "CREATE INDEX idx_appt_closure_id ON appointments (closure_id)",
      // modify enum to include cancelled_by_branch; if this fails, log and continue
      "ALTER TABLE appointments MODIFY COLUMN status ENUM('pending','confirmed','in_progress','technician_completed','paid_and_done','completed','cancelled','cancelled_by_branch') NOT NULL DEFAULT 'pending'",
    ];

    for (const s of alts) {
      try {
        await pool.execute(s);
        console.log('Executed:', s);
      } catch (e) {
        console.warn('Ignored error executing:', s, e.message || e);
      }
    }

    console.log('Migration 004 completed (best-effort)');
    process.exit(0);
  } catch (e) {
    console.error('Migration 004 failed:', e.message || e);
    process.exit(1);
  }
})();
