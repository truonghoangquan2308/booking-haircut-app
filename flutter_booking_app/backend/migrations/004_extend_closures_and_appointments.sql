-- Migration: extend branch closure requests and closures and add appointments.closure_id
-- Adds extra metadata fields and appointment linkage for closure incident management

ALTER TABLE branch_closure_requests
  ADD COLUMN IF NOT EXISTS title VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS detailed_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS impact_level ENUM('low','medium','high','critical') NULL,
  ADD COLUMN IF NOT EXISTS estimated_reopen_date DATE NULL,
  ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(1024) NULL,
  ADD COLUMN IF NOT EXISTS manager_note TEXT NULL;

ALTER TABLE branch_closures
  ADD COLUMN IF NOT EXISTS title VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS detailed_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS impact_level ENUM('low','medium','high','critical') NULL,
  ADD COLUMN IF NOT EXISTS estimated_reopen_date DATE NULL,
  ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(1024) NULL,
  ADD COLUMN IF NOT EXISTS manager_note TEXT NULL;

-- Add closure_id to appointments to link affected appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS closure_id INT NULL,
  ADD COLUMN IF NOT EXISTS cancelled_by_branch_at DATETIME NULL;

-- Ensure index on closure_id for faster lookups
ALTER TABLE appointments
  ADD INDEX IF NOT EXISTS idx_appt_closure_id (closure_id);

-- Add new status value 'cancelled_by_branch' to appointments.status enum
-- This command attempts to preserve existing values; adjust if your DB uses a different set.
ALTER TABLE appointments MODIFY COLUMN status ENUM('pending','confirmed','in_progress','technician_completed','paid_and_done','completed','cancelled','cancelled_by_branch') NOT NULL DEFAULT 'pending';

-- Foreign key constraint (optional if you want referential integrity)
-- ALTER TABLE appointments ADD CONSTRAINT fk_appt_closure FOREIGN KEY (closure_id) REFERENCES branch_closures(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- End migration
