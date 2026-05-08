// db.js
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
const railwayEnvPath = path.join(__dirname, '.env.railway');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(railwayEnvPath)) {
  dotenv.config({ path: railwayEnvPath });
} else {
  dotenv.config();
}

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'haircut_booking',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;