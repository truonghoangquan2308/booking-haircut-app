const axios = require('axios');
const pool = require('../db');

function pad(n){return String(n).padStart(2,'0');}

async function getBarberAndService() {
  const [barbers] = await pool.execute('SELECT id FROM barbers LIMIT 1');
  if (!barbers || barbers.length === 0) throw new Error('No barber');
  const barberId = barbers[0].id;
  const [services] = await pool.execute('SELECT id FROM services LIMIT 1');
  if (!services || services.length === 0) throw new Error('No service');
  const serviceId = services[0].id;
  return { barberId, serviceId };
}

async function createCustomer(name) {
  const phone = `+840${Math.floor(Math.random()*90000000)+10000000}`;
  const [ins] = await pool.execute('INSERT INTO users (phone, full_name, role) VALUES (?, ?, ?)', [phone, name, 'customer']);
  return ins.insertId;
}

async function createSlot(barberId, date, start_time, end_time) {
  const [ins] = await pool.execute('INSERT INTO time_slots (barber_id, slot_date, start_time, end_time, is_booked) VALUES (?, ?, ?, ?, 0)', [barberId, date, start_time, end_time]);
  return ins.insertId;
}

async function createBranchClosure(branchId, date, isFullDay=true, start_time=null, end_time=null) {
  const [ins] = await pool.execute('INSERT INTO branch_closures (branch_id, closure_date, is_full_day, start_time, end_time, created_at) VALUES (?, ?, ?, ?, ?, NOW())', [branchId, date, isFullDay?1:0, start_time, end_time]);
  return ins.insertId;
}

async function getBranchIdForBarber(barberId) {
  const [[r]] = await pool.execute('SELECT u.branch_id FROM barbers b JOIN users u ON u.id = b.user_id WHERE b.id = ? LIMIT 1', [barberId]);
  return r?.branch_id || null;
}

async function attemptBooking(payload) {
  const url = process.env.SERVER_URL || 'http://localhost:3000/api/appointments';
  try {
    const res = await axios.post(url, payload);
    return { status: res.status, data: res.data };
  } catch (e) {
    return { status: e.response?.status || 500, data: e.response?.data || { message: e.message } };
  }
}

