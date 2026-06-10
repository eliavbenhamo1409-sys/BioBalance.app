/**
 * Example portion hints for the quantity card UI (gramsPerUnit, titles).
 * NOT the gate — `quantityPromptRules.js` + AI `quantity_uncertain` decide when to ask.
 */

const AMBIGUOUS_COUNTABLE = [
  // ── Pizza / pasta bakes ──
  { key: 'פיצה', unitSingular: 'משולש', unitPlural: 'משולשים', gramsPerUnit: 120 },
  { key: 'לזניה', unitSingular: 'פרוסה', unitPlural: 'פרוסות', gramsPerUnit: 150 },

  // ── Sushi / Asian dumplings ──
  { key: 'סושי', unitSingular: 'חתיכה', unitPlural: 'חתיכות', gramsPerUnit: 30 },
  { key: 'דים סום', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 20 },
  { key: 'גיוזה', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 20 },
  { key: 'רביולי', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 12 },
  { key: 'אגרול', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 60 },
  { key: 'סמבוס', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 60 },

  // ── Israeli street / savory ──
  { key: 'פלאפל', unitSingular: 'כדור', unitPlural: 'כדורים', gramsPerUnit: 25 },
  { key: 'עראיס', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 90 },
  { key: 'גירוס', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 250 },
  { key: 'שווארמה', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 250, defaultMode: 'gram', promptTitle: 'כמה שווארמה אכלת?' },

  // ── Proteins / cuts (count is fuzzy → grams is the natural answer) ──
  { key: 'חזה עוף', unitSingular: 'חתיכה', unitPlural: 'חתיכות', gramsPerUnit: 150, defaultMode: 'gram', promptTitle: 'כמה חזה עוף אכלת?' },
  { key: 'חזה הודו', unitSingular: 'פרוסה', unitPlural: 'פרוסות', gramsPerUnit: 25, defaultMode: 'gram', promptTitle: 'כמה חזה הודו אכלת?' },
  { key: 'פרגיות', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 120 },
  { key: 'פרגית', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 120 },
  { key: 'שוקיים', unitSingular: 'שוק', unitPlural: 'שוקיים', gramsPerUnit: 90, promptTitle: 'כמה שוקיים אכלת?' },
  { key: 'אנטריקוט', unitSingular: 'סטייק', unitPlural: 'סטייקים', gramsPerUnit: 220, defaultMode: 'gram' },
  { key: 'סינטה', unitSingular: 'סטייק', unitPlural: 'סטייקים', gramsPerUnit: 220, defaultMode: 'gram' },
  { key: 'סטייק', unitSingular: 'סטייק', unitPlural: 'סטייקים', gramsPerUnit: 200, defaultMode: 'gram' },
  { key: 'שניצל', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 120 },
  { key: 'המבורגר', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 150 },
  { key: 'צ׳יזבורגר', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 170 },
  { key: 'צ׳יקנבורגר', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 160 },
  { key: 'כריך', unitSingular: 'כריך', unitPlural: 'כריכים', gramsPerUnit: 200 },
  { key: 'סנדוויץ', unitSingular: 'כריך', unitPlural: 'כריכים', gramsPerUnit: 200 },
  { key: 'באגט', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 250 },
  { key: 'סלמון', unitSingular: 'פילה', unitPlural: 'פילטים', gramsPerUnit: 150, defaultMode: 'gram', promptTitle: 'כמה סלמון אכלת?' },
  { key: 'דניס', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 250, defaultMode: 'gram' },
  { key: 'אמנון', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 250, defaultMode: 'gram' },
  { key: 'פילה דג', unitSingular: 'פילה', unitPlural: 'פילטים', gramsPerUnit: 150, defaultMode: 'gram' },
  { key: 'טונה', unitSingular: 'קופסה', unitPlural: 'קופסאות', gramsPerUnit: 80, promptTitle: 'כמה טונה אכלת?' },
  { key: 'פסטרמה', unitSingular: 'פרוסה', unitPlural: 'פרוסות', gramsPerUnit: 15, promptTitle: 'כמה פסטרמה אכלת?' },
  { key: 'טופו', unitSingular: 'קוביה', unitPlural: 'קוביות', gramsPerUnit: 25, defaultMode: 'gram' },

  // ── Eggs (count = eggs, not portions) ──
  { key: 'חבית', unitSingular: 'ביצה', unitPlural: 'ביצים', gramsPerUnit: 55, promptTitle: 'מכמה ביצים בחביתה?' },
  { key: 'אומלט', unitSingular: 'ביצה', unitPlural: 'ביצים', gramsPerUnit: 55, promptTitle: 'מכמה ביצים באומלט?' },
  { key: 'שקשוק', unitSingular: 'ביצה', unitPlural: 'ביצים', gramsPerUnit: 80, promptTitle: 'מכמה ביצים בשקשוקה?' },

  // ── Meatballs / skewers / wings ──
  { key: 'כדורי בשר', unitSingular: 'כדור', unitPlural: 'כדורים', gramsPerUnit: 30 },
  { key: 'מיטבול', unitSingular: 'כדור', unitPlural: 'כדורים', gramsPerUnit: 30, promptTitle: 'כמה כדורי בשר?' },
  { key: 'קציצות', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 60 },
  { key: 'קציצה', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 60 },
  { key: 'קבב', unitSingular: 'שיפוד', unitPlural: 'שיפודים', gramsPerUnit: 80 },
  { key: 'נקניקיות', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 50 },
  { key: 'נקניקיה', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 50 },
  { key: 'כנפיים', unitSingular: 'כנף', unitPlural: 'כנפיים', gramsPerUnit: 50, promptTitle: 'כמה כנפיים?' },
  { key: 'נגיס', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 40 },
  { key: 'שניצלוני', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 40 },
  { key: 'חסילון', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 15 },
  { key: 'שרימפ', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 15 },

  // ── Stuffed vegetables ──
  { key: 'פלפל ממולא', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 150 },
  { key: 'חציל ממולא', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 130 },
  { key: 'גפילט', unitSingular: 'פרוסה', unitPlural: 'פרוסות', gramsPerUnit: 50 },

  // ── Bakery / burekas ──
  { key: 'בורקס', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 80 },
  { key: 'מאפינ', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 90 },
  { key: 'קרואסון', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 70 },
  { key: 'מאפה', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 75 },
  { key: 'רוגלה', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 35 },
  { key: 'חמציץ', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 45 },

  // ── Salads / bowls / plates (portion varies → ask grams) ──
  { key: 'סלט ירקות', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 200, defaultMode: 'gram', gramOnly: true, promptTitle: 'כמה גרם סלט?' },
  { key: 'סלט עוף', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 250, defaultMode: 'gram', gramOnly: true, promptTitle: 'כמה גרם סלט?' },
  { key: 'סלט טונה', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 220, defaultMode: 'gram', gramOnly: true, promptTitle: 'כמה גרם סלט?' },
  { key: 'סלט', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 200, defaultMode: 'gram', gramOnly: true, promptTitle: 'כמה גרם סלט?' },
  { key: 'טאבולה', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 180, defaultMode: 'gram', gramOnly: true, promptTitle: 'כמה טאבולה?' },
  { key: 'מרק', unitSingular: 'קערה', unitPlural: 'קערות', gramsPerUnit: 250, defaultMode: 'gram', gramOnly: true, promptTitle: 'כמה מרק? (גרם)' },
  { key: 'תבשיל', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 250, defaultMode: 'gram', gramOnly: true, promptTitle: 'כמה תבשיל? (גרם)' },
  { key: 'חומוס', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 150, defaultMode: 'gram', promptTitle: 'כמה חומוס אכלת?' },
  { key: 'מוקפץ', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 200, defaultMode: 'gram', gramOnly: true, promptTitle: 'כמה מוקפץ? (גרם)' },
  { key: 'ריזוטו', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 220, defaultMode: 'gram', gramOnly: true, promptTitle: 'כמה ריזוטו? (גרם)' },
  { key: 'קערת', unitSingular: 'קערה', unitPlural: 'קערות', gramsPerUnit: 300, defaultMode: 'gram', gramOnly: true, promptTitle: 'כמה בקערה? (גרם)' },

  // ── Carbs / staples (grams natural) ──
  { key: 'אורז', unitSingular: 'כוס', unitPlural: 'כוסות', gramsPerUnit: 160, defaultMode: 'gram', promptTitle: 'כמה אורז אכלת?' },
  { key: 'פסטה', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 200, defaultMode: 'gram', promptTitle: 'כמה פסטה אכלת?' },
  { key: 'קינואה', unitSingular: 'כוס', unitPlural: 'כוסות', gramsPerUnit: 180, defaultMode: 'gram' },
  { key: 'בורגול', unitSingular: 'כוס', unitPlural: 'כוסות', gramsPerUnit: 180, defaultMode: 'gram' },
  { key: 'קוסקוס', unitSingular: 'כוס', unitPlural: 'כוסות', gramsPerUnit: 170, defaultMode: 'gram' },
  { key: 'נודלס', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 200, defaultMode: 'gram' },
  { key: 'צ׳יפס', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 150, defaultMode: 'gram', promptTitle: 'כמה צ׳יפס?' },
  { key: 'פירה', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 200, defaultMode: 'gram' },

  // ── Cookies / cakes / sweets ──
  { key: 'עוגייה', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 30 },
  { key: 'עוגיות', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 30 },
  { key: 'עוגת', unitSingular: 'פרוסה', unitPlural: 'פרוסות', gramsPerUnit: 90, promptTitle: 'כמה פרוסות עוגה?' },
  { key: 'טורט', unitSingular: 'פרוסה', unitPlural: 'פרוסות', gramsPerUnit: 100 },
  { key: 'כנאפה', unitSingular: 'פרוסה', unitPlural: 'פרוסות', gramsPerUnit: 100 },
  { key: 'קיש', unitSingular: 'פרוסה', unitPlural: 'פרוסות', gramsPerUnit: 100 },
  { key: 'סופגנייה', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 70 },
  { key: 'דונאט', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 80 },
  { key: 'מקרון', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 20 },
  { key: 'שוקולד', unitSingular: 'קוביה', unitPlural: 'קוביות', gramsPerUnit: 5 },

  // ── Breakfast / crepes ──
  { key: 'פנקייק', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 50 },
  { key: 'וופל', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 80 },
  { key: 'בלינצ׳ס', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 60 },
  { key: 'בלינץ', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 60 },
  { key: 'גרנולה', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 50, defaultMode: 'gram', promptTitle: 'כמה גרנולה אכלת?' },

  // ── Bread slices (not whole pita / roll) ──
  { key: 'לחם', unitSingular: 'פרוסה', unitPlural: 'פרוסות', gramsPerUnit: 32 },
  { key: 'חלה', unitSingular: 'פרוסה', unitPlural: 'פרוסות', gramsPerUnit: 40 },
  { key: 'טוסט', unitSingular: 'פרוסה', unitPlural: 'פרוסות', gramsPerUnit: 35 },
  { key: 'פריכי', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 7, promptTitle: 'כמה פריכיות?' },
  { key: 'סלמי', unitSingular: 'פרוסה', unitPlural: 'פרוסות', gramsPerUnit: 12 },

  // ── Cheeses (count fuzzy) ──
  { key: 'קוטג', unitSingular: 'גביע', unitPlural: 'גביעים', gramsPerUnit: 250, defaultMode: 'gram', promptTitle: 'כמה קוטג׳ אכלת?' },
  { key: 'יוגורט', unitSingular: 'גביע', unitPlural: 'גביעים', gramsPerUnit: 150, defaultMode: 'gram', promptTitle: 'כמה יוגורט אכלת?' },
  { key: 'גבינה צהובה', unitSingular: 'פרוסה', unitPlural: 'פרוסות', gramsPerUnit: 25, promptTitle: 'כמה פרוסות גבינה?' },
  { key: 'גבינה לבנה', unitSingular: 'מנה', unitPlural: 'מנות', gramsPerUnit: 50, defaultMode: 'gram' },

  // ── Nuts / seeds (handful is vague, grams better) ──
  { key: 'שקדים', unitSingular: 'חופן', unitPlural: 'חופנים', gramsPerUnit: 30, defaultMode: 'gram', promptTitle: 'כמה שקדים אכלת?' },
  { key: 'אגוזים', unitSingular: 'חופן', unitPlural: 'חופנים', gramsPerUnit: 30, defaultMode: 'gram', promptTitle: 'כמה אגוזים אכלת?' },
  { key: 'פיסטוק', unitSingular: 'חופן', unitPlural: 'חופנים', gramsPerUnit: 30, defaultMode: 'gram' },
  { key: 'בוטנים', unitSingular: 'חופן', unitPlural: 'חופנים', gramsPerUnit: 30, defaultMode: 'gram' },
  { key: 'קשיו', unitSingular: 'חופן', unitPlural: 'חופנים', gramsPerUnit: 30, defaultMode: 'gram' },
  { key: 'גרעיני', unitSingular: 'חופן', unitPlural: 'חופנים', gramsPerUnit: 30, defaultMode: 'gram', promptTitle: 'כמה גרעינים?' },

  // ── Ice cream (scoops — count; NOT single popsicles) ──
  { key: 'גלידה', unitSingular: 'כדור', unitPlural: 'כדורים', gramsPerUnit: 50 },

  // ── Misc countable ──
  { key: 'טאקו', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 100 },
  { key: 'תמר', unitSingular: 'תמר', unitPlural: 'תמרים', gramsPerUnit: 24 },
  { key: 'זית', unitSingular: 'זית', unitPlural: 'זיתים', gramsPerUnit: 4 },
  { key: 'כדורי', unitSingular: 'כדור', unitPlural: 'כדורים', gramsPerUnit: 30 },
  { key: 'ענב', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 5, promptTitle: 'כמה ענבים בערך?' },
  { key: 'דובדב', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 8, promptTitle: 'כמה דובדבנים?' },
  { key: 'תות', unitSingular: 'יחידה', unitPlural: 'יחידות', gramsPerUnit: 12, promptTitle: 'כמה תותים?' },
];

