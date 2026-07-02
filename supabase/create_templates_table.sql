-- ═══════════════════════════════════════
-- MIGRATION: Create session_templates table
-- GócHọc AI — Kho Mẫu Feature
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS session_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  grade_level TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage own templates"
  ON session_templates FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Cho phép anonymous access (vì GV đăng nhập bằng Supabase Auth)
CREATE POLICY "Allow authenticated access to templates"
  ON session_templates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Index
CREATE INDEX idx_templates_teacher ON session_templates(teacher_id);
