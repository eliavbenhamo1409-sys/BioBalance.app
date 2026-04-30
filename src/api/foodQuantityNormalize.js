/**
 * Normalizes Gemini extractor output to grams (deterministic).
 * Supports { quantity, unit } or legacy { grams }.
 */

export const UNIT = {
  GRAM: 'gram',
  UNIT: 'unit',
  SLICE: 'slice',
  PORTION: 'portion',
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
    return {
      grams: Math.max(1, Math.round(quantity)),
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
    unitNorm === 'פרוסה'
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
    unitNorm === 'מנה'
  ) {
    const g = Math.round(quantity * 200);
    return {
      grams: Math.max(80, g),
      normalizedNote: 'מנה כללית משוערת (~200 גרם)',
      normalizedFrom: 'portion_estimate',
    };
  }

  const gFallback = Math.round(quantity * 120);
  return {
    grams: Math.max(1, gFallback),
    normalizedNote: 'יחידה לא מוכרת — משועך ל-quantity×120 גרם',
    normalizedFrom: 'unknown_unit',
  };
}
