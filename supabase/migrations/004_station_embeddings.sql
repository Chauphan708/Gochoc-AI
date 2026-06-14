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
