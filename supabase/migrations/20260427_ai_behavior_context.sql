-- Timeline data for AI insights: per-glass water logging + meal query indexes
-- Run via Supabase migrations or SQL editor.

CREATE TABLE IF NOT EXISTS water_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  glasses NUMERIC NOT NULL DEFAULT 1 CHECK (glasses > 0)
);

CREATE INDEX IF NOT EXISTS idx_water_logs_user_day ON water_logs(user_id, day_date);
CREATE INDEX IF NOT EXISTS idx_water_logs_user_logged ON water_logs(user_id, logged_at DESC);

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own water logs" ON water_logs;
DROP POLICY IF EXISTS "Users can insert own water logs" ON water_logs;
DROP POLICY IF EXISTS "Users can delete own water logs" ON water_logs;

CREATE POLICY "Users can view own water logs" ON water_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own water logs" ON water_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own water logs" ON water_logs
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE meals ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE meals ADD COLUMN IF NOT EXISTS carbs DECIMAL DEFAULT 0;
ALTER TABLE meals ADD COLUMN IF NOT EXISTS eaten_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_meals_user_created ON meals(user_id, created_at DESC);
