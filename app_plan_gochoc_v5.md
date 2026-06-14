📱 KẾ HOẠCH PHÁT TRIỂN ỨNG DỤNG "GÓC HỌC THÔNG MINH" — V5

App Hỗ Trợ Dạy Học Theo Góc & Tổ Chức Trò Chơi Lớn

[!NOTE]

 

Phiên bản 5.0

 — Tích hợp toàn bộ tính năng v1→v4 và bổ sung: 

Chế độ chấm điểm khi nhóm dùng chung thiết bị

 — Quick Switch, chấm điểm cá nhân/nhóm, NT nộp hộ.


--------------------------------------------------------------------------------


1. TỔNG QUAN

1.1. Tên ứng dụng: 

GócHọc AI

1.2. Tầm nhìn

Một nền tảng 

duy nhất

 giúp GV biến bất kỳ bài học nào thành trải nghiệm dạy học theo góc, với AI Bot thay thế vai trò trợ giảng tại mỗi góc — và mở rộng ra trò chơi lớn ngoài trời.

1.3. Vấn đề cốt lõi (từ nghiên cứu)

#

Khó khăn của GV

Giải pháp GócHọc AI

1

Không thể bao quát

 tất cả góc/trạm cùng lúc

AI Bot trợ giảng + Đồng GV/Trợ giảng hỗ trợ

2

Thời gian chuẩn bị

 quá lớn

AI tự sinh nhiệm vụ từ 1 bộ nội dung GV nạp

3

Khó đánh giá

 cá nhân trong nhóm

Hồ sơ HS + chấm điểm cá nhân ngay cả khi dùng chung thiết bị

4

HS hiểu sai

 mà GV không kịp phát hiện

Bot giải đáp + nhóm trưởng nhắn GV

5

Quản lý lớp

 phức tạp khi luân chuyển

GV chủ động điều hướng + Đồng GV hỗ trợ

6

Thiếu kịch bản mẫu

 cho trò chơi lớn

Kho templates có sẵn

7

Mất kết nối internet

Offline-first toàn diện

8

GV khác muốn dự giờ

Observer View: xem trực tiếp, không can thiệp

9

HS không có điện thoại riêng

Chế độ nhóm chung thiết bị

 — chấm điểm cá nhân trên 1 máy

1.4. Đối tượng sử dụng

graph LR
    GVC["👩‍🏫 GV Chính<br><i>Toàn quyền</i>"] --> APP["📱 GócHọc AI"]
    DGV["👨‍🏫 Đồng GV / Trợ giảng<br><i>Quyền được trao</i>"] --> APP
    OBS["👀 GV Dự giờ<br><i>Chỉ xem</i>"] --> APP
    HS["👩‍🎓 Học sinh<br><i>Tương tác, ứng cử, chọn góc</i>"] --> APP
    NT["👑 Nhóm trưởng / Thư ký<br><i>Giao tiếp GV, nộp bài hộ</i>"] --> APP


mermaid


--------------------------------------------------------------------------------


2. LỊCH SỬ THAY ĐỔI (V1→V5)

Phiên bản

Thay đổi chính

v1

Kế hoạch gốc: tổng quan app, kiến trúc Next.js + PostgreSQL

v2

Đơn giản stack → Vite + Supabase, chia MVP-α/β, chi phí ~$0

v3

Tài khoản HS + Lobby + GV điều hướng + giao tiếp 2 chiều + hồ sơ HS + offline-first + GV tùy chỉnh bot + 2-10 góc + mã 4 số

v4

Đồng GV/Trợ giảng/GV dự giờ + HS tự chọn góc (GV duyệt) + HS ứng cử vai trò (GV duyệt)

v5

★ 

Chấm điểm nhóm chung thiết bị

: Quick Switch, scoring_mode cá nhân/nhóm, NT nộp hộ


--------------------------------------------------------------------------------


3. KIẾN TRÚC KỸ THUẬT

3.1. Tech Stack

Thành phần

Công nghệ

Lý do chọn

Frontend

Vite + React + TypeScript

Nhanh, nhẹ, DX tốt, PWA dễ cấu hình

UI

Shadcn/ui + Tailwind CSS

Component sẵn, nhất quán, responsive

Backend / DB

Supabase (PostgreSQL + Auth + Storage + Realtime)

All-in-one, free tier hào phóng

AI / LLM

Google Gemini 2.0 Flash

Nhanh, rẻ, hỗ trợ tiếng Việt tốt

RAG

Supabase pgvector + Gemini Embedding

Vector search trong PostgreSQL

Real-time

Supabase Realtime (WebSocket)

Tích hợp sẵn, hỗ trợ presence

File Storage

Supabase Storage

Upload ảnh, tài liệu

Hosting

Vercel (frontend)

Free tier, auto-deploy

PWA + Offline

Vite PWA Plugin + IndexedDB + Workbox

Offline-first

[!TIP]

 

Chi phí ước tính MVP:

 ~$0/tháng (toàn bộ free tier). Phát sinh chi phí khi vượt ~50 HS đồng thời.

3.2. Kiến trúc hệ thống

graph TB
    subgraph "Frontend - PWA Offline-First"
        GV_UI["👩‍🏫 GV Dashboard"]
        DGV_UI["👨‍🏫 Đồng GV View"]
        OBS_UI["👀 Observer View"]
        HS_UI["👩‍🎓 HS Interface"]
        LOBBY["🏠 Lobby"]
        PROFILE["📊 Hồ sơ HS"]
        SWITCH["🔄 Quick Switch"]
        IDB["💾 IndexedDB"]
    end

    subgraph "Supabase Platform"
        AUTH["🔐 Auth"]
        DB["🗄️ PostgreSQL + pgvector"]
        RT["📡 Realtime"]
        STORE["📁 Storage"]
        EDGE["⚡ Edge Functions"]
    end

    subgraph "AI Layer"
        GEMINI["🤖 Gemini 2.0 Flash"]
    end

    GV_UI & DGV_UI & OBS_UI & HS_UI & LOBBY & PROFILE --> AUTH
    GV_UI & DGV_UI & HS_UI --> DB & RT
    HS_UI & GV_UI --> STORE
    GV_UI & HS_UI --> IDB
    SWITCH --> HS_UI
    EDGE --> GEMINI
    HS_UI & GV_UI --> EDGE
    DB -.-> EDGE


