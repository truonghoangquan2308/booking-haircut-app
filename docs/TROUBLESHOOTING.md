# 🔧 Troubleshooting Guide - Booking Haircut App

Hướng dẫn giải quyết các lỗi thường gặp khi cài đặt và chạy dự án trên máy mới.

---

## ❌ Lỗi Backend (Node.js / Express)

### 1. Error: "listen EADDRINUSE: address already in use"

**Nguyên nhân**: Port 5000 đang được sử dụng bởi ứng dụng khác

**Giải pháp**:

**Windows**:
```bash
# Tìm process sử dụng port 5000
netstat -ano | findstr :5000

# Xóa process (thay 12345 bằng PID)
taskkill /PID 12345 /F

# Hoặc đổi port trong .env
PORT=5001
```

**macOS/Linux**:
```bash
# Tìm process
lsof -i :5000

# Kill process
kill -9 <PID>
```

---

### 2. Error: "Cannot find module 'express'"

**Nguyên nhân**: Dependencies chưa được cài đặt

**Giải pháp**:
```bash
cd flutter_booking_app/backend
npm install
npm start
```

---

### 3. Error: "connect ECONNREFUSED 127.0.0.1:3306"

**Nguyên nhân**: MySQL không chạy hoặc cấu hình sai

**Giải pháp**:

**Bước 1**: Kiểm tra MySQL đang chạy
```bash
# Windows: Kiểm tra Services
# macOS: brew services list
# Linux: sudo service mysql status
```

**Bước 2**: Kiểm tra .env configuration
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=booking_haircut
DB_PORT=3306
```

**Bước 3**: Test connection
```bash
mysql -u root -p -h localhost
```

**Bước 4**: Nếu vẫn lỗi, restart MySQL
```bash
# Windows: Services.msc > MySQL > Restart
# macOS: brew services restart mysql
# Linux: sudo systemctl restart mysql
```

---

### 4. Error: "Database 'booking_haircut' doesn't exist"

**Nguyên nhân**: Database chưa được tạo

**Giải pháp**:
```bash
mysql -u root -p

# Trong MySQL CLI:
CREATE DATABASE booking_haircut CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Import dữ liệu (tùy chọn):
USE booking_haircut;
SOURCE path/to/Haircut_booking.sql;
```

---

### 5. Error: "env is not defined" hoặc "process.env is undefined"

**Nguyên nhân**: File .env không tồn tại hoặc dotenv không load

**Giải pháp**:
```bash
# Tạo .env từ template
cp flutter_booking_app/backend/.env.example flutter_booking_app/backend/.env

# Hoặc tạo file .env với nội dung:
cat > flutter_booking_app/backend/.env << EOF
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=booking_haircut
JWT_SECRET=your_secret_key_here
EOF
```

---

### 6. Error: "CORS error" - "Access to XMLHttpRequest blocked"

**Nguyên nhân**: CORS không được cấu hình đúng

**Giải pháp**: Kiểm tra `server.js`
```javascript
const cors = require('cors');
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://localhost:3001',
    'http://localhost:3003',
    'http://localhost:3004'
  ],
  credentials: true
}));
```

---

### 7. Error: "Swagger API docs not loading"

**Nguyên nhân**: Swagger không được setup đúng

**Giải pháp**:
```bash
# Kiểm tra port backend chạy đúng
curl http://localhost:5000/api-docs

# Nếu 404, check swagger setup trong server.js
npm install swagger-jsdoc swagger-ui-express
```

---

## ❌ Lỗi Frontend (Next.js / React)

### 1. Error: "Cannot find module '@/components/...'"

**Nguyên nhân**: Alias path không được cấu hình

**Giải pháp**: Kiểm tra `tsconfig.json`
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

### 2. Error: "Port 3000 is already in use"

**Nguyên nhân**: Port 3000 đang được sử dụng

**Giải pháp**:
```bash
# Chạy trên port khác
npm run dev -- -p 3005

# Hoặc kill process
lsof -i :3000 | grep node | awk '{print $2}' | xargs kill -9
```

---

### 3. Error: "next: command not found"

**Nguyên nhân**: Next.js chưa được cài đặt

**Giải pháp**:
```bash
cd admin-web
npm install
npm run dev
```

---

### 4. Error: "NEXT_PUBLIC_API_URL is undefined"

**Nguyên nhân**: .env.local không được tạo

**Giải pháp**:
```bash
# Tạo .env.local
cp admin-web/.env.local.example admin-web/.env.local

# Edit file với API URL đúng
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

---

### 5. Error: "Firebase initialization failed"

**Nguyên nhân**: Firebase config sai hoặc không đúng

**Giải pháp**:
```bash
# Kiểm tra .env.local có Firebase keys:
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx

# Lấy keys từ Firebase Console:
# 1. Login: firebase.google.com
# 2. Chọn project
# 3. Settings > Project settings
# 4. Copy config
```

---

### 6. Error: "build failed" hoặc "next.js compilation error"

**Nguyên nhân**: TypeScript hoặc syntax error

**Giải pháp**:
```bash
cd admin-web
npm run lint
npm run build

# Hoặc xóa cache
rm -rf .next node_modules
npm install
npm run dev
```

---

### 7. Error: "CSS not loading" hoặc "Tailwind classes not working"

**Nguyên nhân**: Tailwind CSS không được build

**Giải pháp**:
```bash
# Kiểm tra tailwind.config.ts
cat admin-web/tailwind.config.ts

# Kiểm tra postcss.config.mjs
cat admin-web/postcss.config.mjs

# Reinstall
cd admin-web
npm install
npm run dev
```

