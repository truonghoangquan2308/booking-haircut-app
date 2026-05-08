/**
 * AdminJS — giao diện quản trị tách biệt (port 3003), không dùng chung với app khách/Owner.
 *
 * Chạy: npm start (từ thư mục admin-station)
 * Đăng nhập: biến môi trường ADMIN_PANEL_EMAIL / ADMIN_PANEL_PASSWORD
 *
 * Retool: có thể trỏ cùng MySQL và build màn hình duyệt shop tương tự nếu muốn no-code.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const session = require('express-session');
const AdminJS = require('adminjs');
const AdminJSExpress = require('@adminjs/express');
const AdminJSSequelize = require('@adminjs/sequelize');
const { Sequelize, DataTypes } = require('sequelize');

const PORT = process.env.ADMINJS_PORT || 3003;
const COOKIE_SECRET =
  process.env.ADMINJS_COOKIE_SECRET || 'doi-adminjs-cookie-secret-trong-production';

AdminJS.registerAdapter({
  Database: AdminJSSequelize.Database,
  Resource: AdminJSSequelize.Resource,
});

const sequelize = new Sequelize(
  process.env.DB_NAME || 'haircut_booking',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    logging: false,
  },
);

const Shop = sequelize.define(
  'Shop',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false },
    description: DataTypes.TEXT,
    owner_user_id: DataTypes.INTEGER,
    manager_user_id: DataTypes.INTEGER,
    is_blocked: { type: DataTypes.BOOLEAN, defaultValue: false },
    approval_status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    tableName: 'shops',
    underscored: true,
    timestamps: false,
  },
);

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    phone: DataTypes.STRING(20),
    email: DataTypes.STRING(100),
    firebase_uid: DataTypes.STRING(128),
    full_name: DataTypes.STRING(100),
    avatar_url: DataTypes.STRING(255),
    date_of_birth: DataTypes.DATEONLY,
    role: DataTypes.STRING(32),
    status: DataTypes.STRING(32),
    branch_id: DataTypes.INTEGER,
    created_at: DataTypes.DATE,
  },
  {
    tableName: 'users',
    underscored: true,
    timestamps: false,
  },
);

const adminJs = new AdminJS({
  databases: [new AdminJSSequelize.Database(sequelize)],
  resources: [
    {
      resource: Shop,
      options: {
        navigation: { name: 'Cửa hàng', icon: 'Store' },
        properties: {
          approval_status: {
            availableValues: [
              { value: 'pending', label: 'Chờ duyệt' },
              { value: 'approved', label: 'Đã duyệt' },
              { value: 'rejected', label: 'Từ chối' },
            ],
          },
          is_blocked: { type: 'boolean' },
        },
        listProperties: [
          'id',
          'name',
          'approval_status',
          'is_blocked',
          'owner_user_id',
          'manager_user_id',
          'updated_at',
        ],
      },
    },
    {
      resource: User,
      options: {
        navigation: { name: 'Người dùng', icon: 'User' },
        listProperties: [
          'id',
          'email',
          'phone',
          'full_name',
          'role',
          'status',
          'created_at',
        ],
      },
    },
  ],
  rootPath: '/admin',
  branding: {
    companyName: 'BB Shop — Admin Panel (AdminJS)',
    softwareBrothers: false,
  },
  locale: {
    language: 'en',
    translations: {
      labels: {
        loginWelcome: 'Đăng nhập quản trị (tách biệt user thường)',
      },
    },
  },
});

const adminEmail = process.env.ADMIN_PANEL_EMAIL || 'admin@bbshop.local';
const adminPassword = process.env.ADMIN_PANEL_PASSWORD || 'admin123';

const router = AdminJSExpress.buildAuthenticatedRouter(
  adminJs,
  {
    authenticate: async (email, password) => {
      if (email === adminEmail && password === adminPassword) {
        return { email, title: email };
      }
      return null;
    },
    cookieName: 'bbshop-adminjs',
    cookiePassword: COOKIE_SECRET,
  },
  null,
  {
    secret: COOKIE_SECRET,
    resave: true,
    saveUninitialized: true,
  },
);

const app = express();
app.get('/', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem">
    <h1>BB Shop — Admin Station</h1>
    <p>Ứng dụng quản trị tách biệt. <a href="/admin">Vào AdminJS</a></p>
    <p>Port ${PORT} — không trùng với Owner (3001) hay API (3000).</p>
  </body></html>`);
});
app.use(adminJs.options.rootPath, router);

app.listen(PORT, () => {
  console.log(`AdminJS: http://localhost:${PORT}/admin`);
  console.log(`Login panel: ${adminEmail} (đặt ADMIN_PANEL_EMAIL / ADMIN_PANEL_PASSWORD trong .env)`);
});
