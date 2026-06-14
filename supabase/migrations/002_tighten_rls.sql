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
