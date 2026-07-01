-- ==============================================================================
-- COMBINED INITIALIZATION SQL FOR GOCHOC-AI
-- Generated on 2026-07-01T13:58:18.849Z
-- Run this script in Supabase SQL Editor to set up your database.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Migration: 001_initial_schema.sql
-- ------------------------------------------------------------------------------

-- ═══════════════════════════════════════
-- GOCHOC AI — DATABASE SCHEMA v5
-- Chạy file này trên Supabase SQL Editor
-- ═══════════════════════════════════════

-- Bật pgvector (cho RAG sau này)
CREATE EXTENSION IF NOT EXISTS vector;

-- ═══════════════════════════════════════
-- QUẢN LÝ NGƯỜI DÙNG
-- ═══════════════════════════════════════

CREATE TABLE teachers (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  school_name TEXT,
  subject TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  student_code TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  class_name TEXT,
  teacher_id UUID REFERENCES teachers ON DELETE SET NULL,

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
);

-- ═══════════════════════════════════════
-- PHIÊN HỌC
-- ═══════════════════════════════════════

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  grade_level TEXT,
  mode TEXT CHECK (mode IN ('station_rotation', 'big_game')) DEFAULT 'station_rotation',

  -- CẤU HÌNH
  join_code CHAR(4) NOT NULL,
  rotation_mode TEXT CHECK (rotation_mode IN ('fixed', 'teacher_directed')) DEFAULT 'fixed',
  rotation_time_minutes INT DEFAULT 15,
  total_time_minutes INT,
  max_stations INT DEFAULT 4 CHECK (max_stations BETWEEN 2 AND 10),

  -- PHÂN NHÓM
  grouping_mode TEXT CHECK (grouping_mode IN (
    'random', 'gender_balanced', 'manual', 'student_choice'
  )) DEFAULT 'random',
  group_size INT DEFAULT 4,

  -- CHỌN VAI TRÒ
  role_assignment TEXT CHECK (role_assignment IN (
    'teacher_assign', 'student_nominate'
  )) DEFAULT 'teacher_assign',

  -- CHẾ ĐỘ THIẾT BỊ (v5)
  device_mode TEXT CHECK (device_mode IN (
    'individual', 'shared'
  )) DEFAULT 'individual',

  -- GV DỰ GIỜ
  allow_observers BOOLEAN DEFAULT TRUE,
  observer_join_code CHAR(6),

  status TEXT DEFAULT 'draft',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint: join_code phải duy nhất trong các phiên đang hoạt động
CREATE UNIQUE INDEX idx_sessions_join_code_active
  ON sessions (join_code)
  WHERE status IN ('draft', 'lobby', 'active');

-- ═══════════════════════════════════════
-- GÓC / TRẠM (2-10 góc)
-- ═══════════════════════════════════════

CREATE TABLE stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_num INT NOT NULL,

  -- CẤU HÌNH BOT
  bot_persona TEXT DEFAULT 'friendly',
  bot_custom_prompt TEXT,
  bot_language_level TEXT DEFAULT 'middle_school',
  bot_allow_hints BOOLEAN DEFAULT TRUE,
  bot_max_hints INT DEFAULT 3,

  -- KIẾN THỨC (cho RAG)
  knowledge_text TEXT,
  knowledge_files TEXT[],

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════
-- NHIỆM VỤ — v5: scoring_mode
-- ═══════════════════════════════════════

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('quiz', 'short_answer', 'photo_upload', 'practice', 'cipher')),
  content JSONB NOT NULL,
  order_num INT NOT NULL,
  points INT DEFAULT 10,
  time_limit_minutes INT,

  -- CÁCH TÍNH ĐIỂM (v5)
  scoring_mode TEXT CHECK (scoring_mode IN (
    'individual', 'group_equal', 'group_leader_tag'
  )) DEFAULT 'individual',

  require_individual_login BOOLEAN DEFAULT FALSE
);

-- ═══════════════════════════════════════
-- NHÓM & PHÂN CÔNG
-- ═══════════════════════════════════════

CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions ON DELETE CASCADE,
  name TEXT NOT NULL,
  current_station_id UUID REFERENCES stations,
  rotation_order INT[],
  current_rotation INT DEFAULT 0,

  -- THIẾT BỊ ĐANG HOẠT ĐỘNG (v5)
  active_device_id TEXT,
  active_student_id UUID REFERENCES students,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups ON DELETE CASCADE,
  student_id UUID REFERENCES students NOT NULL,
  role TEXT CHECK (role IN ('member', 'leader', 'secretary')) DEFAULT 'member',
  UNIQUE (group_id, student_id)
);

-- ═══════════════════════════════════════
-- ĐỒNG GV / TRỢ GIẢNG / DỰ GIỜ
-- ═══════════════════════════════════════

CREATE TABLE session_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers NOT NULL,
  role TEXT CHECK (role IN ('co_teacher', 'assistant', 'observer')) NOT NULL,
  permissions JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  invited_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════
-- HS ỨNG CỬ VAI TRÒ
-- ═══════════════════════════════════════

CREATE TABLE role_nominations (
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
);

-- ═══════════════════════════════════════
-- HS TỰ CHỌN GÓC
-- ═══════════════════════════════════════

CREATE TABLE station_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions ON DELETE CASCADE,
  student_id UUID REFERENCES students NOT NULL,
  preferred_station_id UUID REFERENCES stations,
  preference_order INT DEFAULT 1,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (session_id, student_id, preference_order)
);

-- ═══════════════════════════════════════
-- PHIÊN ĐĂNG NHẬP TRÊN THIẾT BỊ CHUNG (v5)
-- ═══════════════════════════════════════

CREATE TABLE shared_device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  student_id UUID REFERENCES students NOT NULL,
  switched_in_at TIMESTAMPTZ DEFAULT now(),
  switched_out_at TIMESTAMPTZ,
  actions_count INT DEFAULT 0
);

-- ═══════════════════════════════════════
-- GIAO TIẾP 2 CHIỀU
-- ═══════════════════════════════════════

CREATE TABLE messages (
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
);

-- ═══════════════════════════════════════
-- LỊCH SỬ CHAT VỚI BOT
-- ═══════════════════════════════════════

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations,
  student_id UUID REFERENCES students,
  group_id UUID REFERENCES groups,
  role TEXT CHECK (role IN ('student', 'bot')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════
-- KẾT QUẢ NHIỆM VỤ — v5
-- ═══════════════════════════════════════

CREATE TABLE task_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks,
  group_id UUID REFERENCES groups,
  submitted_by UUID REFERENCES students,
  submitted_for UUID[] DEFAULT '{}',
  answer JSONB,
  score INT,
  max_score INT,
  hints_used INT DEFAULT 0,
  xp_earned INT DEFAULT 0,
  feedback TEXT,
  score_distribution TEXT CHECK (score_distribution IN (
    'full', 'equal', 'weighted'
  )) DEFAULT 'full',
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════
-- LỊCH SỬ PHIÊN
-- ═══════════════════════════════════════

CREATE TABLE session_history (
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
);

-- ═══════════════════════════════════════
-- OFFLINE SYNC QUEUE
-- ═══════════════════════════════════════

CREATE TABLE offline_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL,
  synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════
-- RLS (Row Level Security) CƠ BẢN
-- ═══════════════════════════════════════

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- GV xem/sửa thông tin của mình
CREATE POLICY "teachers_select" ON teachers
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "teachers_update" ON teachers
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "teachers_insert" ON teachers
  FOR INSERT WITH CHECK (true); -- Bảo mật bởi khóa ngoại REFERENCES auth.users(id)

-- GV quản lý HS của mình
CREATE POLICY "students_teacher_manage" ON students
  FOR ALL USING (teacher_id = auth.uid());

-- GV quản lý phiên của mình
CREATE POLICY "sessions_teacher_manage" ON sessions
  FOR ALL USING (teacher_id = auth.uid());

-- Mọi người xem đượcphiên đang hoạt động (để HS tham gia)
CREATE POLICY "sessions_public_read" ON sessions
  FOR SELECT USING (status IN ('active', 'lobby'));

-- Stations/Tasks thuộc session của GV
CREATE POLICY "stations_session_owner" ON stations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = stations.session_id
      AND sessions.teacher_id = auth.uid()
    )
  );

