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
