-- ============================================================
-- BioBalance Nutrition Database Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For fuzzy text search

-- Enum for data source
CREATE TYPE food_source AS ENUM ('ISRAEL_MOH', 'USDA', 'AI_ESTIMATE');

-- Main nutrition foods table
CREATE TABLE IF NOT EXISTS nutrition_foods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Identifiers
  food_code VARCHAR(50),           -- Original code from source (e.g., MOH code, FDC_ID)
  
  -- Names (for search and display)
  food_name TEXT NOT NULL,         -- Primary name (Hebrew for MOH, English for USDA)
  food_name_en TEXT,               -- English name
  food_name_he TEXT,               -- Hebrew name
  search_text TEXT,                -- Combined searchable text (lowercased, no diacritics)
  
  -- Source
  source food_source NOT NULL,
  
  -- Nutritional values per 100g
  calories_100g DECIMAL(10, 2),    -- kcal
  protein_100g DECIMAL(10, 2),     -- grams
  carbs_100g DECIMAL(10, 2),       -- grams
  fat_100g DECIMAL(10, 2),         -- grams
  fiber_100g DECIMAL(10, 2),       -- grams (optional)
  sugar_100g DECIMAL(10, 2),       -- grams (optional)
  sodium_100g DECIMAL(10, 2),      -- mg (optional)
  
  -- Category
  category_id INTEGER,
  category_name TEXT,
  
  -- Standard portions (JSON array of common portions)
  standard_portions JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"unit": "cup", "grams": 240}, {"unit": "tablespoon", "grams": 15}]
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast search
CREATE INDEX IF NOT EXISTS idx_nutrition_foods_search_text 
  ON nutrition_foods USING gin(search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_nutrition_foods_source 
  ON nutrition_foods(source);

CREATE INDEX IF NOT EXISTS idx_nutrition_foods_food_name_he 
  ON nutrition_foods USING gin(food_name_he gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_nutrition_foods_food_name_en 
  ON nutrition_foods USING gin(food_name_en gin_trgm_ops);

-- Function to update search_text automatically
CREATE OR REPLACE FUNCTION update_search_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text = LOWER(
    COALESCE(NEW.food_name, '') || ' ' || 
    COALESCE(NEW.food_name_en, '') || ' ' || 
    COALESCE(NEW.food_name_he, '')
  );
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update search_text
CREATE TRIGGER trigger_update_search_text
  BEFORE INSERT OR UPDATE ON nutrition_foods
  FOR EACH ROW
  EXECUTE FUNCTION update_search_text();

-- ============================================================
-- Search function with source priority
-- ============================================================

CREATE OR REPLACE FUNCTION search_nutrition_food(
  search_query TEXT,
  preferred_source food_source DEFAULT 'ISRAEL_MOH'
)
RETURNS TABLE (
  id UUID,
  food_name TEXT,
  food_name_he TEXT,
  food_name_en TEXT,
  source food_source,
  calories_100g DECIMAL,
  protein_100g DECIMAL,
  carbs_100g DECIMAL,
  fat_100g DECIMAL,
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nf.id,
    nf.food_name,
    nf.food_name_he,
    nf.food_name_en,
    nf.source,
    nf.calories_100g,
    nf.protein_100g,
    nf.carbs_100g,
    nf.fat_100g,
    similarity(nf.search_text, LOWER(search_query)) AS similarity_score
  FROM nutrition_foods nf
  WHERE 
    nf.search_text % LOWER(search_query)
    OR nf.food_name_he ILIKE '%' || search_query || '%'
    OR nf.food_name_en ILIKE '%' || search_query || '%'
  ORDER BY 
    -- Priority: preferred source first, then by similarity
    CASE WHEN nf.source = preferred_source THEN 0 ELSE 1 END,
    similarity(nf.search_text, LOWER(search_query)) DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- View for quick stats
-- ============================================================

CREATE OR REPLACE VIEW nutrition_foods_stats AS
SELECT 
  source,
  COUNT(*) as total_foods,
  AVG(calories_100g) as avg_calories
FROM nutrition_foods
GROUP BY source;




