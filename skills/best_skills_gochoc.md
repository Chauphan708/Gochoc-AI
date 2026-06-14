Skills Tốt Nhất Cho Dự Án GócHọc AI (Web App & PWA)

Dựa trên yêu cầu của dự án GócHọc AI (PWA Offline First, Realtime, AI Bot, Database), dưới đây là các skills và framework tôi đã lựa chọn tối ưu nhất cho việc phát triển, đảm bảo chi phí thấp nhất (Free tier) và hiệu năng ổn định.

🎯 Cốt lõi & Frontend (Core Frontend Skills)

Những kỹ năng nền tảng và công cụ được chọn làm xương sống cho Frontend:

React 18 & TypeScript (Core):

 TypeScript là bắt buộc để quản lý các states phức tạp (session, groups, offline queue) rõ ràng mạch lạc. React với Hooks giúp chia nhỏ logic.

Vite:

 Build tool siêu tốc, cấu hình đơn giản hơn Webpack/CRA rất nhiều, đặc biệt native support tốt với PWA plugins.

Tailwind CSS & Shadcn/ui:

Lý do:

 Không mất thời gian viết SCSS/CSS từ đầu. Shadcn/ui mang lại giao diện (component) nhìn rất chuyên nghiệp, hiện đại, sẵn có khả năng tùy biến sâu mà không phụ thuộc thư viện npm cồng kềnh.

Zustand (State Management):

Lý do:

 Nhẹ, ít boilerplate hơn Redux. Thích hợp để quản lý App State (Lobby, Session, User current state), đặc biệt khi phải sync status giữa Online và Offline.

🚀 Backend & Database (Supabase Ecosystem)

Giải pháp Backend-as-a-Service thay thế việc tự duy trì Node.js Server:

Supabase Auth & RLS (Row Level Security):

 Rất dễ cấu hình phân quyền bảo mật trực tiếp trên PostgreSQL, đảm bảo HS chỉ thấy dữ liệu nhóm mình, GV thấy toàn bộ, và Observer chỉ thấy dữ liệu readonly.

Supabase Realtime:

Use case:

 Bắt buộc dùng cho Phòng Chờ (Lobby) và Live Dashboard. Dùng tính năng 

Presence

 để check user online, và 

Broadcast

 để gửi event điều hướng nhóm một cách mượt mà.

Pgvector (PostgreSQL Vector Extension):

Use case:

 Được tích hợp sẵn trong Supabase, cho phép lưu trữ embedding cho RAG. Rẻ và ổn định hơn việc dùng vector database bên 3 thứ hãng.

🧠 AI Integration (Gemini Ecosystem)

Dùng free tier mạnh nhất hiện tại để đảm bảo chi phí MVP = 0đ.

Google Gemini 2.0 Flash:

Tốc độ cực nhanh cho chat.

Prompt Engineering với cấu trúc rõ ràng sẽ giúp Bot hạn chế ảo giác (hallucination).

Function Calling & Structured Outputs:

 Khi kết hợp Gemini với JSON Schema, Bot có thể trả về chính xác format đáp án (dựa trên rubric) hoặc tính năng "cập nhật XP" thông minh.

📡 Chuyên Sâu: PWA & Offline-First Strategies

Bài toán khó nhất là Offline-first (Nhóm dùng chung / Quick Switch). Kỹ năng cần tập trung:

Vite PWA Plugin & Workbox:

 Để cache assets (HTML/CSS/JS) và tài liệu nội dung bài học.

IndexedDB (via 

idb

 hoặc 

dexie.js

 wrapper):

 Lưu trữ toàn bộ câu hỏi trắc nghiệm, bài làm, và hồ sơ người dùng offline. LocalStorage không phù hợp về dung lượng.

Offline Sync Queue Design Pattern:

 Kỹ thuật tự build: Lưu trữ các request (điểm XP, chat history) vào IndexedDB. Lắng nghe event 

window.addEventListener('online', ...)

. Khi có mạng thì loop đọc DB và đẩy tuần tự lên Supabase (conflict resolution bằng 

synced_at

 timestamp).

🔧 Tools & Libraries

Thư viện routing: 

React Router DOM v6

Form & Validation: 

React Hook Form

 kết hợp 

Zod

Icons: 

Lucide React

 (đi kèm hoàn hảo cùng Shadcn)

Markdown/Chat Render: 

react-markdown

 kết hợp plugin để hiển thị chuẩn nội dung RAG.

🗺️ Lộ trình áp dụng (Roadmap)

Khởi động:

 Setup Vite, Tailwind, Shadcn/ui, Supabase Client và Auth trước.

Database:

 Viết các SQL scripts setup schemas cho v5 (sử dụng Prisma hoặc viết thô trên UI Supabase SQL Editor).

Core API / AI:

 Làm Edge Function connect Gemini + RAG (Vector store).

Offline Mode (Khó nhất):

 Tích hợp sau khi logic Online đã chạy chuẩn. Xây dựng Wrapper SyncQueue trước khi release MVP-β.
