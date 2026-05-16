# 📖 Hướng Dẫn và Tài Liệu Dự Án

Danh sách đầy đủ các tài liệu hướng dẫn cài đặt và sử dụng dự án booking-haircut-app.

---

## 📋 Các Tài Liệu Chính

### 🚀 **Hướng Dẫn Cài Đặt (Setup)**

#### [SETUP_NEW_MACHINE.md](./SETUP_NEW_MACHINE.md) - **ĐỌC TRƯỚC TIÊN**
- ✅ Yêu cầu hệ thống (Node.js, Git, MySQL, Flutter)
- ✅ Hướng dẫn step-by-step chi tiết
- ✅ Cấu hình Backend (.env)
- ✅ Cấu hình Frontend (.env.local cho mỗi web app)
- ✅ Setup Database
- ✅ Cách chạy từng component
- ✅ Port mặc định cho mỗi dịch vụ

**Đối tượng**: Người cài đặt lần đầu tiên

---

### ⚡ **Hướng Dẫn Nhanh (Quick Reference)**

#### [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - **DÙNG HẰNG NGÀY**
- 🔍 Tóm tắt cấu trúc dự án
- 🔌 Danh sách ports & URLs
- 🚀 Lệnh khởi chạy nhanh
- 🔐 Tài khoản test mặc định
- 🛠️ Lệnh hữu ích (npm, git, mysql, flutter)
- 📊 Danh sách bảng database
- 🔑 Biến môi trường
- 🐛 Troubleshooting nhanh

**Đối tượng**: Developer đang làm việc

---

### 🔧 **Hướng Dẫn Xử Lý Lỗi (Troubleshooting)**

#### [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - **KHI GẶP LỖI**
- ❌ Lỗi Backend (Node.js)
- ❌ Lỗi Frontend (Next.js)
- ❌ Lỗi Database (MySQL)
- ❌ Lỗi Flutter / Mobile
- ❌ Lỗi Git / Repository
- ❌ Lỗi Ports & Conflicts
- ✅ Giải pháp chi tiết cho mỗi lỗi
- ✅ Checklist xử lý vấn đề

**Đối tượng**: Người gặp lỗi và cần giải quyết

---

## 📁 Các File Cấu Hình Mẫu

### `.env.example` & `.env.local.example`

Những file này giúp dễ dàng tạo file cấu hình đúng:

```
flutter_booking_app/backend/.env.example
admin-web/.env.local.example
```

**Cách sử dụng**:
```bash
# Copy file example
cp flutter_booking_app/backend/.env.example flutter_booking_app/backend/.env

# Chỉnh sửa với thông tin của bạn
# DB_HOST, DB_USER, DB_PASSWORD, Firebase keys, etc.
```

---

## 🎯 Script Tự động Cài đặt

### Windows Scripts

#### `setup.bat` - **Script Batch để Windows**
Tự động cài đặt tất cả dependencies

```bash
cd booking-haircut-app
setup.bat
```

Công việc:
- ✅ Kiểm tra Node.js, Git, MySQL
- ✅ Cài npm dependencies
- ✅ Cài backend dependencies
- ✅ Cài web app dependencies
- ✅ Tạo file .env từ template
- ✅ Hướng dẫn bước tiếp theo

---

#### `setup.ps1` - **PowerShell Script**
Tương tự setup.bat nhưng dùng PowerShell

```powershell
# Chạy PowerShell với admin
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope CurrentUser
.\setup.ps1
```

---

## 📚 Các Tài Liệu Khác

### Có sẵn trong dự án:

| File | Mô tả |
|------|-------|
| [README.md](../README.md) | Tổng quan dự án (Tiếng Việt) |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Hệ thống thiết kế CSS |
| [DESIGN_SYSTEM_COMPLETE.md](./DESIGN_SYSTEM_COMPLETE.md) | Design system chi tiết |
| [COMPONENT_EXAMPLES.md](./COMPONENT_EXAMPLES.md) | Ví dụ component |
| [FILE_STRUCTURE.md](./FILE_STRUCTURE.md) | Cấu trúc file dự án |
| [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) | Checklist phát triển |
| [DELIVERY_SUMMARY.md](./DELIVERY_SUMMARY.md) | Tóm tắt deliverables |
| [UPGRADE_SUMMARY.md](./UPGRADE_SUMMARY.md) | Thay đổi & upgrade |

