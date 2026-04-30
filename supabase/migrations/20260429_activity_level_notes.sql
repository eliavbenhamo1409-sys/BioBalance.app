-- Free-text activity description (optional supplement or alternative to preset chips)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS activity_level_notes TEXT;
