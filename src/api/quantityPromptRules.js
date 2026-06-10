/**
 * Rule engine for "how much did you eat?" prompts.
 * The AI applies these rules and sets `quantity_uncertain` on each food.
 * Client-side rules are a safety net — not a hardcoded food whitelist.
 *
 * `ambiguousCountableFoods.js` supplies UI hints (gramsPerUnit, titles) as examples only.
 */

import { findAmbiguousCountable, NEVER_PROMPT_KEYS } from './ambiguousCountableFoods';

// ── Category rules (patterns, not exhaustive lists) ─────────────────────────

/** One natural unit — never show quantity card. */
const FIXED_SINGLE_PATTERNS = [
  /^(?:שתיתי\s+|שתה\s+|אכלתי\s+|אכל\s+)?(?:קפוצינו|לאטה|מקיאטו|אספרסו|קפה(?:\s|$))/i,
  /^(?:שתיתי\s+|שתה\s+)?(?:מים|תה|מיץ|שייק)(?:\s|$)/i,
  /^(?:אכלתי\s+|אכל\s+)?(?:ארטיק|גלידונית|ביסלי|במבה)(?:\s|$)/i,
  /^(?:אכלתי\s+|אכל\s+)?(?:פיתה|לאפה|לחמניה)(?:\s|$)/i,
  /^(?:אכלתי\s+|אכל\s+)?(?:בננה|תפוח|אגס|תפוז|אבוקדו)(?:\s|$)/i,
];

/** Variable weight — grams is the natural answer. */
const WEIGHT_VARIABLE_RULES = [
  {
    id: 'salad_bowl',
    pattern: /סלט|טאבול|coleslaw|salad/i,
    gramOnly: true,
    gramsPerUnit: 200,
    promptTitle: 'כמה גרם סלט?',
    defaultMode: 'gram',
  },
  {
    id: 'soup_stew',
    pattern: /מרק|תבשיל|נזיד|מרקון|stew|soup/i,
    gramOnly: true,
    gramsPerUnit: 250,
    promptTitle: 'כמה גרם?',
    defaultMode: 'gram',
  },
  {
    id: 'protein_cut',
    pattern:
      /חזה|סטייק|פילה|שניצל|בשר|עוף|כבש|סלמון|דג|טונה|הודו|אנטריקוט|סינטה|פרגית|פרגיות|טופו|tofu|steak|salmon|chicken|turkey/i,
    defaultMode: 'gram',
    gramsPerUnit: 150,
    promptTitle: 'כמה גרם?',
  },
  {
    id: 'deli_sliced',
    pattern: /בייקון|bacon|פסטרמה|סלמי|נקניק|ham|prosciutto|mortadella|pastrami/i,
    unitSingular: 'פרוסה',
    unitPlural: 'פרוסות',
    gramsPerUnit: 15,
    promptTitle: 'כמה פרוסות?',
    defaultMode: 'unit',
  },
  {
    id: 'staple_carb',
    pattern: /^(?:אורז|פסטה|קינואה|בורגול|קוסקוס|נודלס|צ׳?יפס|פירה|rice|pasta|quinoa)/i,
    defaultMode: 'gram',
    gramsPerUnit: 200,
    promptTitle: 'כמה גרם?',
  },
  {
    id: 'bowl_meal',
    pattern: /חומוס|מוקפץ|ריזוטו|קער/i,
    defaultMode: 'gram',
    gramsPerUnit: 200,
    promptTitle: 'כמה גרם?',
  },
  {
    id: 'cheese_dairy',
    pattern: /קוטג|יוגורט|גבינה/i,
    defaultMode: 'gram',
    gramsPerUnit: 50,
    promptTitle: 'כמה אכלת?',
  },
  {
    id: 'nuts_seeds',
    pattern: /שקד|אגוז|פיסטוק|בוטן|קשיו|גרעין/i,
    defaultMode: 'gram',
    gramsPerUnit: 30,
    promptTitle: 'כמה גרם?',
  },
];

