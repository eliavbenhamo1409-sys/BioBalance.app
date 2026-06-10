/**
 * Normalizes Gemini extractor output to grams (deterministic).
 * Supports { quantity, unit } or legacy { grams }.
 *
 * Beyond the four canonical units the system prompt allows (`gram | unit |
 * slice | portion`), Gemini routinely leaks Hebrew kitchen measures into
 * `unit` ("כף", "כפית", "חופן", "כוס", "קופסה", "פחית", or English
 * "tablespoon"/"tsp"/"cup"/"handful"). Falling through to the generic
 * `quantity × 120` fallback turned a tablespoon of tahini into a 120g
 * portion (~710 kcal). This module now recognises those units and looks up
 * per-food gram values so dense spreads, nuts, and liquids map sanely.
 */

export const UNIT = {
  GRAM: 'gram',
  UNIT: 'unit',
  SLICE: 'slice',
  PORTION: 'portion',
  TBSP: 'tbsp',
  TSP: 'tsp',
  HANDFUL: 'handful',
  CUP: 'cup',
  CAN: 'can',
  DRINK_CAN: 'drink_can',
};

/** ~grams per heuristic "unit" (medium assumptions for IL UX). */
const DEFAULT_UNIT_GRAMS = {
  תפוח: 180,
  בננה: 120,
  תפוז: 150,
  ביצה: 50,
  ביצים: 50,
};

const DEFAULT_SLICE_GRAMS = {
  לחם: 32,
  פיתה: 60,
  חלה: 40,
};

/**
 * Hebrew/English unit aliases → canonical kitchen-unit key.
 * Anything matched here gets routed through {@link estimateKitchenUnitGrams}
 * instead of falling into `unknown_unit` (quantity × 120) territory.
 */
const KITCHEN_UNIT_ALIASES = {
  כף: UNIT.TBSP,
  כפות: UNIT.TBSP,
  tablespoon: UNIT.TBSP,
  tablespoons: UNIT.TBSP,
  tbsp: UNIT.TBSP,
  tbsps: UNIT.TBSP,
  tbs: UNIT.TBSP,

  כפית: UNIT.TSP,
  כפיות: UNIT.TSP,
  teaspoon: UNIT.TSP,
  teaspoons: UNIT.TSP,
  tsp: UNIT.TSP,
  tsps: UNIT.TSP,

  חופן: UNIT.HANDFUL,
  חופנים: UNIT.HANDFUL,
  חופניים: UNIT.HANDFUL,
  handful: UNIT.HANDFUL,
  handfuls: UNIT.HANDFUL,

  כוס: UNIT.CUP,
  כוסות: UNIT.CUP,
  ספל: UNIT.CUP,
  ספלים: UNIT.CUP,
  cup: UNIT.CUP,
  cups: UNIT.CUP,
  mug: UNIT.CUP,

  קופסה: UNIT.CAN,
  קופסא: UNIT.CAN,
  קופסאות: UNIT.CAN,
  can: UNIT.CAN,
  jar: UNIT.CAN,
  קונסרב: UNIT.CAN,

  פחית: UNIT.DRINK_CAN,
  פחיות: UNIT.DRINK_CAN,
  בקבוק: UNIT.DRINK_CAN,
  בקבוקים: UNIT.DRINK_CAN,
};

/**
 * Per-food gram tables for kitchen units. Matched by Hebrew/English
 * substrings against the (lower-cased) display name. First match wins, so
 * keep more specific keys before generic ones inside each list.
 */
