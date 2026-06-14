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
