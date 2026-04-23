/**
 * ============================================================
 * BioBalance - Nutrition Database Seed Script
 * ============================================================
 * 
 * This script loads nutrition data from:
 * 1. Israeli Ministry of Health (MOH) - moh_mitzrachim.csv
 * 2. USDA FoodData Central - Foundation Foods
 * 
 * Usage:
 *   node scripts/seedNutritionData.js
 * 
 * Required files:
 *   - data/moh_mitzrachim.csv (Israeli MOH data)
 *   - data/usda_food.csv (USDA food names)
 *   - data/usda_food_nutrient.csv (USDA nutrient values)
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ============================================================
// Configuration
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// USDA Nutrient IDs
const NUTRIENT_IDS = {
  ENERGY: '1008',      // Energy (kcal)
  PROTEIN: '1003',     // Protein (g)
  FAT: '1004',         // Total lipid/fat (g)
  CARBS: '1005',       // Carbohydrate (g)
  FIBER: '1079',       // Fiber (g)
  SUGAR: '2000',       // Total sugars (g)
  SODIUM: '1093',      // Sodium (mg)
};

// ============================================================
// CSV Parser (Simple, handles Hebrew encoding)
// ============================================================

function parseCSV(content, delimiter = ',') {
  const lines = content.split('\n');
  if (lines.length === 0) return [];

  // Parse header
  const headers = parseCSVLine(lines[0], delimiter);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line, delimiter);
    const row = {};

    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });

    data.push(row);
  }

  return data;
}

function parseCSVLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// ============================================================
// Israeli MOH Data Loader
// ============================================================

async function loadIsraeliMOHData(filePath) {
  console.log('📖 Loading Israeli MOH data...');
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = parseCSV(content);
  
  console.log(`   Found ${data.length} foods`);

  const foods = data
    .filter(row => row.shmmitzrach && row.food_energy)
    .map(row => ({
      food_code: row.Code || row.smlmitzrach,
      food_name: row.shmmitzrach,
      food_name_he: row.shmmitzrach,
      food_name_en: row.english_name || null,
      source: 'ISRAEL_MOH',
      calories_100g: parseFloat(row.food_energy) || null,
      protein_100g: parseFloat(row.protein) || null,
      carbs_100g: parseFloat(row.carbohydrates) || null,
      fat_100g: parseFloat(row.total_fat) || null,
      fiber_100g: parseFloat(row.total_dietary_fiber) || null,
      sugar_100g: parseFloat(row.total_sugars) || null,
      sodium_100g: parseFloat(row.sodium) || null,
      category_name: getCategoryFromCode(row.smlmitzrach),
    }));

  return foods;
}

function getCategoryFromCode(code) {
  if (!code) return null;
  const prefix = String(code).substring(0, 2);
  
  const categories = {
    '11': 'מוצרי חלב',
    '12': 'ביצים',
    '13': 'בשר',
    '14': 'עוף',
    '15': 'דגים',
    '16': 'שומנים ושמנים',
    '21': 'דגנים ומאפים',
    '22': 'קטניות',
    '23': 'ירקות',
    '24': 'פירות',
    '31': 'משקאות',
    '32': 'ממתקים',
    '41': 'מנות מוכנות',
    '51': 'תבלינים ורטבים',
    '56': 'מתכונים',
  };

  return categories[prefix] || 'אחר';
}

// ============================================================
// USDA Data Loader
// ============================================================

async function loadUSDAData(foodFilePath, nutrientFilePath) {
  console.log('📖 Loading USDA Foundation Foods data...');

  // Load food names
  const foodContent = fs.readFileSync(foodFilePath, 'utf-8');
  const foodData = parseCSV(foodContent);
  console.log(`   Found ${foodData.length} foods`);

  // Create lookup map: fdc_id -> food info
  const foodMap = new Map();
  foodData.forEach(row => {
    if (row.fdc_id && row.description) {
      foodMap.set(row.fdc_id, {
        food_code: row.fdc_id,
        food_name: row.description,
        food_name_en: row.description,
        source: 'USDA',
        category_id: row.food_category_id,
      });
    }
  });

  // Load nutrient values
  console.log('📖 Loading USDA nutrient data...');
  const nutrientContent = fs.readFileSync(nutrientFilePath, 'utf-8');
  const nutrientData = parseCSV(nutrientContent);
  console.log(`   Found ${nutrientData.length} nutrient entries`);

  // Process nutrient data
  nutrientData.forEach(row => {
    const fdcId = row.fdc_id;
    const nutrientId = row.nutrient_id;
    const amount = parseFloat(row.amount);

    if (!foodMap.has(fdcId) || isNaN(amount)) return;

    const food = foodMap.get(fdcId);

    switch (nutrientId) {
      case NUTRIENT_IDS.ENERGY:
        food.calories_100g = amount;
        break;
      case NUTRIENT_IDS.PROTEIN:
        food.protein_100g = amount;
        break;
      case NUTRIENT_IDS.FAT:
        food.fat_100g = amount;
        break;
      case NUTRIENT_IDS.CARBS:
        food.carbs_100g = amount;
        break;
      case NUTRIENT_IDS.FIBER:
        food.fiber_100g = amount;
        break;
      case NUTRIENT_IDS.SODIUM:
        food.sodium_100g = amount;
        break;
    }
  });

  // Filter foods with at least calories data
  const foods = Array.from(foodMap.values())
    .filter(f => f.calories_100g != null);

  console.log(`   ${foods.length} foods with complete nutrition data`);
  return foods;
}

// ============================================================
// Database Operations
// ============================================================

async function clearTable() {
  console.log('🗑️  Clearing existing data...');
  const { error } = await supabase
    .from('nutrition_foods')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (error) {
    console.error('Error clearing table:', error);
  }
}

async function insertBatch(foods, batchSize = 500) {
  console.log(`📤 Inserting ${foods.length} foods...`);
  
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < foods.length; i += batchSize) {
    const batch = foods.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('nutrition_foods')
      .insert(batch);

    if (error) {
      console.error(`   Batch ${Math.floor(i / batchSize) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`   Inserted: ${inserted}/${foods.length}\r`);
    }
  }

  console.log(`\n✅ Inserted: ${inserted}, Errors: ${errors}`);
  return { inserted, errors };
}

// ============================================================
// Main Execution
// ============================================================

async function main() {
  console.log('============================================================');
  console.log('🥗 BioBalance Nutrition Database Seeder');
  console.log('============================================================\n');

  // Check Supabase connection
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.error('❌ Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables');
    console.log('\nExample:');
    console.log('  export SUPABASE_URL="https://xxx.supabase.co"');
    console.log('  export SUPABASE_SERVICE_KEY="eyJ..."');
    process.exit(1);
  }

  // Define file paths
  const dataDir = path.join(__dirname, '..', 'data');
  const mohFile = path.join(dataDir, 'moh_mitzrachim.csv');
  const usdaFoodFile = path.join(dataDir, 'usda_food.csv');
  const usdaNutrientFile = path.join(dataDir, 'usda_food_nutrient.csv');

  // Check if files exist
  const requiredFiles = [
    { path: mohFile, name: 'Israeli MOH data' },
    { path: usdaFoodFile, name: 'USDA food data' },
    { path: usdaNutrientFile, name: 'USDA nutrient data' },
  ];

  const missingFiles = requiredFiles.filter(f => !fs.existsSync(f.path));
  
  if (missingFiles.length > 0) {
    console.log('⚠️  Missing data files. Please copy them to the data/ folder:');
    missingFiles.forEach(f => {
      console.log(`   - ${f.name}: ${path.basename(f.path)}`);
    });
    console.log('\nExpected structure:');
    console.log('  data/');
    console.log('    ├── moh_mitzrachim.csv');
    console.log('    ├── usda_food.csv');
    console.log('    └── usda_food_nutrient.csv');
    
    // Try alternative paths from Downloads
    const altPaths = {
      moh: 'C:/Users/eliav/Downloads/moh_mitzrachim.csv',
      usdaFood: 'C:/Users/eliav/Downloads/FoodData_Central_foundation_food_csv_2025-12-18/food.csv',
      usdaNutrient: 'C:/Users/eliav/Downloads/FoodData_Central_foundation_food_csv_2025-12-18/food_nutrient.csv',
    };

    console.log('\n📁 Checking alternative paths...');
    
    if (fs.existsSync(altPaths.moh)) {
      console.log('   ✅ Found MOH data at:', altPaths.moh);
    }
    if (fs.existsSync(altPaths.usdaFood)) {
      console.log('   ✅ Found USDA food data at:', altPaths.usdaFood);
    }
    if (fs.existsSync(altPaths.usdaNutrient)) {
      console.log('   ✅ Found USDA nutrient data at:', altPaths.usdaNutrient);
    }

    console.log('\n💡 Tip: Copy files to data/ folder or update paths in this script.');
    process.exit(1);
  }

  try {
    // Clear existing data
    await clearTable();

    // Load Israeli MOH data
    const mohFoods = await loadIsraeliMOHData(mohFile);
    await insertBatch(mohFoods);

    // Load USDA data
    const usdaFoods = await loadUSDAData(usdaFoodFile, usdaNutrientFile);
    await insertBatch(usdaFoods);

    // Print summary
    console.log('\n============================================================');
    console.log('📊 Summary');
    console.log('============================================================');
    console.log(`   Israeli MOH: ${mohFoods.length} foods`);
    console.log(`   USDA:        ${usdaFoods.length} foods`);
    console.log(`   Total:       ${mohFoods.length + usdaFoods.length} foods`);
    console.log('\n✅ Database seeding complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// ============================================================
// Run if called directly
// ============================================================

if (require.main === module) {
  main();
}

module.exports = {
  loadIsraeliMOHData,
  loadUSDAData,
  parseCSV,
};