const TBSP_FOOD_OVERRIDES = [
  { match: /טחינה|tahini/i, grams: 15 },
  { match: /חמאת\s*בוטנים|peanut\s*butter|נוטלה|nutella/i, grams: 16 },
  { match: /חמאה|butter|מרגרינ/i, grams: 14 },
  { match: /שמן|oil/i, grams: 14 },
  { match: /דבש|honey|סילאן|מייפל|maple|סירופ|syrup|ריבה|jam/i, grams: 21 },
  { match: /חומוס|hummus/i, grams: 15 },
  { match: /קוטג|cottage|לבנה|ריקוטה|ricotta/i, grams: 15 },
  { match: /שמנת|cream/i, grams: 15 },
  { match: /סוכר|sugar/i, grams: 12 },
  { match: /קמח|flour/i, grams: 8 },
  { match: /אבקת\s*חלבון|protein\s*powder|whey/i, grams: 8 },
  { match: /קקאו|cocoa/i, grams: 7 },
  { match: /אורז|rice/i, grams: 25 },
  { match: /פסטה|pasta|ספגטי/i, grams: 25 },
  { match: /יוגורט|yogurt|skyr/i, grams: 15 },
  { match: /שקדים|almonds|אגוז|walnut|cashew|peanut|בוטנ|פיסטוק|זרעים|seeds|גרעינ/i, grams: 9 },
];

const TSP_FOOD_OVERRIDES = [
  { match: /שמן|oil/i, grams: 5 },
  { match: /חמאה|butter/i, grams: 5 },
  { match: /סוכר|sugar/i, grams: 4 },
  { match: /מלח|salt|פלפל|תבלין|spice/i, grams: 3 },
  { match: /דבש|honey|סילאן|ריבה|jam|מייפל|maple/i, grams: 7 },
  { match: /אבקת\s*חלבון|protein\s*powder|whey/i, grams: 3 },
];

const HANDFUL_FOOD_OVERRIDES = [
  { match: /שקדים|almonds/i, grams: 30 },
  { match: /אגוז|walnut/i, grams: 28 },
  { match: /קשיו|cashew/i, grams: 30 },
  { match: /פיסטוק|pistachio/i, grams: 28 },
  { match: /בוטנ|peanut/i, grams: 30 },
  { match: /פקאן|pecan/i, grams: 28 },
  { match: /זית|olive/i, grams: 30 },
  { match: /צימוק|raisin|תמר|date|חמוציות|cranberr/i, grams: 30 },
  { match: /גרעינ|seed/i, grams: 28 },
  { match: /תות|פטל|אוכמני|דובדבן|ענב|בלוברי|berry|cherr|grape/i, grams: 60 },
];

const CUP_FOOD_OVERRIDES = [
  // liquids (~density ≈ 1 g/mL) — Israeli cup ~240 mL
  { match: /(^|\s)מים($|\s)|^water$/i, grams: 240 },
  { match: /חלב|milk/i, grams: 245 },
  { match: /קפה|coffee/i, grams: 240 },
  { match: /תה|tea/i, grams: 240 },
  { match: /מיץ|juice|נקטר|nectar/i, grams: 245 },
  { match: /שייק|smoothie|shake/i, grams: 245 },
  { match: /יין|wine/i, grams: 150 },
  { match: /בירה|beer/i, grams: 240 },
  { match: /סודה|cola|soft\s*drink|soda/i, grams: 240 },
  { match: /יוגורט|yogurt|skyr/i, grams: 245 },
  // dense cooked solids — measuring cup of cooked grains
  { match: /אורז|rice/i, grams: 158 },
  { match: /פסטה|pasta|ספגטי/i, grams: 140 },
  { match: /קינואה|quinoa/i, grams: 185 },
  { match: /שיבולת\s*שועל|oats|oatmeal|דייסה/i, grams: 234 },
  { match: /עדש|lentil/i, grams: 200 },
  { match: /שעועית|beans|chickpea|חומוס(?!ית)/i, grams: 175 },
  // dry / loose solids
  { match: /קמח|flour/i, grams: 125 },
  { match: /סוכר|sugar/i, grams: 200 },
  { match: /גרנולה|granola|cereal|דגנים/i, grams: 110 },
  // produce
  { match: /תות|פטל|אוכמני|ענב|דובדבן|berry|cherr|grape/i, grams: 150 },
  { match: /סלט|salad|חסה|lettuce|תרד|spinach|ירק/i, grams: 60 },
];