---

## 🎯 Lộ Trình Cài Đặt

### Nếu bạn là người mới:

1. **Trước tiên, đọc**: [SETUP_NEW_MACHINE.md](./SETUP_NEW_MACHINE.md)
   - Chuẩn bị máy tính
   - Cài dependencies
   - Setup database
   - Cấu hình environment

2. **Sau đó, chạy**: Script tự động hoặc lệnh thủ công
   - Windows: `setup.bat` hoặc `setup.ps1`
   - macOS/Linux: Làm theo hướng dẫn trong SETUP_NEW_MACHINE.md

3. **Khi chạy**, tham khảo: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
   - Lệnh khởi chạy mỗi component
   - Ports & URLs
   - Tài khoản test

4. **Nếu gặp lỗi**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
   - Tìm lỗi của bạn
   - Làm theo giải pháp
   - Check checklist xử lý vấn đề

---

### Nếu bạn đã setup trước đó:

1. **Chỉ cần xem**: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
2. **Gặp vấn đề**: Xem [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## ⚙️ Cấu Hình Nhanh

### Các port mặc định:
```
Backend:           localhost:5000
Login Page:        localhost:3000
Admin Dashboard:   localhost:3002
Manager Dashboard: localhost:3001
Skibidi BBShop:   localhost:3003
Receptionist:      localhost:3004
```

### Database:
```
Type:     MySQL
Host:     localhost
Port:     3306
Database: booking_haircut
User:     root
```

---

## 🚀 Lệnh Khởi Chạy Nhanh

```bash
# Terminal 1: Backend
cd flutter_booking_app/backend && npm start

# Terminal 2: Admin Web
cd admin-web && npm run dev

# Terminal 3: Other apps...
cd login-web && npm run dev

# Terminal 4: Flutter (nếu cần)
cd flutter_booking_app && flutter run
```

**Chi tiết**: Xem [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

---

## 📞 Hỗ Trợ

- **Repository**: https://github.com/truonghoangquan2308/booking-haircut-app
- **Tài liệu**: Dự án có đầy đủ trong folder `docs/`
- **Liên hệ**: Trương Hoàng Quân
- **Issues**: Tạo issue trên GitHub

---

## 📝 Danh Sách Tài Liệu Tóm Tắt

```
docs/
├── SETUP_NEW_MACHINE.md          ← Bắt đầu ở đây
├── QUICK_REFERENCE.md            ← Dùng hằng ngày
├── TROUBLESHOOTING.md            ← Khi gặp lỗi
├── DOCUMENTATION_INDEX.md        ← File này
├── DESIGN_SYSTEM.md
├── DESIGN_SYSTEM_COMPLETE.md
├── COMPONENT_EXAMPLES.md
├── FILE_STRUCTURE.md
├── IMPLEMENTATION_CHECKLIST.md
├── DELIVERY_SUMMARY.md
└── UPGRADE_SUMMARY.md
```

---

## ✅ Checklist Cài Đặt Hoàn Chỉnh

- [ ] Đọc SETUP_NEW_MACHINE.md
- [ ] Cài đặt Node.js, Git, MySQL
- [ ] Clone repository
- [ ] Tạo .env files từ .example
- [ ] Chạy npm install
- [ ] Tạo database MySQL
- [ ] Cấu hình Firebase
- [ ] Chạy backend test (port 5000)
- [ ] Chạy admin-web test (port 3002)
- [ ] Test login với tài khoản mẫu
- [ ] Đọc QUICK_REFERENCE.md để dùng hằng ngày

---

**Cập nhật**: May 2026 | **Version**: 1.0.0
