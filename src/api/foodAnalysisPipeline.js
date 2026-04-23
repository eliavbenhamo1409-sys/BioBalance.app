/**
 * ============================================================
 * BioBalance - Food Analysis Pipeline
 * ============================================================
 * 
 * A 4-stage pipeline that combines AI Vision with accurate
 * nutritional databases (Israeli MOH + USDA).
 * 
 * Stages:
 *   A. Vision - AI identifies food and estimates weight
 *   B. Lookup - Search nutrition database
 *   C. Calculator - Mathematical computation
 *   D. Sanity Check - AI verification
 * 
 * Author: BioBalance Team
 */

import { supabase } from './supabaseClient';
import { 
  generateReferencePrompt, 
  findClosestPortion,
  getFoodDensity 
} from './referenceWeights';

// ============================================================
// Configuration
// ============================================================

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// ============================================================
// STAGE A: The Eyes (AI Vision)
// ============================================================

/**
 * Stage A: AI Vision Analysis
 * - Identifies food name (Hebrew + English)
 * - Estimates weight from visual cues
 * - Does NOT estimate nutritional values
 * 
 * @param {string[]} imagesBase64 - Array of 3 images (top, side, closeup)
 * @returns {Promise<VisionResult>}
 */
export async function stageA_Vision(imagesBase64) {
  console.log('🔍 Stage A: AI Vision Analysis...');

  const imageContents = imagesBase64.map((img, index) => ({
    type: 'image_url',
    image_url: {
      url: `data:image/jpeg;base64,${img}`,
      detail: 'high'
    }
  }));

  const referencesPrompt = generateReferencePrompt();
  
  const prompt = `אתה פיזיקאי מזון מומחה עם חוש מרחבי מצוין. יש לך 3 תמונות של אותה מנה:
- תמונה 1: מבט מלמעלה (bird's eye view)
- תמונה 2: מבט מהצד (side profile)
- תמונה 3: תקריב (close-up)

${referencesPrompt}

## 🎯 משימתך - 3 שלבים:

### שלב 1: זיהוי אובייקטי ייחוס
סרוק את התמונות וזהה:
- האם יש מזלג/כף/סכין? (חשוב מאוד לסקייל!)
- איזה סוג צלחת/קערה? (גודל משפיע על ההערכה)
- האם יש כוס או אובייקט נוסף?

אם מצאת אובייקט ייחוס - השתמש בו לחישוב היחסים!

### שלב 2: זיהוי מזון
זהה כל מרכיב בנפרד:
- אורז + עוף → 2 פריטים
- סלט + לחם → 2 פריטים
- פסטה + רוטב → 1 פריט (אם הרוטב מעורבב)

### שלב 3: הערכת משקל (קריטי!)

#### 🔍 שיטת עבודה:
1. **השווה לאובייקט ייחוס אם יש**
   - "המזלג 19 ס"מ, חתיכת העוף פי 1.5 ארוכה → ~28 ס"מ"
   - "הצלחת 26 ס"מ, האורז תופס ~60% מהצלחת"

2. **שימוש בגיאומטריה בסיסית**
   - אורז בצורת כיפה → חצי כדור
   - חזה עוף שטוח → מנסרה מלבנית
   - סלט → נפח לא סדיר

3. **שימוש בצפיפות**
   - סלט: קליל מאוד (~0.4 g/ml)
   - אורז: בינוני (~0.65 g/ml)
   - בשר: כבד (~1.05 g/ml)

4. **בדיקה מול מנות סטנדרטיות**
   - האם זה נראה כמו "מנה רגילה"?
   - השווה למשקלי המנות שרשמתי למעלה

#### ⚠️ נקודות לתשומת לב:
- אל תהיה שמרני מדי - רוב האנשים אוכלים מנות גדולות יותר
- תמונת הצד עוזרת להבין את העובי/גובה המזון
- תקריב עוזר להבין את הצפיפות והטקסטורה

#### 🎲 רמות ביטחון:
- **high**: יש אובייקט ייחוס ברור + זיהוי חד משמעי
- **medium**: אין אובייקט ייחוס אבל גודל הצלחת ברור
- **low**: קשה להעריך - צלחת לא ברורה, זווית לא טובה

### 🚫 אל תחזיר ערכים תזונתיים!
החזר רק: שם המזון + משקל בגרמים + רמת ביטחון

## 📊 פורמט תשובה (JSON בלבד):

{
  "items": [
    {
      "name_he": "שם המזון בעברית",
      "name_en": "Food name in English",
      "estimated_grams": 180,
      "confidence": "high|medium|low",
      "reasoning": "הסבר קצר למשקל - איך הגעת למספר הזה"
    }
  ],
  "plate_type": "צלחת שטוחה 26 ס\"מ / קערה 15 ס\"מ / מגש",
  "reference_objects": ["מזלג 19 ס\"מ", "כוס"],
  "overall_confidence": "high|medium|low"
}

**חשוב**: החזר JSON בלבד, ללא markdown, ללא backticks, ללא הסברים נוספים.`;


  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...imageContents
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('   Vision response:', content);

    const parsed = JSON.parse(content);
    
    return {
      success: true,
      items: parsed.items || [],
      plateType: parsed.plate_type,
      referenceObjects: parsed.reference_objects || [],
      overallConfidence: parsed.overall_confidence || 'medium',
    };

  } catch (error) {
    console.error('Stage A error:', error);
    return {
      success: false,
      error: error.message,
      items: [],
    };
  }
}

