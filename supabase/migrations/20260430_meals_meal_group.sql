-- Batch logging: link meals from the same chat message
ALTER TABLE meals ADD COLUMN IF NOT EXISTS meal_group_id UUID;
ALTER TABLE meals ADD COLUMN IF NOT EXISTS source_message_text TEXT;

CREATE INDEX IF NOT EXISTS idx_meals_meal_group_id ON meals (meal_group_id)
  WHERE meal_group_id IS NOT NULL;