const CAN_FOOD_OVERRIDES = [
  { match: /טונה|tuna/i, grams: 140 },
  { match: /סרדינ|sardine/i, grams: 95 },
  { match: /חומוס|hummus/i, grams: 240 },
  { match: /תירס|corn/i, grams: 285 },
  { match: /שעועית|beans|chickpea/i, grams: 240 },
  { match: /זית|olive/i, grams: 200 },
];

const DRINK_CAN_FOOD_OVERRIDES = [
  { match: /בירה|beer/i, grams: 330 },
  { match: /יין|wine/i, grams: 750 },
  { match: /מים|water/i, grams: 500 },
];

function matchOverride(table, name, fallback) {
  for (const row of table) {
    if (row.match.test(name)) return row.grams;
  }
  return fallback;
}

/**
 * Per-unit defaults when nothing in the override table matches.
 * Tuned to "small spoonful" / "small handful" rather than to a packaging unit
 * so an unknown food doesn't blow up the calorie count.
 */
const KITCHEN_UNIT_DEFAULT_GRAMS = {
  [UNIT.TBSP]: 15,
  [UNIT.TSP]: 5,
  [UNIT.HANDFUL]: 30,
  [UNIT.CUP]: 240,
  [UNIT.CAN]: 200,
  [UNIT.DRINK_CAN]: 330,
};

function estimateKitchenUnitGrams(unitKey, foodNameLower) {
  switch (unitKey) {
    case UNIT.TBSP:
      return matchOverride(TBSP_FOOD_OVERRIDES, foodNameLower, KITCHEN_UNIT_DEFAULT_GRAMS[UNIT.TBSP]);
    case UNIT.TSP:
      return matchOverride(TSP_FOOD_OVERRIDES, foodNameLower, KITCHEN_UNIT_DEFAULT_GRAMS[UNIT.TSP]);
    case UNIT.HANDFUL:
      return matchOverride(HANDFUL_FOOD_OVERRIDES, foodNameLower, KITCHEN_UNIT_DEFAULT_GRAMS[UNIT.HANDFUL]);
    case UNIT.CUP:
      return matchOverride(CUP_FOOD_OVERRIDES, foodNameLower, KITCHEN_UNIT_DEFAULT_GRAMS[UNIT.CUP]);
    case UNIT.CAN:
      return matchOverride(CAN_FOOD_OVERRIDES, foodNameLower, KITCHEN_UNIT_DEFAULT_GRAMS[UNIT.CAN]);
    case UNIT.DRINK_CAN:
      return matchOverride(DRINK_CAN_FOOD_OVERRIDES, foodNameLower, KITCHEN_UNIT_DEFAULT_GRAMS[UNIT.DRINK_CAN]);
    default:
      return null;
  }
}

/**
 * Per-food sanity floors for the `gram` branch.
 *
 * The trap: Gemini sometimes returns `{quantity:1, unit:"gram"}` for a bare
 * food name like "פיתה" when the user gave no quantity. Without this floor
 * the user sees a "פיתה · 1g · 3 קל" log. For every food family where a
 * "typical unit" weight is well-known, treat anything below `floor` as a
 * hallucinated micro-portion and replace it with the typical weight. The
 * confirm card then opens (because we emit `gram_floored`) so the user can
 * still edit before saving.
 */
