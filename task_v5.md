Danh Sách Công Việc (GócHọc AI v5)

Phase 0: Khởi tạo (1 tuần)
[x] Khởi tạo project React + TypeScript với Vite
[x] Cài đặt Tailwind CSS
[x] Cấu hình Supabase (Auth, Storage)
[ ] Tạo schema database v5 trên Supabase (Đang thực hiện - Đã phân tích thiết kế và cấu trúc RPC)
[ ] Thiết lập RLS (Row Level Security) cơ bản cho Supabase
[x] Cấu hình Vite PWA Plugin + Workbox cho Offline-first
[x] Thiết kế UI mockup (Lobby, Dashboard, Quick Switch, Scoring config)
[ ] Setup CI/CD deploy tự động lên Vercel

MVP-α: Core + Quick Switch (3-4 tuần)

Quản lý HS:
[x] UI tạo tài khoản HS hàng loạt (import Excel/CSV)
[x] Quản lý danh sách (sửa, xóa, reset password)

Tạo Phiên học (GV):
[x] Dashboard GV tạo phiên
[x] Tạo cấu trúc Góc/Trạm (2-10 góc)
[x] Cấu hình device_mode (1 thiết bị vs chia sẻ thiết bị)

Thiết kế nhiệm vụ & Scoring:
[x] Giao diện tạo nhiệm vụ (trắc nghiệm, upload, tự luận, v.v.)
[x] Cấu hình scoring_mode cho từng nhiệm vụ (Cá nhân, Nhóm chia đều, NT gắn tag)

Phòng chờ (Lobby v4):
[x] 4 chế độ phân nhóm (🎲 Ngẫu nhiên, ⚖️ Cân bằng nam/nữ, ✋ GV chọn, 🙋 HS tự chọn) (UI thiết kế, đã hoàn thiện Lõi Ghép Random + Ưu tiên vai trò)
[x] Cơ chế ứng cử vai trò (NT/TK) và duyệt của GV
[x] Kết nối Realtime ghép nhóm & trạng thái Online/Offline

AI Bot:
[ ] Tạo RAG pipeline (pgvector + Gemini embedding)
[x] Tích hợp Gemini 2.0 Flash API (Đã có logic gọi API trong `chatService`)

Giao diện Học sinh:
[x] Đăng nhập (Mã phiên + Auth)
[x] Thanh Quick Switch (không cần nhập lại mật khẩu)
[x] Tương tác với AI Bot

Cơ chế nộp bài (3 chế độ):
[ ] Nộp bài cá nhân (sau khi switch)
[ ] Nộp bài nhóm chia đều (ai nộp cũng được)
[ ] NT nộp và gắn tag (chỉ điểm cho người được tag)

Luân chuyển:
[ ] Tự động chuyển góc theo thời gian
[ ] GV điều khiển luân chuyển thủ công

MVP-β: Giám sát + Cộng tác + Hồ sơ + Offline (4-5 tuần)
[ ] (Chưa bắt đầu)
