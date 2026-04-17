const express = require('express');

const pool = require('../db');

const router = express.Router();

const VALID_APPOINTMENT_STATUSES = new Set([
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
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

    return res.status(200).json({ slots: rows ?? [] });
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

// GET /api/appointments/barber/:barberId
router.get('/appointments/barber/:barberId', async (req, res) => {
  const barberId = Number(req.params.barberId);
  if (!Number.isFinite(barberId) || barberId <= 0) {
    return res.status(400).json({ error: 'barberId không hợp lệ' });
  }

  try {
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

  try {
    // validate time slot
    const [slotRows] = await pool.execute(
      `
      SELECT id, barber_id, slot_date, start_time, end_time, is_booked
      FROM time_slots
      WHERE id = ? AND barber_id = ?
      LIMIT 1
      `,
      [timeSlotId, barberId],
    );

    if (!slotRows || slotRows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy time slot' });
    }

    const slot = slotRows[0];
    const apptDateStr = String(appt_date ?? '').trim();
    const apptDateYmd =
      apptDateStr.length >= 10 ? apptDateStr.slice(0, 10) : apptDateStr;
    // NOTE: Không validate slot.slot_date == appt_date do DATE có thể bị lệch 1 ngày
    // vì timezone (MySQL driver trả về Date object theo timezone).
    // Ta tin tưởng appt_date mà front-end gửi (nó đã khớp với endpoint /timeslots).
    const effectiveApptDate = apptDateYmd;
    if (Number(slot.is_booked) === 1) {
      return res.status(400).json({ error: 'Khung giờ này đã được đặt' });
    }

    const needBranch = await appointmentsHasBranchIdColumn();
    let branchId = null;
    if (needBranch) {
      const [[br]] = await pool.execute(
        'SELECT branch_id FROM barbers WHERE id = ? LIMIT 1',
        [barberId],
      );
      branchId = br?.branch_id != null ? Number(br.branch_id) : null;
      if (!branchId || branchId <= 0) {
        return res.status(400).json({
          error:
            'Thợ chưa gán chi nhánh (branch_id). Cập nhật bảng barbers trong DB.',
        });
      }
    }

    const [result] = needBranch
      ? await pool.execute(
          `
          INSERT INTO appointments
            (customer_id, barber_id, branch_id, service_id, time_slot_id, appt_date, start_time, end_time, total_price, note, status)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
          `,
          [
            customerId,
            barberId,
            branchId,
            serviceId,
            timeSlotId,
            effectiveApptDate,
            start_time,
            end_time,
            totalPrice,
            note ?? null,
          ],
        )
      : await pool.execute(
          `
          INSERT INTO appointments
            (customer_id, barber_id, service_id, time_slot_id, appt_date, start_time, end_time, total_price, note, status)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
          `,
          [
            customerId,
            barberId,
            serviceId,
            timeSlotId,
            effectiveApptDate,
            start_time,
            end_time,
            totalPrice,
            note ?? null,
          ],
        );

    const appointmentId = result.insertId;

    await pool.execute(
      `UPDATE time_slots SET is_booked = 1 WHERE id = ?`,
      [timeSlotId],
    );

    const [rows] = await pool.execute(
      `
      SELECT
        a.id AS id,
        uC.full_name AS customer_full_name,
        uC.full_name AS customer_name,
        uB.full_name AS barber_full_name,
        uB.full_name AS barber_name,
        a.appt_date AS appt_date,
        a.status AS status,
        s.name AS service_name,
        a.start_time AS start_time,
        a.end_time AS end_time,
        a.total_price AS total_price,
        a.note AS note,
        a.created_at AS created_at
      FROM appointments a
      JOIN users uC ON uC.id = a.customer_id
      JOIN barbers b ON b.id = a.barber_id
      JOIN users uB ON uB.id = b.user_id
      JOIN services s ON s.id = a.service_id
      WHERE a.id = ?
      LIMIT 1
      `,
      [appointmentId],
    );

    return res.status(201).json({ status: 'success', appointment: rows[0] ?? null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message ?? 'Server error' });
  }
});

// PUT /api/appointments/:appointmentId/status
router.put('/appointments/:appointmentId/status', async (req, res) => {
  const appointmentId = Number(req.params.appointmentId);
  const { status } = req.body ?? {};

  if (!appointmentId || appointmentId <= 0) {
    return res.status(400).json({ error: 'appointmentId không hợp lệ' });
  }
  if (!status || !VALID_APPOINTMENT_STATUSES.has(status)) {
    return res.status(400).json({
      error: `status không hợp lệ. Hợp lệ: ${Array.from(VALID_APPOINTMENT_STATUSES).join(', ')}`,
    });
  }

  try {
    const [rows] = await pool.execute(
      `
      SELECT time_slot_id
      FROM appointments
      WHERE id = ?
      LIMIT 1
      `,
      [appointmentId],
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy appointment' });
    }

    const timeSlotId = rows[0].time_slot_id;

    await pool.execute(
      `UPDATE appointments SET status = ? WHERE id = ?`,
      [status, appointmentId],
    );

    if (status === 'cancelled') {
      await pool.execute(`UPDATE time_slots SET is_booked = 0 WHERE id = ?`, [timeSlotId]);
    }

    const [updated] = await pool.execute(
      `
      SELECT
        a.id AS id,
        a.status AS status,
        DATE_FORMAT(a.appt_date, '%Y-%m-%d') AS appt_date,
        a.start_time AS start_time,
        a.end_time AS end_time,
        a.total_price AS total_price
      FROM appointments a
      WHERE a.id = ?
      LIMIT 1
      `,
      [appointmentId],
    );

    return res.status(200).json({ success: true, appointment: updated[0] ?? null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message ?? 'Server error' });
  }
});

module.exports = router;