CREATE POLICY "tasks_station_owner" ON tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stations
      JOIN sessions ON sessions.id = stations.session_id
      WHERE stations.id = tasks.station_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- Chat: HS và GV đều đọc được tin liên quan
CREATE POLICY "chat_messages_read" ON chat_messages
  FOR SELECT USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM stations
      JOIN sessions ON sessions.id = stations.session_id
      WHERE stations.id = chat_messages.station_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- Chat: HS ghi tin nhắn của mình
CREATE POLICY "chat_messages_insert" ON chat_messages
  FOR INSERT WITH CHECK (student_id = auth.uid() AND role = 'student');

-- Task results: đọc theo group hoặc session owner
CREATE POLICY "task_results_read" ON task_results
  FOR SELECT USING (
    submitted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM groups
      JOIN sessions ON sessions.id = groups.session_id
      WHERE groups.id = task_results.group_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- Groups: mọi người trong phiên đều xem được
CREATE POLICY "groups_session_read" ON groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND (sessions.teacher_id = auth.uid() OR sessions.status = 'active')
    )
  );

CREATE POLICY "group_members_read" ON group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups
      JOIN sessions ON sessions.id = groups.session_id
      WHERE groups.id = group_members.group_id
      AND (sessions.teacher_id = auth.uid() OR sessions.status = 'active')
    )
  );

-- Messages: đọc theo phiên
CREATE POLICY "messages_session_read" ON messages
  FOR SELECT USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = messages.session_id
      AND sessions.teacher_id = auth.uid()
    )
  );


-- ------------------------------------------------------------------------------
-- Migration: 001_lobby_realtime.sql
-- ------------------------------------------------------------------------------

-- ========================================================
-- MIGRATION: GÓCHỌC AI v5 - SYSTEM LOBBY REALTIME
-- Bảng Session Participants & Các policy RLS tương ứng
-- ========================================================

-- Tạo Enum cho trạng thái ứng cử vai trò (nếu chưa có)
DO $$ BEGIN
    CREATE TYPE "NominatedRole" AS ENUM ('leader', 'secretary');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tạo bảng Session Participants (Người tham gia phòng chờ / phiên học)
CREATE TABLE IF NOT EXISTS public.session_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT true,
    nominated_role "NominatedRole" DEFAULT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL, -- Null lúc ở sảnh chờ
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(session_id, student_id)
);

-- Bật Row Level Security (RLS)
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- 1. Cho phép tất cả xem danh sách (ai cũng có quyền xem bạn bè trong sảnh)
CREATE POLICY "Cho phép xem danh sách người tham gia bằng session_id" 
ON public.session_participants FOR SELECT 
USING (true);

-- 2. Cho phép insert khi Auth là học sinh hoặc thông qua API nặc danh có join_code hợp lệ
CREATE POLICY "Cho phép học sinh tự join" 
ON public.session_participants FOR INSERT 
WITH CHECK (true);

-- 3. Cho phép học sinh / giáo viên update (ví dụ đổi status is_online = false)
CREATE POLICY "Cho phép cập nhật participant"
ON public.session_participants FOR UPDATE 
USING (true);

-- Bật Replication (Realtime) cho bảng phân nhóm + bảng người tham gia
-- Việc này rất quan trọng để React ứng dụng có thể Lắng nghe Event!
-- Cẩn thận: Chạy lệnh SQL này nếu bảng chưa được bật Realtime trước đó!
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;

-- (Tùy chọn) Function cho tự động cập nhật last_seen_at
CREATE OR REPLACE FUNCTION public.handle_update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_session_participants_last_seen ON public.session_participants;

CREATE TRIGGER update_session_participants_last_seen
  BEFORE UPDATE ON public.session_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_update_last_seen();


-- ------------------------------------------------------------------------------
-- Migration: 001b_station_embeddings.sql
-- ------------------------------------------------------------------------------

