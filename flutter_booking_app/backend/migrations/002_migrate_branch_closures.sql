-- Migration: migrate legacy branch_closures schema (closure_date/is_full_day) to new schema
-- This script is idempotent and safe to run multiple times.

-- 1) add missing columns (MySQL 8+ supports IF NOT EXISTS for ADD COLUMN)
ALTER TABLE branch_closures
  ADD COLUMN IF NOT EXISTS start_date DATE NULL,
  ADD COLUMN IF NOT EXISTS end_date DATE NULL,
  ADD COLUMN IF NOT EXISTS closure_type ENUM('holiday','incident','maintenance','temporary_close') NOT NULL DEFAULT 'temporary_close',
  ADD COLUMN IF NOT EXISTS start_time TIME NULL,
  ADD COLUMN IF NOT EXISTS end_time TIME NULL,
  ADD COLUMN IF NOT EXISTS reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_by INT NULL,
  ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS canceled_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS canceled_by INT NULL;

-- 2) Map legacy values when present
-- If the table has closure_date column, copy values to start_date/end_date when those are NULL
-- If the table has is_full_day, clear start_time/end_time for full-day closures

SET @has_closure_date := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branch_closures' AND COLUMN_NAME = 'closure_date');
SET @has_is_full_day := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'branch_closures' AND COLUMN_NAME = 'is_full_day');

-- Map closure_date -> start_date/end_date
-- Only update rows where start_date is NULL (to be safe)
PREPARE stmt1 FROM "UPDATE branch_closures SET start_date = COALESCE(start_date, closure_date), end_date = COALESCE(end_date, closure_date) WHERE (start_date IS NULL OR DATE(start_date) = '0000-00-00') AND closure_date IS NOT NULL";
IF @has_closure_date THEN
  EXECUTE stmt1;
END IF;
DEALLOCATE PREPARE stmt1;

-- If is_full_day present, null out start_time/end_time for those rows
PREPARE stmt2 FROM "UPDATE branch_closures SET start_time = NULL, end_time = NULL WHERE is_full_day = 1";
IF @has_is_full_day THEN
  EXECUTE stmt2;
END IF;
DEALLOCATE PREPARE stmt2;

-- 3) Ensure index exists (best-effort)
-- Note: CREATE INDEX IF NOT EXISTS is supported from MySQL 8.0.13+, otherwise this will be a no-op or fail; running manually is safer.
ALTER TABLE branch_closures ADD INDEX idx_branch_closures_branch_dates (branch_id, start_date, end_date);

-- End migration
