const express = require('express');

const pool = require('../db');

const router = express.Router();

const VALID_APPOINTMENT_STATUSES = new Set([
  'pending',
  'confirmed',
  'in_progress',
  'technician_completed',
  'paid_and_done',
  'completed',
  'cancelled',
  'cancelled_by_branch',
]);

let _apptHasBranchId;

async function appointmentsHasBranchIdColumn() {
  if (_apptHasBranchId !== undefined) return _apptHasBranchId;
  const [r] = await pool.execute(
    `
    SELECT 1 AS ok FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments'
      AND COLUMN_NAME = 'branch_id'
    LIMIT 1
    `,
  );
  _apptHasBranchId = r.length > 0;
  return _apptHasBranchId;
}

router.get('/timeslots/:barberId/:date', async (req, res) => {
  const barberId = Number(req.params.barberId);
  const date = req.params.date; // yyyy-MM-dd

  if (!Number.isFinite(barberId) || barberId <= 0) {
    return res.status(400).json({ error: 'barberId không hợp lệ' });
  }
  if (!date || !String(date).includes('-')) {
    return res.status(400).json({ error: 'date không hợp lệ' });
  }

  function parseTimeToMinutes(t) {
    // supports 'HH:MM' or 'HH:MM:SS'
    const str = String(t ?? '');
    const parts = str.split(':');
    if (parts.length < 2) return null;
    const hh = Number(parts[0]);
    const mm = Number(parts[1]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return hh * 60 + mm;
  }

  function minutesToTimeStr(mins) {
    const m = Math.max(0, mins);
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
  }

  // Booking của bạn yêu cầu mỗi lịch là 2 tiếng (ví dụ: 09:00-11:00).
  const slotDurationMinutes = 120;

  try {
    let [rows] = await pool.execute(
      `
      SELECT
        id,
        start_time,
        end_time,
        is_booked
      FROM time_slots
      WHERE barber_id = ? AND slot_date = ?
      ORDER BY start_time ASC
      `,
      [barberId, date],
    );

    // Nếu slot đã tồn tại nhưng độ dài không đúng (ví dụ trước đó seed 30 phút),
    // xóa và seed lại để đồng bộ đúng "mỗi slot = 2 tiếng".
    if (rows && rows.length > 0) {
      const first = rows[0];
      const startMins = parseTimeToMinutes(first.start_time);
      const endMins = parseTimeToMinutes(first.end_time);
      const dur = (startMins != null && endMins != null) ? (endMins - startMins) : null;
      if (dur != null && dur !== slotDurationMinutes) {
        await pool.execute(
          'DELETE FROM time_slots WHERE barber_id = ? AND slot_date = ?',
          [barberId, date],
        );
        rows = [];
      }
    }

    // If no slots exist yet, auto-seed them so booking flow can work.
    if (!rows || rows.length === 0) {
      // Prefer working_schedules if present
      const [scheduleRows] = await pool.execute(
        `
        SELECT start_time, end_time, is_day_off
        FROM working_schedules
        WHERE barber_id = ? AND work_date = ?
        LIMIT 1
        `,
        [barberId, date],
      );

      let startTime = '09:00:00';
      let endTime = '18:00:00';
      let isDayOff = 0;

      if (scheduleRows && scheduleRows.length > 0) {
        startTime = scheduleRows[0].start_time ?? startTime;
        endTime = scheduleRows[0].end_time ?? endTime;
        isDayOff = Number(scheduleRows[0].is_day_off ?? 0);
      }

      if (!isDayOff) {
        const startMins = parseTimeToMinutes(startTime);
        const endMins = parseTimeToMinutes(endTime);

        if (startMins != null && endMins != null && endMins > startMins) {
          // Insert missing slots (is_booked default 0)
          for (let t = startMins; t + slotDurationMinutes <= endMins; t += slotDurationMinutes) {
            const slotStart = minutesToTimeStr(t);
            const slotEnd = minutesToTimeStr(t + slotDurationMinutes);

            // Avoid duplicates: check existing slot by barber/date/start/end
            const [existsRows] = await pool.execute(
              `
              SELECT id
              FROM time_slots
              WHERE barber_id = ? AND slot_date = ? AND start_time = ? AND end_time = ?
              LIMIT 1
              `,
              [barberId, date, slotStart, slotEnd],
            );

            if (!existsRows || existsRows.length === 0) {
              await pool.execute(
                `
                INSERT INTO time_slots (barber_id, slot_date, start_time, end_time, is_booked)
                VALUES (?, ?, ?, ?, 0)
                `,
                [barberId, date, slotStart, slotEnd],
              );
            }
          }
        }
      }

      // Re-query after seeding
      ;[rows] = await pool.execute(
        `
        SELECT
          id,
          start_time,
          end_time,
          is_booked
        FROM time_slots
        WHERE barber_id = ? AND slot_date = ?
        ORDER BY start_time ASC
        `,
        [barberId, date],
      );
    }

    // Additional filtering to ensure slots are valid and in-sync with appointments and branch closures.
    const allSlots = rows ?? [];
    const totalSlots = allSlots.length;

    // Prepare results when no slots
    if (totalSlots === 0) {
      console.debug(`[timeslots] barberId=${barberId} date=${date} total=0 filtered=0`);
      return res.status(200).json({ slots: [] });
    }

    const slotIds = allSlots.map((s) => s.id);

    // 1) find appointments that reference these slots and are NOT cancelled
    let apptConflictingSlotIds = new Set();
    try {
      const placeholders = slotIds.map(() => '?').join(',');
      const [apptRows] = await pool.execute(
        `SELECT DISTINCT time_slot_id FROM appointments WHERE time_slot_id IN (${placeholders}) AND status NOT IN ('cancelled','cancelled_by_branch')`,
        slotIds,
      );
      for (const ar of apptRows) apptConflictingSlotIds.add(Number(ar.time_slot_id));
    } catch (e) {
      console.error('Error checking appointments for timeslots:', e?.message || e);
    }

    // 2) get barber branch_id (if any) and fetch closures for that date
    let branchId = null;
    let closures = [];
    try {
      const [[brow]] = await pool.execute(
        'SELECT u.branch_id FROM barbers b JOIN users u ON u.id = b.user_id WHERE b.id = ? LIMIT 1',
        [barberId],
      );
      branchId = brow?.branch_id || null;
      if (branchId) {
        const [crows] = await pool.execute(
          'SELECT start_date, end_date, closure_type, start_time, end_time FROM branch_closures WHERE branch_id = ? AND start_date <= ? AND end_date >= ? AND canceled_at IS NULL',
          [branchId, date, date],
        );
        closures = crows || [];
      }
    } catch (e) {
      console.error('Error checking branch_closures for timeslots:', e?.message || e);
    }

    // 3) server current time and date
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = now.toISOString().slice(0, 10);
    const currentTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`; // HH:MM:SS

    // Counters for debug
    let filteredByIsBooked = 0;
    let filteredByAppt = 0;
    let filteredByClosure = 0;
    let filteredByPastTime = 0;

    function timeOverlap(aStart, aEnd, bStart, bEnd) {
      if (!aStart || !aEnd || !bStart || !bEnd) return false;
      return !(aEnd <= bStart || bEnd <= aStart);
    }

    const filtered = allSlots.filter((s) => {
      // Keep original record shape
      const sid = Number(s.id);

      // 1) is_booked must be 0
      if (Number(s.is_booked) === 1) {
        filteredByIsBooked += 1;
        return false;
      }

      // 2) no non-cancelled appointment should exist for this slot
      if (apptConflictingSlotIds.has(sid)) {
        filteredByAppt += 1;
        return false;
      }

      // 3) branch closures: if any closure applies -> filter out
      if (closures && closures.length > 0) {
        for (const c of closures) {
          if (Number(c.is_full_day) === 1) {
            filteredByClosure += 1;
            return false;
          }
          // partial closure: check overlap between slot and closure time
          if (timeOverlap(s.start_time, s.end_time, c.start_time, c.end_time)) {
            filteredByClosure += 1;
            return false;
          }
        }
      }

      // 4) if date is today, filter out slots that already passed (end_time <= current time)
      if (date === todayStr) {
        if (s.end_time <= currentTimeStr) {
          filteredByPastTime += 1;
          return false;
        }
      }

      return true;
    });

    console.debug(`[timeslots] barberId=${barberId} date=${date} total=${totalSlots} filtered=${filtered.length} reasons={is_booked:${filteredByIsBooked}, appt:${filteredByAppt}, closure:${filteredByClosure}, past_time:${filteredByPastTime}}`);

    return res.status(200).json({ slots: filtered });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message ?? 'Server error' });
  }
});

// GET /api/appointments (admin)
router.get('/appointments', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT
        a.id AS id,
        uC.full_name AS customer_full_name,
        uC.full_name AS customer_name,
        uB.full_name AS barber_full_name,
        uB.full_name AS barber_name,
        b.id AS barber_id,
        DATE_FORMAT(a.appt_date, '%Y-%m-%d') AS appt_date,
        DATE_FORMAT(a.appt_date, '%Y-%m-%d') AS date,
        a.status AS status,
        s.name AS service_name,
        a.start_time AS start_time,
        a.end_time AS end_time,
        a.total_price AS total_price
      FROM appointments a
      JOIN users uC ON uC.id = a.customer_id
      JOIN barbers b ON b.id = a.barber_id
      JOIN users uB ON uB.id = b.user_id
      JOIN services s ON s.id = a.service_id
      ORDER BY a.created_at DESC
      `,
    );

    // enrich each appointment with branch closure info for that appointment date
    try {
      const barberIds = Array.from(new Set(rows.map((r) => Number(r.barber_id)).filter(Boolean)));
      if (barberIds.length > 0) {
        const placeholders = barberIds.map(() => '?').join(',');
        const [brows] = await pool.execute(`SELECT b.id AS barber_id, u.branch_id FROM barbers b JOIN users u ON u.id = b.user_id WHERE b.id IN (${placeholders})`, barberIds);
        const branchByBarber = new Map(brows.map((b) => [Number(b.barber_id), b.branch_id]));

        // collect unique queries for closures
        const dateBranchPairs = new Map();
        for (const r of rows) {
          const bid = branchByBarber.get(Number(r.barber_id)) || null;
          r.branch_id = bid;
          if (bid) {
            const key = `${bid}::${r.appt_date}`;
            dateBranchPairs.set(key, { branch_id: bid, date: r.appt_date });
          }
        }

        const closuresMap = new Map();
        if (dateBranchPairs.size > 0) {
          for (const v of dateBranchPairs.values()) {
            const [cr] = await pool.execute('SELECT closure_type, reason FROM branch_closures WHERE branch_id = ? AND start_date <= ? AND end_date >= ? AND canceled_at IS NULL LIMIT 1', [v.branch_id, v.date, v.date]);
            if (cr && cr.length > 0) {
              closuresMap.set(`${v.branch_id}::${v.date}`, cr[0]);
            }
          }
        }

        for (const r of rows) {
          const key = `${r.branch_id}::${r.appt_date}`;
          const c = closuresMap.get(key) || null;
          if (c) {
            r.branch_closed = true;
            r.closure_type = c.closure_type;
            r.closure_reason = c.reason;
          } else {
            r.branch_closed = false;
          }
        }
      }
    } catch (e) {
      console.error('enrich appointments with closure info failed:', e?.message || e);
    }

    // enrich alias response similarly
    try {
      const barberIds = Array.from(new Set(rows.map((r) => Number(r.barber_id)).filter(Boolean)));
      if (barberIds.length > 0) {
        const placeholders = barberIds.map(() => '?').join(',');
        const [brows] = await pool.execute(`SELECT b.id AS barber_id, u.branch_id FROM barbers b JOIN users u ON u.id = b.user_id WHERE b.id IN (${placeholders})`, barberIds);
        const branchByBarber = new Map(brows.map((b) => [Number(b.barber_id), b.branch_id]));
        const dateBranchPairs = new Map();
        for (const r of rows) {
          const bid = branchByBarber.get(Number(r.barber_id)) || null;
          r.branch_id = bid;
          if (bid) dateBranchPairs.set(`${bid}::${r.appt_date}`, { branch_id: bid, date: r.appt_date });
        }
        const closuresMap = new Map();
        if (dateBranchPairs.size > 0) {
          for (const v of dateBranchPairs.values()) {
            const [cr] = await pool.execute('SELECT closure_type, reason FROM branch_closures WHERE branch_id = ? AND start_date <= ? AND end_date >= ? AND canceled_at IS NULL LIMIT 1', [v.branch_id, v.date, v.date]);
            if (cr && cr.length > 0) closuresMap.set(`${v.branch_id}::${v.date}`, cr[0]);
          }
        }
        for (const r of rows) {
          const key = `${r.branch_id}::${r.appt_date}`;
          const c = closuresMap.get(key) || null;
          if (c) {
            r.branch_closed = true;
            r.closure_type = c.closure_type;
            r.closure_reason = c.reason;
          } else {
            r.branch_closed = false;
          }
        }
      }
    } catch (e) {
      console.error('enrich alias appointments with closure info failed:', e?.message || e);
    }

    return res.status(200).json({ appointments: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message ?? 'Server error' });
  }
});