mermaid

3.3. Database Schema

-- ═══════════════════════════════════════
-- QUẢN LÝ NGƯỜI DÙNG
-- ═══════════════════════════════════════

teachers (
  id UUID PRIMARY KEY REFERENCES auth.users,
  full_name TEXT NOT NULL,
  school_name TEXT,
  subject TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
)

students (
  id UUID PRIMARY KEY REFERENCES auth.users,
  display_name TEXT NOT NULL,
  student_code TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  class_name TEXT,
  teacher_id UUID REFERENCES teachers,
  
  -- HỒ SƠ CÁ NHÂN
  total_xp INT DEFAULT 0,
  total_points INT DEFAULT 0,
  badges JSONB DEFAULT '[]',
  total_sessions INT DEFAULT 0,
  total_interactions INT DEFAULT 0,
  total_group_interactions INT DEFAULT 0,
  streak_days INT DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
)

-- ═══════════════════════════════════════
-- PHIÊN HỌC
-- ═══════════════════════════════════════

sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  grade_level TEXT,
  mode TEXT CHECK (mode IN ('station_rotation', 'big_game')) DEFAULT 'station_rotation',
  
  -- CẤU HÌNH
  join_code CHAR(4) UNIQUE NOT NULL,
  rotation_mode TEXT CHECK (rotation_mode IN ('fixed', 'teacher_directed')) DEFAULT 'fixed',
  rotation_time_minutes INT DEFAULT 15,
  total_time_minutes INT,
  max_stations INT DEFAULT 4 CHECK (max_stations BETWEEN 2 AND 10),

  -- PHÂN NHÓM (v4)
  grouping_mode TEXT CHECK (grouping_mode IN (
    'random', 'gender_balanced', 'manual', 'student_choice'
  )) DEFAULT 'random',
  group_size INT DEFAULT 4,

  -- CHỌN VAI TRÒ (v4)
  role_assignment TEXT CHECK (role_assignment IN (
    'teacher_assign', 'student_nominate'
  )) DEFAULT 'teacher_assign',

  -- ★ MỚI v5: CHẾ ĐỘ THIẾT BỊ
  device_mode TEXT CHECK (device_mode IN (
    'individual',      -- Mỗi HS 1 thiết bị (mặc định)
    'shared'           -- Nhóm chung 1 thiết bị
  )) DEFAULT 'individual',
  
  -- GV DỰ GIỜ (v4)
  allow_observers BOOLEAN DEFAULT TRUE,
  observer_join_code CHAR(6),

  status TEXT DEFAULT 'draft',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
)

-- ═══════════════════════════════════════
-- ĐỒNG GV / TRỢ GIẢNG / DỰ GIỜ (v4)
-- ═══════════════════════════════════════

session_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers NOT NULL,
  role TEXT CHECK (role IN ('co_teacher', 'assistant', 'observer')) NOT NULL,
  permissions JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  invited_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ
)

-- ═══════════════════════════════════════
-- HS ỨNG CỬ VAI TRÒ (v4)
-- ═══════════════════════════════════════

role_nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions ON DELETE CASCADE,
  group_id UUID REFERENCES groups ON DELETE CASCADE,
  student_id UUID REFERENCES students NOT NULL,
  nominated_role TEXT CHECK (nominated_role IN ('leader', 'secretary')),
  reason TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES teachers,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_id, group_id, student_id)
)

-- ═══════════════════════════════════════
-- HS TỰ CHỌN GÓC (v4)
-- ═══════════════════════════════════════

station_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions ON DELETE CASCADE,
  student_id UUID REFERENCES students NOT NULL,
  preferred_station_id UUID REFERENCES stations,
  preference_order INT DEFAULT 1,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_id, student_id, preference_order)
)

-- ═══════════════════════════════════════
-- GÓC / TRẠM (2-10 góc)
-- ═══════════════════════════════════════

stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_num INT NOT NULL,
  
  -- CẤU HÌNH BOT (GV tùy chỉnh)
  bot_persona TEXT DEFAULT 'friendly',
  bot_custom_prompt TEXT,
  bot_language_level TEXT DEFAULT 'middle_school',
  bot_allow_hints BOOLEAN DEFAULT TRUE,
  bot_max_hints INT DEFAULT 3,
  
  -- KIẾN THỨC (cho RAG)
  knowledge_text TEXT,
  knowledge_files TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT now()
)

-- ═══════════════════════════════════════
-- NHIỆM VỤ — ★ v5: scoring_mode
-- ═══════════════════════════════════════

tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('quiz', 'short_answer', 'photo_upload', 'practice', 'cipher')),
  content JSONB NOT NULL,
  order_num INT NOT NULL,
  points INT DEFAULT 10,
  time_limit_minutes INT,
  
  -- ★ MỚI v5: CÁCH TÍNH ĐIỂM
  scoring_mode TEXT CHECK (scoring_mode IN (
    'individual',       -- Mỗi HS làm + chấm riêng
    'group_equal',      -- Cả nhóm làm chung → chia đều điểm
    'group_leader_tag'  -- NT nộp, gắn tag ai làm → chấm theo tag
  )) DEFAULT 'individual',

  -- ★ MỚI v5: YÊU CẦU QUICK SWITCH
  require_individual_login BOOLEAN DEFAULT FALSE
    -- TRUE = bắt buộc từng HS phải Quick Switch đăng nhập để làm
    -- FALSE = 1 người có thể nộp cho cả nhóm
)

-- ═══════════════════════════════════════
-- NHÓM & PHÂN CÔNG
-- ═══════════════════════════════════════

groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions ON DELETE CASCADE,
  name TEXT NOT NULL,
  current_station_id UUID REFERENCES stations,
  rotation_order INT[],
  current_rotation INT DEFAULT 0,
  
  -- ★ MỚI v5: THIẾT BỊ ĐANG HOẠT ĐỘNG
  active_device_id TEXT,          -- device fingerprint
  active_student_id UUID REFERENCES students,  -- ai đang dùng
  
  created_at TIMESTAMPTZ DEFAULT now()
)

group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups ON DELETE CASCADE,
  student_id UUID REFERENCES students NOT NULL,
  role TEXT CHECK (role IN ('member', 'leader', 'secretary')) DEFAULT 'member',
  UNIQUE (group_id, student_id)
)

