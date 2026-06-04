const axios = require('axios');
const pool = require('../db');

async function findOrCreateSlot() {
  // find a barber
  const [barbers] = await pool.execute('SELECT id FROM barbers LIMIT 1');
  if (!barbers || barbers.length === 0) throw new Error('No barber found');
  const barberId = barbers[0].id;

  // find a service
  const [services] = await pool.execute('SELECT id FROM services LIMIT 1');
  if (!services || services.length === 0) throw new Error('No service found');
  const serviceId = services[0].id;

  // try to find a free slot tomorrow
  const [slots] = await pool.execute(
    `SELECT id, slot_date, start_time, end_time FROM time_slots WHERE barber_id = ? AND is_booked = 0 AND slot_date >= CURDATE() + INTERVAL 1 DAY LIMIT 1`,
    [barberId],
  );
  if (slots && slots.length > 0) {
    return { slot: slots[0], barberId, serviceId };
  }

  // create a slot for tomorrow 09:00-11:00
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

async function createCustomer(name, phone) {
  const phoneNorm = phone || (`+840${Math.floor(Math.random()*90000000)+10000000}`);
  const [ins] = await pool.execute('INSERT INTO users (phone, full_name, role) VALUES (?, ?, ?)', [phoneNorm, name, 'customer']);
  return ins.insertId;
}

async function runTest() {
  try {
    const { slot, barberId, serviceId } = await findOrCreateSlot();
    console.log('Test slot:', slot.id, 'barberId:', barberId);

    const customerA = await createCustomer('Test Customer A');
    const customerB = await createCustomer('Test Customer B');

    const payload = (customerId) => ({
      customer_id: customerId,
      barber_id: barberId,
      service_id: serviceId,
      time_slot_id: slot.id,
      appt_date: slot.slot_date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      total_price: 100000,
      note: 'concurrent test',
    });

    const url = process.env.SERVER_URL || 'http://localhost:3000/api/appointments';

    // Send two requests near-simultaneously
    const wrap = async (p) => {
      try {
        const r = await axios.post(url, p);
        return { status: r.status, data: r.data };
      } catch (e) {
        const res = e.response;
        return {
          status: res?.status || 500,
          data: res?.data ?? { message: e.message, stack: e.stack },
          isAxiosError: e.isAxiosError === true,
        };
      }
    };

    const reqA = wrap(payload(customerA));
    const reqB = wrap(payload(customerB));

    const results = await Promise.all([reqA, reqB]);

    console.log('Results:');
    console.log('A:', results[0]);
    console.log('B:', results[1]);

    // DB checks
    const [appts] = await pool.execute('SELECT id, status, customer_id, created_at FROM appointments WHERE time_slot_id = ?', [slot.id]);
    console.log('Appointments for slot:', appts);

    const [ts] = await pool.execute('SELECT is_booked FROM time_slots WHERE id = ?', [slot.id]);
    console.log('Time slot is_booked:', ts[0]);

    // print simple PASS/FAIL
    const successCount = results.filter(r => r.status === 201).length;
    const conflictCount = results.filter(r => r.status === 409).length;
    if (successCount === 1 && conflictCount === 1) {
      console.log('TEST A: PASS');
    } else {
      console.log('TEST A: FAIL');
    }

    // also output DB expectations
    const activeAppointments = appts.filter(a => a.status !== 'cancelled');
    console.log('Active appointments count:', activeAppointments.length);

    process.exit(0);
  } catch (err) {
    console.error('Error running test:', err);
    process.exit(2);
  }
}

runTest();
