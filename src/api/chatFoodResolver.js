import { searchFoodWithScores } from './usdaApi';
import { validateKcalPer100 } from './nutritionValidation';
import { normalizeExtractorItem } from './foodQuantityNormalize';
import { attachPortionGuesses, buildHeuristicPortionGuessForDisplayName } from '../utils/standardPortionGuess';
import { buildFoodQuantityAssignment } from '../utils/userMessageFoodBinding';

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const e = new Error('Cancelled');
    e.name = 'AbortError';
    e.code = 'USER_CANCEL';
    throw e;
  }
}

/** Longest Hebrew keyword wins (same idea as smartChatbot). */
export const HEBREW_FOOD_SEARCH_MAP = {
  פסטה: 'pasta cooked',
  אורז: 'rice cooked white',
  'אורז מלא': 'rice cooked brown',
  לחם: 'bread white',
  'לחם מלא': 'bread whole wheat',
  פיתה: 'pita bread',
  בטטה: 'sweet potato baked',
  'תפוח אדמה': 'potato boiled',
  'שיבולת שועל': 'oats',
  קוואקר: 'oats',
  עוף: 'chicken breast cooked',
  'חזה עוף': 'chicken breast cooked',
  הודו: 'turkey breast cooked',
  'חזה הודו': 'turkey breast cooked',
  טונה: 'tuna canned',
  סלמון: 'salmon cooked',
  ביצה: 'egg whole cooked',
  ביצים: 'eggs whole cooked',
  קוטג: 'cottage cheese',
  יוגורט: 'yogurt greek plain',
  לבנה: 'labneh',
  חומוס: 'hummus',
  אבוקדו: 'avocado raw',
  שקדים: 'almonds',
  אגוזים: 'walnuts',
  'אגוזי מלך': 'walnuts',
  קשיו: 'cashews',
  פיסטוק: 'pistachios',
  טחינה: 'tahini',
  'חמאת בוטנים': 'peanut butter',
  בוטנים: 'peanuts',
  בננה: 'banana raw',
  תפוח: 'apple raw',
  תפוז: 'orange raw',
  אשכולית: 'grapefruit raw',
  ענבים: 'grapes raw',
  ענב: 'grapes raw',
  אבטיח: 'watermelon raw',
  מלון: 'melon cantaloupe raw',
  אננס: 'pineapple raw',
  פפאיה: 'papaya raw',
  מנגו: 'mango raw',
  קיווי: 'kiwi raw',
  אגס: 'pear raw',
  אפרסק: 'peach raw',
  נקטרינה: 'nectarine raw',
  שזיף: 'plum raw',
  אפרסמון: 'persimmon raw',
  רימון: 'pomegranate raw',
  דובדבן: 'cherries raw',
  דובדבנים: 'cherries raw',
  תות: 'strawberries raw',
  תותים: 'strawberries raw',
  פטל: 'raspberries raw',
  אוכמניות: 'blueberries raw',
  תאנה: 'fig raw',
  תאנים: 'figs raw',
  תמר: 'dates medjool',
  תמרים: 'dates medjool',
  צימוקים: 'raisins',
  לימון: 'lemon raw',
  קלמנטינה: 'tangerine raw',
  עגבנייה: 'tomato raw',
  עגבניה: 'tomato raw',
  מלפפון: 'cucumber raw',
  זיתים: 'olives green pickled',
  זית: 'olives green pickled',
  גזר: 'carrot raw',
  סלרי: 'celery raw',
  גבינה: 'cheese cheddar',
  'גבינה צהובה': 'cheese cheddar',
  'גבינה לבנה': 'cheese white 5%',
  'גבינה בולגרית': 'cheese feta',
  פטה: 'cheese feta',
  מוצרלה: 'cheese mozzarella',
  חלב: 'milk whole 3.25 milkfat',
  'חלב סויה': 'soy milk',
  'חלב שקדים': 'almond milk',
  'חלב שיבולת שועל': 'oat milk',
  שמנת: 'cream heavy',
  חמאה: 'butter',
  'שמן זית': 'olive oil',
  סטייק: 'beef steak cooked',
  בקר: 'beef cooked',
  בשר: 'beef cooked',
  'בשר טחון': 'ground beef cooked',
  'חטיף חלבון': 'protein bar',
  'שייק חלבון': 'protein shake',
  קינואה: 'quinoa cooked',
  בורגול: 'bulgur cooked',
  כוסמת: 'buckwheat cooked',
  עדשים: 'lentils cooked',
  שעועית: 'beans cooked',
  'שעועית שחורה': 'black beans cooked',
  'שעועית לבנה': 'white beans cooked',
  אדממה: 'edamame',
  טופו: 'tofu firm',
  גרנולה: 'granola',
  חלבון: 'whey protein',
  ברוקולי: 'broccoli cooked',
  כרובית: 'cauliflower cooked',
  תרד: 'spinach raw',
  כרוב: 'cabbage raw',
  פלפל: 'bell pepper',
  חציל: 'eggplant cooked',
  זוקיני: 'zucchini cooked',
  קישוא: 'zucchini cooked',
  פטריות: 'mushrooms',
  בצל: 'onion raw',
  שום: 'garlic raw',
  חסה: 'lettuce raw',
  תירס: 'corn cooked',
  אפונה: 'peas cooked',
  תמנון: 'octopus cooked',
  שרימפס: 'shrimp cooked',
  קלמרי: 'squid cooked',
  סושי: 'sushi',
  פיצה: 'pizza cheese',
  המבורגר: 'hamburger',
  פלאפל: 'falafel',
  שווארמה: 'shawarma',
  גלידה: 'ice cream vanilla',
  שוקולד: 'chocolate dark',
  עוגה: 'cake',
  עוגייה: 'cookie',
  עוגיות: 'cookies',
  בורקס: 'pastry',
  קרואסון: 'croissant',
  סוכר: 'sugar granulated',
  דבש: 'honey',
  סילאן: 'date syrup',
  ריבה: 'jam',
  מיץ: 'juice orange',
  קולה: 'cola',
  בירה: 'beer',
  יין: 'wine red',
};

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
};

