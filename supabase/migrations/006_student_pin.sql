-- ========================================================
-- MIGRATION 006: Add student PIN support
-- GócHọc AI MVP-α
-- ========================================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS pin TEXT DEFAULT '0000';
