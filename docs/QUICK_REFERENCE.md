# 📖 Quick Reference - Booking Haircut App

## 🎯 Tổng Quan Cấu Trúc

```
booking-haircut-app/
├── backend/              # Node.js API Server
├── admin-web/           # Next.js Admin Dashboard  
├── login-web/           # Next.js Login Page
├── manager-web/         # Next.js Manager Dashboard
├── owner-web/           # Next.js Skibidi BBShop
├── receptionist-web/    # Next.js Receptionist App
├── flutter_booking_app/ # Flutter Mobile App
└── docs/               # Documentation
```

---

## ⚙️ Cấu hình Mặc định

### Ports & URLs

| Component | Port | URL | Tên | Người Dùng |
|-----------|------|-----|-----|-----------|
| Backend API | 5000 | http://localhost:5000 | API Server | System |
| API Docs | 5000 | http://localhost:5000/api-docs | Swagger | Dev |
| Login Page | 3000 | http://localhost:3000 | Login Web | Customer |
| Admin Dashboard | 3002 | http://localhost:3002 | Admin | Admin |
| Manager Dashboard | 3001 | http://localhost:3001 | Manager | Manager |
| Skibidi BBShop | 3003 | http://localhost:3003 | Owner | Owner |
| Receptionist | 3004 | http://localhost:3004 | Receptionist | Staff |

### Database
- **Type**: MySQL
- **Host**: localhost
- **Port**: 3306
- **Name**: booking_haircut
- **User**: root
- **Password**: (your password)

---

## 🚀 Lệnh Khởi Chạy Nhanh

### Terminal 1: Backend (API Server)
```bash
cd flutter_booking_app/backend
npm start
# http://localhost:5000
```

### Terminal 2: Admin Web
```bash
cd admin-web
npm run dev
# http://localhost:3002
```

### Terminal 3: Login Web
```bash
cd login-web
npm run dev
# http://localhost:3000
```

### Terminal 4: Manager Web
```bash
cd manager-web
npm run dev
# http://localhost:3001
```

### Terminal 5: Owner Web
```bash
cd owner-web
npm run dev
# http://localhost:3003
```

### Terminal 6: Receptionist Web
```bash
cd receptionist-web
npm run dev
# http://localhost:3004
```

### Terminal 7: Flutter App
```bash
cd flutter_booking_app
flutter pub get
flutter run
```

---

## 📁 File Cấu Hình Quan Trọng

### Backend Configuration
```
flutter_booking_app/backend/
├── .env              # Environment variables (tạo từ .env.example)
├── server.js         # Main server file
├── db.js             # Database connection
├── routes/           # API routes
└── swaggerSpec.js    # API documentation
```

### Frontend Configuration
```
admin-web/
├── .env.local        # Frontend environment variables
├── next.config.ts    # Next.js config
├── package.json      # Dependencies
└── tsconfig.json     # TypeScript config
```

---

## 🔑 Tài Khoản Test Mặc Định

```
Admin:
  Email: admin@example.com
  Password: admin123

Manager:
  Email: manager@example.com
  Password: manager123

Owner:
  Email: owner@example.com
  Password: owner123

Customer:
  Phone: +84912345678
  Password: password123
```

---

## 🛠️ Lệnh Hữu Ích

### NPM/Node Commands
```bash
# Cài dependencies
npm install

# Chạy dev server
npm run dev

# Build production
npm run build

# Chạy production server
npm start

# Check linting
npm run lint

# Fix formatting
npm run lint:fix
```

### Git Commands
```bash
# Clone project
git clone https://github.com/truonghoangquan2308/booking-haircut-app.git

# Create new branch
git checkout -b feature/new-feature

# Commit changes
git commit -m "feat: add new feature"

# Push changes
git push origin feature/new-feature
```

### MySQL Commands
```bash
# Connect to MySQL
mysql -u root -p

# Create database
CREATE DATABASE booking_haircut CHARACTER SET utf8mb4;

# Import SQL file
mysql -u root -p booking_haircut < Haircut_booking.sql

# List databases
SHOW DATABASES;

# Select database
USE booking_haircut;

# List tables
SHOW TABLES;
```

### Flutter Commands
```bash
# Get dependencies
flutter pub get

# Run app
flutter run

# Run on specific device
flutter run -d <device_id>

# List available devices
flutter devices

# Clean build
flutter clean

# Build APK
flutter build apk

# Build iOS
flutter build ios
```

---

## 📊 Database Tables

Bảng chính:
- **users** - Người dùng hệ thống
- **branches** - Các chi nhánh salon
- **barbers** - Thợ cắt tóc
- **services** - Dịch vụ cắt tóc
- **appointments** - Lịch hẹn
- **working_schedules** - Lịch làm việc
- **products** - Sản phẩm bán hàng
- **orders** - Đơn hàng
- **reviews** - Đánh giá
- **payments** - Thanh toán

---

## 🔒 Biến Môi Trường Quan Trọng

### Backend (.env)
```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=booking_haircut
JWT_SECRET=your_secret_key
FIREBASE_API_KEY=xxx
FIREBASE_AUTH_DOMAIN=xxx
VNPAY_TMN_CODE=xxx
VNPAY_HASH_SECRET=xxx
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
```

---

## 🐛 Troubleshooting Nhanh

### Port already in use
```bash
# Windows - Kill process on port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### MySQL connection failed
```bash
# Check MySQL service
# Windows: Services > MySQL > Restart
```

### Dependencies error
```bash
# Clear cache and reinstall
rm -r node_modules
npm install
```

### Hot reload not working (Flutter)
```bash
flutter clean
flutter pub get
flutter run
```

---

## 📚 Tài Liệu Thêm

- [Full Setup Guide](./SETUP_NEW_MACHINE.md)
- [Design System](./DESIGN_SYSTEM.md)
- [Component Examples](./COMPONENT_EXAMPLES.md)
- [Implementation Checklist](./IMPLEMENTATION_CHECKLIST.md)
- [File Structure](./FILE_STRUCTURE.md)

---

## 🔗 Links Hữu Ích

- **Repository**: https://github.com/truonghoangquan2308/booking-haircut-app
- **Node.js**: https://nodejs.org/
- **Next.js**: https://nextjs.org/
- **Flutter**: https://flutter.dev/
- **Firebase**: https://firebase.google.com/
- **MySQL**: https://www.mysql.com/
- **VNPay**: https://sandbox.vnpayment.vn/

---

**Bản cập nhật lần cuối**: May 2026  
**Phiên bản**: 1.0.0