/** Countable units — slices, pieces, balls. */
const COUNTABLE_UNIT_RULES = [
  {
    id: 'pizza',
    pattern: /פיצה|pizza|לזניה|lasagna/i,
    unitSingular: 'משולש',
    unitPlural: 'משולשים',
    gramsPerUnit: 120,
    promptTitle: 'כמה משולשים?',
  },
  {
    id: 'sushi_asian',
    pattern: /סושי|דים\s*סום|גיוזה|רביולי|אגרול|sushi|dumpling/i,
    unitSingular: 'יחידה',
    unitPlural: 'יחידות',
    gramsPerUnit: 30,
  },
  {
    id: 'street_food',
    pattern: /פלאפל|עראיס|גירוס|שווארמה|falafel|shawarma/i,
    unitSingular: 'כדור',
    unitPlural: 'כדורים',
    gramsPerUnit: 25,
  },
  {
    id: 'sandwich',
    pattern: /כריך|סנדוויץ|המבורגר|באגט|sandwich|burger/i,
    unitSingular: 'יחידה',
    unitPlural: 'יחידות',
    gramsPerUnit: 180,
  },
  {
    id: 'eggs_dish',
    pattern: /חבית|אומלט|שקשוק|omelette|frittata/i,
    unitSingular: 'ביצה',
    unitPlural: 'ביצים',
    gramsPerUnit: 55,
    promptTitle: 'מכמה ביצים?',
  },
  {
    id: 'meatballs',
    pattern: /כדור\s*בשר|מיטבול|קציצ|קבב|כנף|כנפיים|meatball|wing/i,
    unitSingular: 'יחידה',
    unitPlural: 'יחידות',
    gramsPerUnit: 40,
  },
  {
    id: 'bakery',
    pattern: /בורקס|מאפינ|קרואסון|מאפה|רוגלה|עוגי/i,
    unitSingular: 'יחידה',
    unitPlural: 'יחידות',
    gramsPerUnit: 80,
  },
  {
    id: 'bread_slice',
    pattern: /^(?:פרוס(?:ת|ות)\s+)?(?:לחם|חלה|טוסט)|^לחם$|^חלה$|^טוסט$/i,
    unitSingular: 'פרוסה',
    unitPlural: 'פרוסות',
    gramsPerUnit: 35,
    promptTitle: 'כמה פרוסות?',
  },
  {
    id: 'cake_slice',
    pattern: /עוג(?:ת|ה)|טורט|כנאפה|קיש|cake/i,
    unitSingular: 'פרוסה',
    unitPlural: 'פרוסות',
    gramsPerUnit: 90,
    promptTitle: 'כמה פרוסות?',
  },
  {
    id: 'ice_cream_scoop',
    pattern: /גלידה(?!ונית)/i,
    unitSingular: 'כדור',
    unitPlural: 'כדורים',
    gramsPerUnit: 50,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizeFoodName(name) {
  return String(name ?? '').toLowerCase().trim();
}

function isNeverPromptFood(foodName) {
  const lower = normalizeFoodName(foodName);
  if (!lower) return false;

  for (const k of NEVER_PROMPT_KEYS) {
    if (!lower.includes(k)) continue;
    if ((k === 'פיתה' || k === 'לאפה') && /סלט|חומוס|כריך|סנדוויץ|שווארמה/.test(lower)) {
      continue;
    }
    if (k === 'קפה' && /עוג/i.test(lower)) continue;
    return true;
  }

  for (const pat of FIXED_SINGLE_PATTERNS) {
    if (pat.test(lower)) return true;
  }
  return false;
}

function findCategoryRule(foodName) {
  const lower = normalizeFoodName(foodName);
  if (!lower) return null;

  for (const rule of COUNTABLE_UNIT_RULES) {
    if (rule.pattern.test(lower)) return rule;
  }
  for (const rule of WEIGHT_VARIABLE_RULES) {
    if (rule.pattern.test(lower)) return rule;
  }
  return null;
}

function isMainFoodMention(originalText, foodName) {
  const text = String(originalText ?? '').toLowerCase();
  const name = normalizeFoodName(foodName);
  if (!name || !text.includes(name)) {
    const short = name.split(/\s+/)[0];
    if (!short || short.length < 3 || !text.includes(short)) return true;
  }

  const key = name.split(/\s+/)[0];
  const toppingMatch = text.match(
    new RegExp(`(?:עם|וב)\\s+([^,.]*?\\b${key}\\b[^,.]*)`, 'i'),
  );
  if (toppingMatch) {
    const beforeTopping = text.slice(0, toppingMatch.index);
    if (!new RegExp(`\\b${key}\\b`, 'i').test(beforeTopping)) {
      return false;
    }
  }
  return true;
}

function pickAiBool(food, ...keys) {
  for (const k of keys) {
    if (food[k] === true) return true;
    if (food[k] === false) return false;
  }
  return null;
}

function mergePromptMeta(food, categoryRule, exampleEntry) {
  const aiMode = food.prompt_mode || food.quantity_prompt_mode;
  const gramOnly = aiMode === 'gram_only' || categoryRule?.gramOnly || exampleEntry?.gramOnly || false;
  const defaultMode =
    aiMode === 'gram' || aiMode === 'gram_only' || gramOnly
      ? 'gram'
      : categoryRule?.defaultMode || exampleEntry?.defaultMode || 'unit';

  return {
    food,
    key: exampleEntry?.key || categoryRule?.id || food.name,
    promptTitle:
      food.quantity_prompt_title ||
      food.promptTitle ||
      categoryRule?.promptTitle ||
      exampleEntry?.promptTitle ||
      null,
    unitSingular:
      food.prompt_unit_singular ||
      categoryRule?.unitSingular ||
      exampleEntry?.unitSingular ||
      'יחידה',
    unitPlural:
      food.prompt_unit_plural ||
      categoryRule?.unitPlural ||
      exampleEntry?.unitPlural ||
      'יחידות',
    gramsPerUnit:
      Number(food.prompt_grams_per_unit) ||
      categoryRule?.gramsPerUnit ||
      exampleEntry?.gramsPerUnit ||
      50,
    defaultMode,
    gramOnly,
  };
}

/**
 * Decide if a food needs the quantity card and build card metadata.
 * Priority: AI flag → category rules → example table (UI hints only).
 */
export function resolveQuantityPromptMeta(food, originalText) {
  if (!food?.name) return null;
  if (!isMainFoodMention(originalText, food.name)) return null;
  if (isNeverPromptFood(food.name)) return null;

  const aiFlag = pickAiBool(food, 'quantity_uncertain', 'needs_quantity_prompt');
  const categoryRule = findCategoryRule(food.name);
  const exampleEntry = findAmbiguousCountable(food.name);

  if (aiFlag === false) return null;

  const shouldPrompt = aiFlag === true || !!categoryRule || !!exampleEntry;
  if (!shouldPrompt) return null;

  return mergePromptMeta(food, categoryRule, exampleEntry);
}

/**
 * Hebrew rules block injected into the Gemini system prompt.
 */
export function buildQuantityPromptRulesBlock() {
  return `
═══════════════════════════════════════
📏 כללי כמות — quantity_uncertain (חובה!)
═══════════════════════════════════════

לכל מאכל ב-foods, **חובה** שדה \`quantity_uncertain\` (true/false).
הלקוח מציג כרטיסיית כמות רק כש-\`quantity_uncertain: true\`.

**כלל A — FIXED_SINGLE (quantity_uncertain: false)**
יחידה אחת = המנה הטבעית. המשתמש לא ציין כמות → quantity:1, יחידה טבעית.
• משקאות: קפוצינו, קפה, לאטה, מקיאטו, מים, תה, מיץ, שייק
• אריזה/יחידה בודדת: ארטיק, גלידונית, ביסלי, במבה
• לחם שלם: פיתה, לאפה, לחמניה (לא פרוסות!)
• פרי שלם: בננה, תפוח, אגס, תפוז, אבוקדו

**כלל B — VARIABLE_WEIGHT (quantity_uncertain: true)**
המשקל/נפח משתנה מאוד — **חובה לשאול** אם אין מספר בהודעה.
• חתיכות בשר/עוף/דג: חזה עוף, סטייק, סלמון, בייקון, פסטרמה
• מנות ללא יחידה קבועה: סלט, מרק, תבשיל, אורז, פסטה, חומוס
• גבינות/יוגורט/אגוזים בלי מידה

**כלל C — COUNTABLE_UNITS (quantity_uncertain: true)**
נספר ביחידות — **חובה לשאול** אם אין מספר בהודעה.
• פיצה (משולשים), סושי, פלאפל, בורקס, פרוסות לחם/עוגה
• חביתה/שקשוקה (ביצים), כנפיים, קציצות

**כלל D — כמות מפורשת בהודעה → quantity_uncertain: false**
מספר, גרם, פרוסות, חופן, כף, מנה, "חצי", מספרים במילים → false.

**שדות אופציונליים לכרטיסייה** (כש-quantity_uncertain: true):
• \`prompt_unit_singular\` / \`prompt_unit_plural\` — יחידת מספר (למשל "פרוסה"/"פרוסות")
• \`prompt_grams_per_unit\` — הערכת גרם ליחידה (למשל בייקון: 15)
• \`prompt_mode\`: "unit" | "gram" | "gram_only"
• \`quantity_prompt_title\` — כותרת הכרטיס (למשל "כמה פרוסות בייקון?")

**response** כש-quantity_uncertain: true — כתוב בטון נייטרלי "רשמתי {שם}" **בלי** לפרט גרם/משולשים.
עדיין החזר quantity+unit כהערכת ברירת מחדל (למקרה שהמשתמש ידלג).

**דוגמאות (לא רשימה סגורה!):**
• "אכלתי בייקון" → quantity_uncertain: true, prompt_unit: פרוסה/פרוסות, prompt_grams_per_unit: 15
• "אכלתי פיצה" → quantity_uncertain: true, משולש/משולשים, ~120g
• "אכלתי סלט" → quantity_uncertain: true, prompt_mode: "gram_only"
• "שתיתי קפוצינו" → quantity_uncertain: false, quantity:1, unit:"cup"
• "אכלתי ארטיק" → quantity_uncertain: false, quantity:1
• "אכלתי 200 גרם בייקון" → quantity_uncertain: false, grams:200
`.trim();
}

export {
  FIXED_SINGLE_PATTERNS,
  WEIGHT_VARIABLE_RULES,
  COUNTABLE_UNIT_RULES,
  isNeverPromptFood,
  findCategoryRule,
};
