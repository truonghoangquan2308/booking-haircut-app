const fs = require('fs');
const path = require('path');
const pool = require('../db');
(async ()=>{
  try {
    const sql = fs.readFileSync(path.join(__dirname,'../migrations/003_branch_closure_requests.sql'),'utf8');
    console.log('Running migration 003...');
    // Split by ';' but keep simple: run entire SQL as one statement
    await pool.execute(sql);
    console.log('Migration 003 applied successfully');
    process.exit(0);
  } catch (e) {
    console.error('Migration 003 failed:', e.message || e);
    process.exit(1);
  }
})();
