# Dự án: booking-haircut-app — Báo cáo tổng quan

## 1) Ngôn ngữ lập trình (ước tính tỷ lệ sử dụng)
Dựa trên đếm file trong workspace (ước tính, làm tròn):

- JavaScript: ~39% (≈50 files) — backend, scripts, utilities, Node.js API
- TypeScript: ~23% (≈30 files) — các web frontend (Next.js) mã TS/typings
- Dart: ~37% (≈48 files) — ứng dụng Flutter (mobile)
- Kotlin: ~1% (≈1 file) — Android native `MainActivity.kt`

Ghi chú: còn nhiều file cấu hình JSON/YAML/MD; phần trăm là ước tính theo số file nguồn chính.

## 2) Packages / Dependencies
Tổng hợp các dependency tìm thấy từ các file `package.json`, `pubspec.yaml`, `build.gradle.kts`.

- Root `package.json` ([package.json](package.json))
  - dependencies: `lucide-react` ^1.16.0
  - devDependencies: `concurrently` ^9.2.1

- Backend `flutter_booking_app/backend/package.json` ([flutter_booking_app/backend/package.json](flutter_booking_app/backend/package.json))
  - dependencies:
    - `cors` ^2.8.6
    - `dotenv` ^17.3.1
    - `express` ^4.22.1
    - `multer` ^2.1.1
    - `mysql2` ^3.19.1
    - `qs` ^6.15.1
    - `swagger-jsdoc` ^6.2.8
    - `swagger-ui-express` ^5.0.1

- Backend admin-station `flutter_booking_app/backend/admin-station/package.json` ([flutter_booking_app/backend/admin-station/package.json](flutter_booking_app/backend/admin-station/package.json))
  - dependencies:
    - `@adminjs/express` ^5.1.0
    - `@adminjs/sequelize` ^2.0.0
    - `adminjs` ^6.8.7
    - `dotenv` ^16.4.5
    - `express` ^4.21.1
    - `express-session` ^1.18.1
    - `mysql2` ^3.11.5
    - `sequelize` ^6.37.3

- Frontend web: nhiều ứng dụng Next.js (package.json ở các folder)
  - `login-web/package.json` ([login-web/package.json](login-web/package.json))
    - dependencies: `firebase` ^12.11.0, `next` 15.2.4, `react` ^19.0.0, `react-dom` ^19.0.0
    - devDependencies: typical Next/TS stack (`typescript`, `tailwindcss`, `eslint`, `@types/*`, ...)
  - `admin-web/package.json` ([admin-web/package.json](admin-web/package.json)) — tương tự `firebase`, `next`, `react`
  - `owner-web/package.json` ([owner-web/package.json](owner-web/package.json))
    - dependencies include `firebase`, `lucide-react`, `next`, `react`, `react-hot-toast`, `recharts`
  - `manager-web/package.json` ([manager-web/package.json](manager-web/package.json))
    - dependencies include `@tanstack/react-virtual`, `firebase`, `lucide-react`, `next`, `xlsx`
  - `receptionist-web/package.json` ([receptionist-web/package.json](receptionist-web/package.json))
    - dependencies include `firebase`, `lucide-react`, `next`, `react`, `xlsx`

- Flutter `pubspec.yaml` ([flutter_booking_app/pubspec.yaml](flutter_booking_app/pubspec.yaml))
  - dependencies:
    - `flutter` (SDK)
    - `cupertino_icons` ^1.0.8
    - `firebase_core` ^4.6.0
    - `firebase_auth` ^6.3.0
    - `http` ^1.2.1
    - `http_parser` ^4.1.2
    - `image_picker` ^1.1.2
    - `geolocator` ^13.0.4
    - `url_launcher` ^6.3.1
    - `sms_autofill` ^2.4.1
    - `shimmer` ^3.0.0
    - `intl` ^0.18.1
    - `flutter_svg` ^1.1.6

- Android Gradle (native) ([android/app/build.gradle.kts](flutter_booking_app/android/app/build.gradle.kts))
  - references `com.google.firebase:firebase-bom:33.9.0`, `kotlin-android`, `com.google.gms.google-services`

Ghi chú: không phát hiện `requirements.txt` hay `pom.xml`. DB driver sử dụng `mysql2` (Node) và SQL schema có sẵn trong `Haircut_booking_clean.sql`.

