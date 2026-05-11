const pool = require('../db');

async function ensureChatMessagesTable() {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      branch_id INT NOT NULL,
      customer_id INT NOT NULL,
      sender ENUM('customer','receptionist') NOT NULL,
      message TEXT NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_chat_messages_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_chat_messages_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      INDEX idx_chat_branch_customer (branch_id, customer_id),
      INDEX idx_chat_branch (branch_id),
      INDEX idx_chat_customer (customer_id),
      INDEX idx_chat_created (created_at)
    ) ENGINE=InnoDB;
    `,
  );
}

module.exports = { ensureChatMessagesTable };