-- ========================================================
-- MIGRATION 004: Create station_embeddings Table
-- GócHọc AI MVP-α
-- ========================================================

CREATE TABLE IF NOT EXISTS public.station_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID REFERENCES public.stations(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ------------------------------------------------------------------------------
-- Migration: 002_tighten_rls.sql
-- ------------------------------------------------------------------------------

-- ========================================================
-- MIGRATION: GÓCHỌC AI v5 — SIẾT RLS BẢO MẬT
-- Cập nhật policy session_participants & bổ sung RLS cho
-- shared_device_sessions, role_nominations, station_preferences
-- ========================================================

-- ═══════════════════════════════════════
-- 1. SIẾT RLS cho session_participants
-- (Hiện tại USING (true) → quá rộng)
-- ═══════════════════════════════════════

-- Xóa policy cũ (quá rộng)
DROP POLICY IF EXISTS "Cho phép xem danh sách người tham gia bằng session_id" ON public.session_participants;
DROP POLICY IF EXISTS "Cho phép học sinh tự join" ON public.session_participants;
DROP POLICY IF EXISTS "Cho phép cập nhật participant" ON public.session_participants;

-- SELECT: Ai cũng xem được danh sách sảnh (cần để Lobby hiển thị)
-- nhưng chỉ trong phiên đang hoạt động
CREATE POLICY "sp_select_active_session" ON public.session_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_participants.session_id
      AND sessions.status IN ('draft', 'lobby', 'active')
    )
  );

-- INSERT: HS chỉ tạo record cho chính mình
CREATE POLICY "sp_insert_own" ON public.session_participants
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_participants.session_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- UPDATE: HS chỉ sửa record của mình, hoặc GV sở hữu phiên
CREATE POLICY "sp_update_own_or_teacher" ON public.session_participants
  FOR UPDATE USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_participants.session_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- DELETE: Chỉ GV sở hữu phiên
CREATE POLICY "sp_delete_teacher" ON public.session_participants
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_participants.session_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════
-- 2. RLS cho shared_device_sessions
-- ═══════════════════════════════════════

ALTER TABLE public.shared_device_sessions ENABLE ROW LEVEL SECURITY;

-- SELECT: GV sở hữu phiên hoặc HS trong group
CREATE POLICY "sds_select" ON public.shared_device_sessions
  FOR SELECT USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM groups
      JOIN sessions ON sessions.id = groups.session_id
      WHERE groups.id = shared_device_sessions.group_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- INSERT: HS trong group (hoặc GV)
CREATE POLICY "sds_insert" ON public.shared_device_sessions
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM groups
      JOIN sessions ON sessions.id = groups.session_id
      WHERE groups.id = shared_device_sessions.group_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- UPDATE: HS tự sửa record hoặc GV
CREATE POLICY "sds_update" ON public.shared_device_sessions
  FOR UPDATE USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM groups
      JOIN sessions ON sessions.id = groups.session_id
      WHERE groups.id = shared_device_sessions.group_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════
-- 3. RLS cho role_nominations
-- ═══════════════════════════════════════

ALTER TABLE public.role_nominations ENABLE ROW LEVEL SECURITY;

-- SELECT: Ai cũng xem (trong phiên active)
CREATE POLICY "rn_select" ON public.role_nominations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = role_nominations.session_id
      AND sessions.status IN ('lobby', 'active')
    )
  );

-- INSERT: HS tự ứng cử
CREATE POLICY "rn_insert" ON public.role_nominations
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
  );

-- UPDATE: GV duyệt (reviewed_by)
CREATE POLICY "rn_update_teacher" ON public.role_nominations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = role_nominations.session_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════
-- 4. RLS cho station_preferences
-- ═══════════════════════════════════════

ALTER TABLE public.station_preferences ENABLE ROW LEVEL SECURITY;

-- SELECT: GV hoặc HS chính mình
CREATE POLICY "stpr_select" ON public.station_preferences
  FOR SELECT USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = station_preferences.session_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- INSERT: HS tự chọn góc
CREATE POLICY "stpr_insert" ON public.station_preferences
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
  );