-- ═══════════════════════════════════════
-- ★ MỚI v5: PHIÊN ĐĂNG NHẬP TRÊN THIẾT BỊ CHUNG
-- ═══════════════════════════════════════

shared_device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups ON DELETE CASCADE,
  device_id TEXT NOT NULL,           -- fingerprint máy
  
  -- Lịch sử switch
  student_id UUID REFERENCES students NOT NULL,
  switched_in_at TIMESTAMPTZ DEFAULT now(),   -- thời điểm chuyển vào
  switched_out_at TIMESTAMPTZ,                -- thời điểm chuyển ra
  
  -- Trong phiên này HS đã làm gì
  actions_count INT DEFAULT 0       -- số hành động (chat, nộp bài...)
)

-- ═══════════════════════════════════════
-- GIAO TIẾP 2 CHIỀU (v4: mở rộng)
-- ═══════════════════════════════════════

messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions,
  sender_type TEXT CHECK (sender_type IN (
    'teacher', 'co_teacher', 'assistant', 'leader', 'secretary'
  )),
  sender_id UUID NOT NULL,
  recipient_type TEXT CHECK (recipient_type IN ('teacher', 'group', 'all_groups', 'co_teachers')),
  recipient_group_id UUID REFERENCES groups,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
)

-- ═══════════════════════════════════════
-- LỊCH SỬ CHAT VỚI BOT
-- ═══════════════════════════════════════

chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations,
  student_id UUID REFERENCES students,  -- ai đang chat (sau Quick Switch)
  group_id UUID REFERENCES groups,
  role TEXT CHECK (role IN ('student', 'bot')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
)

-- ═══════════════════════════════════════
-- KẾT QUẢ NHIỆM VỤ — ★ v5: submitted_by / submitted_for
-- ═══════════════════════════════════════

task_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks,
  group_id UUID REFERENCES groups,
  
  -- ★ MỚI v5: AI NỘP / NỘP CHO AI
  submitted_by UUID REFERENCES students,        -- ai bấm nút nộp
  submitted_for UUID[] DEFAULT '{}',             -- nộp cho ai (array student_ids)
    -- Nếu scoring_mode = 'individual' → submitted_for = [chính mình]
    -- Nếu scoring_mode = 'group_equal' → submitted_for = [tất cả thành viên]
    -- Nếu scoring_mode = 'group_leader_tag' → submitted_for = [HS được tag]
  
  answer JSONB,
  score INT,
  max_score INT,
  hints_used INT DEFAULT 0,
  xp_earned INT DEFAULT 0,
  feedback TEXT,
  
  -- ★ MỚI v5: CÁCH PHÂN BỔ ĐIỂM
  score_distribution TEXT CHECK (score_distribution IN (
    'full',      -- 100% điểm cho mỗi người trong submitted_for
    'equal',     -- chia đều điểm cho submitted_for
    'weighted'   -- GV tùy chỉnh tỷ lệ (future)
  )) DEFAULT 'full',
  
  completed_at TIMESTAMPTZ DEFAULT now()
)

-- ═══════════════════════════════════════
-- LỊCH SỬ PHIÊN, EMBEDDINGS, OFFLINE
-- (giữ nguyên từ v3/v4)
-- ═══════════════════════════════════════

session_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions,
  student_id UUID REFERENCES students,
  group_id UUID REFERENCES groups,
  total_score INT DEFAULT 0,
  total_xp INT DEFAULT 0,
  tasks_completed INT DEFAULT 0,
  tasks_total INT DEFAULT 0,
  interactions_count INT DEFAULT 0,
  group_interactions_count INT DEFAULT 0,
  badges_earned JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ
)

station_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(768),
  metadata JSONB
)

offline_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL,
  synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ
)


sql


--------------------------------------------------------------------------------


4. TÍNH NĂNG CHI TIẾT

4.1. 🧑‍🏫 MODULE GIÁO VIÊN

A. Quản lý Tài khoản HS — 

MVP-α

Tạo tài khoản HS

 hàng loạt (import Excel/CSV)

Quản lý danh sách

 — xem, sửa, xóa, đặt lại mật khẩu

Xem hồ sơ HS

 — điểm, XP, huy hiệu, lịch sử

B. Tạo Phiên học (Session) — 

MVP-α

Chọn chế độ: Dạy học theo góc 

(MVP)

 | Trò chơi lớn 

(Phase 2)

Đặt thời gian tổng + thời gian mỗi vòng

Tạo 

2-10 góc

 (mỗi góc = 1 AI Bot riêng)

Chọn 

chế độ luân chuyển

: cố định | GV điều hướng

Tạo 

mã phiên 4 số

 + 

mã dự giờ 6 số

★ Chọn 

chế độ thiết bị

: mỗi HS 1 máy | nhóm chung 1 máy

C. ★ CẤU HÌNH CHẾ ĐỘ THIẾT BỊ — 

MVP-α

[!IMPORTANT]

 

Tính năng mới v5:

 GV bật/tắt "Chế độ nhóm chung thiết bị" khi tạo phiên. Khi bật, giao diện HS tự động hiển thị thanh Quick Switch và tùy chọn nộp bài phù hợp.

┌──────────────────────────────────────────────────┐
│ ⚙️ CẤU HÌNH PHIÊN HỌC                            │
│ ─────────────────────────────────────────────────│
│                                                  │
│ 📱 CHẾ ĐỘ THIẾT BỊ:                              │
│ ┌────────────────────────────────────────────┐   │
│ │ ○ 📱 Mỗi HS 1 thiết bị                    │   │
│ │   Mỗi HS đăng nhập trên máy riêng         │   │
│ │                                            │   │
│ │ ● 📱👥 Nhóm chung 1 thiết bị               │ ★ │
│ │   Nhiều HS dùng chung 1 máy/nhóm          │   │
│ │   → Bật Quick Switch chuyển người          │   │
│ │   → GV chọn cách tính điểm/nhiệm vụ      │   │
│ └────────────────────────────────────────────┘   │
│                                                  │
│ ℹ️ Khi chọn "Nhóm chung thiết bị":               │
│ • HS chuyển nhanh bằng cách bấm tên (không cần  │
│   đăng nhập lại)                                 │
│ • Mỗi nhiệm vụ có thể chấm điểm cá nhân hoặc   │
│   nhóm tùy GV thiết kế                          │
│ • Nhóm trưởng có thể nộp bài hộ thành viên      │
│                                                  │
└──────────────────────────────────────────────────┘


