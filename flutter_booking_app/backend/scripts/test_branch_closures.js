const axios = require('axios');
const pool = require('../db');

const API_BASE = process.env.SERVER_URL || 'http://localhost:3000/api';

async function findOrCreateSlot() {
  const [barbers] = await pool.execute('SELECT id FROM barbers LIMIT 1');
  if (!barbers || barbers.length === 0) throw new Error('No barber found');
  const barberId = barbers[0].id;

  const [services] = await pool.execute('SELECT id FROM services LIMIT 1');
  if (!services || services.length === 0) throw new Error('No service found');
  const serviceId = services[0].id;

  // try to find a free slot tomorrow
  const [slots] = await pool.execute(
    `SELECT id, slot_date, start_time, end_time FROM time_slots WHERE barber_id = ? AND is_booked = 0 AND slot_date >= CURDATE() + INTERVAL 1 DAY LIMIT 1`,
    [barberId],
  );
  if (slots && slots.length > 0) return { slot: slots[0], barberId, serviceId };

  const [r] = await pool.execute("SELECT DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY),'%Y-%m-%d') AS d");
  const date = r[0].d;
  const start_time = '09:00:00';
  const end_time = '11:00:00';
  const [ins] = await pool.execute(
    `INSERT INTO time_slots (barber_id, slot_date, start_time, end_time, is_booked) VALUES (?, ?, ?, ?, 0)`,
    [barberId, date, start_time, end_time],
  );
  const slotId = ins.insertId;
  return { slot: { id: slotId, slot_date: date, start_time, end_time }, barberId, serviceId };
}

async function createCustomer(name) {
  const phone = `+840${Math.floor(Math.random() * 90000000) + 10000000}`;
  const [ins] = await pool.execute('INSERT INTO users (phone, full_name, role) VALUES (?, ?, ?)', [phone, name, 'customer']);
  return ins.insertId;
}

async function createClosure(branchId, startDate, endDate, opts = {}) {
  const payload = {
    branch_id: branchId,
    start_date: startDate,
    end_date: endDate,
    closure_type: opts.type || 'holiday',
    start_time: opts.start_time || null,
    end_time: opts.end_time || null,
    reason: opts.reason || 'Test closure',
    created_by: opts.created_by || null,
  };
  try {
    const r = await axios.post(`${API_BASE}/branch-closures`, payload);
    return r.data.closure;
  } catch (e) {
    return { error: e.response?.data ?? e.message };
  }
}

async function cancelClosure(id) {
  try {
    const r = await axios.post(`${API_BASE}/branch-closures/${id}/cancel`, { canceled_by: null });
    return r.data;
  } catch (e) {
    return { error: e.response?.data ?? e.message };
  }
}

async function tryBooking(payload) {
  try {
    const r = await axios.post(`${API_BASE}/appointments`, payload);
    return { status: r.status, data: r.data };
  } catch (e) {
    return { status: e.response?.status || 500, data: e.response?.data ?? { message: e.message } };
  }
}

(async function run() {
  try {
    const { slot, barberId, serviceId } = await findOrCreateSlot();
    console.log('Using slot', slot);

    // find branch for barber
    const [[brow]] = await pool.execute('SELECT u.branch_id FROM barbers b JOIN users u ON u.id = b.user_id WHERE b.id = ? LIMIT 1', [barberId]);
    const branchId = brow?.branch_id;
    if (!branchId) throw new Error('Barber has no branch assigned');

    const customer = await createCustomer('Closure Test Customer');

    // TEST I: Owner creates holiday closure. Booking must fail.
    console.log('TEST I: create holiday closure for slot date');
    const c = await createClosure(branchId, slot.slot_date, slot.slot_date, { type: 'holiday', reason: 'Owner holiday' });
    console.log('Created closure:', c);

    const payload = {
      customer_id: customer,
      barber_id: barberId,
      service_id: serviceId,
      time_slot_id: slot.id,
      appt_date: slot.slot_date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      total_price: 100000,
    };

    const r1 = await tryBooking(payload);
    console.log('Booking attempt during closure:', r1);

    // TEST N: Owner cancels closure. Booking becomes available immediately.
    console.log('TEST N: cancel closure and try booking again');
    const cancelRes = await cancelClosure(c.id);
    console.log('Cancel result:', cancelRes);

    const r2 = await tryBooking(payload);
    console.log('Booking attempt after cancel:', r2);

    // TEST M: Closure expires. Simulate by creating a closure in the past and ensure booking allowed.
    console.log('TEST M: expired closure should not block booking');
    // create closure yesterday
    const [drow] = await pool.execute("SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 2 DAY),'%Y-%m-%d') AS d");
    const pastDate = drow[0].d;
    const pastClosure = await createClosure(branchId, pastDate, pastDate, { type: 'maintenance' });
    console.log('Past closure created:', pastClosure);

    const r3 = await tryBooking(payload);
    console.log('Booking attempt with past closure present:', r3);

    console.log('Done tests.');
    process.exit(0);
  } catch (e) {
    console.error('Test script error:', e);
    process.exit(2);
  }
})();