-- UPDATE: HS sửa lựa chọn hoặc GV duyệt
CREATE POLICY "stpr_update" ON public.station_preferences
  FOR UPDATE USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = station_preferences.session_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════
-- 5. Bổ sung RLS cho groups (INSERT/UPDATE)
-- (Hiện chỉ có SELECT policy)
-- ═══════════════════════════════════════

-- GV tạo nhóm
CREATE POLICY "groups_insert_teacher" ON groups
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- GV cập nhật nhóm (rotation)
CREATE POLICY "groups_update_teacher" ON groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- GV thêm thành viên vào nhóm
CREATE POLICY "group_members_insert_teacher" ON group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups
      JOIN sessions ON sessions.id = groups.session_id
      WHERE groups.id = group_members.group_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- HS nộp bài (task_results)
CREATE POLICY "task_results_insert" ON task_results
  FOR INSERT WITH CHECK (
    submitted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM groups
      JOIN sessions ON sessions.id = groups.session_id
      WHERE groups.id = task_results.group_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════
-- 6. Bật Realtime cho bảng cần thiết
-- ═══════════════════════════════════════

-- Đảm bảo task_results cũng có realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_results;


-- ------------------------------------------------------------------------------
-- Migration: 003_timer_and_indexes.sql
-- ------------------------------------------------------------------------------

-- ========================================================
-- MIGRATION 003: Timer đồng bộ + Indexes cho performance
-- GócHọc AI MVP-α
-- ========================================================

-- ═══════════════════════════════════════
-- 1. Thêm timer_end_at để đồng bộ countdown
-- (Server-side source of truth cho timer)
-- ═══════════════════════════════════════

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS timer_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_round INT DEFAULT 0;

-- ═══════════════════════════════════════
-- 2. Index cho station_embeddings (vector search)
-- ═══════════════════════════════════════

-- Bật pgvector extension (nếu chưa có)
CREATE EXTENSION IF NOT EXISTS vector;

-- IVFFlat index cho similarity search nhanh hơn
-- (chỉ tạo khi có >= 100 rows, nếu chưa có thì sequential scan ok)
CREATE INDEX IF NOT EXISTS idx_station_embeddings_vector
  ON public.station_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- ═══════════════════════════════════════
-- 3. Indexes cho performance chung
-- ═══════════════════════════════════════

-- Tìm HS theo teacher nhanh hơn
CREATE INDEX IF NOT EXISTS idx_students_teacher_id
  ON public.students (teacher_id);

-- Tìm groups theo session nhanh hơn
CREATE INDEX IF NOT EXISTS idx_groups_session_id
  ON public.groups (session_id);

-- Tìm group_members theo group nhanh hơn
CREATE INDEX IF NOT EXISTS idx_group_members_group_id
  ON public.group_members (group_id);

-- Tìm tasks theo station nhanh hơn
CREATE INDEX IF NOT EXISTS idx_tasks_station_id
  ON public.tasks (station_id);

-- Tìm task_results theo group+task nhanh hơn
CREATE INDEX IF NOT EXISTS idx_task_results_group_id
  ON public.task_results (group_id);

CREATE INDEX IF NOT EXISTS idx_task_results_task_id
  ON public.task_results (task_id);

-- Chat messages index
CREATE INDEX IF NOT EXISTS idx_chat_messages_station_student
  ON public.chat_messages (station_id, student_id);

-- Session participants index
CREATE INDEX IF NOT EXISTS idx_session_participants_session
  ON public.session_participants (session_id);

-- Shared device sessions index
CREATE INDEX IF NOT EXISTS idx_shared_device_sessions_group
  ON public.shared_device_sessions (group_id);

-- ═══════════════════════════════════════
-- 4. Function tìm kiếm vector (RAG)
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION match_station_knowledge(
  query_embedding VECTOR(768),
  match_station_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.id,
    se.content,
    1 - (se.embedding <=> query_embedding) AS similarity
  FROM station_embeddings se
  WHERE se.station_id = match_station_id
    AND 1 - (se.embedding <=> query_embedding) > match_threshold
  ORDER BY se.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ═══════════════════════════════════════
-- 5. RLS cho station_embeddings
-- ═══════════════════════════════════════

ALTER TABLE public.station_embeddings ENABLE ROW LEVEL SECURITY;

-- SELECT: GV hoặc HS trong phiên active
CREATE POLICY "se_select" ON public.station_embeddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stations
      JOIN sessions ON sessions.id = stations.session_id
      WHERE stations.id = station_embeddings.station_id
      AND (
        sessions.teacher_id = auth.uid()
        OR sessions.status IN ('active', 'lobby')
      )
    )
  );

