(async ()=>{
  try{
    const pool = require('../db');
    const [rows] = await pool.execute('SHOW CREATE TABLE branch_closures');
    if (rows && rows[0] && rows[0]['Create Table']) {
      console.log(rows[0]['Create Table']);
    } else {
      console.log('No branch_closures table or no create statement');
    }
    await pool.end();
  }catch(e){
    console.error('ERR', e.message || e);
    process.exit(1);
  }
})();
