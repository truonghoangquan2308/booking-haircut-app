const fs = require('fs');
const path = require('path');

// Đọc SQL file
const sqlFile = path.join(__dirname, 'Haircut_booking.sql');
let sql = fs.readFileSync(sqlFile, 'utf8');

// Xoá DELIMITER statements
sql = sql.replace(/DELIMITER\s+\$\$/gi, '-- DELIMITER $$');
sql = sql.replace(/DELIMITER\s+;/gi, '-- DELIMITER ;');

// Xoá CREATE TRIGGER
sql = sql.replace(/CREATE\s+TRIGGER\s+[^;]+END\s*;/gis, '');

// Xoá CREATE PROCEDURE  
sql = sql.replace(/CREATE\s+PROCEDURE\s+[^;]+END\s*\$\$/gis, '');

// Xoá dòng comment chứa TRIGGER
sql = sql.split('\n').filter(line => !line.includes('TRIGGER')).join('\n');

// Xoá dòng trống thừa
sql = sql.replace(/\n{3,}/g, '\n\n');

// Lưu file clean
const outputFile = path.join(__dirname, 'Haircut_booking_clean.sql');
fs.writeFileSync(outputFile, sql, 'utf8');

console.log('✅ Clean SQL file created: Haircut_booking_clean.sql');
console.log('📊 Triggers and Procedures removed');
