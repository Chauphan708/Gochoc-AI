-- Migration Script: Chuyển đổi từ hệ thống Điểm số sang hệ thống XP/Pass-Fail

-- 1. Bảng `tasks`
-- Thêm cột `xp_reward` và copy dữ liệu từ `points` sang
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS xp_reward INTEGER DEFAULT 10;
UPDATE public.tasks SET xp_reward = points WHERE points IS NOT NULL;
-- Xóa cột `points`
ALTER TABLE public.tasks DROP COLUMN IF EXISTS points;
-- Đảm bảo `grading_mode` tồn tại
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS grading_mode TEXT CHECK (grading_mode IN ('auto', 'teacher')) DEFAULT 'auto';

-- 2. Bảng `task_results`
-- Xóa cột `score` và `max_score`
ALTER TABLE public.task_results DROP COLUMN IF EXISTS score;
ALTER TABLE public.task_results DROP COLUMN IF EXISTS max_score;
-- Đảm bảo `grading_status` tồn tại và có các trạng thái đúng
ALTER TABLE public.task_results DROP CONSTRAINT IF EXISTS task_results_grading_status_check;
ALTER TABLE public.task_results ADD COLUMN IF NOT EXISTS grading_status TEXT DEFAULT 'graded';
ALTER TABLE public.task_results ADD CONSTRAINT task_results_grading_status_check CHECK (grading_status IN ('graded', 'pending_teacher', 'rejected'));

-- 3. Bảng `students`
-- Xóa cột `total_points` (Chỉ dùng total_xp)
ALTER TABLE public.students DROP COLUMN IF EXISTS total_points;
