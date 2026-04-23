/**
 * ============================================================
 * Reference Weights Database
 * ============================================================
 * 
 * Standard portion weights based on USDA FoodData Central
 * and common Israeli measurements.
 * 
 * Helps AI make more accurate weight estimates by providing
 * real-world reference data.
 */

// ============================================================
// Standard Plate & Container Sizes
// ============================================================

export const CONTAINERS = {
  // Plates (צלחות)
  plate_dinner: {
    name_he: 'צלחת ארוחה רגילה',
    name_en: 'Standard dinner plate',
    diameter_cm: 26,
    typical_food_area_cm: 20, // Food usually doesn't cover entire plate
    depth_cm: 2,
  },
  plate_salad: {
    name_he: 'צלחת סלט/קינוח',
    name_en: 'Salad/dessert plate',
    diameter_cm: 20,
    typical_food_area_cm: 16,
    depth_cm: 2,
  },
  bowl_soup: {
    name_he: 'קערת מרק',
    name_en: 'Soup bowl',
    diameter_cm: 15,
    depth_cm: 6,
    volume_ml: 300,
  },
  bowl_rice: {
    name_he: 'קערת אורז',
    name_en: 'Rice bowl',
    diameter_cm: 12,
    depth_cm: 5,
    volume_ml: 200,
  },
  
  // Reference objects (אובייקטי ייחוס)
  fork: {
    name_he: 'מזלג',
    name_en: 'Fork',
    length_cm: 19,
  },
  spoon: {
    name_he: 'כף',
    name_en: 'Spoon',
    length_cm: 15,
  },
  knife: {
    name_he: 'סכין',
    name_en: 'Knife',
    length_cm: 20,
  },
  glass: {
    name_he: 'כוס',
    name_en: 'Glass',
    height_cm: 12,
    diameter_cm: 7,
  },
};

// ============================================================
// Standard Food Portions (from USDA + Israeli MOH)
// ============================================================

