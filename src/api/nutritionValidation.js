/**
 * Plausible kcal/100g bounds by food family (Israeli UX + USDA typical ranges).
 */

function norm(s) {
  return String(s || '').toLowerCase();
}

/**
 * Decide which dairy sub-family the user actually asked for.
 * The user-facing Hebrew display name dominates: "חלב" alone must NOT
 * accept hits whose USDA description is "Cheese, mozzarella, whole milk"
 * just because the description happens to mention "milk".
 */
function classifyDairyFromDisplayName(name) {
  const n = norm(name).trim();
  if (!n) return null;

  const isCheese =
    /\bcheese\b/.test(n) ||
    /גבינה|גבינות|מוצרלה|פרמזן|פארמה|קשקבל|גאודה|פטה|רוקפור|בולגרית|צהובה|קממבר|ברי|חלומי|מסקרפונה/.test(
      n,
    );
  if (isCheese) return 'cheese';

  if (/cottage|קוטג|לבנה|ricotta|ריקוטה|quark|קוורק/.test(n)) return 'soft_cheese';
  if (/yogurt|יוגורט|לאבנה/.test(n)) return 'yogurt';
  if (/cream|שמנת|crème|creme/.test(n)) return 'cream';

  const isPowderOrConcentrate =
    /אבקה|אבקת|powder|condensed|evaporated|dried|dry/.test(n);
  if (isPowderOrConcentrate) return null;

  if (/(^|\s|,)חלב($|\s|,|%|\d)/.test(n)) return 'milk_liquid';
  if (/\bmilk\b/.test(n)) return 'milk_liquid';

  return null;
}

export function validateKcalPer100(hebrewDisplayName, englishDescription, kcalPer100) {
  const k = Number(kcalPer100);
  const t = `${norm(hebrewDisplayName)} ${norm(englishDescription)}`;
  const tDesc = norm(englishDescription);

  let min = 8;
  let max = 950;

  const dairy = classifyDairyFromDisplayName(hebrewDisplayName);

  if (dairy === 'milk_liquid') {
    if (/\bcheese\b/.test(tDesc) || /\byogurt\b/.test(tDesc) || /\bcream\b/.test(tDesc)) {
      return {
        ok: false,
        min: 25,
        max: 90,
        reason: `display name "${hebrewDisplayName}" is liquid milk but description matches a different dairy family ("${englishDescription}")`,
      };
    }
    min = 25;
    max = 90;
  } else if (dairy === 'yogurt') {
    if (/\bcheese\b/.test(tDesc)) {
      return {
        ok: false,
        min: 30,
        max: 200,
        reason: `display name "${hebrewDisplayName}" is yogurt but description is cheese ("${englishDescription}")`,
      };
    }
    min = 30;
    max = 200;
  } else if (dairy === 'soft_cheese') {
    min = 50;
    max = 250;
  } else if (dairy === 'cream') {
    min = 80;
    max = 950;
  } else if (dairy === 'cheese') {
    min = 100;
    max = 520;
  } else if (
    /\b(?:oil|butter|מיוניז|margarine)|שמן|טחינה|tahini|peanut butter|חמאת בוטנים|אבוקדו|walnut|אגוז|שקדים|עוגת|עוגיי|nut\b/i.test(
      t
    )
  ) {
    min = 100;
    max = 950;
  } else if (
    /beef|veal|lamb|pork|steak|sirloin|tenderloin|brisket|ribs|burger|בקר|סטייק|בשר|עוף|chicken|turkey|הודו|דג|fish|salmon|סלמון|tuna|טונה|חזה|octopus|תמנון|shrimp|שרימפס|squid|קלמרי|meat/i.test(
      t
    )
  ) {
    min = 40;
    max = 520;
  } else if (
    /apple|תפוח|בננה|banana|fruit|תות|אגס|אפרסק|מנגו|דובדבן|תמר|אבטיח|melon|תפוז|אשכולית|רימון|קיווי|ענב|מלון|persimmon/i.test(
      t
    )
  ) {
    min = 12;
    max = 220;
  } else if (/bread|לחם|פיתה|חלה|בגט|פסטה|pasta|אורז|rice|couscous|קוסקוס|שיבולת|oat|cereal|bagel|קרואסון/i.test(t)) {
    min = 70;
    max = 520;
  } else if (/milk|חלב|יוגורט|yogurt|קוטג|cottage|cheese|גבינה|לבנה|cream|שמנת|quark|mozzarella/i.test(t)) {
    min = 30;
    max = 520;
  } else if (
    /cucumber|מלפפון|עגבנ|חסה|broccoli|ברוקולי|cabbage|כרוב|פלפל|חציל|zucchini|celery|onion|carrot|גזר|פטריות|lettuce|spinach|תרד|tomato|ירק|salad|vegetable/i.test(
      t
    )
  ) {
    min = 8;
    max = 120;
  } else if (/quinoa|קינואה|lentil|עדש|chickpea|חומוס|hummus/i.test(t)) {
    min = 65;
    max = 200;
  } else if (/egg|ביצה|ביצים/i.test(t)) {
    min = 40;
    max = 720;
  }

  if (!Number.isFinite(k) || k < min || k > max) {
    return {
      ok: false,
      min,
      max,
      reason: `kcal/100g ${k} outside bounds [${min},${max}]`,
    };
  }
  return { ok: true, min, max };
}
