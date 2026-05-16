# 🚀 Hướng dẫn Cài đặt Dự án trên Máy Khác

Hướng dẫn chi tiết để tải về và chạy dự án **booking-haircut-app** trên một máy tính mới.

---

## 📋 Yêu cầu Hệ thống

Trước khi bắt đầu, đảm bảo máy bạn có:

### 1. **Git**
- Download từ: https://git-scm.com/download/win
- Kiểm tra: `git --version`

### 2. **Node.js & npm** (cho Backend và Web Apps)
- Version: **Node.js >= 18.0**
- Download từ: https://nodejs.org/
- Kiểm tra: 
  ```bash
  node --version
  npm --version
  ```

### 3. **MySQL Server** (cho Database)
- Download từ: https://www.mysql.com/downloads/mysql/
- Hoặc dùng: **MySQL Community Server**
- Đảm bảo MySQL đang chạy
- Kiểm tra: `mysql --version`

### 4. **Flutter SDK** (cho Mobile App)
- Download từ: https://flutter.dev/docs/get-started/install
- Kiểm tra: `flutter --version`

### 5. **Android Studio / Emulator** (tùy chọn - để test Flutter)
- Download từ: https://developer.android.com/studio

---

## 🎯 Bước 1: Clone Repository

```bash
# Mở Terminal/Command Prompt
git clone https://github.com/truonghoangquan2308/booking-haircut-app.git
cd booking-haircut-app
```

---

## 🎯 Bước 2: Cài đặt Dependencies Chung

```bash
# Ở thư mục gốc dự án
npm install
```

---

## 🎯 Bước 3: Thiết lập Database

### 3.1. Tạo Database
```bash
mysql -u root -p

# Trong MySQL CLI, chạy:
CREATE DATABASE booking_haircut CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3.2. Import dữ liệu mẫu (tùy chọn)
```bash
mysql -u root -p booking_haircut < flutter_booking_app/Haircut_booking.sql
```

---

## 🎯 Bước 4: Cấu hình Backend

### 4.1. Tạo file `.env` cho Backend
Tạo file: `flutter_booking_app/backend/.env`

```env
# Server
PORT=5000
HOST=localhost

# Database MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=booking_haircut

# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
FIREBASE_PROJECT_ID=your_firebase_project_id

# JWT & Security
JWT_SECRET=your_secret_key_here_min_32_chars_recommended

# VNPay Payment Gateway (tùy chọn)
VNPAY_TMN_CODE=your_vnpay_code
VNPAY_HASH_SECRET=your_vnpay_secret
VNPAY_URL=https://sandbox.vnpayment.vn/paygate

# Cloudinary (tùy chọn - cho upload ảnh)
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
```

### 4.2. Cài đặt dependencies Backend
```bash
cd flutter_booking_app/backend
npm install
cd ../../
```

### 4.3. Kiểm tra Backend
```bash
cd flutter_booking_app/backend
npm start
# Truy cập: http://localhost:5000/api-docs
```

---

## 🎯 Bước 5: Cấu hình Frontend (Web Apps)

### 5.1. Tạo file `.env.local` cho mỗi Web App

Tạo file: `admin-web/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

**Lặp lại cho các web app khác:**
- `login-web/.env.local`
- `manager-web/.env.local`
- `owner-web/.env.local`
- `receptionist-web/.env.local`

### 5.2. Cài đặt dependencies cho các Web App
```bash
cd admin-web && npm install && cd ..
cd login-web && npm install && cd ..
cd manager-web && npm install && cd ..
cd owner-web && npm install && cd ..
cd receptionist-web && npm install && cd ..
```

---

## 🎯 Bước 6: Cấu hình Flutter App

### 6.1. Cấu hình Firebase cho Flutter
```bash
cd flutter_booking_app

# Tải Firebase configuration
flutter pub get

# Cấu hình Firebase CLI
npm install -g firebase-tools
firebase login
firebase use your_firebase_project_id
```

