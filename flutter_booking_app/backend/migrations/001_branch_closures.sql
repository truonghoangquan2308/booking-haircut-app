-- Migration: create branch_closures table
-- Run this once against the database if you don't auto-run ensure scripts
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
