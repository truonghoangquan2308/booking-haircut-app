const axios = require('axios');
const pool = require('../db');

const API_BASE = process.env.SERVER_URL || 'http://localhost:3000/api';

async function createCustomer(name) {
  const phone = `+840${Math.floor(Math.random() * 90000000) + 10000000}`;
  const [ins] = await pool.execute('INSERT INTO users (phone, full_name, role) VALUES (?, ?, ?)', [phone, name, 'customer']);
  return ins.insertId;
}

async function findBarberWithBranch() {
  const [rows] = await pool.execute('SELECT b.id AS barber_id, u.branch_id, u.id AS user_id FROM barbers b JOIN users u ON u.id = b.user_id WHERE u.branch_id IS NOT NULL LIMIT 1');
  if (!rows || rows.length === 0) throw new Error('No barber with branch found');
  return rows[0];
}

async function createSlot(barberId, date) {
  const start_time = '09:00:00';
  const end_time = '11:00:00';
  const [ins] = await pool.execute('INSERT INTO time_slots (barber_id, slot_date, start_time, end_time, is_booked) VALUES (?, ?, ?, ?, 0)', [barberId, date, start_time, end_time]);
  return { id: ins.insertId, slot_date: date, start_time, end_time };
}

async function createAppointment(customerId, barberId, serviceId, slot) {
  const [res] = await pool.execute('INSERT INTO appointments (customer_id, barber_id, branch_id, service_id, time_slot_id, appt_date, start_time, end_time, total_price, note, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [customerId, barberId, (await pool.execute('SELECT branch_id FROM users WHERE id = (SELECT user_id FROM barbers WHERE id = ? LIMIT 1)', [barberId]))[0][0].branch_id, serviceId, slot.id, slot.slot_date, slot.start_time, slot.end_time, 100000, 'E2E test appt', 'confirmed']);
  return res.insertId;
}

async function postRequest(payload) {
  const r = await axios.post(`${API_BASE}/branch-closure-requests`, payload);
  return r.data.request;
}

async function approveRequest(id, approverId) {
  const r = await axios.post(`${API_BASE}/branch-closure-requests/${id}/approve`, { approved_by: approverId });
  return r.data;
}

(async function run() {
  try {
    // find barber & branch
    const barber = await findBarberWithBranch();
    const branchId = barber.branch_id;
    const barberId = barber.barber_id;
    console.log('Using barber', barberId, 'branch', branchId);

    // choose service
    const [srows] = await pool.execute('SELECT id FROM services LIMIT 1');
    if (!srows || srows.length === 0) throw new Error('No service');
    const serviceId = srows[0].id;

    // pick date (tomorrow)
    const [drow] = await pool.execute("SELECT DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY),'%Y-%m-%d') AS d");
    const date = drow[0].d;

    // create slot and appointment
    const slot = await createSlot(barberId, date);
    const customerId = await createCustomer('E2E Customer');
    const apptId = await createAppointment(customerId, barberId, serviceId, slot);
    console.log('Created appointment', apptId, 'on slot', slot.id);

    // manager submit request
    const [mgrRow] = await pool.execute('SELECT u.id AS manager_id FROM users u WHERE u.role = ? LIMIT 1', ['manager']);
    const managerId = mgrRow && mgrRow.length > 0 ? mgrRow[0].manager_id : null;
    if (!managerId) throw new Error('No manager user found');

    const payload = {
      branch_id: branchId,
      manager_id: managerId,
      request_type: 'incident',
      title: 'E2E Test Closure',
      detailed_reason: 'Test incident affects appointments',
      start_date: date,
      end_date: date,
      estimated_reopen_date: date,
    };

    const req = await postRequest(payload);
    console.log('Request created:', req.id);

    // find owner
    const [ownerRow] = await pool.execute('SELECT u.id AS owner_id FROM users u WHERE u.role = ? LIMIT 1', ['owner']);
    const ownerId = ownerRow && ownerRow.length > 0 ? ownerRow[0].owner_id : null;
    if (!ownerId) throw new Error('No owner user found');

    // owner approve
    const apr = await approveRequest(req.id, ownerId);
    console.log('Approve result:', apr);

    // check appointment status
      // small delay to allow async notifications/updates to complete
      await new Promise((r) => setTimeout(r, 700));
      const [[a]] = await pool.execute('SELECT id, status, closure_id, note FROM appointments WHERE id = ? LIMIT 1', [apptId]);
      console.log('Appointment after approve:', a);

    // check notifications for customer and barber
    const [custNot] = await pool.execute('SELECT id, title, message FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [customerId]);
    const [barberNot] = await pool.execute('SELECT id, title, message FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [barber.user_id]);
    console.log('Customer notifications sample:', custNot.slice(0,3));
    console.log('Barber notifications sample:', barberNot.slice(0,3));

    // Attempt to create a new appointment via API on the same date (should be blocked by closure)
    try {
      const slot2 = await createSlot(barberId, date);
      const customer2 = await createCustomer('E2E Customer 2');
      const bookingPayload = {
        customer_id: customer2,
        barber_id: barberId,
        service_id: serviceId,
        time_slot_id: slot2.id,
        appt_date: slot2.slot_date,
        start_time: slot2.start_time,
        end_time: slot2.end_time,
        total_price: 100000,
        note: 'E2E booking attempt during closure',
      };
      let bookingOk = false;
      try {
        const br = await axios.post(`${API_BASE}/appointments`, bookingPayload);
        console.log('Unexpected booking success:', br.data);
        bookingOk = true;
      } catch (be) {
        const err = be.response?.data ?? be.message ?? be;
        console.log('Booking attempt error:', err);
        if (be.response && be.response.data && be.response.data.error === 'Chi nhánh đang tạm đóng cửa') {
          console.log('Booking blocked as expected by closure');
        } else {
          throw new Error('Booking API did not return expected closure error');
        }
      }
    } catch (e) {
      console.error('Booking check failed:', e.response?.data ?? e.message ?? e);
      process.exit(2);
    }

    console.log('E2E test complete');
    process.exit(0);
  } catch (e) {
    console.error('E2E test failed:', e.response?.data ?? e.message ?? e);
    process.exit(2);
  }
})();
