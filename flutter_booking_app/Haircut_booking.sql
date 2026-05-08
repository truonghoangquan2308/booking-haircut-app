-- ================================================
-- HAIRCUT BOOKING APP - FULL DATABASE (RESET)
-- GROUP 5
-- ================================================

-- 0) RESET DB
DROP DATABASE IF EXISTS haircut_booking;
CREATE DATABASE haircut_booking
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE haircut_booking;
-- ================================================
-- 1. USERS
-- ================================================
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  phone         VARCHAR(20) UNIQUE NULL,
  email         VARCHAR(100) UNIQUE NULL,
  firebase_uid  VARCHAR(128) UNIQUE NULL,
  full_name     VARCHAR(100) NULL,
  avatar_url    VARCHAR(255) NULL,
  date_of_birth DATE NULL,
  role          ENUM('customer', 'barber', 'manager', 'owner', 'admin') NOT NULL DEFAULT 'customer',
  status        ENUM('available', 'off') NOT NULL DEFAULT 'available',
  branch_id     INT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ================================================
-- 2. BRANCHES (chi nhánh)
-- ================================================
CREATE TABLE branches (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  owner_id    INT NOT NULL,
  name        VARCHAR(100) NOT NULL,
  address     TEXT NULL,
  phone       VARCHAR(20) NULL,
  latitude    DECIMAL(10, 7) NULL,
  longitude   DECIMAL(10, 7) NULL,
  status      ENUM('active', 'blocked') NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_branches_owner
    FOREIGN KEY (owner_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_branches_owner (owner_id),
  INDEX idx_branches_status (status)
) ENGINE=InnoDB;

-- Gắn FK branch_id vào users sau khi tạo branches
ALTER TABLE users
  ADD CONSTRAINT fk_users_branch
  FOREIGN KEY (branch_id) REFERENCES branches(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- ================================================
-- 3. BARBERS
-- ================================================
CREATE TABLE barbers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL UNIQUE,
  branch_id     INT NULL,
  bio           ENUM('thợ hiện đại', 'thợ cổ điển', 'thợ phong cách hàn quốc') NULL,
  rating        DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  total_reviews INT NOT NULL DEFAULT 0,
  is_available  TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_barbers_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_barbers_branch
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  INDEX idx_barbers_branch (branch_id)
) ENGINE=InnoDB;
-- ================================================
-- 4. SERVICES
-- ================================================
CREATE TABLE services (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT NULL,
  price       DECIMAL(10,2) NOT NULL,
  duration    INT NOT NULL DEFAULT 30,
  image_url   VARCHAR(255) NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ================================================
-- 5. WORKING SCHEDULES
-- ================================================
CREATE TABLE working_schedules (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  barber_id  INT NOT NULL,
  work_date  DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  is_day_off TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_working_schedules_barber
    FOREIGN KEY (barber_id) REFERENCES barbers(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  UNIQUE KEY uk_barber_work_date (barber_id, work_date)
) ENGINE=InnoDB;

-- ================================================
-- 6. TIME SLOTS
-- ================================================
CREATE TABLE time_slots (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  barber_id  INT NOT NULL,
  slot_date  DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  is_booked  TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_time_slots_barber
    FOREIGN KEY (barber_id) REFERENCES barbers(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_timeslots_barber_date (barber_id, slot_date)
) ENGINE=InnoDB;

-- ================================================
-- 7. APPOINTMENTS
-- ================================================
CREATE TABLE appointments (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  customer_id  INT NOT NULL,
  barber_id    INT NOT NULL,
  branch_id    INT NOT NULL,
  service_id   INT NOT NULL,
  time_slot_id INT NOT NULL,
  appt_date    DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  total_price  DECIMAL(10,2) NOT NULL,
  note         TEXT NULL,
  status       ENUM('pending','confirmed','in_progress','completed','cancelled')
               NOT NULL DEFAULT 'pending',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_appt_customer
    FOREIGN KEY (customer_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_appt_barber
    FOREIGN KEY (barber_id) REFERENCES barbers(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_appt_branch
    FOREIGN KEY (branch_id) REFERENCES branches(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_appt_service
    FOREIGN KEY (service_id) REFERENCES services(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_appt_timeslot
    FOREIGN KEY (time_slot_id) REFERENCES time_slots(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_appt_customer (customer_id),
  INDEX idx_appt_barber_date (barber_id, appt_date),
  INDEX idx_appt_branch (branch_id),
  INDEX idx_appt_status (status)
) ENGINE=InnoDB;

-- ================================================
-- 8. REVIEWS
-- ================================================
CREATE TABLE reviews (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  customer_id    INT NOT NULL,
  barber_id      INT NOT NULL,
  rating         TINYINT NOT NULL,
  comment        TEXT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_reviews_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_reviews_customer
    FOREIGN KEY (customer_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_reviews_barber
    FOREIGN KEY (barber_id) REFERENCES barbers(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  UNIQUE KEY uk_review_appointment (appointment_id),
  INDEX idx_reviews_barber (barber_id)
) ENGINE=InnoDB;

-- ================================================
-- 9. NOTIFICATIONS
-- ================================================
CREATE TABLE notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(200) NULL,
  message    TEXT NULL,
  type       VARCHAR(50) NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_notifications_user_read (user_id, is_read)
) ENGINE=InnoDB;

-- ================================================
-- 10. ADMIN AUDIT LOGS
-- ================================================
CREATE TABLE admin_audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_user_id INT NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) NULL,
  target_id BIGINT NULL,
  detail TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin (admin_user_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================
-- 11. PRODUCT CATEGORIES
-- ================================================
CREATE TABLE product_categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT NULL,
  image_url   VARCHAR(255) NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_product_categories_name (name)
) ENGINE=InnoDB;

-- ================================================
-- 11. PRODUCTS
-- ================================================
CREATE TABLE products (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  category_id   INT NOT NULL,
  name          VARCHAR(150) NOT NULL,
  description   TEXT NULL,
  price         DECIMAL(10,2) NOT NULL,
  stock         INT NOT NULL DEFAULT 0,
  unit          VARCHAR(30) NOT NULL DEFAULT 'cái',
  image_url     VARCHAR(255) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES product_categories(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  INDEX idx_products_category (category_id),
  INDEX idx_products_active (is_active)
) ENGINE=InnoDB;

-- ================================================
-- 12. PRODUCT IMAGES
-- ================================================
CREATE TABLE product_images (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  product_id  INT NOT NULL,
  image_url   VARCHAR(255) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_images_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_product_images_product (product_id)
) ENGINE=InnoDB;

-- ================================================
-- 13. CART ITEMS
-- ================================================
CREATE TABLE cart_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  product_id  INT NOT NULL,
  quantity    INT NOT NULL DEFAULT 1,
  added_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_cart_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  UNIQUE KEY uk_cart_user_product (user_id, product_id)
) ENGINE=InnoDB;

-- ================================================
-- 14. SHOP ORDERS
-- ================================================
CREATE TABLE shop_orders (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  customer_id      INT NOT NULL,
  total_price      DECIMAL(10,2) NOT NULL,
  shipping_address TEXT NULL,
  note             TEXT NULL,
  status           ENUM('pending','confirmed','shipping','delivered','cancelled')
                   NOT NULL DEFAULT 'pending',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_shop_orders_customer
    FOREIGN KEY (customer_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_shop_orders_customer (customer_id),
  INDEX idx_shop_orders_status (status)
) ENGINE=InnoDB;

-- ================================================
-- 15. SHOP ORDER ITEMS
-- ================================================
CREATE TABLE shop_order_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  order_id     INT NOT NULL,
  product_id   INT NOT NULL,
  quantity     INT NOT NULL,
  unit_price   DECIMAL(10,2) NOT NULL,
  subtotal     DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_shop_order_items_order
    FOREIGN KEY (order_id) REFERENCES shop_orders(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_shop_order_items_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  INDEX idx_shop_order_items_order (order_id)
) ENGINE=InnoDB;

-- ================================================
-- TRIGGERS: Auto sync barber rating
-- ================================================
DELIMITER $$

CREATE TRIGGER trg_reviews_after_insert
AFTER INSERT ON reviews
FOR EACH ROW
BEGIN
  UPDATE barbers b
  SET
    b.rating = COALESCE((
      SELECT ROUND(AVG(r.rating), 1)
      FROM reviews r
      WHERE r.barber_id = NEW.barber_id
    ), 0.0),
    b.total_reviews = (
      SELECT COUNT(*)
      FROM reviews r
      WHERE r.barber_id = NEW.barber_id
    )
  WHERE b.id = NEW.barber_id;
END$$

CREATE TRIGGER trg_reviews_after_update
AFTER UPDATE ON reviews
FOR EACH ROW
BEGIN
  UPDATE barbers b
  SET
    b.rating = COALESCE((
      SELECT ROUND(AVG(r.rating), 1)
      FROM reviews r
      WHERE r.barber_id = OLD.barber_id
    ), 0.0),
    b.total_reviews = (
      SELECT COUNT(*)
      FROM reviews r
      WHERE r.barber_id = OLD.barber_id
    )
  WHERE b.id = OLD.barber_id;

  UPDATE barbers b
  SET
    b.rating = COALESCE((
      SELECT ROUND(AVG(r.rating), 1)
      FROM reviews r
      WHERE r.barber_id = NEW.barber_id
    ), 0.0),
    b.total_reviews = (
      SELECT COUNT(*)
      FROM reviews r
      WHERE r.barber_id = NEW.barber_id
    )
  WHERE b.id = NEW.barber_id;
END$$

CREATE TRIGGER trg_reviews_after_delete
AFTER DELETE ON reviews
FOR EACH ROW
BEGIN
  UPDATE barbers b
  SET
    b.rating = COALESCE((
      SELECT ROUND(AVG(r.rating), 1)
      FROM reviews r
      WHERE r.barber_id = OLD.barber_id
    ), 0.0),
    b.total_reviews = (
      SELECT COUNT(*)
      FROM reviews r
      WHERE r.barber_id = OLD.barber_id
    )
  WHERE b.id = OLD.barber_id;
END$$

DELIMITER ;

-- ================================================
-- SEED: DEFAULT SYSTEM USERS
-- Thứ tự: admin → owner → branch → manager
-- ================================================

-- 1. Admin
INSERT INTO users (email, firebase_uid, full_name, role, status)
VALUES ('admin@gmail.com', 'EbfvPfq5x2fEPrWVVZhxtoH9Fpi2', 'Admin', 'admin', 'available');

-- 2. Owner
INSERT INTO users (email, firebase_uid, full_name, role, status)
VALUES ('owner@gmail.com', 'EvIEkvm1LWR9OOAz8uALiVlHg8J3', 'Owner', 'owner', 'available');

-- 3. Chi nhánh 1 - Bình Tân
INSERT INTO branches (owner_id, name, address, phone, latitude, longitude, status)
VALUES (
  (SELECT id FROM users WHERE email = 'owner@gmail.com'),
  'BB Shop - Chi nhánh 1',
  '123 Tên Lửa, Phường Bình Trị Đông B, Quận Bình Tân, TP.HCM',
  '0909000001',
  10.7553,
  106.6019,
  'active'
);

-- 4. Chi nhánh 2 - Thủ Đức
INSERT INTO branches (owner_id, name, address, phone, latitude, longitude, status)
VALUES (
  (SELECT id FROM users WHERE email = 'owner@gmail.com'),
  'BB Shop - Chi nhánh 2',
  '456 Võ Văn Ngân, Phường Bình Thọ, TP. Thủ Đức, TP.HCM',
  '0909000002',
  10.8500,
  106.7717,
  'active'
);

-- 5. Manager (gắn vào chi nhánh 1)
INSERT INTO users (email, firebase_uid, full_name, role, status, branch_id)
VALUES (
  'manager@gmail.com',
  'oXpcYrnTCQX5EstaxEWXTJ6o9Op1',
  'Manager',
  'manager',
  'available',
  (SELECT id FROM branches WHERE name = 'BB Shop - Chi nhánh 1')
);

-- ================================================
-- DONE
-- ================================================
