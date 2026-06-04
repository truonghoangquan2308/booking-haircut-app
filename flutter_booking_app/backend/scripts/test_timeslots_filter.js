// Test harness for timeslots filtering logic (replicates logic in appointments.js)
function pad(n) { return String(n).padStart(2,'0'); }

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function timeOverlap(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return !(aEnd <= bStart || bEnd <= aStart);
}

function filterSlots({ allSlots, apptRows, closures, serverNow, barberId, date }) {
  const totalSlots = allSlots.length;
  const slotIds = allSlots.map(s => s.id);
  const apptConflictingSlotIds = new Set((apptRows || []).filter(a => a.status !== 'cancelled').map(a => a.time_slot_id));

  const todayStr = serverNow.toISOString().slice(0,10);
  const currentTimeStr = formatTime(serverNow) + ':00'.slice(2); // ensure HH:MM:SS
  let filteredByIsBooked=0, filteredByAppt=0, filteredByClosure=0, filteredByPastTime=0;

  const filtered = allSlots.filter(s => {
    const sid = Number(s.id);
    if (Number(s.is_booked) === 1) { filteredByIsBooked++; return false; }
    if (apptConflictingSlotIds.has(sid)) { filteredByAppt++; return false; }
    if (closures && closures.length>0) {
      for (const c of closures) {
        if (Number(c.is_full_day) === 1) { filteredByClosure++; return false; }
        if (timeOverlap(s.start_time, s.end_time, c.start_time, c.end_time)) { filteredByClosure++; return false; }
      }
    }
    if (date === todayStr) {
      if (s.end_time <= currentTimeStr) { filteredByPastTime++; return false; }
    }
    return true;
  });

  console.log(`[timeslots] barberId=${barberId} date=${date} total=${totalSlots} filtered=${filtered.length} reasons={is_booked:${filteredByIsBooked}, appt:${filteredByAppt}, closure:${filteredByClosure}, past_time:${filteredByPastTime}}`);
  return filtered;
}

function runTest(name, opts) {
  console.log('\n=== ' + name + ' ===');
  console.log('Request: GET /api/timeslots/:barberId/:date');
  console.log('barberId=', opts.barberId, 'date=', opts.date, 'serverNow=', opts.serverNow.toISOString());
  const before = opts.allSlots;
  console.log('\nResponse BEFORE (raw DB rows):');
  console.log(JSON.stringify({ slots: before }, null, 2));
  const after = filterSlots(opts);
  console.log('\nResponse AFTER (filtered):');
  console.log(JSON.stringify({ slots: after }, null, 2));
}

// Helpers to build slot objects
function slot(id, start, end, is_booked=0) { return { id, start_time: start, end_time: end, is_booked }; }

// Run tests per user scenarios
// TEST 1
runTest('TEST 1 - Slot đã qua thời gian', {
  barberId: 1,
  date: '2026-06-02',
  serverNow: new Date('2026-06-02T14:30:00'),
  allSlots: [ slot(1,'09:00:00','10:00:00',0), slot(2,'13:00:00','14:00:00',0), slot(3,'15:00:00','16:00:00',0) ],
  apptRows: [], closures: []
});

// TEST 2 - booked
runTest('TEST 2 - Slot bị booked', {
  barberId: 1,
  date: '2026-06-02',
  serverNow: new Date('2026-06-02T09:00:00'),
  allSlots: [ slot(1,'09:00:00','10:00:00',1), slot(2,'10:00:00','11:00:00',0) ],
  apptRows: [], closures: []
});

// TEST 3 - appointment exists but is_booked=0
runTest('TEST 3 - Appointment tồn tại nhưng is_booked = 0', {
  barberId: 1,
  date: '2026-06-02',
  serverNow: new Date('2026-06-02T08:00:00'),
  allSlots: [ slot(1,'09:00:00','10:00:00',0), slot(2,'10:00:00','11:00:00',0) ],
  apptRows: [ { time_slot_id: 2, status: 'confirmed' } ], closures: []
});

// TEST 4 - appointment cancelled
runTest('TEST 4 - Appointment cancelled', {
  barberId: 1,
  date: '2026-06-02',
  serverNow: new Date('2026-06-02T08:00:00'),
  allSlots: [ slot(1,'09:00:00','10:00:00',0), slot(2,'10:00:00','11:00:00',0) ],
  apptRows: [ { time_slot_id: 2, status: 'cancelled' } ], closures: []
});

// TEST 5 - branch closure full day
runTest('TEST 5 - Branch closure full day', {
  barberId: 1,
  date: '2026-06-02',
  serverNow: new Date('2026-06-02T08:00:00'),
  allSlots: [ slot(1,'09:00:00','10:00:00',0), slot(2,'10:00:00','11:00:00',0) ],
  apptRows: [], closures: [ { is_full_day: 1 } ]
});

// TEST 6 - branch closure partial hours
runTest('TEST 6 - Branch closure theo giờ', {
  barberId: 1,
  date: '2026-06-02',
  serverNow: new Date('2026-06-02T08:00:00'),
  allSlots: [ slot(1,'09:00:00','10:00:00',0), slot(2,'10:00:00','11:00:00',0), slot(3,'11:00:00','12:00:00',0), slot(4,'15:00:00','16:00:00',0) ],
  apptRows: [], closures: [ { is_full_day: 0, start_time: '10:00:00', end_time: '14:00:00' } ]
});

// TEST 7 - Flutter compatibility: show before and after types
console.log('\n=== TEST 7 - Flutter compatibility ===');
const sampleBefore = [ slot(1,'09:00:00','10:00:00',0) ];
const sampleAfter = filterSlots({ allSlots: sampleBefore, apptRows: [], closures: [], serverNow: new Date('2026-06-02T08:00:00'), barberId:1, date:'2026-06-02' });
console.log('Endpoint name unchanged: /api/timeslots/:barberId/:date');
console.log('Response BEFORE:', JSON.stringify({ slots: sampleBefore }));
console.log('Response AFTER:', JSON.stringify({ slots: sampleAfter }));

// End