/** Longest key first so multi-word keys (e.g. "חזה עוף") win over substrings ("עוף"). */
const SORTED = [...AMBIGUOUS_COUNTABLE].sort((a, b) => b.key.length - a.key.length);

/**
 * Foods/drinks where 1 = the natural portion — never show the quantity card.
 * (Cappuccino, ice pop, whole pita, single fruit, water, etc.)
 */
const NEVER_PROMPT_KEYS = [
  'קפוצינו',
  'קפה',
  'לאטה',
  'מקיאטו',
  'אספרסו',
  'ארטיק',
  'גלידונית',
  'מים',
  'תה',
  'מיץ',
  'שייק',
  'בננה',
  'תפוח',
  'אגס',
  'תפוז',
  'פיתה',
  'לאפה',
  'לחמניה',
  'ביסלי',
  'במבה',
  'חטיף',
];

function isNaturalSinglePortion(foodName) {
  const lower = String(foodName ?? '').toLowerCase().trim();
  if (!lower) return false;

  for (const k of NEVER_PROMPT_KEYS) {
    if (!lower.includes(k)) continue;
    // Allow "סלט בפיתה" style — salad is the main dish, pita is vessel
    if ((k === 'פיתה' || k === 'לאפה') && /סלט|חומוס|כריך|סנדוויץ|שווארמה/.test(lower)) {
      continue;
    }
    // Block only when the name is essentially this single item (not "עוגת קפה")
    if (k === 'קפה' && /עוג/i.test(lower)) continue;
    return true;
  }
  return false;
}

export function findAmbiguousCountable(foodName) {
  if (!foodName) return null;
  const lower = String(foodName).toLowerCase();

  if (isNaturalSinglePortion(lower)) return null;

  for (const entry of SORTED) {
    if (!lower.includes(entry.key)) continue;
    if (entry.key === 'לחם' && /לחמניה/.test(lower)) continue;
    if (entry.key === 'עוגת' && /עוגיי?ה/.test(lower)) continue;
    if (entry.key === 'תות' && /תות\s*שחור|תות\s*עץ|תות\s*שדה/.test(lower)) continue;
    if (entry.key === 'נגיס' && /נגיסי\s*דג|fish\s*stick/.test(lower)) continue;
    return entry;
  }
  return null;
}

export { AMBIGUOUS_COUNTABLE, NEVER_PROMPT_KEYS };
