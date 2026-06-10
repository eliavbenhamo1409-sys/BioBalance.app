import { normalizeExtractorItem } from './foodQuantityNormalize';
import {
  buildHeuristicPortionGuessForDisplayName,
  defaultTotalGramsForFood,
} from '../utils/standardPortionGuess';
import { buildFoodQuantityAssignment } from '../utils/userMessageFoodBinding';

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const e = new Error('Cancelled');
    e.name = 'AbortError';
    e.code = 'USER_CANCEL';
    throw e;
  }
}

/** Local per-100g cache for common Hebrew foods (zero-latency fallback). */
const FALLBACK_HEBREW = {
  סטייק: { kcal100: 250, protein100: 26, fat100: 17, carbs100: 0, en: 'beef steak (estimate)' },
  בשר: { kcal100: 250, protein100: 26, fat100: 17, carbs100: 0, en: 'beef (estimate)' },
  'בשר טחון': { kcal100: 254, protein100: 26, fat100: 17, carbs100: 0, en: 'ground beef (estimate)' },
  סלמון: { kcal100: 208, protein100: 20, fat100: 13, carbs100: 0, en: 'salmon (estimate)' },
  טונה: { kcal100: 116, protein100: 26, fat100: 1, carbs100: 0, en: 'canned tuna (estimate)' },
  תפוח: { kcal100: 52, protein100: 0.3, fat100: 0.2, carbs100: 14, en: 'apple (estimate)' },
  תפוז: { kcal100: 47, protein100: 0.9, fat100: 0.1, carbs100: 12, en: 'orange (estimate)' },
  אשכולית: { kcal100: 42, protein100: 0.8, fat100: 0.1, carbs100: 11, en: 'grapefruit (estimate)' },
  בננה: { kcal100: 89, protein100: 1.1, fat100: 0.3, carbs100: 23, en: 'banana (estimate)' },
  ענבים: { kcal100: 69, protein100: 0.7, fat100: 0.2, carbs100: 18, en: 'grapes (estimate)' },
  ענב: { kcal100: 69, protein100: 0.7, fat100: 0.2, carbs100: 18, en: 'grapes (estimate)' },
  אבטיח: { kcal100: 30, protein100: 0.6, fat100: 0.2, carbs100: 7.6, en: 'watermelon (estimate)' },
  מלון: { kcal100: 34, protein100: 0.8, fat100: 0.2, carbs100: 8.2, en: 'cantaloupe melon (estimate)' },
  אננס: { kcal100: 50, protein100: 0.5, fat100: 0.1, carbs100: 13, en: 'pineapple (estimate)' },
  פפאיה: { kcal100: 43, protein100: 0.5, fat100: 0.3, carbs100: 11, en: 'papaya (estimate)' },
  מנגו: { kcal100: 60, protein100: 0.8, fat100: 0.4, carbs100: 15, en: 'mango (estimate)' },
  קיווי: { kcal100: 61, protein100: 1.1, fat100: 0.5, carbs100: 15, en: 'kiwi (estimate)' },
  אגס: { kcal100: 57, protein100: 0.4, fat100: 0.1, carbs100: 15, en: 'pear (estimate)' },
  אפרסק: { kcal100: 39, protein100: 0.9, fat100: 0.3, carbs100: 10, en: 'peach (estimate)' },
  נקטרינה: { kcal100: 44, protein100: 1.1, fat100: 0.3, carbs100: 11, en: 'nectarine (estimate)' },
  שזיף: { kcal100: 46, protein100: 0.7, fat100: 0.3, carbs100: 11, en: 'plum (estimate)' },
  אפרסמון: { kcal100: 81, protein100: 0.6, fat100: 0.2, carbs100: 19, en: 'persimmon (estimate)' },
  רימון: { kcal100: 83, protein100: 1.7, fat100: 1.2, carbs100: 19, en: 'pomegranate (estimate)' },
  דובדבן: { kcal100: 63, protein100: 1, fat100: 0.2, carbs100: 16, en: 'cherries (estimate)' },
  דובדבנים: { kcal100: 63, protein100: 1, fat100: 0.2, carbs100: 16, en: 'cherries (estimate)' },
  תות: { kcal100: 32, protein100: 0.7, fat100: 0.3, carbs100: 7.7, en: 'strawberries (estimate)' },
  תותים: { kcal100: 32, protein100: 0.7, fat100: 0.3, carbs100: 7.7, en: 'strawberries (estimate)' },
  פטל: { kcal100: 52, protein100: 1.2, fat100: 0.7, carbs100: 12, en: 'raspberries (estimate)' },
  אוכמניות: { kcal100: 57, protein100: 0.7, fat100: 0.3, carbs100: 14, en: 'blueberries (estimate)' },
  תאנה: { kcal100: 74, protein100: 0.8, fat100: 0.3, carbs100: 19, en: 'fig (estimate)' },
  תאנים: { kcal100: 74, protein100: 0.8, fat100: 0.3, carbs100: 19, en: 'figs (estimate)' },
  תמר: { kcal100: 277, protein100: 1.8, fat100: 0.2, carbs100: 75, en: 'dates (estimate)' },
  תמרים: { kcal100: 277, protein100: 1.8, fat100: 0.2, carbs100: 75, en: 'dates (estimate)' },
  צימוקים: { kcal100: 299, protein100: 3.1, fat100: 0.5, carbs100: 79, en: 'raisins (estimate)' },
  קלמנטינה: { kcal100: 47, protein100: 0.9, fat100: 0.2, carbs100: 12, en: 'tangerine (estimate)' },
  לימון: { kcal100: 29, protein100: 1.1, fat100: 0.3, carbs100: 9, en: 'lemon (estimate)' },
  עגבנייה: { kcal100: 18, protein100: 0.9, fat100: 0.2, carbs100: 3.9, en: 'tomato (estimate)' },
  עגבניה: { kcal100: 18, protein100: 0.9, fat100: 0.2, carbs100: 3.9, en: 'tomato (estimate)' },
  מלפפון: { kcal100: 15, protein100: 0.7, fat100: 0.1, carbs100: 3.6, en: 'cucumber (estimate)' },
  גזר: { kcal100: 41, protein100: 0.9, fat100: 0.2, carbs100: 10, en: 'carrot (estimate)' },
  בצל: { kcal100: 40, protein100: 1.1, fat100: 0.1, carbs100: 9.3, en: 'onion (estimate)' },
  שום: { kcal100: 149, protein100: 6.4, fat100: 0.5, carbs100: 33, en: 'garlic (estimate)' },
  חסה: { kcal100: 15, protein100: 1.4, fat100: 0.2, carbs100: 2.9, en: 'lettuce (estimate)' },
  פלפל: { kcal100: 31, protein100: 1, fat100: 0.3, carbs100: 6, en: 'bell pepper (estimate)' },
  חציל: { kcal100: 25, protein100: 1, fat100: 0.2, carbs100: 6, en: 'eggplant (estimate)' },
  זוקיני: { kcal100: 17, protein100: 1.2, fat100: 0.3, carbs100: 3.1, en: 'zucchini (estimate)' },
  קישוא: { kcal100: 17, protein100: 1.2, fat100: 0.3, carbs100: 3.1, en: 'zucchini (estimate)' },
  כרוב: { kcal100: 25, protein100: 1.3, fat100: 0.1, carbs100: 5.8, en: 'cabbage (estimate)' },
  כרובית: { kcal100: 25, protein100: 1.9, fat100: 0.3, carbs100: 5, en: 'cauliflower (estimate)' },
  ברוקולי: { kcal100: 34, protein100: 2.8, fat100: 0.4, carbs100: 7, en: 'broccoli (estimate)' },
  תרד: { kcal100: 23, protein100: 2.9, fat100: 0.4, carbs100: 3.6, en: 'spinach (estimate)' },
  פטריות: { kcal100: 22, protein100: 3.1, fat100: 0.3, carbs100: 3.3, en: 'mushrooms (estimate)' },
  תירס: { kcal100: 86, protein100: 3.3, fat100: 1.4, carbs100: 19, en: 'corn (estimate)' },
  אפונה: { kcal100: 84, protein100: 5.4, fat100: 0.4, carbs100: 16, en: 'peas (estimate)' },
  בטטה: { kcal100: 86, protein100: 1.6, fat100: 0.1, carbs100: 20, en: 'sweet potato (estimate)' },
  'תפוח אדמה': { kcal100: 87, protein100: 1.9, fat100: 0.1, carbs100: 20, en: 'potato (estimate)' },
  זית: { kcal100: 145, protein100: 1, fat100: 15, carbs100: 3.8, en: 'olives (estimate)' },
  זיתים: { kcal100: 145, protein100: 1, fat100: 15, carbs100: 3.8, en: 'olives (estimate)' },
  אבוקדו: { kcal100: 160, protein100: 2, fat100: 15, carbs100: 9, en: 'avocado (estimate)' },
  לחם: { kcal100: 265, protein100: 9, fat100: 3.2, carbs100: 49, en: 'white bread (estimate)' },
  'לחם מלא': { kcal100: 247, protein100: 13, fat100: 3.4, carbs100: 41, en: 'whole wheat bread (estimate)' },
  פיתה: { kcal100: 275, protein100: 9, fat100: 1.2, carbs100: 56, en: 'pita (estimate)' },
  פסטה: { kcal100: 131, protein100: 5, fat100: 1, carbs100: 25, en: 'pasta cooked (estimate)' },
  אורז: { kcal100: 130, protein100: 2.7, fat100: 0.3, carbs100: 28, en: 'rice white cooked (estimate)' },
  'אורז מלא': { kcal100: 112, protein100: 2.6, fat100: 0.9, carbs100: 24, en: 'rice brown cooked (estimate)' },
  קינואה: { kcal100: 120, protein100: 4.4, fat100: 1.9, carbs100: 21, en: 'quinoa cooked (estimate)' },
  בורגול: { kcal100: 83, protein100: 3.1, fat100: 0.2, carbs100: 19, en: 'bulgur cooked (estimate)' },
  כוסמת: { kcal100: 92, protein100: 3.4, fat100: 0.6, carbs100: 20, en: 'buckwheat cooked (estimate)' },
  עדשים: { kcal100: 116, protein100: 9, fat100: 0.4, carbs100: 20, en: 'lentils cooked (estimate)' },
  שעועית: { kcal100: 127, protein100: 8.7, fat100: 0.5, carbs100: 23, en: 'beans cooked (estimate)' },
  אדממה: { kcal100: 121, protein100: 12, fat100: 5, carbs100: 9, en: 'edamame (estimate)' },
  טופו: { kcal100: 144, protein100: 17, fat100: 9, carbs100: 3, en: 'tofu firm (estimate)' },
  חומוס: { kcal100: 166, protein100: 8, fat100: 10, carbs100: 14, en: 'hummus (estimate)' },
  טחינה: { kcal100: 595, protein100: 17, fat100: 53, carbs100: 21, en: 'tahini (estimate)' },
  'חמאת בוטנים': { kcal100: 588, protein100: 25, fat100: 50, carbs100: 20, en: 'peanut butter (estimate)' },
  שקדים: { kcal100: 579, protein100: 21, fat100: 50, carbs100: 22, en: 'almonds (estimate)' },
  אגוזים: { kcal100: 654, protein100: 15, fat100: 65, carbs100: 14, en: 'walnuts (estimate)' },
  'אגוזי מלך': { kcal100: 654, protein100: 15, fat100: 65, carbs100: 14, en: 'walnuts (estimate)' },
  קשיו: { kcal100: 553, protein100: 18, fat100: 44, carbs100: 30, en: 'cashews (estimate)' },
  פיסטוק: { kcal100: 560, protein100: 20, fat100: 45, carbs100: 28, en: 'pistachios (estimate)' },
  בוטנים: { kcal100: 567, protein100: 26, fat100: 49, carbs100: 16, en: 'peanuts (estimate)' },
  גרנולה: { kcal100: 471, protein100: 10, fat100: 20, carbs100: 64, en: 'granola (estimate)' },
  'שיבולת שועל': { kcal100: 389, protein100: 17, fat100: 7, carbs100: 66, en: 'oats (estimate)' },
  קוואקר: { kcal100: 389, protein100: 17, fat100: 7, carbs100: 66, en: 'oats (estimate)' },
  ביצה: { kcal100: 155, protein100: 13, fat100: 11, carbs100: 1.1, en: 'egg cooked (estimate)' },
  ביצים: { kcal100: 155, protein100: 13, fat100: 11, carbs100: 1.1, en: 'eggs cooked (estimate)' },
  עוף: { kcal100: 165, protein100: 31, fat100: 3.6, carbs100: 0, en: 'chicken breast (estimate)' },
  'חזה עוף': { kcal100: 165, protein100: 31, fat100: 3.6, carbs100: 0, en: 'chicken breast (estimate)' },
  הודו: { kcal100: 135, protein100: 30, fat100: 1, carbs100: 0, en: 'turkey breast (estimate)' },
  'חזה הודו': { kcal100: 135, protein100: 30, fat100: 1, carbs100: 0, en: 'turkey breast (estimate)' },
  שרימפס: { kcal100: 99, protein100: 24, fat100: 0.3, carbs100: 0.2, en: 'shrimp (estimate)' },
  תמנון: { kcal100: 164, protein100: 30, fat100: 2.1, carbs100: 4.4, en: 'octopus (estimate)' },
  קלמרי: { kcal100: 175, protein100: 18, fat100: 7.5, carbs100: 7.8, en: 'squid (estimate)' },
  יוגורט: { kcal100: 73, protein100: 10, fat100: 1.9, carbs100: 4, en: 'greek yogurt (estimate)' },
  לבנה: { kcal100: 110, protein100: 7, fat100: 8, carbs100: 4, en: 'labneh (estimate)' },
  קוטג: { kcal100: 98, protein100: 11, fat100: 4.3, carbs100: 3.4, en: 'cottage cheese (estimate)' },
  גבינה: { kcal100: 402, protein100: 25, fat100: 33, carbs100: 1.3, en: 'cheddar cheese (estimate)' },
  'גבינה צהובה': { kcal100: 402, protein100: 25, fat100: 33, carbs100: 1.3, en: 'cheddar cheese (estimate)' },
  'גבינה לבנה': { kcal100: 100, protein100: 12, fat100: 5, carbs100: 3, en: 'white cheese 5% (estimate)' },
  'גבינה בולגרית': { kcal100: 264, protein100: 14, fat100: 21, carbs100: 4, en: 'feta cheese (estimate)' },
  פטה: { kcal100: 264, protein100: 14, fat100: 21, carbs100: 4, en: 'feta cheese (estimate)' },
  מוצרלה: { kcal100: 280, protein100: 28, fat100: 17, carbs100: 3, en: 'mozzarella cheese (estimate)' },
  'חטיף חלבון': { kcal100: 380, protein100: 30, fat100: 12, carbs100: 35, en: 'protein bar (estimate)' },
  חלב: { kcal100: 61, protein100: 3.2, fat100: 3.3, carbs100: 4.8, en: 'whole milk (estimate)' },
  'חלב סויה': { kcal100: 43, protein100: 3.3, fat100: 1.8, carbs100: 4.3, en: 'soy milk (estimate)' },
  'חלב שקדים': { kcal100: 17, protein100: 0.6, fat100: 1.5, carbs100: 0.3, en: 'almond milk (estimate)' },
  'חלב שיבולת שועל': { kcal100: 47, protein100: 1, fat100: 1.5, carbs100: 7, en: 'oat milk (estimate)' },
  שמנת: { kcal100: 340, protein100: 2.8, fat100: 36, carbs100: 2.8, en: 'heavy cream (estimate)' },
  חמאה: { kcal100: 717, protein100: 0.9, fat100: 81, carbs100: 0.1, en: 'butter (estimate)' },
  'שמן זית': { kcal100: 884, protein100: 0, fat100: 100, carbs100: 0, en: 'olive oil (estimate)' },
  סוכר: { kcal100: 387, protein100: 0, fat100: 0, carbs100: 100, en: 'sugar (estimate)' },
  דבש: { kcal100: 304, protein100: 0.3, fat100: 0, carbs100: 82, en: 'honey (estimate)' },
  סילאן: { kcal100: 320, protein100: 0.5, fat100: 0, carbs100: 80, en: 'date syrup (estimate)' },
  ריבה: { kcal100: 278, protein100: 0.4, fat100: 0.1, carbs100: 69, en: 'jam (estimate)' },
  שוקולד: { kcal100: 546, protein100: 7.6, fat100: 31, carbs100: 60, en: 'chocolate (estimate)' },
  גלידה: { kcal100: 207, protein100: 3.5, fat100: 11, carbs100: 24, en: 'ice cream vanilla (estimate)' },
  עוגה: { kcal100: 350, protein100: 5, fat100: 15, carbs100: 50, en: 'cake (estimate)' },
  עוגייה: { kcal100: 480, protein100: 5.5, fat100: 22, carbs100: 65, en: 'cookie (estimate)' },
  עוגיות: { kcal100: 480, protein100: 5.5, fat100: 22, carbs100: 65, en: 'cookies (estimate)' },
  בורקס: { kcal100: 350, protein100: 8, fat100: 22, carbs100: 30, en: 'pastry (estimate)' },
  קרואסון: { kcal100: 406, protein100: 8.2, fat100: 21, carbs100: 46, en: 'croissant (estimate)' },
  פיצה: { kcal100: 266, protein100: 11, fat100: 10, carbs100: 33, en: 'pizza (estimate)' },
  המבורגר: { kcal100: 295, protein100: 17, fat100: 14, carbs100: 24, en: 'hamburger (estimate)' },
  פלאפל: { kcal100: 333, protein100: 13, fat100: 18, carbs100: 32, en: 'falafel (estimate)' },
  שווארמה: { kcal100: 230, protein100: 21, fat100: 14, carbs100: 4, en: 'shawarma (estimate)' },
  סושי: { kcal100: 150, protein100: 6, fat100: 3, carbs100: 27, en: 'sushi (estimate)' },
  מיץ: { kcal100: 45, protein100: 0.7, fat100: 0.2, carbs100: 10, en: 'juice (estimate)' },
  קולה: { kcal100: 42, protein100: 0, fat100: 0, carbs100: 11, en: 'cola (estimate)' },
  בירה: { kcal100: 43, protein100: 0.5, fat100: 0, carbs100: 3.6, en: 'beer (estimate)' },
  יין: { kcal100: 85, protein100: 0.1, fat100: 0, carbs100: 2.7, en: 'wine (estimate)' },
  // Coffee & beverages — typical per-100ml ≈ per-100g values for the drink as
  // served. Cappuccino / latte assume regular milk; tweak by gram-edit later.
  קפה: { kcal100: 2, protein100: 0.1, fat100: 0, carbs100: 0, en: 'brewed coffee (estimate)' },
  'קפה שחור': { kcal100: 2, protein100: 0.1, fat100: 0, carbs100: 0, en: 'black coffee (estimate)' },
  'קפה הפוך': { kcal100: 40, protein100: 2, fat100: 1.8, carbs100: 3, en: 'cappuccino (estimate)' },
  אספרסו: { kcal100: 9, protein100: 0.1, fat100: 0.2, carbs100: 1.7, en: 'espresso (estimate)' },
  קפוצינו: { kcal100: 40, protein100: 2, fat100: 1.8, carbs100: 3, en: 'cappuccino (estimate)' },
  'קפוצ׳ינו': { kcal100: 40, protein100: 2, fat100: 1.8, carbs100: 3, en: 'cappuccino (estimate)' },
  לאטה: { kcal100: 55, protein100: 2.8, fat100: 2.8, carbs100: 4.2, en: 'latte (estimate)' },
  'קפה לאטה': { kcal100: 55, protein100: 2.8, fat100: 2.8, carbs100: 4.2, en: 'latte (estimate)' },
  מקיאטו: { kcal100: 30, protein100: 1.3, fat100: 1.3, carbs100: 2.5, en: 'macchiato (estimate)' },
  אמריקאנו: { kcal100: 6, protein100: 0.1, fat100: 0.1, carbs100: 1.2, en: 'americano (estimate)' },
  'נס קפה': { kcal100: 30, protein100: 1.5, fat100: 1.3, carbs100: 3, en: 'instant coffee w/ milk (estimate)' },
  נסקפה: { kcal100: 30, protein100: 1.5, fat100: 1.3, carbs100: 3, en: 'instant coffee w/ milk (estimate)' },
  מאצה: { kcal100: 70, protein100: 3, fat100: 2.5, carbs100: 9, en: 'matcha latte (estimate)' },
  'מאצה לאטה': { kcal100: 70, protein100: 3, fat100: 2.5, carbs100: 9, en: 'matcha latte (estimate)' },
  תה: { kcal100: 1, protein100: 0, fat100: 0, carbs100: 0.3, en: 'brewed tea (estimate)' },
  'תה ירוק': { kcal100: 1, protein100: 0, fat100: 0, carbs100: 0, en: 'green tea (estimate)' },
  'תה צמחים': { kcal100: 1, protein100: 0, fat100: 0, carbs100: 0.2, en: 'herbal tea (estimate)' },
  קקאו: { kcal100: 80, protein100: 3.3, fat100: 2.5, carbs100: 11, en: 'hot cocoa w/ milk (estimate)' },
  'שוקו חם': { kcal100: 85, protein100: 3.4, fat100: 3, carbs100: 11, en: 'hot chocolate (estimate)' },
  שוקו: { kcal100: 85, protein100: 3.4, fat100: 3, carbs100: 11, en: 'chocolate milk (estimate)' },
  מילקשייק: { kcal100: 110, protein100: 3.5, fat100: 3, carbs100: 18, en: 'milkshake (estimate)' },
  'שייק חלב': { kcal100: 90, protein100: 3.5, fat100: 2.5, carbs100: 13, en: 'milkshake (estimate)' },
  סמודי: { kcal100: 60, protein100: 1, fat100: 0.4, carbs100: 13, en: 'fruit smoothie (estimate)' },
  'שייק פירות': { kcal100: 60, protein100: 1, fat100: 0.4, carbs100: 13, en: 'fruit smoothie (estimate)' },
  לימונדה: { kcal100: 40, protein100: 0.1, fat100: 0, carbs100: 10, en: 'lemonade (estimate)' },
  סודה: { kcal100: 0, protein100: 0, fat100: 0, carbs100: 0, en: 'club soda (estimate)' },
  'מים מינרליים': { kcal100: 0, protein100: 0, fat100: 0, carbs100: 0, en: 'water (estimate)' },
  מים: { kcal100: 0, protein100: 0, fat100: 0, carbs100: 0, en: 'water (estimate)' },
};