async function run() {
  try {
    const { barberId, serviceId } = await getBarberAndService();
    console.log('Using barberId,serviceId:', barberId, serviceId);

    // Dates: tomorrow and dayAfter
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24*3600*1000);
    const dayAfter = new Date(now.getTime() + 2*24*3600*1000);
    const date1 = tomorrow.toISOString().slice(0,10);
    const date2 = dayAfter.toISOString().slice(0,10);

    // Times
    const start = '09:00:00';
    const end = '11:00:00';

    // TEST C: branch closure
    console.log('\n=== TEST C: Branch closure blocks booking ===');
    const slotC = await createSlot(barberId, date1, start, end);
    const custC = await createCustomer('BranchClosure Customer');
    const branchId = await getBranchIdForBarber(barberId);
    console.log('slotC, branchId:', slotC, branchId);
    if (!branchId) console.warn('No branch_id for barber — TEST C may be N/A');
    let closureId = null;
    if (branchId) closureId = await createBranchClosure(branchId, date1, true);
    const payloadC = {
      customer_id: custC,
      barber_id: barberId,
      service_id: serviceId,
      time_slot_id: slotC,
      appt_date: date1,
      start_time: start,
      end_time: end,
      total_price: 50000,
      note: 'test C'
    };
    const resC = await attemptBooking(payloadC);
    console.log('Request payload:', payloadC);
    console.log('Response:', resC);
    const [apptsC] = await pool.execute('SELECT * FROM appointments WHERE time_slot_id = ?', [slotC]);
    const [tsC] = await pool.execute('SELECT is_booked FROM time_slots WHERE id = ?', [slotC]);
    console.log('Appointments rows:', apptsC);
    console.log('Time slot is_booked:', tsC[0]);
    console.log('TEST C', (resC.status===400 && apptsC.length===0 && Number(tsC[0].is_booked)===0) ? 'PASS' : 'FAIL');

    // Clean closure
    if (closureId) await pool.execute('UPDATE branch_closures SET canceled_at = NOW() WHERE id = ?', [closureId]);

    // TEST D: successful booking
    console.log('\n=== TEST D: Successful booking ===');
    const slotD = await createSlot(barberId, date2, start, end);
    const custD = await createCustomer('Successful Customer');
    const payloadD = {
      customer_id: custD,
      barber_id: barberId,
      service_id: serviceId,
      time_slot_id: slotD,
      appt_date: date2,
      start_time: start,
      end_time: end,
      total_price: 60000,
      note: 'test D'
    };
    const resD = await attemptBooking(payloadD);
    console.log('Request payload:', payloadD);
    console.log('Response:', resD);
    const [apptsD] = await pool.execute('SELECT * FROM appointments WHERE time_slot_id = ?', [slotD]);
    const [tsD] = await pool.execute('SELECT is_booked FROM time_slots WHERE id = ?', [slotD]);
    console.log('Appointments rows:', apptsD);
    console.log('Time slot is_booked:', tsD[0]);
    console.log('TEST D', (resD.status===201 && apptsD.length===1 && Number(tsD[0].is_booked)===1) ? 'PASS' : 'FAIL');

    // TEST E: booking on already-booked slot (should conflict)
    console.log('\n=== TEST E: Slot already has appointment (conflict) ===');
    const custE = await createCustomer('Conflict Customer');
    const payloadE = {
      customer_id: custE,
      barber_id: barberId,
      service_id: serviceId,
      time_slot_id: slotD,
      appt_date: date2,
      start_time: start,
      end_time: end,
      total_price: 60000,
      note: 'test E'
    };
    const resE = await attemptBooking(payloadE);
    console.log('Request payload:', payloadE);
    console.log('Response:', resE);
    const [apptsE] = await pool.execute('SELECT * FROM appointments WHERE time_slot_id = ?', [slotD]);
    const [tsE] = await pool.execute('SELECT is_booked FROM time_slots WHERE id = ?', [slotD]);
    console.log('Appointments rows:', apptsE);
    console.log('Time slot is_booked:', tsE[0]);
    console.log('TEST E', (resE.status===409 && apptsE.length===1 && Number(tsE[0].is_booked)===1) ? 'PASS' : 'FAIL');

    // TEST F: Barber LeaveMark unavailable/on leave -> booking rejected
    console.log('\n=== TEST F: Barber unavailable/on leave ===');
    // mark barber unavailable
    await pool.execute('UPDATE barbers SET is_available = 0 WHERE id = ?', [barberId]);
    const slotF = await createSlot(barberId, date2, start, end);
    const custF = await createCustomer('Leave Customer');
    const payloadF = {
      customer_id: custF,
      barber_id: barberId,
      service_id: serviceId,
      time_slot_id: slotF,
      appt_date: date2,
      start_time: start,
      end_time: end,
      total_price: 50000,
      note: 'test F'
    };
    const resF = await attemptBooking(payloadF);
    console.log('Request payload:', payloadF);
    console.log('Response:', resF);
    const [apptsF] = await pool.execute('SELECT * FROM appointments WHERE time_slot_id = ?', [slotF]);
    const [tsF] = await pool.execute('SELECT is_booked FROM time_slots WHERE id = ?', [slotF]);
    console.log('Appointments rows:', apptsF);
    console.log('Time slot is_booked:', tsF[0]);
    console.log('TEST F', (resF.status===400 && apptsF.length===0 && Number(tsF[0].is_booked)===0) ? 'PASS' : 'FAIL');
    // restore barber availability
    await pool.execute('UPDATE barbers SET is_available = 1 WHERE id = ?', [barberId]);

    // TEST G: Future Date Validation — tomorrow 09:00 should succeed even if current time is later today
    console.log('\n=== TEST G: Future date early time booking ===');
    const tomorrowEarlyDate = date1; // date1 is tomorrow
    const slotG = await createSlot(barberId, tomorrowEarlyDate, start, end);
    const custG = await createCustomer('Future Early Customer');
    const payloadG = {
      customer_id: custG,
      barber_id: barberId,
      service_id: serviceId,
      time_slot_id: slotG,
      appt_date: tomorrowEarlyDate,
      start_time: start,
      end_time: end,
      total_price: 50000,
      note: 'test G'
    };
    const resG = await attemptBooking(payloadG);
    console.log('Request payload:', payloadG);
    console.log('Response:', resG);
    const [apptsG] = await pool.execute('SELECT * FROM appointments WHERE time_slot_id = ?', [slotG]);
    const [tsG] = await pool.execute('SELECT is_booked FROM time_slots WHERE id = ?', [slotG]);
    console.log('Appointments rows:', apptsG);
    console.log('Time slot is_booked:', tsG[0]);
    console.log('TEST G', (resG.status===201 && apptsG.length===1 && Number(tsG[0].is_booked)===1) ? 'PASS' : 'FAIL');

    // TEST H: Stale client / late submit
    console.log('\n=== TEST H: Stale client / late submit ===');
    const slotH = await createSlot(barberId, date2, start, end);
    const custH_A = await createCustomer('Stale Client A');
    const custH_B = await createCustomer('Stale Client B');
    // Client A sees slot (no action)
    // Client B books first
    const payloadH_B = { customer_id: custH_B, barber_id: barberId, service_id: serviceId, time_slot_id: slotH, appt_date: date2, start_time: start, end_time: end, total_price: 50000, note: 'test H B' };
    const resH_B = await attemptBooking(payloadH_B);
    console.log('B Response:', resH_B);
    // Now Client A submits old slot
    const payloadH_A = { customer_id: custH_A, barber_id: barberId, service_id: serviceId, time_slot_id: slotH, appt_date: date2, start_time: start, end_time: end, total_price: 50000, note: 'test H A' };
    const resH_A = await attemptBooking(payloadH_A);
    console.log('A Response:', resH_A);
    const [apptsH] = await pool.execute('SELECT * FROM appointments WHERE time_slot_id = ?', [slotH]);
    const [tsH] = await pool.execute('SELECT is_booked FROM time_slots WHERE id = ?', [slotH]);
    console.log('Appointments rows:', apptsH);
    console.log('Time slot is_booked:', tsH[0]);
    console.log('TEST H', (resH_B.status===201 && resH_A.status===409 && apptsH.length===1 && Number(tsH[0].is_booked)===1) ? 'PASS' : 'FAIL');

    process.exit(0);
  } catch (err) {
    console.error('Error running suite:', err);
    process.exit(2);
  }
}

run();
