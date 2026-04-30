-- Per-meal nutritional provenance (USDA match tier, optional fdc id)
ALTER TABLE meals ADD COLUMN IF NOT EXISTS nutrition_metadata JSONB DEFAULT '{}'::jsonb;
