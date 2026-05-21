# 🚀 SOURCE MARKET - NỀN TẢNG BÁN MÃ NGUỒN

Nền tảng web hoàn chỉnh để mua bán mã nguồn với tính năng mạng xã hội mini.

## 📋 TÍNH NĂNG

### ✨ Core Features
- ✅ **Hệ thống đăng nhập/đăng ký** với JWT Authentication
- ✅ **Quản lý sản phẩm** - Thêm, sửa, xóa, mua sản phẩm
- ✅ **Ví tiền** - Nạp tiền, giao dịch, lịch sử
- ✅ **Phân quyền** - User, Seller, Admin
- ✅ **Admin Panel** - Quản trị toàn quyền
- ✅ **SPA (Single Page Application)** - Không reload trang
- ✅ **Responsive Design** - Mobile friendly

### 🎯 Tính năng nâng cao
- 📝 Bài đăng mạng xã hội (Coming soon)
- 💬 Nhắn tin 1-1 (Coming soon)
- 🖼️ Upload ảnh/video (Coming soon)

---

## 🛠️ CÔNG NGHỆ SỬ DỤNG

### Backend
- **Node.js** + **Express.js**
- **MySQL** Database
- **JWT** Authentication
- **bcrypt** Password hashing
- **Multer** File uploads

### Frontend
- **Vanilla JavaScript** (No framework)
- **HTML5** + **CSS3**
- **Font Awesome** Icons
- **SPA Router** tự code

---

## 📦 CÀI ĐẶT

### 1️⃣ Yêu cầu hệ thống

```bash
Node.js >= 14.x
MySQL >= 5.7
npm >= 6.x
```

### 2️⃣ Clone & Install

```bash
# Giải nén file zip
cd source-market-complete

# Cài đặt dependencies
npm install
```

### 3️⃣ Cấu hình Database

```bash
# Tạo database MySQL
mysql -u root -p

# Import database schema
mysql -u root -p < database.sql
```

### 4️⃣ Cấu hình môi trường

Chỉnh sửa file `.env`:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=sourcemarket

# JWT Secret (QUAN TRỌNG: Đổi thành chuỗi ngẫu nhiên)
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# Admin Account
ADMIN_EMAIL=nguyenhongsang0207@gmail.com
ADMIN_PASSWORD=Admin@123456
```

### 5️⃣ Chạy Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Server sẽ chạy tại: **http://localhost:3000**

---

## 👤 TÀI KHOẢN MẶC ĐỊNH

Sau khi chạy server lần đầu, tài khoản admin sẽ được tạo tự động:

```
Email: nguyenhongsang0207@gmail.com
Password: Admin@123456
```

**⚠️ QUAN TRỌNG:** Đổi mật khẩu ngay sau lần đăng nhập đầu tiên!

---

## 🗂️ CẤU TRÚC PROJECT

```
source-market-complete/
├── backend/
│   ├── config/
│   │   └── database.js          # MySQL connection
│   ├── middleware/
│   │   ├── auth.js               # JWT authentication
│   │   └── upload.js             # File upload
│   ├── routes/
│   │   ├── auth.routes.js        # Authentication routes
│   │   ├── products.routes.js    # Product routes
│   │   ├── admin.routes.js       # Admin routes
│   │   └── ...
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── productController.js
│   │   └── ...
│   ├── services/
│   │   ├── authService.js
│   │   ├── productService.js
│   │   └── ...
│   ├── uploads/                  # Uploaded files
│   └── server.js                 # ⭐ Entry point
│
├── frontend/
│   ├── pages/
│   │   ├── index1.html           # Trang chủ
│   │   ├── header.html           # Header
│   │   ├── footer.html           # Footer
│   │   ├── login.html            # Đăng nhập
│   │   ├── product.html          # ⭐ Chi tiết sản phẩm
│   │   └── admin.html            # Admin panel
│   ├── css/
│   │   ├── main.css              # Styles chính
│   │   └── components.css        # Components
│   ├── js/
│   │   ├── app.js                # ⭐ Main application
│   │   ├── router.js             # SPA router
│   │   ├── api.js                # API client
│   │   ├── auth.js               # Auth helper
│   │   ├── utils.js              # Utilities
│   │   └── pages/                # Page scripts
│   │       ├── home.js
│   │       ├── product.js
│   │       ├── login.js
│   │       └── ...
│   └── index.html                # ⭐ Container chính
│
├── database.sql                  # Database schema
├── package.json
├── .env
└── README.md
```

---

## 🔌 API ENDPOINTS

### Authentication
```
POST   /api/auth/register       Đăng ký
POST   /api/auth/login          Đăng nhập
GET    /api/auth/me             Thông tin user
PUT    /api/auth/update-profile Cập nhật profile
PUT    /api/auth/change-password Đổi mật khẩu
POST   /api/auth/logout         Đăng xuất
```

### Products
```
GET    /api/products            Danh sách sản phẩm
GET    /api/products/:id        Chi tiết sản phẩm
POST   /api/products            Tạo sản phẩm (seller/admin)
PUT    /api/products/:id        Sửa sản phẩm
DELETE /api/products/:id        Xóa sản phẩm
POST   /api/products/:id/purchase Mua sản phẩm
```

### Admin
```
GET    /api/admin/dashboard     Dashboard thống kê
GET    /api/admin/users         Quản lý users
PUT    /api/admin/users/:id/role Thay đổi quyền
PUT    /api/admin/users/:id/status Ban/Unban user
POST   /api/admin/revenue/reset Reset doanh thu
```

Xem đầy đủ API tại: **File README gốc**

---

## 🎨 CÁCH HOẠT ĐỘNG

### SPA Router
- `index.html` không bao giờ reload
- Chỉ thay đổi nội dung trong `#main-content`
- URL thay đổi nhưng không reload trang
- Sử dụng `History API`