// GET /api/admin/appointments (alias for older clients)
router.get('/admin/appointments', async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT
        a.id AS id,
        uC.full_name AS customer_full_name,
        uC.full_name AS customer_name,
        uB.full_name AS barber_full_name,
        uB.full_name AS barber_name,
        DATE_FORMAT(a.appt_date, '%Y-%m-%d') AS appt_date,
        DATE_FORMAT(a.appt_date, '%Y-%m-%d') AS date,
        a.status AS status,
        s.name AS service_name,
        a.start_time AS start_time,
        a.end_time AS end_time,
        a.total_price AS total_price
      FROM appointments a
      JOIN users uC ON uC.id = a.customer_id
      JOIN barbers b ON b.id = a.barber_id
      JOIN users uB ON uB.id = b.user_id
      JOIN services s ON s.id = a.service_id
      ORDER BY a.created_at DESC
      `,
    );

    return res.status(200).json({ appointments: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message ?? 'Server error' });
  }
});

// GET /api/appointments/customer/:customerId
router.get('/appointments/customer/:customerId', async (req, res) => {
  const customerId = Number(req.params.customerId);
  if (!Number.isFinite(customerId) || customerId <= 0) {
    return res.status(400).json({ error: 'customerId không hợp lệ' });
  }

  try {
    const [rows] = await pool.execute(
      `
      SELECT
        a.id AS id,
        DATE_FORMAT(a.appt_date, '%Y-%m-%d') AS appt_date,
        a.status AS status,
        a.total_price AS total_price,
        a.start_time AS start_time,
        a.end_time AS end_time,
        s.name AS service_name,
        uB.full_name AS barber_full_name,
        uB.full_name AS barber_name,
        b.id AS barber_id
      FROM appointments a
      JOIN barbers b ON b.id = a.barber_id
      JOIN users uB ON uB.id = b.user_id
      JOIN services s ON s.id = a.service_id
      WHERE a.customer_id = ?
      ORDER BY a.appt_date DESC, a.start_time DESC, a.created_at DESC
      `,
      [customerId],
    );

    return res.status(200).json({ appointments: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message ?? 'Server error' });
  }
});

// PATCH /api/appointments/:id/cancel  -- allow customer to cancel their own appointment
router.patch('/appointments/:id/cancel', async (req, res) => {
  const id = Number(req.params.id);
  const customerId = Number(req.body?.customer_id || req.query?.customer_id || 0);
  if (!id || id <= 0) return res.status(400).json({ error: 'id không hợp lệ' });
  if (!customerId || customerId <= 0) return res.status(400).json({ error: 'customer_id không hợp lệ' });

  try {
    const [[row]] = await pool.execute('SELECT id, customer_id, barber_id, status FROM appointments WHERE id = ? LIMIT 1', [id]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy lịch' });
    if (Number(row.customer_id) !== Number(customerId)) return res.status(403).json({ error: 'Lịch không thuộc khách này' });
    const currentStatus = String(row.status || '').toLowerCase();
    // Only allow customer to cancel when appointment is still pending (chưa được thợ xác nhận)
    if (currentStatus !== 'pending') {
      return res.status(400).json({ error: 'Chỉ cho phép hủy khi chưa được thợ xác nhận' });
    }

    // Chỉ cho phép khách hủy khi lịch chưa được thợ xác nhận (status = 'pending')
    if (currentStatus !== 'pending') {
      return res.status(400).json({ error: 'Chỉ có thể hủy khi thợ chưa xác nhận lịch' });
    }

    await pool.execute('UPDATE appointments SET status = ? WHERE id = ?', ['cancelled', id]);

    // notify barber user if possible (DB notification + realtime emit)
    let barberUserId = null;
    try {
      const [[brow]] = await pool.execute('SELECT user_id FROM barbers WHERE id = ? LIMIT 1', [row.barber_id]);
      barberUserId = brow?.user_id || null;
      const [[cust]] = await pool.execute('SELECT full_name FROM users WHERE id = ? LIMIT 1', [customerId]);
      const customerName = cust?.full_name || 'Khách';
      if (barberUserId) {
        await pool.execute('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [barberUserId, 'appointment', 'Khách hủy lịch', `Khách ${customerName} đã hủy lịch (${id})`]);
      }
    } catch (e) {
      console.error('notify barber on cancel failed:', e?.message || e);
    }

    const [[updated]] = await pool.execute(
      `
      SELECT
        a.id,
        a.customer_id,
        a.barber_id,
        a.service_id,
        a.appt_date,
        a.start_time,
        a.end_time,
        a.total_price,
        a.status,
        a.note,
        a.created_at
      FROM appointments a
      WHERE a.id = ?
      LIMIT 1
      `,
      [id],
    );

    // Emit realtime event to barber's socket room if available
    try {
      if (barberUserId && global.io && typeof global.io.to === 'function') {
        global.io.to(`user_${barberUserId}`).emit('appointment_cancelled', { appointment: updated });
      }
    } catch (e) {
      console.error('emit realtime appointment_cancelled failed:', e?.message || e);
    }

    return res.json({ appointment: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// GET /api/appointments/barber/:barberId
router.get('/appointments/barber/:barberId', async (req, res) => {
  const barberId = Number(req.params.barberId);
  if (!Number.isFinite(barberId) || barberId <= 0) {
    return res.status(400).json({ error: 'barberId không hợp lệ' });
  }

  try {
    console.log(`[API] GET /api/appointments/barber/${barberId} - received barberId=${barberId}`);
    const [rows] = await pool.execute(
      `
      SELECT
        a.id AS id,
        DATE_FORMAT(a.appt_date, '%Y-%m-%d') AS appt_date,
        a.status AS status,
        a.customer_id AS customer_id,
        a.barber_id AS barber_id,
        a.total_price AS total_price,
        a.start_time AS start_time,
        a.end_time AS end_time,
        s.name AS service_name,
        uC.full_name AS customer_full_name,
        uC.full_name AS customer_name
      FROM appointments a
      JOIN users uC ON uC.id = a.customer_id
      JOIN services s ON s.id = a.service_id
      WHERE a.barber_id = ?
      ORDER BY a.created_at DESC
      `,
      [barberId],
    );

    return res.status(200).json({ appointments: rows });
  } catch (err) {
    console.error(`[API] GET /api/appointments/barber/${barberId} - error:`, err?.message || err);
    console.error(err);
    return res.status(500).json({ error: err.message ?? 'Server error' });
  }
});

// POST /api/appointments
router.post('/appointments', async (req, res) => {
  const {
    customer_id,
    barber_id,
    service_id,
    time_slot_id,
    appt_date,
    start_time,
    end_time,
    total_price,
    note,
  } = req.body ?? {};

  const customerId = Number(customer_id);
  const barberId = Number(barber_id);
  const serviceId = Number(service_id);
  const timeSlotId = Number(time_slot_id);
  const totalPrice = Number(total_price);

  if (!customerId || customerId <= 0) return res.status(400).json({ error: 'Thiếu customer_id' });
  if (!barberId || barberId <= 0) return res.status(400).json({ error: 'Thiếu barber_id' });
  if (!serviceId || serviceId <= 0) return res.status(400).json({ error: 'Thiếu service_id' });
  if (!timeSlotId || timeSlotId <= 0) return res.status(400).json({ error: 'Thiếu time_slot_id' });
  if (!appt_date) return res.status(400).json({ error: 'Thiếu appt_date' });
  if (!start_time) return res.status(400).json({ error: 'Thiếu start_time' });
  if (!end_time) return res.status(400).json({ error: 'Thiếu end_time' });
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) return res.status(400).json({ error: 'total_price không hợp lệ' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Lock the time_slot row first (consistent lock ordering)
    const [slotRows] = await conn.execute(
      `SELECT id, barber_id, slot_date, start_time, end_time, is_booked,
        STR_TO_DATE(CONCAT(DATE_FORMAT(slot_date, '%Y-%m-%d'), ' ', end_time), '%Y-%m-%d %H:%i:%s') AS slot_end_ts,
        (STR_TO_DATE(CONCAT(DATE_FORMAT(slot_date, '%Y-%m-%d'), ' ', end_time), '%Y-%m-%d %H:%i:%s') <= NOW()) AS is_expired
      FROM time_slots
      WHERE id = ? AND barber_id = ? FOR UPDATE`,
      [timeSlotId, barberId],
    );
    if (!slotRows || slotRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Không tìm thấy time slot' });
    }

    const slot = slotRows[0];
    console.log('[booking-debug] slotRows0:', slot);
    const apptDateStr = String(appt_date ?? '').trim();
    const apptDateYmd = apptDateStr.length >= 10 ? apptDateStr.slice(0, 10) : apptDateStr;

    // server time check for expired slot (use DB-calculated absolute timestamp)
    const isExpired = Number(slot.is_expired || 0) === 1;
    if (isExpired) {
      await conn.rollback();
      console.log(`[booking] slotId=${timeSlotId} customerId=${customerId} barberId=${barberId} result=expired`);
      return res.status(400).json({ error: 'Khung giờ đã trôi' });
    }

    // 2) If slot.is_booked flagged, treat as conflict
    if (Number(slot.is_booked) === 1) {
      await conn.rollback();
      console.log(`[booking] slotId=${timeSlotId} customerId=${customerId} barberId=${barberId} result=conflict`);
      return res.status(409).json({ error: 'Xin lỗi, lịch này đã kín. Vui lòng chọn thợ hoặc khung giờ khác.' });
    }

    // 3) Validate branch closures inside transaction
    const needBranch = await appointmentsHasBranchIdColumn();
    let branchId = null;
    if (needBranch) {
      const [[br]] = await conn.execute(
        'SELECT u.branch_id FROM barbers b JOIN users u ON u.id = b.user_id WHERE b.id = ? LIMIT 1',
        [barberId],
      );
      branchId = br?.branch_id != null ? Number(br.branch_id) : null;
      if (!branchId || branchId <= 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Thợ chưa gán chi nhánh (branch_id). Cập nhật bảng users.branch_id trong DB.' });
      }

      const [closureRows] = await conn.execute(
        'SELECT start_date, end_date, closure_type, start_time, end_time FROM branch_closures WHERE branch_id = ? AND start_date <= ? AND end_date >= ? AND canceled_at IS NULL FOR UPDATE',
        [branchId, slot.slot_date, slot.slot_date],
      );
      if (closureRows && closureRows.length > 0) {
        for (const c of closureRows) {
          const fullDay = !(c.start_time && c.end_time);
          if (fullDay) {
            await conn.rollback();
            console.log(`[booking] slotId=${timeSlotId} customerId=${customerId} barberId=${barberId} result=closed`);
            return res.status(400).json({ error: 'Chi nhánh đang tạm đóng cửa', reason: c.reason ?? undefined });
          }
          // partial closure overlap
          if (c.start_time && c.end_time && !(slot.end_time <= c.start_time || c.end_time <= slot.start_time)) {
            await conn.rollback();
            console.log(`[booking] slotId=${timeSlotId} customerId=${customerId} barberId=${barberId} result=closed`);
            return res.status(400).json({ error: 'Chi nhánh đang tạm đóng cửa', reason: c.reason ?? undefined });
          }
        }
      }
    }

    // 3b) Validate barber availability / working schedule (reject if barber marked unavailable or on day off)
    try {
      const [[binfo]] = await conn.execute(
        'SELECT b.is_available AS is_available, u.status AS user_status FROM barbers b JOIN users u ON u.id = b.user_id WHERE b.id = ? LIMIT 1 FOR UPDATE',
        [barberId],
      );
      const isAvailable = Number(binfo?.is_available ?? 1);
      const userStatus = String(binfo?.user_status || '').toLowerCase();
      if (isAvailable === 0 || (userStatus && userStatus !== 'available' && userStatus !== 'đang làm' && userStatus !== 'dang lam')) {
        await conn.rollback();
        console.log(`[booking] slotId=${timeSlotId} customerId=${customerId} barberId=${barberId} result=barber_unavailable`);
        return res.status(400).json({ error: 'Thợ hiện không có mặt' });
      }

      const [wsRows] = await conn.execute(
        'SELECT is_day_off FROM working_schedules WHERE barber_id = ? AND work_date = ? LIMIT 1 FOR UPDATE',
        [barberId, slot.slot_date],
      );
      if (wsRows && wsRows.length > 0 && Number(wsRows[0].is_day_off) === 1) {
        await conn.rollback();
        console.log(`[booking] slotId=${timeSlotId} customerId=${customerId} barberId=${barberId} result=barber_off`);
        return res.status(400).json({ error: 'Thợ nghỉ trong ngày' });
      }
    } catch (e) {
      // If any failure occurs here, rollback and surface error
      await conn.rollback();
      console.error('barber availability check failed:', e?.message || e);
      return res.status(500).json({ error: 'Lỗi kiểm tra trạng thái thợ' });
    }

    // 4) Lock appointments for this slot to check conflicts (must lock after time_slots)
    const [conf] = await conn.execute(
      `SELECT id FROM appointments WHERE time_slot_id = ? AND status NOT IN ('cancelled','cancelled_by_branch') LIMIT 1 FOR UPDATE`,
      [timeSlotId],
    );
    if (conf && conf.length > 0) {
      await conn.rollback();
      console.log(`[booking] slotId=${timeSlotId} customerId=${customerId} barberId=${barberId} result=conflict`);
      return res.status(409).json({ error: 'Xin lỗi, lịch này đã kín. Vui lòng chọn thợ hoặc khung giờ khác.' });
    }

    // 5) Insert appointment
    const insertSql = needBranch
      ? `INSERT INTO appointments (customer_id, barber_id, branch_id, service_id, time_slot_id, appt_date, start_time, end_time, total_price, note, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      : `INSERT INTO appointments (customer_id, barber_id, service_id, time_slot_id, appt_date, start_time, end_time, total_price, note, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`;
    const effectiveApptDate = apptDateYmd;
    const insertParams = needBranch
      ? [customerId, barberId, branchId, serviceId, timeSlotId, effectiveApptDate, start_time, end_time, totalPrice, note ?? null]
      : [customerId, barberId, serviceId, timeSlotId, effectiveApptDate, start_time, end_time, totalPrice, note ?? null];

    const [result] = await conn.execute(insertSql, insertParams);
    const appointmentId = result.insertId;

    // 6) Update time_slots.is_booked = 1
    await conn.execute('UPDATE time_slots SET is_booked = 1 WHERE id = ?', [timeSlotId]);

    // 7) Read appointment for response (within transaction)
    const [rows] = await conn.execute(
      `SELECT a.id AS id, uC.full_name AS customer_full_name, uC.full_name AS customer_name, uB.full_name AS barber_full_name, uB.full_name AS barber_name, a.appt_date AS appt_date, a.status AS status, s.name AS service_name, a.start_time AS start_time, a.end_time AS end_time, a.total_price AS total_price, a.note AS note, a.created_at AS created_at FROM appointments a JOIN users uC ON uC.id = a.customer_id JOIN barbers b ON b.id = a.barber_id JOIN users uB ON uB.id = b.user_id JOIN services s ON s.id = a.service_id WHERE a.id = ? LIMIT 1`,
      [appointmentId],
    );

    await conn.commit();

    // Notify barber user about new booking (after commit)
    try {
      const [[barberRow]] = await pool.execute('SELECT user_id FROM barbers WHERE id = ? LIMIT 1', [barberId]);
      const [[cust]] = await pool.execute('SELECT full_name FROM users WHERE id = ? LIMIT 1', [customerId]);
      const barberUserId = barberRow?.user_id || null;
      const customerName = cust?.full_name || 'Khách';
      if (barberUserId) {
        await pool.execute(`INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'booking', 'Có khách đặt lịch mới', ?)`, [barberUserId, `Khách ${customerName} vừa đặt lịch ${effectiveApptDate} ${start_time}`]);
      }
    } catch (e) {
      console.error('notify booking:', e?.message || e);
    }

    console.log(`[booking] slotId=${timeSlotId} customerId=${customerId} barberId=${barberId} result=success`);
    return res.status(201).json({ status: 'success', appointment: rows[0] ?? null });
  } catch (err) {
    try { await conn.rollback(); } catch (e) {}
    console.error(err);
    console.log(`[booking] slotId=${timeSlotId} customerId=${customerId} barberId=${barberId} result=error`);
    return res.status(500).json({ error: err.message ?? 'Server error' });
  } finally {
    conn.release();
  }
});

module.exports = router;

