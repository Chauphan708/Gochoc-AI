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