D. THIẾT KẾ NHIỆM VỤ — ★ Chọn cách tính điểm — 

MVP-α

[!IMPORTANT]

 

Tính năng mới v5:

 Mỗi nhiệm vụ, GV chọn 

cách tính điểm

 phù hợp. Hệ thống tự gợi ý mặc định theo loại nhiệm vụ.

┌──────────────────────────────────────────────────┐
│ ✏️ THIẾT KẾ NHIỆM VỤ — Góc 1: Khám phá          │
│ ─────────────────────────────────────────────────│
│                                                  │
│ 📝 Nhiệm vụ 1:                                   │
│ ┌────────────────────────────────────────────┐   │
│ │ Tên: "Trả lời câu hỏi trắc nghiệm"       │   │
│ │ Loại: [Trắc nghiệm ▼]    Điểm: [10]      │   │
│ │                                            │   │
│ │ 📊 CÁCH TÍNH ĐIỂM:                  ★ MỚI │   │
│ │ ┌──────────────────────────────────────┐   │   │
│ │ │ ● 👤 Cá nhân (Individual)            │   │   │
│ │ │   Mỗi HS tự làm, tự chấm riêng     │   │   │
│ │ │   → Cần Quick Switch từng người     │   │   │
│ │ │                                      │   │   │
│ │ │ ○ 👥 Nhóm chia đều (Group Equal)    │   │   │
│ │ │   Cả nhóm làm chung, chia đều điểm │   │   │
│ │ │   → 1 người nộp, cả nhóm được điểm │   │   │
│ │ │                                      │   │   │
│ │ │ ○ 👑 NT gắn tag (Leader Tag)        │   │   │
│ │ │   NT nộp bài, chọn ai đã làm phần  │   │   │
│ │ │   nào → chấm theo tag              │   │   │
│ │ └──────────────────────────────────────┘   │   │
│ └────────────────────────────────────────────┘   │
│                                                  │
│ 📝 Nhiệm vụ 2:                                   │
│ ┌────────────────────────────────────────────┐   │
│ │ Tên: "Thí nghiệm nhóm + chụp ảnh"        │   │
│ │ Loại: [Upload ảnh ▼]     Điểm: [20]      │   │
│ │                                            │   │
│ │ 📊 CÁCH TÍNH ĐIỂM:                        │   │
│ │ ┌──────────────────────────────────────┐   │   │
│ │ │ ○ 👤 Cá nhân                         │   │   │
│ │ │ ● 👥 Nhóm chia đều                   │ ← │   │
│ │ │ ○ 👑 NT gắn tag                      │   │   │
│ │ └──────────────────────────────────────┘   │   │
│ └────────────────────────────────────────────┘   │
│                                                  │
│ 📝 Nhiệm vụ 3:                                   │
│ ┌────────────────────────────────────────────┐   │
│ │ Tên: "Viết giải thích hiện tượng"         │   │
│ │ Loại: [Tự luận ngắn ▼]   Điểm: [15]      │   │
│ │                                            │   │
│ │ 📊 CÁCH TÍNH ĐIỂM:                        │   │
│ │ ┌──────────────────────────────────────┐   │   │
│ │ │ ○ 👤 Cá nhân                         │   │   │
│ │ │ ○ 👥 Nhóm chia đều                   │   │   │
│ │ │ ● 👑 NT gắn tag                      │ ← │   │
│ │ └──────────────────────────────────────┘   │   │
│ └────────────────────────────────────────────┘   │
│                                                  │
│ 💡 GỢI Ý TỰ ĐỘNG:                                │
│ • Trắc nghiệm → Cá nhân (mỗi HS tự trả lời)    │
│ • Upload ảnh thực hành → Nhóm chia đều           │
│ • Tự luận → NT gắn tag hoặc Cá nhân             │
│                                                  │
└──────────────────────────────────────────────────┘


Bảng gợi ý mặc định theo loại nhiệm vụ:

Loại nhiệm vụ

Scoring mode mặc định

Lý do

Trắc nghiệm

👤 

Cá nhân

Mỗi HS có kiến thức riêng

Tự luận ngắn

👤 

Cá nhân

Đánh giá khả năng diễn đạt cá nhân

Upload ảnh (thực hành nhóm)

👥 

Nhóm chia đều

Sản phẩm chung của nhóm

Upload ảnh (bài cá nhân)

👑 

NT gắn tag

NT chụp hộ, gắn tên từng HS

Thực hành

👥 

Nhóm chia đều

Hoạt động hợp tác

Chat hỏi bot

— 

Không chấm điểm

Chỉ đếm tương tác vào hồ sơ

E. 🏠 PHÒNG CHỜ (LOBBY) — 

MVP-α

Lobby đầy đủ 4 chế độ phân nhóm + HS ứng cử (giữ nguyên từ v4):

🎲 Ngẫu nhiên | ⚖️ Cân bằng nam/nữ | ✋ GV tự chọn | 🙋 HS tự chọn (GV duyệt)

👑 GV chỉ định vai trò | 🙋 HS ứng cử (GV duyệt)

GV duyệt GV dự giờ

F. 👥 HỆ THỐNG ĐỒNG GV / TRỢ GIẢNG / DỰ GIỜ — 

MVP-β

Vai trò

Cách vào

Quyền hạn

👩‍🏫 

GV Chính

Tạo phiên

Toàn quyền

👨‍🏫 

Đồng GV

GV chính mời

Quyền được trao (giám sát, nhắn tin, điều hướng, chấm bài)

🧑‍🏫 

Trợ giảng

GV chính mời

Quyền giới hạn (giám sát + nhắn tin)

👀 

GV Dự giờ

Mã/QR → GV duyệt

CHỈ XEM

G. ⚙️ TÙY CHỈNH AI BOT — 

MVP-β

Chọn tính cách / viết prompt tùy chỉnh

Prompt bổ sung, chủ đề cấm

Mức hỗ trợ (ít/nhiều gợi ý)

Thử chat với bot trước khi sử dụng

H. Giám sát Real-time (Live Dashboard) — 