-- INSERT/UPDATE/DELETE: Chỉ GV sở hữu phiên
CREATE POLICY "se_modify_teacher" ON public.station_embeddings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stations
      JOIN sessions ON sessions.id = stations.session_id
      WHERE stations.id = station_embeddings.station_id
      AND sessions.teacher_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════
-- 6. Supabase Storage bucket cho uploads
-- ═══════════════════════════════════════

-- Tạo bucket (nếu chạy qua SQL Editor)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('task-uploads', 'task-uploads', false)
-- ON CONFLICT (id) DO NOTHING;


-- ------------------------------------------------------------------------------
-- Migration: 005_schema_fixes.sql
-- ------------------------------------------------------------------------------

-- ========================================================
-- MIGRATION 005: Schema Fixes & Enhancements
-- GócHọc AI MVP-α
-- ========================================================

-- 1. Thêm rotation_order vào bảng groups (xoay vòng trạm)
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS rotation_order INT[];

-- 2. Thêm group_size vào bảng sessions
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS group_size INT DEFAULT 4;

-- 3. Đảm bảo started_at, ended_at, current_round tồn tại trên sessions
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_round INT DEFAULT 0;

-- 4. Verify RLS policies cho station_embeddings
DROP POLICY IF EXISTS "se_select" ON public.station_embeddings;
DROP POLICY IF EXISTS "se_modify_teacher" ON public.station_embeddings;

-- SELECT: GV hoặc HS trong phiên active/lobby
CREATE POLICY "se_select" ON public.station_embeddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stations
      JOIN public.sessions ON sessions.id = stations.session_id
      WHERE stations.id = station_embeddings.station_id
      AND (
        sessions.teacher_id = auth.uid()
        OR sessions.status IN ('active', 'lobby')
      )
    )
  );

-- INSERT/UPDATE/DELETE: Chỉ GV sở hữu phiên
CREATE POLICY "se_modify_teacher" ON public.station_embeddings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stations
      JOIN public.sessions ON sessions.id = stations.session_id
      WHERE stations.id = station_embeddings.station_id
      AND sessions.teacher_id = auth.uid()
    )
  );


-- ------------------------------------------------------------------------------
-- Migration: 006_student_pin.sql
-- ------------------------------------------------------------------------------

-- ========================================================
-- MIGRATION 006: Add student PIN support
-- GócHọc AI MVP-α
-- ========================================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS pin TEXT DEFAULT '0000';


-- ------------------------------------------------------------------------------
-- Migration: 007_storage_policies.sql
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- 007_storage_policies.sql
-- Storage Policies for task-uploads bucket
-- ==============================================================================

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-uploads', 'task-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security (RLS) for the storage.objects table
-- This table is owned by the Supabase Storage API, but we can manage policies
-- (RLS is already enabled by default on storage.objects in Supabase)

-- 1. Allow public read access to all files in the task-uploads bucket
-- Since it's public, anyone can get the public URL and view the file.
CREATE POLICY "Public Read Access for task-uploads" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'task-uploads');

-- 2. Allow authenticated users to upload files
-- Both students (uploading task photos) and teachers (knowledge files) need this.
CREATE POLICY "Authenticated users can upload to task-uploads" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'task-uploads' 
    AND auth.role() = 'authenticated'
);

-- 3. Allow users to update their own files
CREATE POLICY "Users can update own uploads in task-uploads" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'task-uploads' 
    AND auth.uid() = owner
);

-- 4. Allow users to delete their own files
CREATE POLICY "Users can delete own uploads in task-uploads" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'task-uploads' 
    AND auth.uid() = owner
);


