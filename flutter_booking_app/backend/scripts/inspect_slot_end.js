const pool = require('../db');
(async()=>{
  const id = Number(process.argv[2] || 22);
  try {
    const q = `SELECT id, slot_date, start_time, end_time, STR_TO_DATE(CONCAT(DATE_FORMAT(slot_date, '%Y-%m-%d'), ' ', end_time), '%Y-%m-%d %H:%i:%s') AS slot_end_ts, (STR_TO_DATE(CONCAT(DATE_FORMAT(slot_date, '%Y-%m-%d'), ' ', end_time), '%Y-%m-%d %H:%i:%s') <= NOW()) AS is_expired, NOW() as now_ts FROM time_slots WHERE id = ?`;
    const [r] = await pool.execute(q, [id]);
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(2);
  }
})();
