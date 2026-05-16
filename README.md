# booking-haircut-app

Hệ thống đặt lịch cắt tóc đa nền tảng hỗ trợ khách hàng, lễ tân, quản lý và chủ cửa hàng trong việc quản lý lịch hẹn, dịch vụ và hoạt động kinh doanh salon.

---

## ⚡ Cách Nhanh để Bắt Đầu

> **Nếu đây là lần đầu tiên bạn cài đặt dự án này**, hãy đọc:
> 
> ### 📖 [**HƯỚNG DẪN CÀI ĐẶT TRÊN MÁY MỚI** → docs/SETUP_NEW_MACHINE.md](./docs/SETUP_NEW_MACHINE.md)
> 
> Hoặc sử dụng script tự động:
> ```bash
> # Windows
> setup.bat    # hoặc
> .\setup.ps1
> ```

### 📚 Tài Liệu Quan Trọng
- 📖 [SETUP_NEW_MACHINE.md](./docs/SETUP_NEW_MACHINE.md) - Hướng dẫn cài đặt chi tiết
- ⚡ [QUICK_REFERENCE.md](./docs/QUICK_REFERENCE.md) - Tham khảo nhanh (ports, lệnh, tài khoản test)
- 🔧 [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) - Giải quyết lỗi
- 📋 [DOCUMENTATION_INDEX.md](./docs/DOCUMENTATION_INDEX.md) - Danh sách tài liệu đầy đủ

---

## 📌 Giới thiệu dự án

`booking-haircut-app` là hệ thống đặt lịch cắt tóc được phát triển nhằm hỗ trợ:

* Đặt lịch trực tuyến
* Quản lý lịch hẹn
* Quản lý nhân viên và chi nhánh
* Quản lý dịch vụ và sản phẩm
* Theo dõi doanh thu
* Thanh toán trực tuyến VNPay
* Gửi thông báo thời gian thực

Hệ thống được xây dựng theo mô hình đa nền tảng gồm:

* Website khách hàng
* Website quản trị
* Ứng dụng Flutter cho lễ tân

---

# 🏗️ Kiến trúc hệ thống

Hệ thống gồm các thành phần chính:

```bash
booking-haircut-app/
│
├── admin-web/           # Website quản trị Admin
├── manager-web/         # Website quản lý Manager
├── owner-web/           # Website Owner
├── receptionist-web/   # Website lễ tân
├── login-web/          # Website đăng nhập
├── flutter_booking_app/ # Ứng dụng Flutter
├── scripts/            # Scripts hỗ trợ hệ thống
├── docs/               # Tài liệu dự án
└── backend/            # API Server
```

---

# 💻 Công nghệ sử dụng

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

## Backend

* Node.js
* Express.js
* RESTful API
* Swagger API Documentation

## Mobile/Desktop

* Flutter
* Dart

## Database

* MySQL

## Cloud & Services

* Firebase Authentication
* Firebase Cloud Messaging (FCM)
* Cloudinary
* VNPay Payment Gateway

---

# ✨ Tính năng chính

## 👤 Khách hàng

* Đăng ký / đăng nhập
* Đặt lịch cắt tóc online
* Chọn thợ cắt tóc
* Chọn dịch vụ
* Thanh toán VNPay
* Theo dõi lịch hẹn
* Đánh giá dịch vụ
* Nhận thông báo nhắc lịch

## 🧑‍💼 Lễ tân

* Quản lý lịch hẹn
* Xác nhận khách đến
* Hỗ trợ check-in
* Quản lý khách hàng
* Quản lý trạng thái lịch hẹn

## 🏪 Manager / Owner

* Quản lý chi nhánh
* Quản lý barber
* Quản lý dịch vụ
* Quản lý sản phẩm
* Quản lý doanh thu
* Xem thống kê hệ thống

## 👨‍💻 Admin

* Quản lý toàn bộ hệ thống
* Quản lý tài khoản
* Quản lý phân quyền
* Theo dõi hoạt động hệ thống

---

# 🧠 Thuật toán & Kỹ thuật sử dụng

* Haversine Formula (Tính khoảng cách GPS)
* Firebase Authentication
* HMAC-SHA512 (VNPay Signature)
* SQL Aggregation Queries
* Offset Pagination
* Fuzzy Search
* State Machine Pattern
* Audit Logging
* Vietnamese Phone Normalization

---

# 🔐 Bảo mật hệ thống

* Firebase Token Authentication
* CORS Protection
* SQL Prepared Statements
* Upload File Validation
* Role-based Authorization
* Account Locking Mechanism

---

# 🗄️ Thiết kế cơ sở dữ liệu

Các bảng dữ liệu chính:

* Users
* Branches
* Services
* Appointments
* WorkingSchedules
* Products
* Orders
* Reviews
* Promotions

---

# 🚀 Cài đặt dự án

## 1. Clone Repository

```bash
git clone https://github.com/truonghoangquan2308/booking-haircut-app.git
cd booking-haircut-app
```

## 2. Cài đặt dependencies

```bash
npm install
```

## 3. Cấu hình môi trường

Tạo file `.env`:

```env
PORT=5000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=booking_haircut

JWT_SECRET=your_secret_key

FIREBASE_API_KEY=your_key
FIREBASE_AUTH_DOMAIN=your_domain

VNPAY_TMN_CODE=your_code
VNPAY_HASH_SECRET=your_secret
```

---

# ▶️ Chạy dự án

## Frontend

```bash
npm run dev
```

## Backend

```bash
node server.js
```

## Flutter App

```bash
flutter pub get
flutter run
```

---

# 📷 Hình ảnh hệ thống

> Đang cập nhật...

---

# 📚 API Documentation

Swagger API:

```bash
http://localhost:5000/api-docs
```

---

# 👨‍💻 Thành viên phát triển

* Trương Hoàng Quân

---

# 📌 Repository

[booking-haircut-app Repository](https://github.com/truonghoangquan2308/booking-haircut-app?utm_source=chatgpt.com)

---

# 📄 License

Dự án được phát triển phục vụ mục đích học tập và nghiên cứu.
