const axios = require('axios');
const pool = require('../db');

function pad(n){return String(n).padStart(2,'0');}

async function run() {
  try {
    // choose a barber and service
    const [[barberRow]] = await pool.execute('SELECT id FROM barbers LIMIT 1');
    if (!barberRow) throw new Error('No barber');
    const barberId = barberRow.id;
    const [[serviceRow]] = await pool.execute('SELECT id FROM services LIMIT 1');
    if (!serviceRow) throw new Error('No service');
    const serviceId = serviceRow.id;

    // create customer
    const [insCust] = await pool.execute('INSERT INTO users (phone, full_name, role) VALUES (?, ?, ?)', [`+840${Math.floor(Math.random()*90000000)+10000000}`, 'Expired Tester', 'customer']);
    const customerId = insCust.insertId;

    // compute today and times: end_time = now - 1 minute
    const now = new Date();
    const end = new Date(now.getTime() - 60*1000);
    const start = new Date(end.getTime() - 2*60*60*1000); // 2 hours before end
    const slotDate = now.toISOString().slice(0,10);
    const start_time = `${pad(start.getHours())}:${pad(start.getMinutes())}:${pad(start.getSeconds())}`;
    const end_time = `${pad(end.getHours())}:${pad(end.getMinutes())}:${pad(end.getSeconds())}`;

    const [insSlot] = await pool.execute('INSERT INTO time_slots (barber_id, slot_date, start_time, end_time, is_booked) VALUES (?, ?, ?, ?, 0)', [barberId, slotDate, start_time, end_time]);
    const slotId = insSlot.insertId;
    console.log('Created past slot:', slotId, slotDate, start_time, end_time);

    const payload = {
      customer_id: customerId,
      barber_id: barberId,
      service_id: serviceId,
      time_slot_id: slotId,
      appt_date: slotDate,
      start_time,
      end_time,
      total_price: 50000,
      note: 'test expired'
    };

    const url = process.env.SERVER_URL || 'http://localhost:3000/api/appointments';
    try {
      const res = await axios.post(url, payload);
      console.log('Unexpected success:', res.status, res.data);
    } catch (e) {
      const st = e.response?.status || 500;
      const body = e.response?.data || e.message;
      console.log('Booking response status:', st);
      console.log('Booking response body:', body);
    }

    const [appts] = await pool.execute('SELECT * FROM appointments WHERE time_slot_id = ?', [slotId]);
    console.log('Appointments rows for slot:', appts);
    const [ts] = await pool.execute('SELECT is_booked FROM time_slots WHERE id = ?', [slotId]);
    console.log('Time slot is_booked:', ts[0]);

    const bookingReturned400 = (await (async()=>{
      try { await axios.post(url, payload); return false; } catch(e){ return (e.response?.status===400); }
    })());

    const pass = bookingReturned400 && appts.length===0 && Number(ts[0].is_booked)===0;
    console.log('TEST B', pass ? 'PASS' : 'FAIL');
    process.exit(pass?0:3);
  } catch (err) {
    console.error('Error', err);
    process.exit(2);
  }
}

run();