### Authentication Flow
```
1. User đăng nhập → Server trả về JWT token
2. Token lưu trong localStorage
3. Mọi request gửi kèm token trong header Authorization
4. Server verify token → Trả về data
```

### Product Detail
- **CHỈ 1 FILE** `product.html`
- Sử dụng route: `/product/:id`
- Load data từ API: `/api/products/:id`
- Hiển thị động bằng JavaScript

---

## 🚦 TESTING

### 1. Test đăng ký
```
1. Mở http://localhost:3000/register
2. Nhập thông tin
3. Kiểm tra database có user mới
```

### 2. Test đăng nhập
```
1. Mở http://localhost:3000/login
2. Đăng nhập với admin hoặc user đã tạo
3. Kiểm tra localStorage có token
```

### 3. Test mua sản phẩm
```
1. Đăng nhập
2. Vào chi tiết sản phẩm
3. Click "Mua ngay"
4. Kiểm tra balance và database
```

---

## 📝 PHÁT TRIỂN THÊM

### Tính năng cần hoàn thiện:
1. ✅ Upload ảnh/video sản phẩm
2. ✅ Hệ thống bài đăng (posts)
3. ✅ Nhắn tin 1-1
4. ✅ Trang cá nhân user
5. ✅ Lịch sử nạp tiền
6. ✅ Admin duyệt nạp tiền

### Cách thêm tính năng mới:
1. Tạo route trong `backend/routes/`
2. Tạo controller trong `backend/controllers/`
3. Tạo service trong `backend/services/`
4. Tạo HTML page trong `frontend/pages/`
5. Tạo script trong `frontend/js/pages/`
6. Thêm route vào `app.js`

---

## 🐛 DEBUG

### Lỗi thường gặp:

**1. Database connection failed**
```bash
# Kiểm tra MySQL đã chạy chưa
mysql -u root -p

# Kiểm tra file .env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
```

**2. Token expired**
```bash
# Xóa localStorage
localStorage.clear()

# Hoặc đăng nhập lại
```

**3. Port 3000 đã được sử dụng**
```bash
# Đổi port trong .env
PORT=3001
```

---

## 📞 LIÊN HỆ

**Email:** nguyenhongsang0207@gmail.com

---

## 📄 LICENSE

MIT License - Tự do sử dụng cho mục đích cá nhân và thương mại.

---

## 🎉 CREDITS

Developed by **Nguyen Hong Sang**

---

**⭐ Nếu project hữu ích, hãy để lại star trên GitHub!**