const FLOOR_RULES = [
  { match: /פיתה|pita/i, floor: 30, typical: 60 },
  { match: /לחמני|sandwich\s*roll|\broll\b/i, floor: 40, typical: 80 },
  { match: /באגט|baguette/i, floor: 60, typical: 200 },
  { match: /סנדוויץ|סנדויץ|כריך/i, floor: 80, typical: 200 },
  { match: /טוסט/i, floor: 40, typical: 90 },
  { match: /פיצה|pizza/i, floor: 60, typical: 120 },
  { match: /המבורגר|hamburger|burger/i, floor: 60, typical: 180 },
  { match: /סטייק|אנטריקוט|steak|ribeye|פילה/i, floor: 80, typical: 200 },
  { match: /שניצל|schnitzel/i, floor: 60, typical: 150 },
  { match: /חזה\s*עוף|chicken\s*breast/i, floor: 60, typical: 150 },
  { match: /חזה\s*הודו|turkey\s*breast/i, floor: 50, typical: 130 },
  { match: /קציצ|מיטבול|meatball/i, floor: 50, typical: 130 },
  { match: /קבב|כיפתל/i, floor: 60, typical: 150 },
  { match: /שווארמ|shawarma/i, floor: 80, typical: 200 },
  { match: /ביצה|ביצים|egg/i, floor: 30, typical: 50 },
  { match: /חביתה|אומלט|omelet/i, floor: 60, typical: 110 },
  { match: /שקשוק|shakshuka/i, floor: 120, typical: 250 },
  { match: /בננה|banana/i, floor: 60, typical: 120 },
  { match: /תפוח(?!\s*אדמה)|apple/i, floor: 80, typical: 180 },
  { match: /תפוז|orange|אשכולית|grapefruit/i, floor: 70, typical: 150 },
  { match: /אגס|pear/i, floor: 60, typical: 170 },
  { match: /אבוקדו|avocado/i, floor: 50, typical: 150 },
  { match: /בטטה|sweet\s*potato/i, floor: 80, typical: 200 },
  { match: /תפו(ח|חי)\s*אדמה|potato/i, floor: 60, typical: 170 },
  { match: /פלאפל|falafel/i, floor: 30, typical: 60 },
  { match: /סלט|salad/i, floor: 80, typical: 200 },
  { match: /מרק|soup/i, floor: 120, typical: 300 },
  { match: /גלידה|ice\s*cream|ארטיק/i, floor: 40, typical: 90 },
  { match: /יוגורט|yogurt|skyr/i, floor: 80, typical: 150 },
  { match: /קוטג|cottage/i, floor: 60, typical: 150 },
  { match: /אורז|rice/i, floor: 60, typical: 150 },
  { match: /פסטה|pasta|ספגטי/i, floor: 70, typical: 180 },
  { match: /קינואה|quinoa/i, floor: 60, typical: 150 },
  { match: /צ['׳]?יפס|fries/i, floor: 50, typical: 150 },
  { match: /קרואסון|croissant/i, floor: 30, typical: 60 },
  { match: /בורקס/i, floor: 50, typical: 120 },
  { match: /חטיף\s*חלבון|protein\s*bar|חטיף\s*אנרגיה|energy\s*bar/i, floor: 25, typical: 60 },
  { match: /סושי|sushi/i, floor: 60, typical: 200 },
];

function applyFoodGramFloor(foodName, grams) {
  const lower = String(foodName || '').toLowerCase();
  for (const r of FLOOR_RULES) {
    if (r.match.test(lower) && grams < r.floor) {
      return {
        grams: r.typical,
        note: `הותאם ל-${r.typical} גרם (מינ׳ סביר עבור "${foodName}")`,
      };
    }
  }
  return null;
}

function kitchenUnitHeNoun(unitKey) {
  switch (unitKey) {
    case UNIT.TBSP:
      return 'כף';
    case UNIT.TSP:
      return 'כפית';
    case UNIT.HANDFUL:
      return 'חופן';
    case UNIT.CUP:
      return 'כוס';
    case UNIT.CAN:
      return 'קופסה';
    case UNIT.DRINK_CAN:
      return 'פחית';
    default:
      return 'יחידה';
  }
}

/**
 * @param {{ name?: string, grams?: number, quantity?: number, unit?: string }} raw
 * @returns {{ grams: number, quantityUnit?: string, normalizedNote?: string, normalizedFrom?: string }}
 */
export function normalizeExtractorItem(raw) {
  const name = String(raw?.name ?? '').trim() || 'מזון';
  const he = name.toLowerCase();

  // Legacy Gemini / old chats
  if (
    raw?.grams != null &&
    Number.isFinite(Number(raw.grams)) &&
    !(raw.quantity != null)
  ) {
    const g = Number(raw.grams);
    return {
      grams: Math.max(1, Math.round(g)),
      normalizedFrom: 'legacy_grams',
    };
  }

  let quantity = Number(raw?.quantity);
  const unitRaw = String(raw?.unit ?? UNIT.GRAM).toLowerCase().trim();
  let unitNorm = unitRaw;
  if (unitRaw === 'g' || unitRaw === 'grams' || unitRaw === 'גרם') unitNorm = UNIT.GRAM;

  if (!Number.isFinite(quantity) || quantity <= 0) quantity = 1;

  if (unitNorm === UNIT.GRAM || unitNorm === 'gram') {
    const rawGrams = Math.max(1, Math.round(quantity));
    const floored = applyFoodGramFloor(name, rawGrams);
    if (floored) {
      return {
        grams: floored.grams,
        normalizedNote: floored.note,
        normalizedFrom: 'gram_floored',
      };
    }
    return {
      grams: rawGrams,
      normalizedFrom: 'gram',
    };
  }

  if (unitNorm === UNIT.UNIT || unitNorm === 'unit' || unitNorm === 'יחידה') {
    for (const [key, grams] of Object.entries(DEFAULT_UNIT_GRAMS)) {
      if (he.includes(key)) {
        const g = Math.round(quantity * grams);
        return {
          grams: Math.max(1, g),
          quantityUnit: 'unit',
          normalizedNote: `יחידת מפתח "${key}" ≈ ${grams} גרם`,
          normalizedFrom: 'unit_estimate',
        };
      }
    }
    const g = Math.round(quantity * 150);
    return {
      grams: Math.max(1, g),
      quantityUnit: 'unit',
      normalizedNote: 'יחידת מזון משוערת ~150 גרם (כללי)',
      normalizedFrom: 'unit_default',
    };
  }

  if (
    unitNorm === UNIT.SLICE ||
    unitNorm === 'slice' ||
    unitNorm === 'פרוסה' ||
    unitNorm === 'פרוסות'
  ) {
    let per = 35;
    for (const [key, grams] of Object.entries(DEFAULT_SLICE_GRAMS)) {
      if (he.includes(key.toLowerCase())) {
        per = grams;
        break;
      }
    }
    const g = Math.round(quantity * per);
    return {
      grams: Math.max(1, g),
      quantityUnit: 'slice',
      normalizedNote: `פרוסה משוערת ~${per} גרם`,
      normalizedFrom: 'slice_estimate',
    };
  }

  if (
    unitNorm === UNIT.PORTION ||
    unitNorm === 'portion' ||
    unitNorm === 'מנה' ||
    unitNorm === 'מנות'
  ) {
    const g = Math.round(quantity * 200);
    return {
      grams: Math.max(80, g),
      normalizedNote: 'מנה כללית משוערת (~200 גרם)',
      normalizedFrom: 'portion_estimate',
    };
  }

  // Hebrew/English kitchen units — must run before the unknown_unit fallback.
  const kitchenKey = KITCHEN_UNIT_ALIASES[unitNorm];
  if (kitchenKey) {
    const perUnit = estimateKitchenUnitGrams(kitchenKey, he);
    const grams = Math.max(1, Math.round(quantity * perUnit));
    const noun = kitchenUnitHeNoun(kitchenKey);
    return {
      grams,
      quantityUnit: kitchenKey,
      normalizedNote: `${noun} ≈ ${perUnit} גרם`,
      normalizedFrom: `kitchen_${kitchenKey}`,
    };
  }

  const gFallback = Math.round(quantity * 120);
  return {
    grams: Math.max(1, gFallback),
    normalizedNote: 'יחידה לא מוכרת — משועך ל-quantity×120 גרם',
    normalizedFrom: 'unknown_unit',
  };
}
