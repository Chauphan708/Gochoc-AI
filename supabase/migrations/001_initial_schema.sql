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