// ============================================================
// STAGE A.5: Weight Calibration (NEW!)
// ============================================================

/**
 * Stage A.5: Weight Calibration
 * - Compares AI estimate to standard portion sizes
 * - Suggests correction if estimate seems off
 * 
 * @param {object} item - Item from Vision stage
 * @returns {object} Calibrated weight
 */
export function stageA5_WeightCalibration(item) {
  console.log(`⚖️  Stage A.5: Calibrating weight for "${item.name_he}"...`);

  const originalGrams = item.estimated_grams;
  const standardPortion = findClosestPortion(item.name_he, originalGrams);

  if (standardPortion && standardPortion.confidence === 'high') {
    const diff = Math.abs(standardPortion.suggestedGrams - originalGrams);
    const diffPercent = (diff / originalGrams) * 100;

    // If difference is significant (>20%), suggest correction
    if (diffPercent > 20) {
      console.log(`   ⚠️  Large difference detected: ${diffPercent.toFixed(0)}%`);
      console.log(`   Original: ${originalGrams}g → Suggested: ${standardPortion.suggestedGrams}g`);
      console.log(`   Reason: ${standardPortion.description}`);

      // Use weighted average: 70% standard + 30% AI estimate
      const calibratedGrams = Math.round(
        standardPortion.suggestedGrams * 0.7 + originalGrams * 0.3
      );

      return {
        originalGrams,
        calibratedGrams,
        standardPortion: standardPortion.suggestedGrams,
        adjustmentReason: `מנה סטנדרטית: ${standardPortion.description}`,
        wasAdjusted: true,
        confidence: 'calibrated',
      };
    }
  }

  // No adjustment needed
  console.log(`   ✅ Weight looks good: ${originalGrams}g`);
  return {
    originalGrams,
    calibratedGrams: originalGrams,
    wasAdjusted: false,
    confidence: item.confidence,
  };
}

// ============================================================
// STAGE B: The Facts (Database Lookup)
// ============================================================

/**
 * Stage B: Database Lookup
 * - Searches for food in nutrition database
 * - Priority: Israeli MOH first, then USDA
 * 
 * @param {string} foodNameHe - Hebrew food name
 * @param {string} foodNameEn - English food name
 * @returns {Promise<LookupResult>}
 */
