// backend/routes/shopProductsRoutesFixed.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Dùng chung cấu hình DB từ db.js để tránh query nhầm database.
const pool = require('../db');

const uploadDir = path.join(__dirname, '../uploads/products');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mt = (file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const imgExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic'].includes(ext);
    const ok =
      mt.startsWith('image/') ||
      mt === 'application/octet-stream' ||
      (mt === '' && imgExt);
    cb(null, ok);
  },
});

function handleProductUpload(req, res, next) {
  upload.fields([{ name: 'image', maxCount: 1 }])(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload ảnh thất bại' });
    }
    next();
  });
}

const DEFAULT_PRODUCT_CATEGORIES = [
  { name: 'Dầu gội', description: '', is_active: 1 },
  { name: 'Sữa tắm', description: '', is_active: 1 },
  { name: 'Sáp vuốt tóc', description: '', is_active: 1 },
  { name: 'Sữa rửa mặt', description: '', is_active: 1 },
];

router.get('/product-categories', async (_req, res) => {
  try {
    // Ensure the app always has the required 4 categories.
    // This prevents the Flutter "Danh mục" chips from being empty
    // when the database hasn't been seeded yet.
    const names = DEFAULT_PRODUCT_CATEGORIES.map((c) => c.name);
    const placeholders = names.map(() => '?').join(',');
    const [existingRows] = await pool.query(
      `SELECT name FROM product_categories WHERE name IN (${placeholders})`,
      names,
    );
    const existing = new Set((existingRows ?? []).map((r) => r.name));

    for (const c of DEFAULT_PRODUCT_CATEGORIES) {
      if (existing.has(c.name)) continue;
      await pool.query(
        `
        INSERT INTO product_categories (name, description, image_url, is_active)
        VALUES (?, ?, NULL, ?)
        `,
        [String(c.name).trim(), c.description ? String(c.description) : '', Number(c.is_active ?? 1)],
      );
    }

    const [rows] = await pool.query(
      `
      SELECT id, name, description, image_url, is_active, created_at
      FROM product_categories
      ORDER BY id DESC
      `,
    );
    res.json({ categories: rows });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

router.get('/products', async (_req, res) => {
  try {
    const { category_id, search, stock_filter, sort_by = 'id', sort_order = 'desc', limit = 10, offset = 0 } = _req.query;

    let where = ['p.is_active = 1'];
    let params = [];

    if (category_id) {
      where.push('p.category_id = ?');
      params.push(Number(category_id));
    }
    if (search) {
      where.push('p.name LIKE ?');
      params.push(`%${search}%`);
    }
    if (stock_filter) {
      if (stock_filter === 'in_stock') {
        where.push('p.stock > 0');
      } else if (stock_filter === 'low_stock') {
        where.push('p.stock > 0 AND p.stock < 5');
      } else if (stock_filter === 'out_of_stock') {
        where.push('p.stock = 0');
      }
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const validSortFields = ['id', 'name', 'price', 'stock', 'created_at'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'id';
    const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';

    const [rows] = await pool.query(
      `
      SELECT p.id, p.category_id, pc.name as category_name, p.name, p.description, p.price, p.stock, p.unit,
             p.image_url, p.is_active, p.created_at
      FROM products p
      JOIN product_categories pc ON p.category_id = pc.id
      ${whereClause}
      ORDER BY p.${sortField} ${sortDir}
      LIMIT ? OFFSET ?
      `,
      [...params, Number(limit), Number(offset)]
    );

    // Get total count for pagination
    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) as total
      FROM products p
      ${whereClause.replace('p.is_active = 1 AND', 'p.is_active = 1').replace('WHERE p.is_active = 1', 'WHERE p.is_active = 1')}
      `,
      params
    );

    res.json({ products: rows, total: countRows[0].total });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

// ----------------------------------------------------
// POST /api/admin/product-categories (JSON)
// ----------------------------------------------------
// Body: { name, description?, is_active? }
router.post('/admin/product-categories', async (req, res) => {
  try {
    const { name, description, is_active } = req.body ?? {};
    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }

    const active = is_active === undefined ? 1 : Number(is_active);

    const [result] = await pool.query(
      `
      INSERT INTO product_categories (name, description, image_url, is_active)
      VALUES (?, ?, NULL, ?)
      `,
      [String(name).trim(), description ? String(description) : '', active],
    );

    const insertedId = result.insertId;

    const [rows] = await pool.query(
      `
      SELECT id, name, description, image_url, is_active, created_at
      FROM product_categories
      WHERE id = ?
      LIMIT 1
      `,
      [insertedId],
    );

    const category = rows?.[0] ?? null;
    if (!category) {
      return res.status(500).json({ error: 'Cannot load inserted category' });
    }

    res.status(201).json({ category });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

router.post('/admin/products', handleProductUpload, async (req, res) => {
  try {
    const {
      category_id,
      name,
      description,
      price,
      stock,
      unit,
      is_active,
    } = req.body ?? {};

    const categoryId = Number(category_id);
    const p = Number(price);
    const s = Number(stock);
    const active = is_active === undefined ? 1 : Number(is_active);

    if (!categoryId || Number.isNaN(categoryId)) {
      return res.status(400).json({ error: 'category_id is required' });
    }
    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (Number.isNaN(p) || p <= 0) {
      return res.status(400).json({ error: 'price must be > 0' });
    }
    if (Number.isNaN(s) || s < 0) {
      return res.status(400).json({ error: 'stock must be >= 0' });
    }
    if (!unit || String(unit).trim().length === 0) {
      return res.status(400).json({ error: 'unit is required' });
    }

    const imageFile = req.files?.image?.[0];
    const imageUrl = imageFile ? `/uploads/products/${imageFile.filename}` : null;

    const [result] = await pool.query(
      `
      INSERT INTO products (category_id, name, description, price, stock, unit, image_url, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        categoryId,
        String(name).trim(),
        description ? String(description) : '',
        p,
        s,
        String(unit).trim(),
        imageUrl,
        active,
      ],
    );

    const insertedId = result.insertId;

    const [productRows] = await pool.query(
      `
      SELECT id, category_id, name, description, price, stock, unit,
             image_url, is_active, created_at
      FROM products
      WHERE id = ?
      LIMIT 1
      `,
      [insertedId],
    );

    const product = productRows?.[0] ?? null;
    if (!product) {
      return res.status(500).json({ error: 'Cannot load inserted product' });
    }

    res.status(201).json({ product });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

// PUT /api/admin/products/:id
router.put('/admin/products/:id', handleProductUpload, async (req, res) => {
  try {
    const { id } = req.params;
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const {
      category_id,
      name,
      description,
      price,
      stock,
      unit,
      is_active,
    } = req.body ?? {};

    const categoryId = Number(category_id);
    const p = Number(price);
    const s = Number(stock);
    const active = is_active === undefined ? 1 : Number(is_active);

    if (!categoryId || Number.isNaN(categoryId)) {
      return res.status(400).json({ error: 'category_id is required' });
    }
    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (Number.isNaN(p) || p <= 0) {
      return res.status(400).json({ error: 'price must be > 0' });
    }
    if (Number.isNaN(s) || s < 0) {
      return res.status(400).json({ error: 'stock must be >= 0' });
    }
    if (!unit || String(unit).trim().length === 0) {
      return res.status(400).json({ error: 'unit is required' });
    }

    // Check if product exists
    const [existing] = await pool.query(
      'SELECT id FROM products WHERE id = ?',
      [productId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const imageFile = req.files?.image?.[0];
    let imageUrl = null;
    if (imageFile) {
      imageUrl = `/uploads/products/${imageFile.filename}`;
    } else {
      // Keep existing image if no new image
      const [current] = await pool.query(
        'SELECT image_url FROM products WHERE id = ?',
        [productId]
      );
      imageUrl = current[0]?.image_url;
    }

    await pool.query(
      `
      UPDATE products
      SET category_id = ?, name = ?, description = ?, price = ?, stock = ?, unit = ?, image_url = ?, is_active = ?
      WHERE id = ?
      `,
      [
        categoryId,
        String(name).trim(),
        description ? String(description) : '',
        p,
        s,
        String(unit).trim(),
        imageUrl,
        active,
        productId,
      ],
    );

    const [productRows] = await pool.query(
      `
      SELECT id, category_id, name, description, price, stock, unit,
             image_url, is_active, created_at
      FROM products
      WHERE id = ?
      LIMIT 1
      `,
      [productId],
    );

    const product = productRows?.[0] ?? null;
    res.json({ product });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

// DELETE /api/admin/products/:id
router.delete('/admin/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const [result] = await pool.query(
      'DELETE FROM products WHERE id = ?',
      [productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

// PUT /api/admin/product-categories/:id
router.put('/admin/product-categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const categoryId = Number(id);
    if (Number.isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    const { name, description, is_active } = req.body ?? {};
    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }

    const active = is_active === undefined ? 1 : Number(is_active);

    // Check if category exists
    const [existing] = await pool.query(
      'SELECT id FROM product_categories WHERE id = ?',
      [categoryId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await pool.query(
      `
      UPDATE product_categories
      SET name = ?, description = ?, is_active = ?
      WHERE id = ?
      `,
      [
        String(name).trim(),
        description ? String(description) : '',
        active,
        categoryId,
      ],
    );

    const [rows] = await pool.query(
      `
      SELECT id, name, description, image_url, is_active, created_at
      FROM product_categories
      WHERE id = ?
      LIMIT 1
      `,
      [categoryId],
    );

    const category = rows?.[0] ?? null;
    res.json({ category });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

// DELETE /api/admin/product-categories/:id
router.delete('/admin/product-categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const categoryId = Number(id);
    if (Number.isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    // Check if category has products
    const [products] = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [categoryId]
    );
    if (products[0].count > 0) {
      return res.status(400).json({ error: 'Cannot delete category with existing products' });
    }

    const [result] = await pool.query(
      'DELETE FROM product_categories WHERE id = ?',
      [categoryId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

// POST /api/admin/products/:id/stock
router.post('/admin/products/:id/stock', async (req, res) => {
  try {
    const { id } = req.params;
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const { change_type, quantity, note, user_id } = req.body ?? {};
    const qty = Number(quantity);
    if (!['import', 'export', 'adjust'].includes(change_type)) {
      return res.status(400).json({ error: 'Invalid change_type' });
    }
    if (Number.isNaN(qty)) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    // Get current stock
    const [current] = await pool.query(
      'SELECT stock FROM products WHERE id = ?',
      [productId]
    );
    if (current.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const previousStock = current[0].stock;

    let newStock = previousStock;
    if (change_type === 'import') {
      newStock += qty;
    } else if (change_type === 'export') {
      newStock -= qty;
      if (newStock < 0) newStock = 0; // Prevent negative stock
    } else if (change_type === 'adjust') {
      newStock = qty;
    }

    // Update product stock
    await pool.query(
      'UPDATE products SET stock = ? WHERE id = ?',
      [newStock, productId]
    );

    // Insert stock history
    await pool.query(
      `
      INSERT INTO stock_history (product_id, change_type, quantity, previous_stock, new_stock, note, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [productId, change_type, qty, previousStock, newStock, note || null, user_id || null]
    );

    res.json({ previous_stock: previousStock, new_stock: newStock });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

// GET /api/products/stock-history
router.get('/products/stock-history', async (req, res) => {
  try {
    const { product_id, change_type, start_date, end_date, limit = 50, offset = 0 } = req.query;

    let where = [];
    let params = [];

    if (product_id) {
      where.push('sh.product_id = ?');
      params.push(Number(product_id));
    }
    if (change_type && ['import', 'export', 'adjust'].includes(change_type)) {
      where.push('sh.change_type = ?');
      params.push(change_type);
    }
    if (start_date) {
      where.push('sh.created_at >= ?');
      params.push(start_date);
    }
    if (end_date) {
      where.push('sh.created_at <= ?');
      params.push(end_date);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `
      SELECT sh.id, sh.product_id, p.name as product_name, sh.change_type, sh.quantity,
             sh.previous_stock, sh.new_stock, sh.note, sh.user_id, u.full_name as user_name,
             sh.created_at
      FROM stock_history sh
      LEFT JOIN products p ON sh.product_id = p.id
      LEFT JOIN users u ON sh.user_id = u.id
      ${whereClause}
      ORDER BY sh.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, Number(limit), Number(offset)]
    );

    res.json({ history: rows });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

// GET /api/shop/stats
router.get('/shop/stats', async (req, res) => {
  try {
    // Total products
    const [totalProducts] = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE is_active = 1'
    );

    // Low stock products (< 5)
    const [lowStock] = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE stock < 5 AND is_active = 1'
    );

    // Revenue this month
    const [revenue] = await pool.query(
      `
      SELECT COALESCE(SUM(so.total_price), 0) as revenue
      FROM shop_orders so
      WHERE MONTH(so.created_at) = MONTH(CURRENT_DATE())
      AND YEAR(so.created_at) = YEAR(CURRENT_DATE())
      AND so.status IN ('delivered', 'completed')
      `
    );

    // Orders today
    const [ordersToday] = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM shop_orders so
      WHERE DATE(so.created_at) = CURDATE()
      `
    );

    // Top 5 best selling products
    const [topProducts] = await pool.query(
      `
      SELECT p.id, p.name, SUM(soi.quantity) as total_sold
      FROM shop_order_items soi
      JOIN products p ON soi.product_id = p.id
      JOIN shop_orders so ON soi.order_id = so.id
      WHERE so.status IN ('delivered', 'completed')
      GROUP BY p.id, p.name
      ORDER BY total_sold DESC
      LIMIT 5
      `
    );

    res.json({
      total_products: totalProducts[0].count,
      low_stock_products: lowStock[0].count,
      monthly_revenue: revenue[0].revenue,
      orders_today: ordersToday[0].count,
      top_products: topProducts,
    });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

// GET /api/shop/orders
router.get('/shop/orders', async (req, res) => {
  try {
    const {
      status,
      customer_id,
      start_date,
      end_date,
      limit = 20,
      offset = 0,
    } = req.query;

    let where = [];
    let params = [];

    if (customer_id) {
      const custId = Number(customer_id);
      if (!Number.isNaN(custId) && custId > 0) {
        where.push('so.customer_id = ?');
        params.push(custId);
      }
    }
    if (status && ['pending','confirmed','shipping','delivered','completed','cancelled'].includes(status)) {
      where.push('so.status = ?');
      params.push(status);
    }
    if (start_date) {
      where.push('DATE(so.created_at) >= ?');
      params.push(start_date);
    }
    if (end_date) {
      where.push('DATE(so.created_at) <= ?');
      params.push(end_date);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `
      SELECT so.id,
             so.customer_id,
             u.full_name as customer_name,
             so.total_price,
             so.status,
             so.shipping_address,
             so.note,
             so.branch_id,
             br.name as branch_name,
             so.created_at
      FROM shop_orders so
      JOIN users u ON so.customer_id = u.id
      LEFT JOIN branches br ON so.branch_id = br.id
      ${whereClause}
      ORDER BY so.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, Number(limit), Number(offset)]
    );

    res.json({ orders: rows });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

// GET /api/shop/orders/:id
router.get('/shop/orders/:id', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Order ID không hợp lệ' });
    }

    const { customer_id } = req.query;
    const conditions = ['so.id = ?'];
    const params = [orderId];

    if (customer_id) {
      const custId = Number(customer_id);
      if (!Number.isNaN(custId) && custId > 0) {
        conditions.push('so.customer_id = ?');
        params.push(custId);
      }
    }

    const [orders] = await pool.query(
      `
      SELECT so.id,
             so.customer_id,
             u.full_name as customer_name,
             so.total_price,
             so.status,
             so.shipping_address,
             so.note,
             so.branch_id,
             br.name as branch_name,
             so.created_at
      FROM shop_orders so
      JOIN users u ON so.customer_id = u.id
      LEFT JOIN branches br ON so.branch_id = br.id
      WHERE ${conditions.join(' AND ')}
      LIMIT 1
      `,
      params,
    );

    if (!orders.length) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    const order = orders[0];
    const [items] = await pool.query(
      `
      SELECT soi.id,
             soi.product_id,
             soi.quantity,
             soi.unit_price,
             soi.subtotal,
             p.name as product_name
      FROM shop_order_items soi
      LEFT JOIN products p ON soi.product_id = p.id
      WHERE soi.order_id = ?
      `,
      [orderId],
    );

    res.json({ order: order, items });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

// PUT /api/admin/shop/orders/:id/status
router.put('/admin/shop/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const orderId = Number(id);
    if (Number.isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const { status } = req.body ?? {};
    if (!status || !['pending','confirmed','shipping','delivered','completed','cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const [result] = await pool.query(
      'UPDATE shop_orders SET status = ? WHERE id = ?',
      [status, orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order status updated successfully' });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Server error' });
  }
});

module.exports = router;