## 3) Công nghệ & Framework
- Frontend web: Next.js + React (đa ứng dụng: `admin-web`, `owner-web`, `manager-web`, `receptionist-web`, `login-web`).
- Mobile: Flutter (Dart) ứng dụng `flutter_booking_app`.
- Backend: Node.js + Express (API server: `flutter_booking_app/backend/server.js`), Socket.io (được khởi tạo trong server), Admin panel: AdminJS + Sequelize in `backend/admin-station`.
- Database: MySQL / MariaDB (driver `mysql2`, schema file `flutter_booking_app/Haircut_booking_clean.sql`).
- Authentication/Services: Firebase used in frontends (`firebase` lib) for auth/integration; backend uses `x-firebase-uid` header for manager/owner auth checks.
- Payments: VNPay integration implemented (HMAC-SHA512 signing) in `backend/routes/managerVnpay.js` and debug helper `backend/debugVnpay.js`.
- API docs: Swagger via `swagger-jsdoc` + `swagger-ui-express`.
- Utilities: `multer` for file uploads, `dotenv` for env config, `concurrently` for dev scripts.

## 4) Thuật toán & Logic đặc biệt (vị trí file)
Tổng hợp các logic đáng chú ý và vị trí file:

- Tính khoảng cách địa lý (Haversine) — tính khoảng cách đường chim bay WGS84 (km):
  - `flutter_booking_app/backend/lib/haversine.js`
  - `flutter_booking_app/backend/lib/geoHaversine.js`

- Quản lý timeslots / seed slot tự động / lọc slot trước khi hiển thị:
  - `flutter_booking_app/backend/routes/appointments.js` (GET `/timeslots/:barberId/:date`)
    - tự-seed slot theo `working_schedules` nếu chưa có
    - chuyển đổi thời gian sang phút, tạo slot theo duration cố định (mặc định 120 phút)
    - lọc slot theo `is_booked`, appointment tồn tại (status không phải cancelled), branch closures, và thời gian đã qua

- Luồng đặt lịch (transactional booking) với khóa và xử lý tranh chấp:
  - `flutter_booking_app/backend/routes/appointments.js` (POST `/appointments`)
    - Bắt đầu transaction, `SELECT ... FOR UPDATE` trên `time_slots` để khóa hàng
    - Kiểm tra `is_expired` (DB timestamp), `is_booked` flag
    - Kiểm tra closure (`branch_closures`) với `FOR UPDATE`
    - Kiểm tra barber availability / working schedule (cũng `FOR UPDATE` trên bảng liên quan)
    - Khóa appointments liên quan (`SELECT ... FOR UPDATE`) để phát hiện tranh chấp
    - Insert appointment, cập nhật `time_slots.is_booked = 1`, commit — đảm bảo chỉ 1 booking thành công cho cùng slot
    - Kết quả lỗi/409 khi tranh chấp hoặc đã đầy

- Kịch bản test booking đồng thời (concurrency test):
  - `flutter_booking_app/backend/scripts/test_concurrent_booking.js` — gửi hai POST gần như đồng thời, kiểm tra kết quả 201 vs 409 và status DB

- Quy trình thanh toán VNPay (tạo chữ ký HMAC-SHA512):
  - `flutter_booking_app/backend/routes/managerVnpay.js`
    - hàm `sortObject`, `buildVnpayQuery` (xử lý encoding, sắp key, tạo HMAC SHA512)

- Các script DB/migration và helper:
  - `flutter_booking_app/Haircut_booking_clean.sql` — schema đầy đủ (tables: users, barbers, time_slots, appointments, branch_closures, promotions, reviews, ...)
  - `flutter_booking_app/backend/lib/ensureSchemaExtensions*.js` — thêm/cập nhật schema khi server chạy (migrations nhẹ)

- Chuẩn hóa điện thoại / phone normalization logic:
  - `flutter_booking_app/backend/lib/phoneVn.js` (được dùng trước khi insert/update users)

- Đồng bộ rating từ reviews & bảng sync:
  - `flutter_booking_app/backend/lib/syncBarberRatings.js`

## 5) Kiến trúc tổng quan
- Hình thức repo: Monorepo chứa nhiều ứng dụng (Next.js web apps + Flutter mobile + Node.js backend + admin station)

