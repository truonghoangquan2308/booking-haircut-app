const { normalizeVietnamPhone } = require('./phoneVn');

async function tableExists(conn, name) {
  const [r] = await conn.execute(
    `
    SELECT 1 AS ok FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = ?
    LIMIT 1
    `,
    [name],
  );
  return r.length > 0;
}

/**
 * Gộp user customer trùng SĐT (khác định dạng +84 / 0) và chuẩn hoá cột phone.
 * Chạy mỗi lần khởi động server — idempotent sau khi đã sạch.
 */
async function runUserPhoneDedupeAndNormalize(pool) {
  const conn = await pool.getConnection();
  try {
    const [users] = await conn.execute(
      `
      SELECT id, phone, role, firebase_uid, full_name
      FROM users
      WHERE phone IS NOT NULL AND TRIM(phone) != ''
      `,
    );

    const byNorm = new Map();
    for (const u of users) {
      const n = normalizeVietnamPhone(u.phone);
      if (!n) continue;
      if (!byNorm.has(n)) byNorm.set(n, []);
      byNorm.get(n).push(u);
    }

    for (const [norm, list] of byNorm) {
      if (list.length < 2) continue;

      const allCustomer = list.every((x) => String(x.role) === 'customer');
      if (!allCustomer) {
        console.warn(
          `[migrateUserPhones] Bỏ qua gộp "${norm}": không phải toàn customer`,
          list.map((x) => ({ id: x.id, role: x.role })),
        );
        continue;
      }

      const ids = list.map((x) => x.id);
      const ph = ids.map(() => '?').join(',');
      const [barberRows] = await conn.execute(
        `SELECT user_id FROM barbers WHERE user_id IN (${ph})`,
        ids,
      );
      if (barberRows.length > 0) {
        console.warn(`[migrateUserPhones] Bỏ qua gộp "${norm}": có user gắn bảng barbers`);
        continue;
      }

      list.sort((a, b) => {
        const af = a.firebase_uid ? 1 : 0;
        const bf = b.firebase_uid ? 1 : 0;
        if (bf !== af) return bf - af;
        return Number(a.id) - Number(b.id);
      });

      const keeper = list[0];
      const dups = list.slice(1);

      const hasAppt = await tableExists(conn, 'appointments');
      const hasShop = await tableExists(conn, 'shop_orders');
      const hasNotif = await tableExists(conn, 'notifications');
      const hasRev = await tableExists(conn, 'reviews');
      const hasCart = await tableExists(conn, 'cart_items');

      await conn.beginTransaction();
      try {
        for (const d of dups) {
          if (hasAppt) {
            await conn.execute(
              'UPDATE appointments SET customer_id = ? WHERE customer_id = ?',
              [keeper.id, d.id],
            );
          }
          if (hasShop) {
            await conn.execute(
              'UPDATE shop_orders SET customer_id = ? WHERE customer_id = ?',
              [keeper.id, d.id],
            );
          }
          if (hasNotif) {
            await conn.execute(
              'UPDATE notifications SET user_id = ? WHERE user_id = ?',
              [keeper.id, d.id],
            );
          }
          if (hasRev) {
            await conn.execute(
              'UPDATE reviews SET customer_id = ? WHERE customer_id = ?',
              [keeper.id, d.id],
            );
          }

          if (hasCart) {
            const [cartRows] = await conn.execute(
              'SELECT id FROM cart_items WHERE user_id = ?',
              [d.id],
            );
            for (const cr of cartRows) {
              try {
                await conn.execute('UPDATE cart_items SET user_id = ? WHERE id = ?', [
                  keeper.id,
                  cr.id,
                ]);
              } catch (e) {
                if (e.code === 'ER_DUP_ENTRY') {
                  await conn.execute('DELETE FROM cart_items WHERE id = ?', [cr.id]);
                } else {
                  throw e;
                }
              }
            }
          }

          await conn.execute(
            `
            UPDATE users SET
              firebase_uid = COALESCE(firebase_uid, ?),
              full_name = CASE
                WHEN full_name IS NULL OR TRIM(full_name) = '' THEN ?
                ELSE full_name
              END
            WHERE id = ?
            `,
            [d.firebase_uid ?? null, d.full_name ?? null, keeper.id],
          );

          await conn.execute('DELETE FROM users WHERE id = ?', [d.id]);
        }

        await conn.execute('UPDATE users SET phone = ? WHERE id = ?', [norm, keeper.id]);
        await conn.commit();
        console.log(
          `[migrateUserPhones] Đã gộp ${dups.length} user trùng SĐT → keeper id=${keeper.id}, phone=${norm}`,
        );
      } catch (e) {
        await conn.rollback();
        console.error(`[migrateUserPhones] Lỗi gộp "${norm}":`, e.message);
      }
    }

    const [users2] = await conn.execute(
      `
      SELECT id, phone FROM users
      WHERE phone IS NOT NULL AND TRIM(phone) != ''
      `,
    );
    for (const u of users2) {
      const n = normalizeVietnamPhone(u.phone);
      if (!n || n === String(u.phone)) continue;
      try {
        await conn.execute('UPDATE users SET phone = ? WHERE id = ?', [n, u.id]);
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          console.warn(
            `[migrateUserPhones] Không đổi phone user id=${u.id} → ${n} (đã tồn tại bản ghi khác)`,
          );
        } else {
          throw e;
        }
      }
    }
  } finally {
    conn.release();
  }
}

module.exports = { runUserPhoneDedupeAndNormalize };