MVP-β

Trạng thái từng nhóm: vị trí, tiến độ, thời gian

★ 

Hiển thị ai đang dùng máy

 (khi shared device mode)

Cảnh báo tự động khi nhóm chậm/kẹt

Giao tiếp 2 chiều: GV + Đồng GV ↔ NT/TK

Điều hướng nhóm (khi chế độ GV điều hướng)

I. Đánh giá & Báo cáo — 

Phase 2

Bảng điểm tự động (cá nhân + nhóm)

★ 

Phân biệt rõ

: điểm cá nhân vs điểm nhóm chia đều vs điểm được tag

Xuất báo cáo PDF/Excel


--------------------------------------------------------------------------------


4.2. 🤖 MODULE AI BOT

A. Kiến trúc Bot

flowchart LR
    HS["💬 HS gửi tin nhắn<br>(sau Quick Switch)"] --> CHECK{"Online?"}
    CHECK -->|"Có"| EDGE["⚡ Edge Function"]
    CHECK -->|"Không"| CACHE["💾 IndexedDB"]
    CACHE -->|"Khi có mạng"| EDGE
    EDGE --> RAG["🔍 pgvector"]
    RAG --> CTX["📋 Context +<br>System Prompt +<br>GV Custom Prompt"]
    CTX --> GEMINI["🤖 Gemini 2.0 Flash"]
    GEMINI --> RESP["💬 Phản hồi"]
    RESP --> LOG["📝 Log + XP<br>(gắn đúng student_id)"]


mermaid

[!TIP]

 

Khi Shared Device Mode:

 Bot nhận biết ai đang chat qua 

student_id

 sau Quick Switch. Chat history gắn đúng từng HS, dù cùng 1 thiết bị.

B. System Prompt — Mặc định + GV tùy chỉnh

Bạn là trợ giảng AI tại "{station_name}" trong phiên học "{session_title}".

## Vai trò
- Chào đón HS khi đến góc
- Hướng dẫn nhiệm vụ theo thứ tự
- Giải đáp CHỈ TRONG phạm vi kiến thức
- KHÔNG đưa đáp án trực tiếp — hướng dẫn suy nghĩ
- Đánh giá bài làm theo tiêu chí GV

## Tính cách: {bot_persona}
## Ngôn ngữ: Phù hợp HS cấp {school_level}
## Kiến thức bài học: {knowledge_base_context}
## Nhiệm vụ: {tasks_list}
## Hướng dẫn bổ sung: {teacher_custom_prompt}
## Chủ đề CẤM: {blocked_topics}

## Quy tắc:
1. Ngoài phạm vi: "Mình chỉ hỗ trợ bài hôm nay thôi nhé! 😊"
2. Gợi ý DẦN DẦN (tối đa {max_hints} lần)
3. Hoàn thành → chúc mừng + cập nhật tiến độ
4. Kết thúc bằng câu hỏi mở hoặc khuyến khích
5. Ghi nhận XP khi hoàn thành tốt


C. Các loại tương tác Bot

Loại

Mô tả

Phase

Chat văn bản

Hỏi đáp text

MVP-α

Trắc nghiệm

Bot ra câu hỏi, HS chọn đáp án

MVP-α

Tự luận ngắn

Bot đánh giá dựa trên rubric GV

MVP-β

Upload ảnh

HS chụp bài → bot xác nhận

MVP-β

Giải mật thư

Cho trò chơi lớn

Phase 2


--------------------------------------------------------------------------------


4.3. 📱 MODULE HỌC SINH

A. Đăng nhập & Tham gia — 

MVP-α

flowchart TD
    A["📱 Mở app"] --> B["🔐 Đăng nhập"]
    B --> C["🔢 Mã phiên 4 số"]
    C --> D["🏠 Lobby"]
    D --> D1{"HS tự chọn góc?"}
    D1 -->|"Có"| D2["🙋 Chọn góc"]
    D1 -->|"Không"| D3["⏳ Chờ GV"]
    D2 & D3 --> E{"HS ứng cử?"}
    E -->|"Có"| E2["🙋 Ứng cử NT/TK"]
    E -->|"Không"| E3["⏳ Chờ"]
    E2 & E3 --> F["▶️ Bắt đầu"]
    F --> G["➡️ Vào Góc"]


mermaid

B. ★ QUICK SWITCH — Chuyển người trên thiết bị chung — 

MVP-α

[!IMPORTANT]

 

Tính năng mới v5:

 Khi GV bật "Nhóm chung thiết bị", giao diện HS hiển thị thanh Quick Switch ở trên cùng. HS chuyển người bằng 1 chạm — không cần đăng nhập lại.

┌──────────────────────────────────────────────────┐
│ 🔄 QUICK SWITCH — Nhóm 2                    ★ v5│
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│ │  An  │ │ Bình │ │Cường │ │ Dung │ │  Em  │   │
│ │ 👤   │ │ ●👤● │ │ 👤   │ │ 👤   │ │ 👤   │   │
│ │      │ │đang  │ │      │ │      │ │      │   │
│ │      │ │dùng  │ │      │ │      │ │      │   │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
│ ─────────────────────────────────────────────── │
│ 🔬 GÓC KHÁM PHÁ                         ⏱️ 8:23│
│ ──────────────────────────────────────────────── │
│ 📋 Nhiệm vụ:                                    │
│ ✅ 1. Xem video (👥 Nhóm chia đều: +5 XP/người)│
│ 🔄 2. Trắc nghiệm (👤 Cá nhân: Bình đang làm) │
│ ⬜ 3. Viết giải thích (👑 NT gắn tag)           │
│ ──────────────────────────────────────────────── │
│ 💬 Chat với Bot (đang chat với tư cách: Bình)   │
│ ┌────────────────────────────────────────────┐   │
│ │ 🤖 Chào Bình! Em hãy trả lời câu hỏi:   │   │
│ │    CO2 được tạo ra từ phản ứng nào?       │   │
│ │                                            │   │
│ │ 👩‍🎓 Bình: Phản ứng giữa axit và muối ạ   │   │
│ │                                            │   │
│ │ 🤖 Gần đúng rồi! 💡 Gợi ý: Cụ thể hơn,  │   │
│ │    axit nào tác dụng với muối nào? 🤔     │   │
│ └────────────────────────────────────────────┘   │
│ [Nhập tin nhắn...] [Gửi]                        │
│                                                  │
│ [📷 Chụp ảnh] [🆘 Nhắn GV]                      │
│ 📊 Bình: XP 95 (+5) | 🏅 1 huy hiệu             │
└──────────────────────────────────────────────────┘


