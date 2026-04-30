/**
 * True if the user message already gives *any* quantity / measure the model can map to grams
 * (digits, גרם, פרוסות, חופן, מידות מטבח, מספרים במילים וכו').
 * Used to avoid showing the portion-confirm card when add_food is the right path.
 */

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