- Cấu trúc thư mục chính (rút gọn):
  - `flutter_booking_app/` — Flutter app + backend (Node/Express) + SQL schema
    - `backend/` — API server (Express), `routes/`, `lib/`, `scripts/`, `uploads/`
    - `pubspec.yaml`, `lib/` — Flutter app source
  - `admin-web/`, `owner-web/`, `manager-web/`, `receptionist-web/`, `login-web/` — Next.js frontends (separate apps)
  - `docs/` — tài liệu, hướng dẫn

- Pattern & liên kết module:
  - Backend theo kiểu REST API monolith: routes tách file dưới `backend/routes`, DB access dùng `mysql2/promise` pool (`db.js`) và transactions khi cần.
  - DB-centric business logic: nhiều kiểm tra và khóa DB để đảm bảo tính nhất quán (ví dụ booking), logic nghiệp vụ lớn được thực hiện ở backend.
  - Frontend (Next.js) kết nối tới backend qua REST endpoints; nhiều app độc lập nhưng cùng database backend.
  - Admin UI độc lập (`backend/admin-station`) dùng AdminJS + Sequelize để quản trị DB (thay vì dùng same Express API).

## Tài liệu tham khảo (vị trí file quan trọng)
- Backend server: [flutter_booking_app/backend/server.js](flutter_booking_app/backend/server.js#L1)
- Booking logic (timeslots & booking transaction): [flutter_booking_app/backend/routes/appointments.js](flutter_booking_app/backend/routes/appointments.js#L1)
- VNPay integration: [flutter_booking_app/backend/routes/managerVnpay.js](flutter_booking_app/backend/routes/managerVnpay.js#L1)
- Haversine utilities: [flutter_booking_app/backend/lib/haversine.js](flutter_booking_app/backend/lib/haversine.js#L1)
- DB pool: [flutter_booking_app/backend/db.js](flutter_booking_app/backend/db.js#L1)
- Schema SQL: [flutter_booking_app/Haircut_booking_clean.sql](flutter_booking_app/Haircut_booking_clean.sql#L1)
- Flutter pubspec: [flutter_booking_app/pubspec.yaml](flutter_booking_app/pubspec.yaml#L1)
- Next apps: [admin-web/package.json](admin-web/package.json#L1), [owner-web/package.json](owner-web/package.json#L1), [manager-web/package.json](manager-web/package.json#L1), [receptionist-web/package.json](receptionist-web/package.json#L1), [login-web/package.json](login-web/package.json#L1)

---

## Bổ sung: Auth flow, Socket.io, API endpoints và Environment variables

**Auth flow (tóm tắt)**
- Frontends (Next.js, Flutter) use Firebase for authentication. Frontends exchange Firebase UIDs with backend to map users.
- Endpoint `/api/users/verify` (server.js) accepts `{ phone, firebase_uid, role }` to upsert a `users` row and link `firebase_uid`.
- Many protected routes expect the header `x-firebase-uid` (e.g., `managerVnpay.js`, `adminPlatform.js`) — middleware functions read this header and validate it by querying `users` WHERE `firebase_uid = ?` then check `role`, `is_locked`, and `branch_id` where applicable.
- There are also public helper endpoints: `/api/users/by-firebase/:firebaseUid` (get user by Firebase UID) and `/api/users/:phone` (resolve by phone).

**Socket.IO usage (realtime notifications)**
- Server initializes Socket.IO in `server.js` and exposes it as `global.io`:
  - `const io = new IoServer(server, { cors: { origin: process.env.CLIENT_CORS_ORIGIN || '*', methods: ['GET','POST','PATCH','PUT'] } });`
  - Clients should `connect` then emit `register` with payload `{ userId }` (server joins socket to room `user_<userId>`).
  - Routes emit events using `global.io.to('user_<id>').emit(...)` (e.g., `appointments.js` emits booking/cancellation notifications to barber user rooms).

**Environment variables (found in README, admin-web examples, and code)**
- DB / server:
  - `PORT` (server port)
  - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  - `CLIENT_CORS_ORIGIN` (Socket.IO CORS origin)
- Firebase / frontend:
  - `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_*` (frontend envs in `admin-web/.env.local.example`)
- VNPay / payments:
  - `VNPAY_URL`, `VNPAY_TMNCODE`, `VNPAY_HASHSECRET`, `VNPAY_RETURN_URL`, (README lists `VNPAY_TMN_CODE` / `VNPAY_HASH_SECRET` — code expects `VNPAY_URL`, `VNPAY_TMNCODE`, `VNPAY_HASHSECRET`, `VNPAY_RETURN_URL`)
- Other:
  - `JWT_SECRET` (mentioned in README sample though JWT is not prominent in server code)
  - `SERVER_URL` (used in some scripts like `scripts/test_concurrent_booking.js`)

**Các router / mount points (tổng quan các API endpoint chính)**
Ảnh hưởng bởi cách `server.js` đăng ký các router. Dưới đây là mount point + ví dụ các route con (không liệt kê mọi route nhỏ):

- `/api/services` — `routes/services.js`
  - `GET /api/services/`, `POST /api/services/` (quản lý dịch vụ shop)

- `/api` — `routes/branchesPublic.js`
  - `GET /api/branches/nearest`, `GET /api/branches` (tìm chi nhánh)

- `/api` — `routes/shopCheckout.js`
  - `POST /api/shop/checkout`, `GET /api/shop/orders/:id/payment-status`, `GET /api/shop/vnpay/ipn`, `GET /api/shop/vnpay/return`

- `/api` — `routes/shopProductsRoutesFixed.js`
  - Product/shop admin endpoints: `/api/product-categories`, `/api/products`, `/api/admin/products`, `/api/shop/orders`, `/api/shop/stats`, etc.

- `/api` — `routes/appointments.js`
  - `GET /api/timeslots/:barberId/:date`
  - `GET /api/appointments` (admin list)
  - `GET /api/admin/appointments`
  - `GET /api/appointments/customer/:customerId`
  - `GET /api/appointments/barber/:barberId`
  - `POST /api/appointments` (booking — transactional)
  - `PATCH /api/appointments/:id/cancel`

- `/api/owner` — owner routes (`routes/ownerAnalytics.js`, `routes/ownerOffers.js`, `routes/ownerBarbers.js`)
  - `GET /api/owner/analytics`, `GET /api/owner/offers`, `POST /api/owner/offers`, `GET /api/owner/barbers`, etc.

- `/api` — `routes/offersPublic.js`
  - `GET /api/offers`, `POST /api/promotions/validate`, `GET /api/promotions/usage-history`

- `/api/admin` — admin routes (`routes/adminShopsApi.js`, `routes/adminPlatform.js`)
  - `GET /api/admin/shops`, `PATCH /api/admin/shops/:id`, `GET /api/admin/platform/stats`, `GET /api/admin/platform/users`, `PATCH /api/admin/platform/users/:id`, `GET /api/admin/platform/notifications`, `GET /api/admin/platform/audit-log`

- `/api/manager` — manager routes (`routes/managerOps.js`, `routes/managerVnpay.js`)
  - Manager ops: `/api/manager/branches`, `/api/manager/barbers`, `/api/manager/appointments`, `/api/manager/working-schedules`, `/api/manager/messages`, `/api/manager/appointments-on-behalf`, etc.
  - Payments: `POST /api/manager/vnpay/checkout`, `GET /api/manager/appointments/:id/payment-status`

- `/api` — `routes/branchClosures.js`, `routes/branchClosureRequests.js`
  - `GET /api/branch-closures`, `POST /api/branch-closures`, `POST /api/branch-closures/:id/cancel`, `PUT /api/branch-closures/:id`
  - `GET /api/branch-closure-requests`, `POST /api/branch-closure-requests`, `/approve`, `/reject`

- `/api` — `routes/chatMessages.js`
  - `POST /api/messages`, `GET /api/messages` (chat support between customers and receptionist)

- Misc (direct routes in `server.js`)
  - User endpoints: `POST /api/users/verify`, `GET /api/users/by-firebase/:firebaseUid`, `GET /api/users/:phone`, `GET /api/users`, `PUT /api/users/:id`, and admin alias `GET /api/admin/users`.
  - Barber endpoints exposed on `/api/barbers`, `/api/barbers/by-user/:userId`, `POST /api/barbers`, `PUT /api/barbers/:barberId/availability`.

---
