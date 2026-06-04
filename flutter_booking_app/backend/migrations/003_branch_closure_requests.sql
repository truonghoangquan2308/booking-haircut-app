-- Migration: create branch_closure_requests table
CREATE TABLE IF NOT EXISTS branch_closure_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  manager_id INT NOT NULL,
  request_type ENUM('holiday','incident','maintenance','temporary_close') NOT NULL DEFAULT 'incident',
  reason TEXT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  approved_by INT NULL,
  approved_at DATETIME NULL,
  rejection_reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bcr_branch_status (branch_id, status, created_at),
  CONSTRAINT fk_bcr_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
