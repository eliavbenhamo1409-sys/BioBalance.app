/**
 * True if the user message already gives *any* quantity / measure the model can map to grams
 * (digits, גרם, פרוסות, חופן, מידות מטבח, מספרים במילים וכו').
 * Used to avoid showing the portion-confirm card when add_food is the right path.
 */

import { NEVER_PROMPT_KEYS } from '../api/ambiguousCountableFoods';
import { resolveQuantityPromptMeta } from '../api/quantityPromptRules';

const HEBREW_NUM_WORD =
  /(?:^|[\s,.])(?:אחת|אחד|שני|שניים|שתי|שתיים|שלוש|שלושה|ארבע|ארבעה|חמש|חמשה|שש|שישה|שבע|שבעה|שמונה|תשע|תשעה|עשר|עשרה)(?:$|[\s,.])/i;

const SUBSTRING_HINTS = [
  'גרם',
  'גר׳',
  'ג״ר',
  'ק״ג',
  'קילו',
  'מ״ל',
  'מ"ל',
  'ליטר',
  'ml ',
  ' ml',
  'חופן',
  'חופניים',
  'כפית',
  'כפות',
  'פרוסה',
  'פרוסות',
  'משולש',
  'משולשים',
  'חתיכה',
  'חתיכות',
  'כדור',
  'כדורים',
  'קוביה',
  'קוביות',
  'ביצה',
  'ביצים',
  'כנף',
  'כנפיים',
  'נתח',
  'נתחים',
  'מנה',
  'מנות',
  'יחידה',
  'יחידות',
  'סטנדרט',
  'סטנדרטי',
  'סטנדרטית',
  'סטנדרטיות',
  'קערה',
  'קערת',
  'צלחת',
  'כוס',
  'כוסות',
  'גביע',
  'קופסה',
  'שקית',
  'שקיות',
  'שק״ל',
  'משקל',
  'בינוני',
  'בינונית',
  'גדול',
  'גדולה',
  'קטן',
  'קטנה',
  'קצת',
  'מעט',
  'מעטים',
  'חצי',
  'רבע',
  'שליש',
  'כפול',
  'קילוגרם',
];

export function userMessageImpliesFoodQuantity(text) {
  const s = String(text ?? '').trim();
  if (!s) return false;

  if (/\d/.test(s)) return true;

  const lower = s.toLowerCase();

  for (const h of SUBSTRING_HINTS) {
    if (lower.includes(h)) return true;
  }

  // "כף חומוס" — לא "כפתור"
  if (/(^|[\s,.״"'])כף($|[\s,.])/.test(lower)) return true;

  if (HEBREW_NUM_WORD.test(s)) return true;

  if (/(?:^|[\s,.])(?:שני|שתי|שלוש|ארבע|חמש)\s+פרוס/i.test(s)) return true;

  return false;
}

/** Whole message is a known single-portion item (e.g. "שתיתי קפוצינו"). */
function looksLikeNaturalSingleMessage(text) {
  const lower = String(text ?? '').trim().toLowerCase();
  if (!lower) return false;

  const stripped = lower
    .replace(/^(שתיתי|שתה|אכלתי|אכל|נאכל)\s+/i, '')
    .replace(/[.!?]+$/, '')
    .trim();

  for (const k of NEVER_PROMPT_KEYS) {
    if (stripped.includes(k) && stripped.length <= k.length + 20) {
      return true;
    }
  }
  return false;
}

/**
 * When the user names food without quantity and rules/AI mark it uncertain,
 * return metadata for the in-chat quantity card; otherwise null.
 */
export function needsQuantityPrompt(foods, originalText) {
  if (!Array.isArray(foods) || foods.length === 0) return null;
  if (userMessageImpliesFoodQuantity(originalText)) return null;
  if (looksLikeNaturalSingleMessage(originalText)) return null;

  for (const f of foods) {
    const meta = resolveQuantityPromptMeta(f, originalText);
    if (meta) return meta;
  }
  return null;
}
