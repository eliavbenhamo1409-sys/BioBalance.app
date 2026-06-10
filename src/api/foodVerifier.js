/**
 * Final Gemini sanity-check that audits the resolved plan
 * (name + grams + kcal/100g) against the user's original message.
 *
 * Contract:
 *   - Gemini may only adjust grams. kcal/100g from the resolver stays authoritative.
 *   - On any failure we return input foods unchanged with `skipped: 'reason'`.
 *   - Disabled by setting EXPO_PUBLIC_FOOD_VERIFIER_ENABLED=0.
 */

import { callGemini, RateLimitError } from './geminiClient';

const DEFAULT_TIMEOUT_MS = 6000;
const MAX_FOODS_PER_AUDIT = 12;
const MIN_GRAMS = 1;
const MAX_GRAMS = 5000;

function devLog(...args) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[foodVerifier]', ...args);
  }
}

export function isFoodVerifierEnabled() {
  const raw = String(
    (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_FOOD_VERIFIER_ENABLED) ??
      '1',
  ).trim().toLowerCase();
  if (raw === '' || raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') {
    return true;
  }
  return false;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const e = new Error('Cancelled');
    e.name = 'AbortError';
    e.code = 'USER_CANCEL';
    throw e;
  }
}

function clampGrams(g) {
  const n = Math.round(Number(g));
  if (!Number.isFinite(n)) return null;
  if (n < MIN_GRAMS) return MIN_GRAMS;
  if (n > MAX_GRAMS) return MAX_GRAMS;
  return n;
}

