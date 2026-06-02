const mysql = require('mysql2/promise');
require('dotenv').config();
(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || 'haircut_booking',
    });
    const [res] = await conn.execute(
      "UPDATE users SET avatar_url = REPLACE(avatar_url, 'http://10.0.2.2:3000', '') WHERE avatar_url LIKE 'http://10.0.2.2:%' OR avatar_url LIKE 'http://10.0.2.2/%'"
    );
    console.log('rowsAffected:', res.affectedRows);
    await conn.end();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