export const STANDARD_PORTIONS = {
  // Grains & Carbs
  rice_cooked: {
    name_he: 'אורז מבושל',
    portions: [
      { description: 'מנה קטנה', grams: 100 },
      { description: 'מנה רגילה', grams: 150 },
      { description: 'מנה גדולה', grams: 250 },
      { description: 'כוס מידה (1 cup)', grams: 158 },
    ],
    density: 0.65, // g/ml for volume estimation
  },
  pasta_cooked: {
    name_he: 'פסטה מבושלת',
    portions: [
      { description: 'מנה קטנה', grams: 120 },
      { description: 'מנה רגילה', grams: 180 },
      { description: 'מנה גדולה', grams: 280 },
      { description: 'כוס מידה (1 cup)', grams: 140 },
    ],
    density: 0.6,
  },
  bread_slice: {
    name_he: 'פרוסת לחם',
    portions: [
      { description: 'פרוסה רגילה', grams: 30 },
      { description: 'פרוסה עבה', grams: 45 },
    ],
  },
  pita: {
    name_he: 'פיתה',
    portions: [
      { description: 'פיתה שלמה', grams: 60 },
      { description: 'חצי פיתה', grams: 30 },
    ],
  },

  // Proteins
  chicken_breast: {
    name_he: 'חזה עוף',
    portions: [
      { description: 'חתיכה קטנה', grams: 100 },
      { description: 'חתיכה בינונית', grams: 150 },
      { description: 'חתיכה גדולה', grams: 200 },
      { description: 'חזה שלם', grams: 250 },
    ],
    density: 1.05,
  },
  fish_fillet: {
    name_he: 'פילה דג',
    portions: [
      { description: 'פילה קטן', grams: 100 },
      { description: 'פילה בינוני', grams: 150 },
      { description: 'פילה גדול', grams: 220 },
    ],
    density: 1.05,
  },
  meat_steak: {
    name_he: 'סטייק בשר',
    portions: [
      { description: 'סטייק קטן', grams: 120 },
      { description: 'סטייק בינוני', grams: 180 },
      { description: 'סטייק גדול', grams: 250 },
    ],
    density: 1.08,
  },
  egg: {
    name_he: 'ביצה',
    portions: [
      { description: 'ביצה אחת (בינונית)', grams: 50 },
      { description: 'ביצה גדולה', grams: 60 },
    ],
  },

  // Vegetables
  salad_mixed: {
    name_he: 'סלט ירקות',
    portions: [
      { description: 'קערה קטנה', grams: 100 },
      { description: 'קערה בינונית', grams: 180 },
      { description: 'קערה גדולה', grams: 300 },
      { description: 'כוס מידה', grams: 85 },
    ],
    density: 0.4, // Very light
  },
  vegetables_cooked: {
    name_he: 'ירקות מבושלים',
    portions: [
      { description: 'מנה קטנה', grams: 100 },
      { description: 'מנה רגילה', grams: 150 },
      { description: 'מנה גדולה', grams: 220 },
      { description: 'כוס מידה', grams: 125 },
    ],
    density: 0.55,
  },

  // Fruits
  banana: {
    name_he: 'בננה',
    portions: [
      { description: 'בננה קטנה', grams: 100 },
      { description: 'בננה בינונית', grams: 120 },
      { description: 'בננה גדולה', grams: 150 },
    ],
  },
  apple: {
    name_he: 'תפוח',
    portions: [
      { description: 'תפוח קטן', grams: 150 },
      { description: 'תפוח בינוני', grams: 180 },
      { description: 'תפוח גדול', grams: 220 },
    ],
  },

  // Dairy
  yogurt_container: {
    name_he: 'גביע יוגורט',
    portions: [
      { description: 'גביע קטן', grams: 125 },
      { description: 'גביע רגיל', grams: 150 },
      { description: 'גביע גדול', grams: 200 },
    ],
    density: 1.03,
  },
  cottage_cheese: {
    name_he: 'קוטג',
    portions: [
      { description: 'גביע קטן', grams: 150 },
      { description: 'גביע רגיל', grams: 200 },
      { description: 'גביע גדול', grams: 250 },
    ],
    density: 1.04,
  },

  // Snacks
  hummus: {
    name_he: 'חומוס',
    portions: [
      { description: 'כף', grams: 15 },
      { description: '2 כפות', grams: 30 },
      { description: 'קערה קטנה', grams: 100 },
    ],
    density: 0.95,
  },
  nuts_handful: {
    name_he: 'אגוזים/שקדים (חופן)',
    portions: [
      { description: 'חופן קטן', grams: 20 },
      { description: 'חופן רגיל', grams: 30 },
      { description: 'חופן גדול', grams: 45 },
    ],
    density: 0.6,
  },
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * Find closest standard portion for a food type
 * @param {string} foodName - Name of the food
 * @param {number} estimatedGrams - AI's initial estimate
 * @returns {object|null} Closest standard portion
 */
export function findClosestPortion(foodName, estimatedGrams) {
  const lowerName = foodName.toLowerCase();
  
  // Try to match food type
  for (const [key, data] of Object.entries(STANDARD_PORTIONS)) {
    if (lowerName.includes(data.name_he) || 
        lowerName.includes(key.replace(/_/g, ' '))) {
      
      // Find closest portion size
      const portions = data.portions || [];
      let closest = null;
      let minDiff = Infinity;

      for (const portion of portions) {
        const diff = Math.abs(portion.grams - estimatedGrams);
        if (diff < minDiff) {
          minDiff = diff;
          closest = portion;
        }
      }

      if (closest && minDiff <= 50) { // Within 50g tolerance
        return {
          suggestedGrams: closest.grams,
          description: closest.description,
          confidence: minDiff <= 20 ? 'high' : 'medium',
          originalEstimate: estimatedGrams,
        };
      }
    }
  }

  return null;
}

/**
 * Get density for volume-to-weight conversion
 * @param {string} foodName
 * @returns {number} Density in g/ml
 */
export function getFoodDensity(foodName) {
  const lowerName = foodName.toLowerCase();
  
  for (const [key, data] of Object.entries(STANDARD_PORTIONS)) {
    if (data.density && 
        (lowerName.includes(data.name_he) || 
         lowerName.includes(key.replace(/_/g, ' ')))) {
      return data.density;
    }
  }

  // Default densities by category
  if (lowerName.includes('סלט') || lowerName.includes('salad')) return 0.4;
  if (lowerName.includes('אורז') || lowerName.includes('rice')) return 0.65;
  if (lowerName.includes('בשר') || lowerName.includes('meat')) return 1.08;
  if (lowerName.includes('עוף') || lowerName.includes('chicken')) return 1.05;
  if (lowerName.includes('דג') || lowerName.includes('fish')) return 1.05;
  
  return 1.0; // Default water density
}

/**
 * Generate reference objects prompt for AI
 */
export function generateReferencePrompt() {
  return `
📏 אובייקטי ייחוס (חשוב מאוד!):
חפש באופן אקטיבי את האובייקטים הבאים בתמונות:

🍴 כלי אוכל:
- מזלג רגיל = 19 ס"מ אורך
- כף = 15 ס"מ אורך
- סכין = 20 ס"מ אורך

🍽️ כלים:
- צלחת ארוחה רגילה = 26 ס"מ קוטר
- צלחת סלט/קינוח = 20 ס"מ קוטר
- קערת מרק = 15 ס"מ קוטר
- כוס = 7 ס"מ קוטר, 12 ס"מ גובה

אם אתה רואה אחד מאלה - השתמש בו לסקייל!

📊 משקלי מנות טיפוסיות (לבדיקת סבירות):
• אורז מבושל: מנה רגילה 150-200g
• פסטה מבושלת: מנה רגילה 180-250g
• חזה עוף: חתיכה בינונית 150-180g
• סטייק בשר: בינוני 180-220g
• סלט ירקות: קערה בינונית 180-250g
• ירקות מבושלים: מנה רגילה 150g

⚠️ אם ההערכה שלך רחוקה מהטווחים האלה - בדוק שוב!`;
}

export default {
  CONTAINERS,
  STANDARD_PORTIONS,
  findClosestPortion,
  getFoodDensity,
  generateReferencePrompt,
};