export const MAX_FOODS_PER_MESSAGE = 12;

/**
 * Normalize Hebrew food names so map lookups survive minor spelling variants:
 *  - Strip niqqud (U+05B0–U+05C7) so "קָפֶה" matches "קפה".
 *  - Strip geresh / gershayim / ASCII quote marks so "קפוצ'ינו" matches "קפוצינו".
 *  - Collapse whitespace.
 * The original casing is irrelevant for Hebrew but we still lower-case to keep
 * the previous behaviour for mixed-case English fragments.
 */
export function normalizeHebrewFoodName(displayName) {
  return String(displayName ?? '')
    .toLowerCase()
    .replace(/[\u05B0-\u05C7]/g, '')
    .replace(/['׳״"`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fallbackNutritionForHebrew(displayName) {
  const norm = normalizeHebrewFoodName(displayName);
  const keys = Object.keys(FALLBACK_HEBREW).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const nk = normalizeHebrewFoodName(k);
    if (nk && norm.includes(nk)) {
      return { ...FALLBACK_HEBREW[k], matchedKey: k };
    }
  }
  return null;
}

function buildNutritionMeta({
  base,
  source,
  matchScore,
  confidence,
  englishMatched,
  isEstimate = false,
}) {
  return {
    fdcId: base.fdcId ?? null,
    kcalPer100g: Math.round(base.calories * 10) / 10,
    source,
    matchScore:
      typeof matchScore === 'number' ? Math.round(matchScore * 100) / 100 : null,
    confidence:
      typeof confidence === 'number' ? Math.round(confidence * 1000) / 1000 : null,
    energyMode: base.energyMode ?? null,
    energyNutrientId: base.energyNutrientId ?? null,
    rawEnergyUnitLabel: base.rawEnergyUnitLabel ?? null,
    englishMatched,
    isEstimate,
  };
}

function foodRowFromBase(displayName, grams, base, meta) {
  const multFinal = grams / 100;
  return {
    name: displayName.trim(),
    grams: Math.round(grams),
    calories: Math.round(base.calories * multFinal),
    protein: Math.round(base.protein * multFinal * 10) / 10,
    fat: Math.round(base.fat * multFinal * 10) / 10,
    carbs: Math.round(base.carbs * multFinal * 10) / 10,
    nutrition_metadata: meta,
  };
}

/**
 * Resolution order:
 *  1. Gemini-supplied per-100g from extractor JSON → source='gemini'.
 *  2. Local Hebrew table → source='local_table'.
 *  3. Generic estimate → source='generic_estimate' (always logs something).
 */
function resolveOneFoodItem(displayName, grams, _signal, originalItem) {
  const llm = extractLlmNutritionPer100g(originalItem);
  if (llm) {
    const base = {
      fdcId: null,
      name: displayName,
      calories: llm.kcal100,
      protein: llm.protein100,
      fat: llm.fat100,
      carbs: llm.carbs100,
      energyMode: 'gemini',
      energyNutrientId: null,
      rawEnergyUnitLabel: null,
    };
    const meta = buildNutritionMeta({
      base,
      source: 'gemini',
      matchScore: null,
      confidence: 0.75,
      englishMatched: displayName,
      isEstimate: false,
    });
    return { kind: 'ok', food: foodRowFromBase(displayName, grams, base, meta) };
  }

  const fb = fallbackNutritionForHebrew(displayName);
  if (fb) {
    const base = {
      fdcId: null,
      name: fb.en,
      calories: fb.kcal100,
      protein: fb.protein100,
      fat: fb.fat100,
      carbs: fb.carbs100,
      energyMode: 'local_table',
      energyNutrientId: null,
      rawEnergyUnitLabel: null,
    };
    const meta = buildNutritionMeta({
      base,
      source: 'local_table',
      matchScore: null,
      confidence: 0.55,
      englishMatched: fb.en,
      isEstimate: true,
    });
    return {
      kind: 'ok',
      food: foodRowFromBase(displayName, grams, base, meta),
      usedFallbackEstimate: true,
    };
  }

  const base = {
    fdcId: null,
    name: displayName,
    calories: 200,
    protein: 10,
    fat: 8,
    carbs: 22,
    energyMode: 'generic_estimate',
    energyNutrientId: null,
    rawEnergyUnitLabel: null,
  };
  const meta = buildNutritionMeta({
    base,
    source: 'generic_estimate',
    matchScore: null,
    confidence: 0.25,
    englishMatched: displayName,
    isEstimate: true,
  });
  return {
    kind: 'ok',
    food: foodRowFromBase(displayName, grams, base, meta),
    usedFallbackEstimate: true,
  };
}

/**
 * Pull plausible per-100g macros out of an extractor item. Two paths:
 *  1. Direct per-100g fields if the LLM provided them.
 *  2. Total kcal + grams the LLM provided → derive per-100g.
 * Returns null when nothing usable is present.
 */
function extractLlmNutritionPer100g(item) {
  if (!item || typeof item !== 'object') return null;

  const direct = Number(item.calories_per_100g ?? item.kcal_per_100g);
  if (Number.isFinite(direct) && direct >= 1 && direct <= 950) {
    const protein = Number(item.protein_per_100g);
    const fat = Number(item.fat_per_100g);
    const carbs = Number(item.carbs_per_100g);
    return {
      kcal100: direct,
      protein100: Number.isFinite(protein) ? protein : 0,
      fat100: Number.isFinite(fat) ? fat : 0,
      carbs100: Number.isFinite(carbs) ? carbs : 0,
    };
  }

  // Derive per-100g from total kcal + grams if both look reasonable.
  const totalKcal = Number(item.calories ?? item.kcal);
  const grams = Number(item.grams ?? item.weight_grams);
  if (
    Number.isFinite(totalKcal) &&
    Number.isFinite(grams) &&
    totalKcal >= 1 &&
    grams >= 1
  ) {
    const k100 = (totalKcal * 100) / grams;
    if (k100 >= 1 && k100 <= 950) {
      const totalProt = Number(item.protein);
      const totalFat = Number(item.fat);
      const totalCarbs = Number(item.carbs);
      const scale = 100 / grams;
      return {
        kcal100: k100,
        protein100: Number.isFinite(totalProt) ? totalProt * scale : 0,
        fat100: Number.isFinite(totalFat) ? totalFat * scale : 0,
        carbs100: Number.isFinite(totalCarbs) ? totalCarbs * scale : 0,
      };
    }
  }

  return null;
}

function lookupLocalNutrition(name) {
  const fb = fallbackNutritionForHebrew(name);
  if (!fb) return null;
  return {
    calories: fb.kcal100,
    protein: fb.protein100,
    fat: fb.fat100,
    carbs: fb.carbs100,
  };
}

function emojiForFood(name) {
  const n = String(name).toLowerCase();
  if (n.includes('פסטה') || n.includes('ספגטי')) return '🍝';
  if (n.includes('אורז')) return '🍚';
  if (n.includes('עוף') || n.includes('חזה')) return '🍗';
  if (n.includes('בשר') || n.includes('סטייק')) return '🥩';
  if (n.includes('דג') || n.includes('סלמון')) return '🐟';
  if (n.includes('סלט') || n.includes('ירק')) return '🥗';
  if (n.includes('ביצ')) return '🥚';
  if (n.includes('לחם') || n.includes('פיתה')) return '🍞';
  if (n.includes('תפוח') && !n.includes('אדמה')) return '🍎';
  if (n.includes('בננה')) return '🍌';
  return '🍽️';
}

export async function enrichAddFoodFoods(foodsInput, options = {}) {
  const { signal } = options;
  const raw = Array.isArray(foodsInput) ? foodsInput : [];

  const skippedOverCap =
    raw.length > MAX_FOODS_PER_MESSAGE
      ? raw.slice(MAX_FOODS_PER_MESSAGE).map((r) =>
          String(r?.name ?? '').trim() || '?'
        )
      : [];

  const queue = raw.slice(0, MAX_FOODS_PER_MESSAGE);

  const resolvedFoods = [];
  const needsClarification = [];
  let estimateCount = 0;

  for (const item of queue) {
    throwIfAborted(signal);
    const name = String(item?.name ?? '').trim() || 'מזון';
    const norm = normalizeExtractorItem(item);
    const grams = norm.grams;

    const outcome = await resolveOneFoodItem(name, grams, signal, item);
    if (outcome.kind === 'ok') {
      resolvedFoods.push(outcome.food);
      if (outcome.usedFallbackEstimate) estimateCount += 1;
    } else if (outcome.kind === 'clarify') {
      needsClarification.push({
        name: outcome.name,
        question: outcome.question,
      });
    }
  }

  return {
    resolvedFoods,
    needsClarification,
    failures: [],
    skippedOverCap,
    estimateFallbackCount: estimateCount,
    hasAnythingSaved: resolvedFoods.length > 0,
  };
}

function macrosFromPer100(grams, p100) {
  const mult = grams / 100;
  return {
    calories: Math.round(p100.kcal * mult),
    protein: Math.round(p100.protein * mult * 10) / 10,
    fat: Math.round(p100.fat * mult * 10) / 10,
    carbs: Math.round(p100.carbs * mult * 10) / 10,
  };
}

const QTY_UNIT_HE = {
  unit: 'יחידה',
  יחידה: 'יחידה',
  slice: 'פרוסה',
  פרוסה: 'פרוסה',
  פרוסות: 'פרוסות',
  portion: 'מנה',
  מנה: 'מנה',
  gram: 'גרם',
  g: 'גרם',
  גרם: 'גרם',
  tbsp: 'כף',
  כף: 'כף',
  כפות: 'כפות',
  tsp: 'כפית',
  כפית: 'כפית',
  כפיות: 'כפיות',
  handful: 'חופן',
  חופן: 'חופן',
  cup: 'כוס',
  כוס: 'כוס',
  כוסות: 'כוסות',
  can: 'קופסה',
  קופסה: 'קופסה',
  drink_can: 'פחית',
  פחית: 'פחית',
};

function qtyUnitHe(unitRaw) {
  const u = String(unitRaw ?? '').toLowerCase().trim();
  return QTY_UNIT_HE[u] || u || 'יחידה';
}

/** Human-readable quantity line for the confirm card (shown under "QTY."). */
export function buildQtyLabelForConfirm({
  grams,
  rawItem,
  norm,
  portionHint,
  portionGuess,
}) {
  const g = Math.max(1, Math.round(Number(grams) || 1));
  const cleanHint = String(portionHint || '').replace(/\?$/, '').trim();

  if (
    cleanHint &&
    !/^הותאם ל-/i.test(cleanHint) &&
    !/משוערת\s*~150\s*גרם/i.test(cleanHint) &&
    !/יחידה לא מוכרת/i.test(cleanHint)
  ) {
    if (/גרם|g\b/i.test(cleanHint)) return cleanHint;
    return `${cleanHint} · ${g}g`;
  }

  const standard = String(portionGuess?.standardLabel || '')
    .replace(/\?$/, '')
    .trim();
  if (standard) {
    return `${standard} · ${g}g`;
  }

  const summary = String(portionGuess?.summaryLine || '').replace(/\?$/, '').trim();
  if (summary && !/בערך\s*150\s*גרם\s*\(כללי\)/i.test(summary)) {
    if (/גרם|g\b|מ״ל|מ"ל/i.test(summary)) return summary;
    return `${summary} · ${g}g`;
  }

  const q = Number(rawItem?.quantity);
  const unitRaw = String(
    rawItem?.unit ?? norm?.quantityUnit ?? '',
  )
    .toLowerCase()
    .trim();

  if (Number.isFinite(q) && q > 0 && unitRaw && unitRaw !== 'gram' && unitRaw !== 'g') {
    const noun = qtyUnitHe(unitRaw);
    if (unitRaw === 'unit' || unitRaw === 'יחידה') {
      return q === 1 ? `יחידה אחת · ${g}g` : `${q} יחידות · ${g}g`;
    }
    if (unitRaw === 'slice' || unitRaw === 'פרוסה' || unitRaw === 'פרוסות') {
      return q === 1 ? `פרוסה אחת · ${g}g` : `${q} פרוסות · ${g}g`;
    }
    if (unitRaw === 'portion' || unitRaw === 'מנה') {
      return q === 1 ? `מנה אחת · ${g}g` : `${q} מנות · ${g}g`;
    }
    return q === 1 ? `${noun} אחת · ${g}g` : `${q} ${noun} · ${g}g`;
  }

  if (norm?.normalizedNote && !/^הותאם ל-/i.test(norm.normalizedNote)) {
    return `${norm.normalizedNote} · ${g}g`;
  }

  return `${g} גרם`;
}

function sourceLabelHe(source) {
  switch (source) {
    case 'gemini':
      return 'Gemini';
    case 'local_table':
    case 'fallback_estimate':
      return 'טבלה מקומית';
    case 'generic_estimate':
      return 'הערכה כללית';
    case 'llm_estimate':
    case 'gemini_estimate':
      return 'הערכת Gemini';
    default:
      return 'מקור משוער';
  }
}

function foodToConfirmItem(food, extras = {}) {
  const meta = food.nutrition_metadata || {};
  const grams = Number(food.grams) || 1;
  const mult = 100 / grams;
  return {
    name: food.name,
    grams,
    calories: food.calories,
    protein: food.protein,
    fat: food.fat,
    carbs: food.carbs,
    calories_per_100g: meta.kcalPer100g ?? Math.round((food.calories || 0) * mult),
    protein_per_100g:
      meta.proteinPer100g ?? Math.round((food.protein || 0) * mult * 10) / 10,
    fat_per_100g: meta.fatPer100g ?? Math.round((food.fat || 0) * mult * 10) / 10,
    carbs_per_100g: meta.carbsPer100g ?? Math.round((food.carbs || 0) * mult * 10) / 10,
    source: meta.source || 'unknown',
    sourceLabel: sourceLabelHe(meta.source),
    nutrition_metadata: meta,
    ...extras,
  };
}

/**
 * Build chat confirm-card rows with full nutrition (Gemini → local table → generic).
 */
export async function buildNutritionConfirmItems(
  userText,
  foodsFromModel,
  options = {},
) {
  const { signal } = options;
  throwIfAborted(signal);

  const raw = Array.isArray(foodsFromModel) ? foodsFromModel : [];
  const meta = buildFoodQuantityAssignment(userText, raw);
  const items = [];

  for (let i = 0; i < raw.length; i++) {
    throwIfAborted(signal);
    const rawItem = raw[i];
    const name = String(rawItem?.name ?? '').trim() || 'מזון';
    const norm = normalizeExtractorItem(rawItem);
    let grams = norm.grams;
    const assigned = meta[i]?.userAssignedGrams;
    const userSuppliedExplicitGrams = assigned != null;
    if (userSuppliedExplicitGrams) {
      grams = assigned;
    } else {
      // No explicit "N גרם" in the user message → never trust Gemini's gram
      // count for a bare food name. Prefer the per-food typical serving so
      // the card opens with a realistic default (e.g. פיתה ≈ 60g, ביצה ≈ 50g)
      // instead of Gemini's "1g". Keeps macros in sync with per-100g values.
      const guess = buildHeuristicPortionGuessForDisplayName(name);
      const fromGuess = defaultTotalGramsForFood({ name, portionGuess: guess });
      if (fromGuess != null) grams = fromGuess;
    }
    grams = Math.max(1, Math.round(grams));

    const outcome = resolveOneFoodItem(name, grams, signal, rawItem);

    if (outcome.kind === 'ok') {
      const guess = buildHeuristicPortionGuessForDisplayName(name);
      const portionHint =
        norm.normalizedNote || guess?.standardLabel || guess?.summaryLine || null;
      items.push(
        foodToConfirmItem(outcome.food, {
          portionHint,
          qtyLabel: buildQtyLabelForConfirm({
            grams,
            rawItem,
            norm,
            portionHint,
            portionGuess: guess,
          }),
          lockedGrams: assigned != null,
          normalizationNote: norm.normalizedNote || null,
        }),
      );
    } else {
      const guess = buildHeuristicPortionGuessForDisplayName(name);
      const g = defaultTotalGramsForFood({ name, portionGuess: guess }) || grams;
      const fb = fallbackNutritionForHebrew(name) || {
        kcal100: 200,
        protein100: 10,
        fat100: 8,
        carbs100: 22,
      };
      const macros = macrosFromPer100(g, {
        kcal: fb.kcal100,
        protein: fb.protein100,
        fat: fb.fat100,
        carbs: fb.carbs100,
      });
      items.push({
        name,
        grams: g,
        ...macros,
        calories_per_100g: fb.kcal100,
        protein_per_100g: fb.protein100,
        fat_per_100g: fb.fat100,
        carbs_per_100g: fb.carbs100,
        source: 'local_table',
        sourceLabel: sourceLabelHe('local_table'),
        portionHint: guess?.standardLabel || guess?.summaryLine || 'ערוך משקל וערכים',
        qtyLabel: buildQtyLabelForConfirm({
          grams: g,
          rawItem,
          norm,
          portionHint: guess?.standardLabel || guess?.summaryLine,
          portionGuess: guess,
        }),
        lockedGrams: false,
        nutrition_metadata: {
          source: 'local_table',
          confidence: 0.35,
          isEstimate: true,
        },
      });
    }
  }

  return items;
}

/** @deprecated use buildNutritionConfirmItems */
export async function buildConfirmPortionItemsFromUserMessage(
  userText,
  foodsFromModel,
  options = {},
) {
  return buildNutritionConfirmItems(userText, foodsFromModel, options);
}

export function recalcConfirmItemFromGrams(item, newGrams) {
  const g = Math.max(1, Math.round(Number(newGrams) || 1));
  const k100 = Number(item.calories_per_100g) || 0;
  const p100 = Number(item.protein_per_100g) || 0;
  const f100 = Number(item.fat_per_100g) || 0;
  const c100 = Number(item.carbs_per_100g) || 0;
  const macros = macrosFromPer100(g, {
    kcal: k100,
    protein: p100,
    fat: f100,
    carbs: c100,
  });
  const qtyLabel = refreshQtyLabelGrams(item.qtyLabel, g);
  return {
    ...item,
    grams: g,
    qtyLabel,
    ...macros,
  };
}

/** Keep QTY text in sync when user edits grams in the card. */
export function refreshQtyLabelGrams(qtyLabel, grams) {
  const g = Math.max(1, Math.round(Number(grams) || 1));
  const base = String(qtyLabel || '').trim();
  if (!base) return `${g} גרם`;
  const withoutGram = base
    .replace(/\s*·\s*\d+\s*g\s*$/i, '')
    .replace(/\s*·\s*\d+\s*גרם\s*$/i, '')
    .replace(/\s*\d+\s*גרם\s*$/i, '')
    .trim();
  if (withoutGram) return `${withoutGram} · ${g}g`;
  return `${g} גרם`;
}

export function confirmItemsToReadyFoods(items) {
  return (items || [])
    .map((it) => ({
      name: it.name,
      grams: Math.max(1, Math.round(Number(it.grams) || 1)),
      calories: Math.round(Number(it.calories) || 0),
      protein: Number(it.protein) || 0,
      fat: Number(it.fat) || 0,
      carbs: Number(it.carbs) || 0,
      nutrition_metadata: it.nutrition_metadata || {
        kcalPer100g: it.calories_per_100g,
        source: it.source,
      },
    }))
    .filter((f) => f.grams > 0);
}

/** Turn resolved food rows into inline confirm-card items. */
export function resolvedFoodsToConfirmItems(resolvedFoods) {
  return (resolvedFoods || []).map((f) => {
    const meta = f.nutrition_metadata || {};
    const portionHint =
      meta.portionHint || meta.standardLabel || meta.summaryLine || null;
    return foodToConfirmItem(f, {
      portionHint,
      qtyLabel: buildQtyLabelForConfirm({
        grams: f.grams,
        rawItem: null,
        norm: null,
        portionHint,
        portionGuess: meta.portionGuess || null,
      }),
    });
  });
}

export async function prefillAskQuantityHints(foodsInput) {
  const out = [];
  for (const f of foodsInput || []) {
    const name = String(f?.name ?? '').trim() || 'מזון';
    const llm = extractLlmNutritionPer100g(f);
    const cand = llm
      ? {
          calories: llm.kcal100,
          protein: llm.protein100,
          fat: llm.fat100,
          carbs: llm.carbs100,
        }
      : lookupLocalNutrition(name);
    const fb = !cand ? fallbackNutritionForHebrew(name) : null;

    if (cand) {
      out.push({
        ...f,
        name,
        calories_per_100g: cand.calories,
        protein_per_100g: cand.protein,
        fat_per_100g: cand.fat,
        carbs_per_100g: cand.carbs,
      });
    } else if (fb) {
      out.push({
        ...f,
        name,
        calories_per_100g: fb.kcal100,
        protein_per_100g: fb.protein100,
        fat_per_100g: fb.fat100,
        carbs_per_100g: fb.carbs100,
      });
    } else {
      out.push({
        ...f,
        name,
        calories_per_100g: 200,
        protein_per_100g: 10,
        fat_per_100g: 8,
        carbs_per_100g: 22,
      });
    }
  }
  return out;
}

/** סף גס בגרמים לתזכורת (אינדיקציה בלבד, לא פסק הלכה). */
const BREAD_GRAMS_FOR_KEZAYIT_HINT = 25;

const BREAD_LIKE_NAME_SUBSTRINGS_HE = [
  'לחם',
  'חלה',
  'לחמניה',
  'פיתה',
  'באגט',
  'בגט',
  'טוסט',
  'כריך',
  'סנדוויץ',
  'סנדויץ',
  'באגל',
];

/**
 * זיהוי מאכל דומה ללחם (להמוציא / ברכת מזון) — לתזכורת באפליקציה בלבד.
 */
export function isBreadLikeFoodName(name) {
  const s = String(name || '').trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (
    /\bbread\b/i.test(lower) ||
    /\btoast\b/i.test(lower) ||
    /\bbaguette\b/i.test(lower) ||
    /\bbagel\b/i.test(lower) ||
    /\bpita\b/i.test(lower)
  ) {
    return true;
  }
  return BREAD_LIKE_NAME_SUBSTRINGS_HE.some((w) => s.includes(w));
}

function resolvedFoodsSuggestBirkatHamazon(resolvedFoods) {
  if (!resolvedFoods?.length) return false;
  for (const f of resolvedFoods) {
    const g = Number(f.grams) || 0;
    if (g < BREAD_GRAMS_FOR_KEZAYIT_HINT) continue;
    if (isBreadLikeFoodName(f.name)) return true;
  }
  return false;
}

export function formatFoodLoggedReply(
  resolvedFoods,
  {
    dailyStats = {},
    targets = {},
    needsClarification = [],
    skippedOverCap = [],
    estimateFallbackCount = 0,
    verifierCorrections = [],
    verifierApproved = [],
  } = {}
) {
  if (!resolvedFoods?.length && !needsClarification?.length) {
    return 'לא הצלחתי לרשום מזון אמין מההודעה. פרט מה אכלת (שם + גרם).';
  }

  const correctionByName = new Map();
  for (const c of verifierCorrections || []) {
    if (c?.name) correctionByName.set(c.name, c);
  }
  const approvedSet = new Set(verifierApproved || []);

  const lines = [];
  let totalCal = 0;
  let totalProt = 0;

  for (const f of resolvedFoods) {
    const em = emojiForFood(f.name);
    totalCal += f.calories || 0;
    totalProt += f.protein || 0;
    const verifyMark = correctionByName.has(f.name)
      ? ' 🔍'
      : approvedSet.has(f.name)
        ? ' ✓'
        : '';
    lines.push(`${em} ${f.name} (${f.grams}g)${verifyMark} | ${f.calories} קל`);
  }

  const dayCal =
    resolvedFoods.length > 0
      ? (dailyStats.calories || 0) + totalCal
      : dailyStats.calories || 0;
  const goal = targets.calories || 2000;

  let mood = '';
  if (resolvedFoods.length > 0) {
    if (dayCal >= goal) {
      mood = 'וואו, סגרת את היעד ובגדול! כל הכבוד!';
    } else if (dayCal >= goal * 0.85) {
      mood = 'מעולה, קרוב מאוד ליעד!';
    } else {
      mood = 'נשאר אנרגיה ליום — כיף לראות!';
    }
  }

  const extras = [];

  if (verifierCorrections?.length) {
    const lines = verifierCorrections.map((c) => {
      const head = `🔍 תיקנתי: ${c.name} ≈ ${c.correctedGrams}g (ולא ${c.originalGrams}g)`;
      return c.reason ? `${head} — ${c.reason}` : head;
    });
    extras.push(lines.join('\n'));
  }

  if (skippedOverCap.length) {
    extras.push(
      `זיהיתי עוד פריטים שלא חושבו כאן (${skippedOverCap.length}). שלח את המשך או פרט עד ${MAX_FOODS_PER_MESSAGE} פריטים להודעה.`
    );
  }

  if (needsClarification.length) {
    extras.push(
      'לא הבנתי בביטחון:' +
        needsClarification.map((x) => '\n• ' + x.question).join('')
    );
  }

  if (estimateFallbackCount > 0) {
    extras.push(
      `(${estimateFallbackCount} פריטים לפי אומדן פנימי — דיוק נמוך יותר.)`
    );
  }

  const intro =
    resolvedFoods.length > 0
      ? needsClarification.length || skippedOverCap.length
        ? '✅ רשמתי מה שהצלחתי לאמת:'
        : '✅ נרשם הכל!'
      : '📝 נדרשת הבהרה';

  const totalsBlock =
    resolvedFoods.length > 0
      ? [
          '────────────────────',
          ...lines,
          '────────────────────',
          `סה״כ: ${Math.round(totalCal)} קלוריות | ${totalProt.toFixed(1)}g חלבון`,
          `📈 מאזן יומי: ${Math.round(dayCal)} / ${goal} קלוריות`,
          mood ? `💪 ${mood}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '';

  const birkatHamazonHint = resolvedFoodsSuggestBirkatHamazon(resolvedFoods)
    ? '💭 שים לב: הכמות כנראה יותר מכזית. אם אתה מקפיד — צריך לברך ברכת המזון. נוסחים במסך ״ברכת המזון״ בתפריט.'
    : '';

  return [
    intro,
    totalsBlock,
    extras.filter(Boolean).join('\n\n'),
    birkatHamazonHint,
  ]
    .filter((s) => s && String(s).trim())
    .join('\n\n');
}
