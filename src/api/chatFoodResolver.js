import { searchFoodWithScores } from './usdaApi';
import { validateKcalPer100 } from './nutritionValidation';
import { normalizeExtractorItem } from './foodQuantityNormalize';

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
  לחם: 'bread white',
  פיתה: 'pita bread',
  בטטה: 'sweet potato baked',
  'תפוח אדמה': 'potato boiled',
  'שיבולת שועל': 'oats',
  עוף: 'chicken breast cooked',
  'חזה עוף': 'chicken breast cooked',
  טונה: 'tuna canned',
  סלמון: 'salmon cooked',
  ביצה: 'egg whole cooked',
  ביצים: 'eggs whole cooked',
  קוטג: 'cottage cheese',
  יוגורט: 'yogurt greek plain',
  חומוס: 'hummus',
  אבוקדו: 'avocado raw',
  שקדים: 'almonds',
  אגוזים: 'walnuts',
  'אגוזי מלך': 'walnuts',
  טחינה: 'tahini',
  'חמאת בוטנים': 'peanut butter',
  בננה: 'banana raw',
  תפוח: 'apple raw',
  תפוז: 'orange raw',
  עגבנייה: 'tomato raw',
  מלפפון: 'cucumber raw',
  גזר: 'carrot raw',
  גבינה: 'cheese cheddar',
  'גבינה צהובה': 'cheese cheddar',
  חלב: 'milk whole',
  סטייק: 'beef steak cooked',
  בקר: 'beef cooked',
  'חטיף חלבון': 'protein bar',
  'שייק חלבון': 'protein shake',
  קינואה: 'quinoa cooked',
  עדשים: 'lentils cooked',
  טופו: 'tofu firm',
  גרנולה: 'granola',
  חלבון: 'whey protein',
  ברוקולי: 'broccoli cooked',
  תרד: 'spinach raw',
  כרוב: 'cabbage raw',
  פלפל: 'bell pepper',
  חציל: 'eggplant cooked',
  זוקיני: 'zucchini cooked',
  פטריות: 'mushrooms',
  תמנון: 'octopus cooked',
  שרימפס: 'shrimp cooked',
  קלמרי: 'squid cooked',
};

const FALLBACK_HEBREW = {
  סטייק: { kcal100: 250, protein100: 26, fat100: 17, carbs100: 0, en: 'beef steak (estimate)' },
  בשר: { kcal100: 250, protein100: 26, fat100: 17, carbs100: 0, en: 'beef (estimate)' },
  סלמון: { kcal100: 208, protein100: 20, fat100: 13, carbs100: 0, en: 'salmon (estimate)' },
  תפוח: { kcal100: 52, protein100: 0.3, fat100: 0.2, carbs100: 14, en: 'apple (estimate)' },
  בננה: { kcal100: 89, protein100: 1.1, fat100: 0.3, carbs100: 23, en: 'banana (estimate)' },
  לחם: { kcal100: 265, protein100: 9, fat100: 3.2, carbs100: 49, en: 'white bread (estimate)' },
  פסטה: { kcal100: 131, protein100: 5, fat100: 1, carbs100: 25, en: 'pasta cooked (estimate)' },
  עוף: { kcal100: 165, protein100: 31, fat100: 3.6, carbs100: 0, en: 'chicken breast (estimate)' },
  'חזה עוף': { kcal100: 165, protein100: 31, fat100: 3.6, carbs100: 0, en: 'chicken breast (estimate)' },
  'חטיף חלבון': { kcal100: 380, protein100: 30, fat100: 12, carbs100: 35, en: 'protein bar (estimate)' },
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
 * Try ranked USDA hits; then explicit fallback table (marked estimate). No silent bad USDA row.
 */
async function resolveOneFoodItem(displayName, grams, signal) {
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

  return {
    kind: 'clarify',
    name: displayName.trim(),
    question: `לא הצלחתי לקשר בעקביות את "${displayName}" למקור מהימן. מה בדיוק אכלת (סוג ומשקל בגרם)?`,
  };
}

async function lookupFirstValidated(name) {
  const scored = await searchFoodWithScores(
    resolveEnglishQueryFromHebrewDisplayName(name) || name
  );
  if (!scored?.length) return null;
  for (const cand of scored) {
    if (validateKcalPer100(name, cand.name, cand.calories).ok) return cand;
  }
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

    const outcome = await resolveOneFoodItem(name, grams, signal);
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
