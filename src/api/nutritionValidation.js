/**
 * Plausible kcal/100g bounds by food family (Israeli UX + USDA typical ranges).
 */

function norm(s) {
  return String(s || '').toLowerCase();
}

export function validateKcalPer100(hebrewDisplayName, englishDescription, kcalPer100) {
  const k = Number(kcalPer100);
  const t = `${norm(hebrewDisplayName)} ${norm(englishDescription)}`;

  let min = 8;
  let max = 950;

  if (
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