export async function stageB_Lookup(foodNameHe, foodNameEn) {
  console.log(`📚 Stage B: Database Lookup for "${foodNameHe}" / "${foodNameEn}"...`);

  try {
    // Try Hebrew search first (Israeli MOH priority)
    let result = await searchNutritionDatabase(foodNameHe, 'ISRAEL_MOH');
    
    if (!result) {
      // Try English search
      result = await searchNutritionDatabase(foodNameEn, 'USDA');
    }

    if (!result) {
      // Try fuzzy search with both names
      result = await fuzzySearchNutritionDatabase(foodNameHe, foodNameEn);
    }

    if (result) {
      console.log(`   ✅ Found in ${result.source}: ${result.food_name}`);
      return {
        found: true,
        source: result.source,
        foodName: result.food_name,
        calories_100g: result.calories_100g,
        protein_100g: result.protein_100g,
        carbs_100g: result.carbs_100g,
        fat_100g: result.fat_100g,
        fiber_100g: result.fiber_100g,
      };
    }

    console.log('   ❌ Not found in database');
    return { found: false };

  } catch (error) {
    console.error('Stage B error:', error);
    return { found: false, error: error.message };
  }
}

/**
 * Search nutrition database with exact/partial match
 */
async function searchNutritionDatabase(searchTerm, preferredSource) {
  if (!searchTerm) return null;

  const { data, error } = await supabase
    .from('nutrition_foods')
    .select('*')
    .or(`food_name_he.ilike.%${searchTerm}%,food_name_en.ilike.%${searchTerm}%,food_name.ilike.%${searchTerm}%`)
    .order('source', { ascending: preferredSource === 'ISRAEL_MOH' })
    .limit(5);

  if (error || !data || data.length === 0) return null;

  // Prefer the specified source
  const preferredMatch = data.find(d => d.source === preferredSource);
  return preferredMatch || data[0];
}

/**
 * Fuzzy search with combined terms
 */
async function fuzzySearchNutritionDatabase(hebrewName, englishName) {
  const searchTerms = [hebrewName, englishName].filter(Boolean);
  
  for (const term of searchTerms) {
    // Try with first word only (often more accurate)
    const firstWord = term.split(' ')[0];
    
    const { data, error } = await supabase
      .from('nutrition_foods')
      .select('*')
      .or(`food_name_he.ilike.%${firstWord}%,food_name_en.ilike.%${firstWord}%`)
      .limit(5);

    if (!error && data && data.length > 0) {
      // Return Israeli MOH if available
      const mohMatch = data.find(d => d.source === 'ISRAEL_MOH');
      return mohMatch || data[0];
    }
  }

  return null;
}

// ============================================================
// STAGE C: The Calculator
// ============================================================

/**
 * Stage C: Mathematical Calculation
 * - Calculates nutrition based on weight
 * - Uses deterministic math (not AI)
 * 
 * @param {LookupResult} nutritionData - Data from stage B
 * @param {number} estimatedGrams - Weight from stage A
 * @returns {CalculatedResult}
 */
export function stageC_Calculate(nutritionData, estimatedGrams) {
  console.log(`🔢 Stage C: Calculating for ${estimatedGrams}g...`);

  if (!nutritionData.found) {
    return {
      success: false,
      needsAIEstimate: true,
    };
  }

  const factor = estimatedGrams / 100;

  const result = {
    success: true,
    source: nutritionData.source,
    grams: Math.round(estimatedGrams),
    calories: Math.round((nutritionData.calories_100g || 0) * factor),
    protein: Math.round(((nutritionData.protein_100g || 0) * factor) * 10) / 10,
    carbs: Math.round(((nutritionData.carbs_100g || 0) * factor) * 10) / 10,
    fat: Math.round(((nutritionData.fat_100g || 0) * factor) * 10) / 10,
    fiber: nutritionData.fiber_100g 
      ? Math.round(((nutritionData.fiber_100g) * factor) * 10) / 10 
      : null,
    // Per 100g reference
    per100g: {
      calories: nutritionData.calories_100g,
      protein: nutritionData.protein_100g,
      carbs: nutritionData.carbs_100g,
      fat: nutritionData.fat_100g,
    }
  };

  console.log(`   ✅ Calculated: ${result.calories} kcal, ${result.protein}g protein`);
  return result;
}

// ============================================================
// STAGE D: Sanity Check (AI Verification)
// ============================================================

