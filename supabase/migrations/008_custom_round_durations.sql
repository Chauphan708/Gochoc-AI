-- ==============================================================================
-- 008_custom_round_durations.sql
-- Add round_durations column to sessions table to support custom duration per round
-- ==============================================================================

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS round_durations TEXT;