### 6.2. Tạo file `firebase_options.dart`
File này thường được generate tự động hoặc download từ Firebase Console.

---

## 🎯 Bước 7: Chạy Dự án

### **Chạy Backend** (Terminal 1)
```bash
cd flutter_booking_app/backend
npm start
# Server chạy trên: http://localhost:5000
```

### **Chạy Admin Web App** (Terminal 2)
```bash
cd admin-web
npm run dev
# Truy cập: http://localhost:3002
```

### **Chạy Login Web** (Terminal 3)
```bash
cd login-web
npm run dev
# Truy cập: http://localhost:3000
```

### **Chạy Manager Web** (Terminal 4)
```bash
cd manager-web
npm run dev
# Truy cập: http://localhost:3001
```

### **Chạy Owner Web** (Terminal 5)
```bash
cd owner-web
npm run dev
```

### **Chạy Receptionist Web** (Terminal 6)
```bash
cd receptionist-web
npm run dev
```

### **Chạy Flutter App** (Terminal 7)
```bash
cd flutter_booking_app
flutter pub get
flutter run
# Chọn device (emulator hoặc physical device)
```

---

## 🔧 Sử dụng Scripts Tự động

Dự án có các script sẵn sàng trong thư mục `scripts/`:

### Windows
```bash
# Chạy Admin Web
scripts/start-admin-web.bat

# Chạy Manager Web
scripts/start-manager-web.bat

# Chạy Owner Web
scripts/start-owner-web.bat

# Chạy Receptionist Web
scripts/start-receptionist-web.bat
```

---

## ⚙️ Cấu hình Cổng Mặc định

| Component | Port | URL |
|-----------|------|-----|
| Backend | 5000 | http://localhost:5000 |
| Login Web | 3000 | http://localhost:3000 |
| Admin Web | 3002 | http://localhost:3002 |
| Manager Web | 3001 | http://localhost:3001 |
| Owner Web | 3003 | http://localhost:3003 |
| Receptionist Web | 3004 | http://localhost:3004 |
| API Docs | 5000 | http://localhost:5000/api-docs |

---

## 🔍 Kiểm tra & Troubleshooting

### Port đã được sử dụng
```bash
# Windows - Tìm process sử dụng port 5000
netstat -ano | findstr :5000

# Xóa process
taskkill /PID <PID> /F
```

### MySQL Connection Error
```bash
# Kiểm tra MySQL đang chạy
mysql -u root -p

# Nếu lỗi, restart MySQL:
# Windows: Services > MySQL > Restart
```

### Node_modules lỗi
```bash
# Xóa và cài lại
rm -r node_modules
npm install
```

### Firebase Configuration lỗi
- Lấy credentials từ Firebase Console
- Tạo file `.env` đúng format
- Restart server

---

## 📱 Test Ứng dụng

### Tài khoản Test (mặc định từ DB)
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
```

---

## 📞 Liên hệ & Hỗ trợ

- **Repository**: https://github.com/truonghoangquan2308/booking-haircut-app
- **Developer**: Trương Hoàng Quân
- **Issues**: Tạo issue trên GitHub

---

## ✅ Checklist Cài đặt

- [ ] Cài đặt Git, Node.js, MySQL, Flutter
- [ ] Clone repository
- [ ] Chạy `npm install` ở thư mục gốc
- [ ] Tạo database MySQL
- [ ] Import dữ liệu SQL (tùy chọn)
- [ ] Tạo file `.env` cho backend
- [ ] Tạo file `.env.local` cho các web app
- [ ] Cài dependencies cho backend
- [ ] Cài dependencies cho từng web app
- [ ] Cấu hình Firebase cho Flutter
- [ ] Chạy backend trên port 5000
- [ ] Chạy web apps trên các port tương ứng
- [ ] Test login và các tính năng cơ bản

---

**Nếu gặp vấn đề, kiểm tra lại các bước trên hoặc tạo issue trên GitHub.**