/**
 * Stage D: Final Sanity Check
 * - Verifies calculated values make sense visually
 * - Suggests corrections if needed
 * 
 * @param {string} imageBase64 - One image for verification
 * @param {object} calculatedData - Results from stage C
 * @returns {Promise<SanityCheckResult>}
 */
export async function stageD_SanityCheck(imageBase64, calculatedData) {
  console.log('✅ Stage D: Sanity Check...');

  const prompt = `אתה מבצע ביקורת איכות על ניתוח מזון.

## הנתונים שחושבו:
- מזון: ${calculatedData.name}
- משקל משוער: ${calculatedData.grams}g
- קלוריות: ${calculatedData.calories} kcal
- חלבון: ${calculatedData.protein}g
- שומן: ${calculatedData.fat}g
- מקור הנתונים: ${calculatedData.source}

## משימתך:
הסתכל על התמונה ובדוק:
1. האם הזיהוי נכון?
2. האם המשקל הגיוני לגודל המנה בתמונה?
3. האם הקלוריות הגיוניות?

## החזר JSON בלבד:

{
  "verification": "approved|needs_correction",
  "weight_adjustment": null או מספר (אם צריך תיקון),
  "reason": "סיבה קצרה אם יש תיקון",
  "confidence": "high|medium|low"
}`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'low'
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`Sanity check API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content);

    console.log(`   Verification: ${parsed.verification}`);

    return {
      success: true,
      approved: parsed.verification === 'approved',
      weightAdjustment: parsed.weight_adjustment,
      reason: parsed.reason,
      confidence: parsed.confidence,
    };

  } catch (error) {
    console.error('Stage D error:', error);
    // On error, approve by default
    return {
      success: false,
      approved: true,
      error: error.message,
    };
  }
}

// ============================================================
// AI FALLBACK (When database has no match)
// ============================================================

/**
 * AI Fallback: Full estimation when database has no match
 * - Clearly marked as AI_ESTIMATE source
 * 
 * @param {string} foodName - Name of the food
 * @param {number} estimatedGrams - Estimated weight
 * @returns {Promise<FallbackResult>}
 */
export async function aiEstimateFallback(foodName, estimatedGrams) {
  console.log(`🤖 AI Fallback: Estimating nutrition for "${foodName}"...`);

  const prompt = `אתה תזונאי מומחה. הערך את הערכים התזונתיים למזון הבא:

מזון: ${foodName}
משקל: ${estimatedGrams} גרם

החזר JSON בלבד עם הערכה מושכלת:
{
  "calories": מספר,
  "protein": מספר (גרם),
  "carbs": מספר (גרם),
  "fat": מספר (גרם),
  "confidence": "medium|low",
  "reasoning": "הסבר קצר"
}

בסס את ההערכה על ידע כללי. היה שמרני בהערכות.`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`AI fallback error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content);

    return {
      success: true,
      source: 'AI_ESTIMATE',
      grams: estimatedGrams,
      calories: parsed.calories,
      protein: parsed.protein,
      carbs: parsed.carbs,
      fat: parsed.fat,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
    };

  } catch (error) {
    console.error('AI Fallback error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================================
// MAIN PIPELINE FUNCTION
// ============================================================

/**
 * Main Food Analysis Pipeline
 * Orchestrates all 4 stages
 * 
 * @param {string[]} imagesBase64 - 3 images (top, side, closeup)
 * @returns {Promise<PipelineResult>}
 */
export async function analyzeFoodPipeline(imagesBase64) {
  console.log('\n============================================================');
  console.log('🍽️  BioBalance Food Analysis Pipeline');
  console.log('============================================================\n');

  const startTime = Date.now();
  const results = {
    items: [],
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    stages: {},
  };

  try {
    // ========== STAGE A: Vision ==========
    const visionResult = await stageA_Vision(imagesBase64);
    results.stages.vision = visionResult;

    if (!visionResult.success || visionResult.items.length === 0) {
      return {
        success: false,
        error: 'לא הצלחתי לזהות את המזון בתמונות',
        results,
      };
    }

    // Process each identified food item
    for (const item of visionResult.items) {
      console.log(`\n--- Processing: ${item.name_he} ---`);

      // ========== STAGE A.5: Weight Calibration ==========
      const calibration = stageA5_WeightCalibration(item);
      const adjustedGrams = calibration.calibratedGrams;
      
      if (calibration.wasAdjusted) {
        console.log(`   🔧 Weight adjusted: ${item.estimated_grams}g → ${adjustedGrams}g`);
      }

      // ========== STAGE B: Lookup ==========
      const lookupResult = await stageB_Lookup(item.name_he, item.name_en);
      
      let calculatedResult;

      if (lookupResult.found) {
        // ========== STAGE C: Calculate ==========
        calculatedResult = stageC_Calculate(lookupResult, adjustedGrams);
        calculatedResult.name = item.name_he;
        calculatedResult.name_en = item.name_en;
        
        // Add calibration metadata
        if (calibration.wasAdjusted) {
          calculatedResult.wasCalibrated = true;
          calculatedResult.originalEstimate = item.estimated_grams;
          calculatedResult.calibrationReason = calibration.adjustmentReason;
        }
      } else {
        // ========== AI FALLBACK ==========
        calculatedResult = await aiEstimateFallback(item.name_he, adjustedGrams);
        calculatedResult.name = item.name_he;
        calculatedResult.name_en = item.name_en;
      }

      if (calculatedResult.success) {
        results.items.push(calculatedResult);
        results.totalCalories += calculatedResult.calories || 0;
        results.totalProtein += calculatedResult.protein || 0;
        results.totalCarbs += calculatedResult.carbs || 0;
        results.totalFat += calculatedResult.fat || 0;
      }
    }

    // ========== STAGE D: Sanity Check ==========
    if (results.items.length > 0) {
      // Sanity check on the main item with first image
      const mainItem = results.items[0];
      const sanityResult = await stageD_SanityCheck(imagesBase64[0], {
        name: mainItem.name,
        grams: mainItem.grams,
        calories: results.totalCalories,
        protein: results.totalProtein,
        fat: results.totalFat,
        source: mainItem.source,
      });
      
      results.stages.sanityCheck = sanityResult;

      // Apply weight adjustment if needed
      if (!sanityResult.approved && sanityResult.weightAdjustment) {
        console.log(`\n⚠️  Applying weight adjustment: ${sanityResult.weightAdjustment}x`);
        const adjustment = sanityResult.weightAdjustment;
        
        // Recalculate totals
        results.totalCalories = Math.round(results.totalCalories * adjustment);
        results.totalProtein = Math.round(results.totalProtein * adjustment * 10) / 10;
        results.totalCarbs = Math.round(results.totalCarbs * adjustment * 10) / 10;
        results.totalFat = Math.round(results.totalFat * adjustment * 10) / 10;
        
        results.items = results.items.map(item => ({
          ...item,
          grams: Math.round(item.grams * adjustment),
          calories: Math.round(item.calories * adjustment),
          protein: Math.round(item.protein * adjustment * 10) / 10,
          carbs: Math.round(item.carbs * adjustment * 10) / 10,
          fat: Math.round(item.fat * adjustment * 10) / 10,
          adjusted: true,
          adjustmentReason: sanityResult.reason,
        }));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ Pipeline complete in ${duration}ms`);

    return {
      success: true,
      results,
      duration,
    };

  } catch (error) {
    console.error('Pipeline error:', error);
    return {
      success: false,
      error: error.message,
      results,
    };
  }
}

// ============================================================
// SIMPLIFIED SINGLE-IMAGE ANALYSIS
// ============================================================

/**
 * Simplified analysis for a single image
 * (For backward compatibility with existing UI)
 * 
 * @param {string} imageBase64 - Single image
 * @returns {Promise<SimpleResult>}
 */
export async function analyzeFoodSimple(imageBase64) {
  // Use the same image 3 times
  return analyzeFoodPipeline([imageBase64, imageBase64, imageBase64]);
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  analyzeFoodPipeline,
  analyzeFoodSimple,
  stageA_Vision,
  stageB_Lookup,
  stageC_Calculate,
  stageD_SanityCheck,
  aiEstimateFallback,
};