---

## ❌ Lỗi Database (MySQL)

### 1. Error: "Access denied for user 'root'@'localhost'"

**Nguyên nhân**: Password sai hoặc user không có quyền

**Giải pháp**:
```bash
# Kiểm tra password
mysql -u root -p

# Nếu quên password, reset:
# Windows: mysql_data/ > recovery mode
# macOS/Linux: skip-grant-tables

# Hoặc tạo user mới
mysql -u root -p
CREATE USER 'booking_user'@'localhost' IDENTIFIED BY 'password123';
GRANT ALL PRIVILEGES ON booking_haircut.* TO 'booking_user'@'localhost';
FLUSH PRIVILEGES;

# Update .env
DB_USER=booking_user
DB_PASSWORD=password123
```

---

### 2. Error: "Table 'booking_haircut.users' doesn't exist"

**Nguyên nhân**: Database tồn tại nhưng tables chưa được tạo

**Giải pháp**:
```bash
mysql -u root -p booking_haircut < flutter_booking_app/Haircut_booking.sql
```

---

### 3. Error: "Disk quota exceeded" hoặc "No space left"

**Nguyên nhân**: Ổ cứng đầy

**Giải pháp**:
```bash
# Xóa các file không cần
rm -rf node_modules
rm -rf .next build
npm install
```

---

### 4. Error: "Character set mismatch"

**Nguyên nhân**: Database charset không phải UTF-8

**Giải pháp**:
```bash
mysql -u root -p

ALTER DATABASE booking_haircut CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## ❌ Lỗi Flutter / Mobile

### 1. Error: "Flutter command not found"

**Nguyên nhân**: Flutter chưa được cài đặt hoặc PATH không đúng

**Giải pháp**:
```bash
# Kiểm tra Flutter installation
flutter --version

# Nếu không có, download từ
https://flutter.dev/docs/get-started/install

# Add Flutter to PATH (Windows):
# Advanced System Settings > Environment Variables > PATH
# Thêm: C:\flutter\bin
```

---

### 2. Error: "Unable to find Android SDK"

**Nguyên nhân**: Android SDK không được cài đặt

**Giải pháp**:
```bash
flutter doctor

# Nếu có lỗi, download Android Studio
# hoặc chạy: flutter config --android-sdk /path/to/sdk
```

---

### 3. Error: "Gradle build failed"

**Nguyên nhân**: Build dependencies lỗi

**Giải pháp**:
```bash
cd flutter_booking_app
flutter clean
flutter pub get
flutter pub upgrade
flutter run
```

---

### 4. Error: "No devices found"

**Nguyên nhân**: Emulator hoặc physical device không được detect

**Giải pháp**:
```bash
# Liệt kê devices
flutter devices

# Chạy emulator
flutter emulators --launch <emulator_id>

# Hoặc kết nối physical device
# Bật Developer Mode trên điện thoại
# Kết nối USB
# Chạy: adb devices
```

---

## ❌ Lỗi Git / Repository

### 1. Error: "git: command not found"

**Nguyên nhân**: Git chưa được cài đặt

**Giải pháp**:
```bash
# Download Git từ https://git-scm.com/download/win
# Hoặc dùng package manager
# Windows: choco install git
# macOS: brew install git
```

---

### 2. Error: "fatal: not a git repository"

**Nguyên nhân**: Project folder không phải git repo

**Giải pháp**:
```bash
cd booking-haircut-app
git init
git remote add origin https://github.com/truonghoangquan2308/booking-haircut-app.git
git fetch origin main
```

---

## ❌ Lỗi Cổng (Port) Chung

### Port Conflicts - Multiple Ports in Use

**Giải pháp**: Thay đổi port

**Backend** (.env):
```env
PORT=5000
```

**Admin Web** (package.json):
```json
{
  "scripts": {
    "dev": "next dev -p 3002"
  }
}
```

**Hoặc kiểm tra all ports**:
```bash
# Windows
netstat -ano | findstr /R "3000|3001|3002|3003|3004|5000"

# macOS/Linux
lsof -i -P -n | grep -E "3000|3001|3002|3003|3004|5000"
```

---

## ✅ Checklist Troubleshooting

Khi gặp vấn đề, kiểm tra theo thứ tự:

- [ ] Kiểm tra Node.js version: `node --version` (>= 18.0)
- [ ] Kiểm tra npm: `npm --version`
- [ ] Kiểm tra dependencies: `npm ls`
- [ ] Kiểm tra .env files tồn tại và đúng format
- [ ] Kiểm tra ports không conflict
- [ ] Kiểm tra MySQL chạy: `mysql --version`
- [ ] Kiểm tra database tồn tại: `mysql -u root -p -e "SHOW DATABASES;"`
- [ ] Xóa cache: `rm -rf node_modules && npm install`
- [ ] Restart services (MySQL, ngrok, etc.)
- [ ] Kiểm tra error logs: `npm run dev 2>&1 | tee error.log`

---

## 🆘 Cần Hỗ Trợ?

Nếu vấn đề không được giải quyết:

1. **Kiểm tra logs**: Terminal output có error message gì
2. **Google search**: Copy error message vào Google
3. **Stack Overflow**: Tìm kiếm on SO
4. **GitHub Issues**: https://github.com/truonghoangquan2308/booking-haircut-app/issues
5. **Documentation**: Kiểm tra docs/ folder
6. **Contact Developer**: Liên hệ Trương Hoàng Quân

---

**Bản cập nhật lần cuối**: May 2026  
**Phiên bản**: 1.0.0