Cơ chế Quick Switch:

Thanh avatar HS ở trên cùng — bấm tên = chuyển ngay

Không cần nhập mật khẩu lại

 (session token nhóm)

Khi chuyển → giao diện cập nhật:

Tên HS hiện tại

Tiến độ nhiệm vụ của HS đó

Chat history của HS đó (riêng biệt)

XP/điểm của HS đó

Bot nhận biết ai đang chat → phản hồi bằng tên đúng

Mỗi lần switch → ghi log vào 

shared_device_sessions

C. ★ NỘP BÀI THEO SCORING MODE — 

MVP-α

Khi scoring_mode = 👤 Cá nhân (Individual)

┌──────────────────────────────────────┐
│ 📝 NHIỆM VỤ 2: Trắc nghiệm         │
│ 📊 Chấm điểm: 👤 Cá nhân            │
│ ──────────────────────────────────── │
│                                      │
│ ⚠️ Mỗi bạn cần tự trả lời!          │
│ ● Đang làm: Bình                    │
│                                      │
│ Câu 1: CO2 là chất gì?              │
│ ○ A. Chất rắn                       │
│ ● B. Chất khí                       │
│ ○ C. Chất lỏng                      │
│                                      │
│ [✅ Nộp bài cho Bình]                │
│                                      │
│ 📋 Trạng thái:                       │
│ ✅ An: đã nộp (8/10 điểm)           │
│ 🔄 Bình: đang làm                   │
│ ⬜ Cường: chưa làm                   │
│ ⬜ Dung: chưa làm                    │
│                                      │
│ → Chuyển sang Cường: [🔄 Switch]    │
└──────────────────────────────────────┘


Khi scoring_mode = 👥 Nhóm chia đều (Group Equal)

┌──────────────────────────────────────┐
│ 📝 NHIỆM VỤ 1: Xem video + ghi chép│
│ 📊 Chấm điểm: 👥 Nhóm chia đều     │
│ ──────────────────────────────────── │
│                                      │
│ ℹ️ Cả nhóm cùng làm, điểm chia đều! │
│ Ai nộp cũng được.                    │
│                                      │
│ 3 hiện tượng quan sát:              │
│ 1. [Bọt khí xuất hiện         ]     │
│ 2. [Dung dịch đổi màu         ]     │
│ 3. [Nhiệt độ tăng             ]     │
│                                      │
│ [✅ Nộp cho cả nhóm]                │
│ → Tất cả 5 người đều nhận điểm     │
│                                      │
│ 📊 Nếu đạt 20/20:                   │
│ • An: +20 điểm, +15 XP              │
│ • Bình: +20 điểm, +15 XP            │
│ • Cường: +20 điểm, +15 XP           │
│ • Dung: +20 điểm, +15 XP            │
│ • Em: +20 điểm, +15 XP              │
└──────────────────────────────────────┘


Khi scoring_mode = 👑 NT gắn tag (Leader Tag)

┌──────────────────────────────────────┐
│ 📝 NHIỆM VỤ 3: Viết giải thích      │
│ 📊 Chấm điểm: 👑 NT gắn tag         │
│ ──────────────────────────────────── │
│                                      │
│ ℹ️ Nhóm trưởng nộp bài, chọn ai đã  │
│    làm phần nào.                     │
│                                      │
│ Bài giải thích:                      │
│ ┌──────────────────────────────────┐ │
│ │ Hiện tượng bọt khí xảy ra do    │ │
│ │ phản ứng giữa HCl và CaCO3     │ │
│ │ tạo ra khí CO2...               │ │
│ └──────────────────────────────────┘ │
│                                      │
│ 👑 Nộp bài này cho ai?              │
│ ┌──────────────────────────────────┐ │
│ │ ☑️ An    — viết phần đầu        │ │
│ │ ☑️ Bình  — viết phần giải thích │ │
│ │ ☐ Cường — chưa tham gia        │ │
│ │ ☑️ Dung  — viết kết luận       │ │
│ │ ☐ Em    — chưa tham gia        │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [✅ Nộp cho: An, Bình, Dung]        │
│ → 3 người được điểm                 │
│ → Cường, Em: điểm = 0 (chưa tham gia)│
└──────────────────────────────────────┘


D. 📊 HỒ SƠ HỌC SINH — 

MVP-β

Mục

Mô tả

XP tổng

Tích lũy qua tất cả phiên

Điểm trung bình

Điểm hoàn thành nhiệm vụ

Streak

Ngày liên tiếp tham gia

Chat

Tổng tương tác bot (gắn đúng HS qua Quick Switch)

Tương tác nhóm

Hợp tác, đóng góp

Huy hiệu

Thành tích đặc biệt

Lịch sử phiên

Chi tiết từng phiên

Vai trò

Số lần làm NT/TK

★ 

Chi tiết điểm

Phân biệt: điểm cá nhân / nhóm chia đều / được tag


--------------------------------------------------------------------------------


4.4. 📡 MODULE OFFLINE-FIRST

Tính năng

Online 🟢

Offline 🟡

Đăng nhập

✅

✅ (token cached)

Quick Switch

✅

✅ (session nhóm cached)

Xem nhiệm vụ

✅

✅

Làm trắc nghiệm

✅

✅ (lưu local)

Viết tự luận

✅

✅ (lưu local)

Chụp ảnh

✅

✅ (lưu local)

Chat bot

✅

⚠️ Cache FAQ

Nhắn tin GV

✅

⚠️ Queue

Dashboard

✅

⚠️ Snapshot

Xem hồ sơ

✅

✅

AI đánh giá

✅

❌ Queue


--------------------------------------------------------------------------------


5. USER FLOW CHI TIẾT

5.1. Flow Giáo viên