export const MAX_FOODS_PER_MESSAGE = 12;

export function resolveEnglishQueryFromHebrewDisplayName(displayName) {
  const lower = String(displayName).toLowerCase();
  const sorted = Object.keys(HEBREW_FOOD_SEARCH_MAP).sort((a, b) => b.length - a.length);
  for (const hk of sorted) {
    if (lower.includes(hk.toLowerCase())) {
      return HEBREW_FOOD_SEARCH_MAP[hk];
    }
  }
  return null;
}

export function fallbackNutritionForHebrew(displayName) {
  const lower = String(displayName).toLowerCase();
  const keys = Object.keys(FALLBACK_HEBREW).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (lower.includes(k)) {
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
 *  1. USDA hit that passes kcal/100g validation → high confidence, source='usda'.
 *  2. Hebrew fallback table (kcal/macros tuned per item) → mid confidence, source='fallback_estimate'.
 *  3. USDA top hit even when validation failed → low confidence, source='usda_unvalidated'.
 *     Used as a last-resort so the user gets *something* logged instead of "needs clarification".
 *  4. If we have nutrition hints from the LLM (kcal_per_100g etc.) → source='llm_estimate'.
 *  5. Only then 'clarify'.
 */
async function resolveOneFoodItem(displayName, grams, signal, originalItem) {
  throwIfAborted(signal);
  const q = resolveEnglishQueryFromHebrewDisplayName(displayName);
  const scored = await searchFoodWithScores(q || String(displayName).trim());
  let chosen = null;
  let chosenScore = null;
  let chosenConf = null;

  if (scored?.length) {
    for (const cand of scored) {
      const v = validateKcalPer100(displayName, cand.name, cand.calories);
      if (v.ok) {
        chosen = cand;
        chosenScore = cand.matchScore;
        chosenConf = cand.confidence;
        break;
      }
    }
  }

  if (chosen) {
    const meta = buildNutritionMeta({
      base: chosen,
      source: 'usda',
      matchScore: chosenScore,
      confidence: chosenConf,
      englishMatched: chosen.name,
      isEstimate: false,
    });
    return { kind: 'ok', food: foodRowFromBase(displayName, grams, chosen, meta) };
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
      energyMode: 'fallback_table',
      energyNutrientId: null,
      rawEnergyUnitLabel: null,
    };
    const meta = buildNutritionMeta({
      base,
      source: 'fallback_estimate',
      matchScore: null,
      confidence: 0.45,
      englishMatched: fb.en,
      isEstimate: true,
    });
    return {
      kind: 'ok',
      food: foodRowFromBase(displayName, grams, base, meta),
      usedFallbackEstimate: true,
    };
  }

  // Soft fallback: USDA gave us hits but none passed validation. Better to
  // log the closest match (clearly marked low-confidence) than to refuse.
  if (scored?.length) {
    const top = scored[0];
    const base = {
      fdcId: top.fdcId ?? null,
      name: top.name,
      calories: top.calories,
      protein: top.protein,
      fat: top.fat,
      carbs: top.carbs,
      energyMode: top.energyMode ?? null,
      energyNutrientId: top.energyNutrientId ?? null,
      rawEnergyUnitLabel: top.rawEnergyUnitLabel ?? null,
    };
    const meta = buildNutritionMeta({
      base,
      source: 'usda_unvalidated',
      matchScore: top.matchScore,
      confidence: 0.35,
      englishMatched: top.name,
      isEstimate: true,
    });
    return {
      kind: 'ok',
      food: foodRowFromBase(displayName, grams, base, meta),
      usedFallbackEstimate: true,
    };
  }

  // Last resort: trust the LLM's per-100g numbers if it provided any.
  // Used when the user names a niche food we never mapped and USDA is silent.
  const llm = extractLlmNutritionPer100g(originalItem);
  if (llm) {
    const base = {
      fdcId: null,
      name: `${displayName} (LLM estimate)`,
      calories: llm.kcal100,
      protein: llm.protein100,
      fat: llm.fat100,
      carbs: llm.carbs100,
      energyMode: 'llm_estimate',
      energyNutrientId: null,
      rawEnergyUnitLabel: null,
    };
    const meta = buildNutritionMeta({
      base,
      source: 'llm_estimate',
      matchScore: null,
      confidence: 0.3,
      englishMatched: `${displayName} (LLM)`,
      isEstimate: true,
    });
    return {
      kind: 'ok',
      food: foodRowFromBase(displayName, grams, base, meta),
      usedFallbackEstimate: true,
    };
  }

  return {
    kind: 'clarify',
    name: displayName.trim(),
    question: `לא הצלחתי לקשר בעקביות את "${displayName}" למקור מהימן. מה בדיוק אכלת (סוג ומשקל בגרם)?`,
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

async function lookupFirstValidated(name) {
  const scored = await searchFoodWithScores(
    resolveEnglishQueryFromHebrewDisplayName(name) || name
  );
  if (!scored?.length) return null;
  for (const cand of scored) {
    if (validateKcalPer100(name, cand.name, cand.calories).ok) return cand;
  }
  // Soft fallback for portion-confirm hints: prefer *something* over nothing,
  // so the kcal-per-100g preview shows reasonable numbers even on edge foods.
  return scored[0] ?? null;
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

/**
 * Portion-confirm card items: USDA per-100g + locked grams from user text or heuristic guess.
 */
export async function buildConfirmPortionItemsFromUserMessage(
  userText,
  foodsFromModel,
  options = {},
) {
  const { signal } = options;
  throwIfAborted(signal);

  const raw = Array.isArray(foodsFromModel) ? foodsFromModel : [];
  const meta = buildFoodQuantityAssignment(userText, raw);
  const hinted = await prefillAskQuantityHints(raw.map((f) => ({ name: f?.name })));

  return hinted.map((h, i) => {
    const m = meta[i];
    const grams = m?.userAssignedGrams;
    if (grams != null) {
      const guessBase = buildHeuristicPortionGuessForDisplayName(h.name);
      return {
        ...h,
        portionGuess: {
          ...guessBase,
          defaultGrams: grams,
          minGrams: grams,
          maxGrams: grams,
          step: 1,
          summaryLine: `${grams} גרם (כמו שכתבתם בהודעה)`,
        },
      };
    }
    return attachPortionGuesses([h])[0];
  });
}

export async function prefillAskQuantityHints(foodsInput) {
  const out = [];
  for (const f of foodsInput || []) {
    const name = String(f?.name ?? '').trim() || 'מזון';
    let cand = await lookupFirstValidated(name);
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
  } = {}
) {
  if (!resolvedFoods?.length && !needsClarification?.length) {
    return 'לא הצלחתי לרשום מזון אמין מההודעה. פרט מה אכלת (שם + גרם).';
  }

  const lines = [];
  let totalCal = 0;
  let totalProt = 0;

  for (const f of resolvedFoods) {
    const em = emojiForFood(f.name);
    totalCal += f.calories || 0;
    totalProt += f.protein || 0;
    lines.push(`${em} ${f.name} (${f.grams}g) | ${f.calories} קל`);
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
      `(${estimateFallbackCount} פריטים לפי אומדן פנימי — דיוק נמוך יותר מ־USDA.)`
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

  return [intro, totalsBlock, extras.filter(Boolean).join('\n\n'), birkatHamazonHint]
    .filter((s) => s && String(s).trim())
    .join('\n\n');
}