function safeRound(n, digits = 1) {
  if (!Number.isFinite(n)) return 0;
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

/**
 * Re-derive per-100g macros from a resolved food row.
 */
function per100gFromFood(food) {
  const grams = Number(food?.grams);
  if (!Number.isFinite(grams) || grams <= 0) {
    return { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  }
  const kcal =
    Number(food?.nutrition_metadata?.kcalPer100g) ||
    (Number(food?.calories) * 100) / grams;
  const scale = 100 / grams;
  return {
    kcal: Number.isFinite(kcal) ? kcal : 0,
    protein: Number(food?.protein || 0) * scale,
    fat: Number(food?.fat || 0) * scale,
    carbs: Number(food?.carbs || 0) * scale,
  };
}

function rebuildFoodAtGrams(food, grams) {
  const safe = Math.max(1, Math.round(grams));
  const mult = safe / 100;
  const p100 = per100gFromFood(food);
  return {
    ...food,
    grams: safe,
    calories: Math.round(p100.kcal * mult),
    protein: safeRound(p100.protein * mult, 1),
    fat: safeRound(p100.fat * mult, 1),
    carbs: safeRound(p100.carbs * mult, 1),
  };
}

function buildAuditPrompt(userMessage, foods) {
  const list = foods
    .slice(0, MAX_FOODS_PER_AUDIT)
    .map((f, i) => {
      const p100 = per100gFromFood(f);
      const src = f?.nutrition_metadata?.source || 'unknown';
      return `  ${i + 1}. שם="${f.name}", grams=${f.grams}, kcal_per_100g=${Math.round(
        p100.kcal,
      )} (${src}), total_kcal=${f.calories}`;
    })
    .join('\n');

  return `אתה auditor של רישומי תזונה. המשימה: לבדוק האם כמות הגרמים שנבחרה לכל פריט סבירה ביחס למה שהמשתמש כתב.

הודעת המשתמש המקורית:
"${String(userMessage || '').slice(0, 500)}"

תכנון הרישום (לפני שמירה):
${list}

🧠 הנחות יסוד:
• ה-kcal_per_100g מגיע מה-resolver והוא נכון — אסור לשנות אותו.
• אתה רשאי לשנות רק את grams. אם הכמות סבירה — אשר.
• השתמש בידע שלך על מידות בית בעברית:

  יחידות מטבח:
  • כף טחינה/חמאת בוטנים/חומוס/דבש/ריבה ≈ 15 גרם. כף שמן ≈ 14 גרם. כף סוכר ≈ 12 גרם. כף קמח ≈ 8 גרם.
  • כפית שמן/חמאה/סוכר/מלח ≈ 5 גרם. כפית דבש ≈ 7 גרם.
  • חופן אגוזים/זיתים/שקדים/בוטנים ≈ 30 גרם. חופן צימוקים/תמרים ≈ 30 גרם. חופן תותים ≈ 60 גרם.
  • כוס מים/חלב/קפה/תה ≈ 240 גרם. כוס יין ≈ 150 גרם. פחית בירה ≈ 330 גרם.
  • כוס אורז מבושל ≈ 158 גרם. כוס פסטה מבושלת ≈ 140 גרם. כוס שיבולת שועל מבושלת ≈ 234 גרם.
  • קופסת טונה ≈ 140 גרם. קופסת חומוס מסחרית ≈ 240 גרם.

  יחידות שלמות:
  • פיתה ≈ 60 גרם. לחמניה ≈ 80 גרם. באגט ≈ 200 גרם. פרוסת לחם ≈ 30 גרם. טוסט ≈ 90 גרם. סנדוויץ׳/כריך ≈ 200 גרם.
  • פיצה (פרוסה) ≈ 120 גרם. המבורגר ≈ 180 גרם. סטייק ≈ 200 גרם. שניצל ≈ 150 גרם.
  • חזה עוף (חתיכה) ≈ 150 גרם. חזה הודו ≈ 130 גרם. קציצה ≈ 70 גרם.
  • ביצה ≈ 50 גרם. חביתה (2 ביצים) ≈ 110 גרם. שקשוקה ≈ 250 גרם.
  • בננה ≈ 120 גרם. תפוח ≈ 180 גרם. תפוז ≈ 150 גרם. אגס ≈ 170 גרם. אבוקדו ≈ 150 גרם.
  • בטטה ≈ 200 גרם. תפוח אדמה ≈ 170 גרם. פלאפל (כדור אחד) ≈ 17 גרם.
  • סלט (צלחת) ≈ 200 גרם. מרק (קערה) ≈ 300 גרם.
  • גלידה (כדור) ≈ 60 גרם. גלידת מגנום ≈ 86 גרם. ארטיק ≈ 60 גרם.
  • יוגורט (גביע) ≈ 150 גרם. קוטג׳ (גביע) ≈ 250 גרם.
  • מנת פסטה/אורז מבושל ≈ 150-180 גרם. מנת צ׳יפס ≈ 150 גרם.
  • קרואסון ≈ 60 גרם. בורקס ≈ 120 גרם. חטיף חלבון ≈ 60 גרם.

🚨 חוק "מידה אבסורדית" — חובה לתקן:
• אם grams קטן מ-30% מהיחידה הטיפוסית של המאכל הזה (למשל "פיתה" עם 1 גרם, "ביצה" עם 5 גרם, "סטייק" עם 10 גרם, "בננה" עם 8 גרם) — זה כמעט תמיד שגיאת חילוץ של מספר/יחידה. תקן ל-corrected_grams ≈ היחידה הטיפוסית למעלה.
• אם grams גדול פי 3+ מיחידה טיפוסית (פיתה עם 500 גרם, ביצה עם 400 גרם) — תקן למטה.
• אם הזיהוי לא תואם את המאכל שהמשתמש תיאר (למשל "חמאה" סווג כ"גבינה"), החזר action="flag".

📋 פלט:
החזר אך ורק JSON תקין בפורמט הזה (בלי טקסט נוסף):
{
  "items": [
    { "idx": 1, "action": "approve" }
    או
    { "idx": 1, "action": "correct_grams", "corrected_grams": 15, "reason_he": "כף טחינה ≈ 15 גרם" }
    או
    { "idx": 1, "action": "flag", "reason_he": "המאכל שזוהה לא תואם" }
  ]
}

חוקים:
• idx 1-based, חובה לכלול פריט אחד לכל שורה למעלה.
• corrected_grams חייב להיות מספר חיובי שלם בטווח ${MIN_GRAMS}-${MAX_GRAMS}.
• reason_he קצר (עד ~60 תווים), בעברית.
• אל תחזיר שדות אחרים. אל תוסיף הסברים מחוץ ל-JSON.`;
}

function stripCodeFences(s) {
  return String(s || '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

function parseAuditResponse(text, count) {
  if (!text) return null;
  const cleaned = stripCodeFences(text);
  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }
  if (!parsed || !Array.isArray(parsed.items)) return null;

  const items = new Array(count).fill(null);
  for (const it of parsed.items) {
    const idx = Number(it?.idx);
    if (!Number.isFinite(idx) || idx < 1 || idx > count) continue;
    const action = String(it?.action || '').toLowerCase();
    if (action === 'approve') {
      items[idx - 1] = { action: 'approve' };
    } else if (action === 'correct_grams') {
      const g = clampGrams(it?.corrected_grams);
      if (g == null) continue;
      const reason = String(it?.reason_he || '').slice(0, 120).trim();
      items[idx - 1] = { action: 'correct_grams', grams: g, reason };
    } else if (action === 'flag') {
      const reason = String(it?.reason_he || '').slice(0, 120).trim();
      items[idx - 1] = { action: 'flag', reason };
    }
  }
  return items;
}

/**
 * Audit a deterministic add_food plan with Gemini.
 *
 * @param {object} params
 * @param {string} params.userMessage   Raw user text that produced this plan.
 * @param {Array<object>} params.foods  Resolved food rows from `enrichAddFoodFoods`.
 * @param {AbortSignal} [params.signal]
 * @param {number} [params.timeoutMs]   Overrides default 6s timeout.
 *
 * @returns {Promise<{
 *   foods: Array<object>,
 *   clarifications: Array<{ name: string, question: string }>,
 *   corrections: Array<{ name: string, originalGrams: number, correctedGrams: number, reason: string }>,
 *   approved: Array<string>,
 *   skipped: string | null
 * }>}
 */
export async function verifyResolvedFoodPlan({
  userMessage,
  foods,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const passthrough = (reason) => ({
    foods,
    clarifications: [],
    corrections: [],
    approved: [],
    skipped: reason,
  });

  if (!Array.isArray(foods) || foods.length === 0) {
    return passthrough('no_foods');
  }
  if (!isFoodVerifierEnabled()) {
    return passthrough('disabled');
  }

  throwIfAborted(signal);

  const auditFoods = foods.slice(0, MAX_FOODS_PER_AUDIT);
  const prompt = buildAuditPrompt(userMessage, auditFoods);

  let raw;
  try {
    raw = await callGemini(
      [{ role: 'system', content: prompt }],
      {
        maxTokens: 400,
        timeoutMs,
        signal,
        responseMimeType: 'application/json',
        transportRetries: 0,
      },
    );
  } catch (err) {
    if (err?.code === 'USER_CANCEL') throw err;
    if (err instanceof RateLimitError || err?.name === 'RateLimitError') {
      devLog('rate-limited, passing through');
      return passthrough('rate_limited');
    }
    devLog('verifier call failed:', err?.message || err);
    return passthrough(err?.code === 'TIMEOUT' ? 'timeout' : 'error');
  }

  const decisions = parseAuditResponse(raw, auditFoods.length);
  if (!decisions) {
    devLog('could not parse verifier response');
    return passthrough('parse_failed');
  }

  const outFoods = [];
  const clarifications = [];
  const corrections = [];
  const approved = [];

  auditFoods.forEach((food, i) => {
    const decision = decisions[i] || { action: 'approve' };
    const baseMeta = food.nutrition_metadata || {};

    if (decision.action === 'flag') {
      clarifications.push({
        name: food.name,
        question:
          decision.reason ||
          `לא הצלחתי לאמת את "${food.name}" — שלח שם מדויק וכמות (גרם).`,
      });
      return;
    }

    if (decision.action === 'correct_grams') {
      const originalGrams = Number(food.grams);
      const correctedGrams = decision.grams;
      if (correctedGrams === originalGrams) {
        outFoods.push({
          ...food,
          nutrition_metadata: {
            ...baseMeta,
            verified: {
              by: 'gemini',
              status: 'approved',
              reasonHe: decision.reason || null,
            },
          },
        });
        approved.push(food.name);
        return;
      }
      const rebuilt = rebuildFoodAtGrams(food, correctedGrams);
      const newMeta = {
        ...baseMeta,
        verified: {
          by: 'gemini',
          status: 'corrected',
          originalGrams,
          correctedGrams,
          reasonHe: decision.reason || null,
        },
      };
      outFoods.push({ ...rebuilt, nutrition_metadata: newMeta });
      corrections.push({
        name: food.name,
        originalGrams,
        correctedGrams,
        reason: decision.reason || '',
      });
      return;
    }

    outFoods.push({
      ...food,
      nutrition_metadata: {
        ...baseMeta,
        verified: {
          by: 'gemini',
          status: 'approved',
        },
      },
    });
    approved.push(food.name);
  });

  // Pass through any extras that were sliced out above (rare).
  if (foods.length > MAX_FOODS_PER_AUDIT) {
    for (const extra of foods.slice(MAX_FOODS_PER_AUDIT)) {
      outFoods.push(extra);
    }
  }

  return {
    foods: outFoods,
    clarifications,
    corrections,
    approved,
    skipped: null,
  };
}