flowchart TD
    A["🔐 GV đăng nhập"] --> B["📋 Trang chủ"]
    B --> M2["📋 Tạo Phiên"]
    M2 --> C["📝 Nhập thông tin bài"]
    C --> C1{"Chế độ thiết bị? ★v5"}
    C1 -->|"Mỗi HS 1 máy"| C2["📱 Individual mode"]
    C1 -->|"Chung 1 máy"| C3["📱👥 Shared mode<br>+ chọn scoring/nhiệm vụ"]
    C2 & C3 --> C4["👥 Mời Đồng GV"]
    C4 --> D{"Tạo góc? (2-10)"}
    D --> E["Tạo góc + nhiệm vụ<br>★ Chọn scoring_mode/task"]
    E --> F["⚙️ Tùy chỉnh Bot"]
    F --> G["🔢 Tạo mã 4+6 số"]
    G --> I["🏠 Lobby (4 chế độ)"]
    I --> N["▶️ Bắt đầu"]
    N --> O["📊 Dashboard"]
    O --> Q["🏁 Kết thúc → Báo cáo"]


mermaid

5.2. Flow HS — Thiết bị chung ★v5

flowchart TD
    A["📱 Mở app"] --> B["🔐 NT đăng nhập<br>(đại diện nhóm)"]
    B --> C["🔢 Mã phiên 4 số"]
    C --> D["🏠 Lobby<br>(hệ thống tự nhận nhóm)"]
    D --> E["▶️ GV bắt đầu"]
    E --> F["➡️ Vào Góc"]
    
    F --> G["🔄 Quick Switch<br>hiển thị ở trên cùng"]
    G --> H["📖 Làm nhiệm vụ"]
    
    H --> H1{"Scoring mode?"}
    H1 -->|"👤 Cá nhân"| H2["🔄 Switch sang HS cần làm<br>→ Từng người tự trả lời<br>→ Nộp riêng"]
    H1 -->|"👥 Nhóm đều"| H3["Ai nộp cũng được<br>→ Cả nhóm nhận điểm"]
    H1 -->|"👑 NT tag"| H4["NT nộp bài<br>→ Tag ai đã làm<br>→ Chỉ người được tag nhận điểm"]
    
    H2 & H3 & H4 --> I{"Còn nhiệm vụ?"}
    I -->|"Có"| H
    I -->|"Không"| J["⏳ Chờ chuyển góc"]
    J --> F


mermaid

5.3. Flow GV Dự giờ

flowchart LR
    A["🔐 Đăng nhập"] --> B["🔢 Mã dự giờ / QR"]
    B --> C["⏳ Chờ duyệt"]
    C --> D["👀 Observer View<br>(chỉ xem)"]
    D --> E["🏁 Kết thúc"]


mermaid


--------------------------------------------------------------------------------


6. CHẾ ĐỘ HOẠT ĐỘNG

6.1. Dạy học theo góc 

(MVP)

┌───────────────────────────────────────────────────────┐
│                      LỚP HỌC                          │
│                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │  GÓC 1   │ │  GÓC 2   │ │  GÓC 3   │              │
│  │ 🤖 Bot   │ │ 🤖 Bot   │ │ 🤖 Bot   │              │
│  │ 👨‍🏫 ĐồngGV│ │          │ │ 🧑‍🏫 TGiảng│              │
│  │ 📱👥 1máy │ │ 📱📱 riêng│ │ 📱👥 1máy │ ← tùy nhóm  │
│  └──────────┘ └──────────┘ └──────────┘              │
│                                                       │
│  ┌──────────┐ ┌──────────┐   ┌────────────────────┐  │
│  │  GÓC 4   │ │  GÓC 5   │   │  👩‍🏫 GV + Dashboard │  │
│  │ 🤖 Bot   │ │ 🤖 Bot   │   │  👀 2 GV dự giờ    │  │
│  └──────────┘ └──────────┘   └────────────────────┘  │
└───────────────────────────────────────────────────────┘


6.2. Trò chơi lớn 

(Phase 2)

Mật thư, QR check-in, Đồng GV phụ trách trạm

GPS tracking tùy chọn


--------------------------------------------------------------------------------


7. LỘ TRÌNH PHÁT TRIỂN (V5)

Phase 0 — Khởi tạo (1 tuần)

Ngày

Công việc

1-2

Vite + React + TypeScript + Tailwind + Shadcn/ui

2-3

Supabase: schema v5, Auth, Storage, RLS

3-5

UI mockup (Lobby, Dashboard, Quick Switch, scoring)

5-7

CI/CD: GitHub → Vercel + PWA + Workbox

MVP-α — Core + Quick Switch (3-4 tuần)

Mục tiêu:

 GV tạo phiên (2 chế độ thiết bị), Lobby v4, HS chat bot, Quick Switch, 3 scoring mode.

Tuần

Công việc

Kết quả

1

Quản lý HS: TK, import Excel, đăng nhập

GV quản lý HS

1-2

GV Dashboard: phiên, góc (2-10), ★ chọn device_mode

GV tạo bài

2

★ 

Thiết kế nhiệm vụ + scoring_mode

 (individual/group/tag)

3 cách chấm

2

Lobby v4: 4 chế độ phân nhóm + ứng cử

Lobby hoạt động

2-3

AI Bot: RAG + Gemini

Bot trả lời đúng

3

HS Interface: đăng nhập, ★ 

Quick Switch

, chat bot

HS tương tác

3

★ 

Nộp bài 3 chế độ

: cá nhân / nhóm đều / NT tag

Chấm điểm

3-4

Luân chuyển: cố định + GV điều hướng

2 chế độ

Kết quả MVP-α:

 Demo end-to-end, thử 1 nhóm (5-10 HS, 1-2 thiết bị).

MVP-β — Giám sát + Cộng tác + Hồ sơ + Offline (4-5 tuần)

Tuần

Công việc

Kết quả

1

Dashboard v4: real-time, ★ hiển thị ai đang dùng máy

Dashboard

1-2

Đồng GV/Trợ giảng: mời, phân quyền

Cộng tác

2

GV Dự giờ: mã/QR, duyệt, Observer View

Dự giờ

2-3

Giao tiếp 2 chiều: GV + Đồng GV ↔ NT/TK

Tin nhắn

3

Tùy chỉnh Bot: prompt, thử chat

Cấu hình

3-4

Hồ sơ HS: XP, điểm, huy hiệu, ★ phân biệt loại điểm

Hồ sơ

4

Nhiệm vụ nâng cao: tự luận, upload ảnh

Nộp bài

