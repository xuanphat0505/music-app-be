# Kế hoạch Triển khai Backend NestJS - MusicHub

Tài liệu này chi tiết hóa các bước thiết lập, cấu hình cơ sở dữ liệu, và phát triển các API cho dự án backend MusicHub sử dụng NestJS.

---

## 1. Công nghệ Sử dụng (Technology Stack)
*   **Framework**: NestJS (TypeScript)
*   **Database**: MongoDB (sử dụng `@nestjs/mongoose` & Mongoose)
*   **Authentication**: Passport.js + JWT (JSON Web Tokens), `bcrypt` để mã hóa mật khẩu
*   **Scheduler**: `@nestjs/schedule` (Cron Job) cho việc tự động đồng bộ nhạc
*   **HTTP Client**: `axios` để giao tiếp với các node API của Audius

---

## 2. Cấu trúc Thư mục Backend (Project Structure)
```text
server/
├── src/
│   ├── app.module.ts           # Module gốc liên kết tất cả các module con
│   ├── main.ts                 # Điểm khởi chạy ứng dụng (bootstrap)
│   ├── config/                 # Cấu hình môi trường, hằng số hệ thống
│   ├── common/                 # Guards, Interceptors, Filters, Decorators dùng chung
│   └── modules/
│       ├── auth/               # Đăng ký, đăng nhập, cấp phát JWT token
│       ├── users/              # Thông tin người dùng & Cài đặt cá nhân
│       ├── sync/               # Đồng bộ dữ liệu từ Audius API về MongoDB
│       ├── songs/              # Danh sách nhạc, chi tiết bài hát, tăng playsCount
│       ├── artists/            # Danh mục nghệ sĩ
│       ├── albums/             # Danh mục album
│       ├── playlists/          # Tạo & cập nhật danh sách phát
│       ├── favorites/          # Quản lý danh sách nhạc yêu thích
│       └── history/            # Lưu lịch sử nghe nhạc và lịch sử tìm kiếm
├── test/                       # Thư mục kiểm thử (E2E testing)
├── .env.example                # File mẫu cấu hình biến môi trường
├── package.json
└── tsconfig.json
```

---

## 3. Lộ trình Triển khai Chi tiết (Phases)

### Giai đoạn 1: Khởi tạo & Cấu hình Cơ bản
*   [ ] **Khởi tạo dự án**: Cài đặt NestJS CLI và khởi tạo ứng dụng NestJS trong thư mục `server/`.
*   [ ] **Cấu hình biến môi trường**: Tích hợp `@nestjs/config` để quản lý cổng chạy, chuỗi kết nối MongoDB, khóa bí mật JWT.
*   [ ] **Kết nối Database**: Cấu hình `@nestjs/mongoose` liên kết tới MongoDB (Local hoặc Atlas).
*   [ ] **Tạo khung Module**: Sử dụng NestJS CLI để tạo cấu trúc sơ bộ cho các module (`auth`, `users`, `sync`, `songs`, `artists`, `albums`, `playlists`, `favorites`, `history`).

### Giai đoạn 2: Phát triển Module Auth & Users (Quản lý Xác thực)
*   [ ] **Thiết kế Mongoose Schema**: Định nghĩa `UserSchema` và `SettingsSchema`.
*   [ ] **Đăng ký tài khoản (`/auth/register`)**: Nhận email, password, username; mã hóa mật khẩu bằng `bcrypt` và lưu vào DB.
*   [ ] **Đăng nhập (`/auth/login`)**: Kiểm tra mật khẩu, ký và trả về `accessToken` cùng `refreshToken`.
*   [ ] **Guard bảo vệ API**: Viết `JwtStrategy` và `JwtAuthGuard` để bảo vệ các tuyến API cần đăng nhập.
*   [ ] **Thông tin cá nhân (`/auth/me` hoặc `/users/profile`)**: Lấy thông tin user hiện tại thông qua token gửi kèm.

### Giai đoạn 3: Phát triển Sync Module (Đồng bộ nhạc từ Audius)
*   [ ] **Khám phá API Node**: Viết logic tự động lấy danh sách Host Node hoạt động tốt nhất từ Audius API (giúp kết nối luôn ổn định).
*   [ ] **Định nghĩa Schemas**: Tạo `SongSchema`, `ArtistSchema`, `AlbumSchema` với các liên kết `ref` tương ứng.
*   [ ] **Viết service đồng bộ**:
    *   Quét danh sách các ca sĩ/bài hát thịnh hành từ Audius.
    *   Lưu thông tin metadata về MongoDB (tránh trùng lặp dựa trên `audiusId`).
*   [ ] **Cấu hình Cron Job**: Thiết lập Cron chạy tự động hàng ngày (hoặc hàng tuần) bằng `@nestjs/schedule` để cập nhật nhạc mới.

### Giai đoạn 4: Phát triển Music REST API (Songs, Artists, Albums)
*   [ ] **API Bài hát (`/songs`)**: Lấy danh sách nhạc có phân trang, tìm kiếm theo tên, lấy bài hát chi tiết, và tăng lượt nghe (`playsCount`).
*   [ ] **API Nghệ sĩ (`/artists`)**: Lấy danh sách nghệ sĩ, xem chi tiết nghệ sĩ cùng danh sách các bài hát của họ.
*   [ ] **API Album (`/albums`)**: Danh sách album và chi tiết các bài hát nằm trong album.

### Giai đoạn 5: Phát triển Playlist, Favorites & History
*   [ ] **API Playlist (`/playlists`)**: Tạo playlist mới, sửa tên/cover, thêm bài hát vào playlist, xóa bài hát khỏi playlist.
*   [ ] **API Yêu thích (`/favorites`)**: Bật/tắt trạng thái yêu thích bài hát (like/unlike), lấy danh sách bài hát đã yêu thích.
*   [ ] **API Lịch sử (`/history`)**: Ghi nhận bài hát khi người dùng nghe trên 30 giây, hiển thị lịch sử nghe gần nhất.

---

## 4. Hướng dẫn thiết lập chạy thử nghiệm nhanh (Quick Start)
1.  **Cài đặt package**: Chạy lệnh `npm install` hoặc `yarn install` trong thư mục `server`.
2.  **Tạo file `.env`**: Sao chép từ `.env.example` và thiết lập các biến `MONGO_URI`, `JWT_SECRET`.
3.  **Khởi động server**: Chạy lệnh `npm run start:dev` để chạy chế độ hot-reload phát triển.
