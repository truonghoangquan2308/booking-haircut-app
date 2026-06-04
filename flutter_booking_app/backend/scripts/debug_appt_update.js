const pool = require('../db');
(async ()=>{
  try {
    const id = Number(process.argv[2] || 8);
    const [[r]] = await pool.execute('SELECT * FROM branch_closure_requests WHERE id = ?',[id]);
    function f(d){ if(!d) return null; if(typeof d==='string') return d.slice(0,10); if(d instanceof Date){ const pad=(n)=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;} return String(d).slice(0,10); }
    const normStart=f(r.start_date); const normEnd=f(r.end_date)||normStart;
    console.log('normStart',normStart,'normEnd',normEnd,'branch',r.branch_id);
    const whereParts=['branch_id = ?', 'appt_date BETWEEN ? AND ?'];
    const whereParams=[r.branch_id,normStart,normEnd];
    const sql = `SELECT id, appt_date, status FROM appointments WHERE ${whereParts.join(' AND ')}`;
    const [sel]=await pool.execute(sql, whereParams);
    console.log('select len', sel.length, sel);
    const updateSql = `UPDATE appointments SET status = ?, note=CONCAT(COALESCE(note,''),?) WHERE ${whereParts.join(' AND ')}`;
    const [u]=await pool.execute(updateSql,['cancelled_by_branch','\nnote', ...whereParams]);
    console.log('updated', u.affectedRows);
    process.exit(0);
  } catch (e) { console.error(e); process.exit(1); }
})();