4-5

Offline-first: IndexedDB, sync queue, ★ Quick Switch offline

Offline

Phase 2 — Mở rộng (6-8 tuần)

Tính năng

Mô tả

Trò chơi lớn

Mật thư, QR check-in, trưởng trạm

Gamification nâng cao

Huy hiệu, bảng xếp hạng, streak

Kho Templates

Kịch bản mẫu theo môn/cấp

Báo cáo chi tiết

PDF/Excel, phân tích xu hướng

Đánh giá nâng cao

Rubric, Gemini Vision chấm ảnh

Phase 3 — Scale (8-12 tuần)

Tính năng

Mô tả

Mobile native

React Native / Expo

Offline đầy đủ

Sync nâng cao, conflict resolution

Tích hợp LMS

Google Classroom, Moodle

Cộng đồng GV

Chia sẻ, đánh giá templates

Đa ngôn ngữ

Tiếng Việt + English

API mở

Cho trường tích hợp


--------------------------------------------------------------------------------


8. MÔ HÌNH KINH DOANH

Gói

Giá/tháng

Tính năng

Miễn phí

0đ

3 phiên/tháng, 4 góc, 30 HS, bot cơ bản, ★ shared device

GV Pro

79.000đ

Không giới hạn, 10 góc, tùy chỉnh bot, hồ sơ HS, offline, 1 Đồng GV

Trường học

399.000đ

Nhiều GV, trò chơi lớn, templates, analytics, dự giờ

Sở GD&ĐT

Liên hệ

Toàn hệ thống, đào tạo, SLA

[!NOTE]

 

Shared Device Mode miễn phí

 cho tất cả các gói — vì đây là giải pháp cho trường thiếu thiết bị, cần ưu tiên phổ cập.


--------------------------------------------------------------------------------


9. METRICS ĐO LƯỜNG

Metric

Mục tiêu MVP

6 tháng

GV đăng ký

10

500

HS có tài khoản

400

20.000

Phiên/tuần

5

200

HS/tuần

50

5.000

Hoàn thành phiên

80%

90%

GV retention 30d

40%

60%

GV dự giờ/tuần

2

50

HS ứng cử/phiên

30%

50%

★ Phiên dùng shared device

40%

30% (giảm khi trường đầu tư)

Bot phản hồi

< 3s

< 3s

Uptime

99.5%

99.5%

★ Quick Switch time

< 1s

< 0.5s


--------------------------------------------------------------------------------


10. RỦI RO VÀ GIẢI PHÁP

#

Rủi ro

Mức

Giải pháp

1

HS không có điện thoại

🟡

★ 

Shared Device Mode

 — Quick Switch trên 1 máy

2

Internet mất

🔴

Offline-first + sync queue

3

Bot trả lời sai

🟡

RAG + GV prompt + log review

4

Chi phí API

🟡

Cache + giới hạn

5

HS quên mật khẩu

🟢

GV reset

6

HS spam bot

🟡

Rate limiting

7

Bảo mật

🟢

Supabase RLS

8

Xung đột offline

🟡

Last-write-wins

9

★ HS không chuyển Quick Switch khi bài cá nhân

🟡

Bot nhắc "Bạn nào chưa làm?" + GV thấy trên Dashboard

10

★ NT không tag đúng người

🟡

GV review log + HS phản hồi nếu bị sai


--------------------------------------------------------------------------------


11. TỔNG HỢP TẤT CẢ TÍNH NĂNG (V1→V5)

#

Tính năng

Phiên bản

Phase

1

AI Bot trợ giảng tại mỗi góc

v1

MVP-α

2

GV Dashboard + tạo phiên

v1

MVP-α

3

Stack Vite + Supabase (~$0)

v2

MVP-α

4

Chia MVP-α / MVP-β

v2

—

5

Tài khoản HS (GV cấp)

v3

MVP-α

6

Phòng chờ Lobby

v3

MVP-α

7

2-10 góc

v3

MVP-α

8

Mã phiên 4 số

v3

MVP-α

9

GV điều hướng luân chuyển

v3

MVP-α

10

Giao tiếp 2 chiều GV↔NT/TK

v3

MVP-β

11

GV tùy chỉnh bot

v3

MVP-β

12

Hồ sơ HS (XP, huy hiệu, streak)

v3

MVP-β

13

Offline-first

v3

MVP-β

14

HS tự chọn góc (GV duyệt)

v4

MVP-α

15

HS ứng cử NT/TK (GV duyệt)

v4

MVP-α

16

Đồng GV / Trợ giảng

v4

MVP-β

17

GV Dự giờ (Observer)

v4

MVP-β

18

★ Shared Device Mode

v5

MVP-α

19

★ Quick Switch

v5

MVP-α

20

★ 3 Scoring modes (individual/group/tag)

v5

MVP-α

21

Trò chơi lớn

v1

Phase 2

22

Gamification nâng cao

v2

Phase 2

23

Kho Templates

v1

Phase 2

24

Mobile native

v1

Phase 3

25

Tích hợp LMS

v1

Phase 3


--------------------------------------------------------------------------------


12. BƯỚC TIẾP THEO

✅ 

Xác nhận kế hoạch v5

🎨 

Thiết kế UI

 — Quick Switch, Scoring config, Lobby v4, Observer View

🛠️ 

Khởi tạo project

 — Vite + Supabase + PWA + Vercel

👥 

Tạo demo

 — 5 HS + 1 GV + 1 Đồng GV + 1 Observer + 1 shared device

🤖 

AI Bot

 — RAG + Gemini + Quick Switch aware

🧪 

Demo MVP-α

 — Lobby → Quick Switch → 3 scoring modes → Chat bot

[!IMPORTANT]

 

Cần xác nhận từ bạn:

Bạn muốn demo với 

môn/bài học

 cụ thể nào?

Đối tượng HS

: Tiểu học / THCS / THPT?

Có 

danh sách HS mẫu

 (Excel) để test import không?

Bạn muốn bắt đầu code luôn hay cần điều chỉnh thêm?


--------------------------------------------------------------------------------


Ghi chú:

 Kế hoạch v5 tích hợp toàn bộ 25 tính năng từ v1→v5, dựa trên nghiên cứu "Phương Pháp Dạy Học Theo Góc và Trò Chơi Lớn Ở Trường Học".
