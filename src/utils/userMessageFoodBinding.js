/**
 * Binds explicit {@code ... גרם} quantities in the user message to specific food names
 * (nearest match, each gram amount used at most once). Used so mixed messages like
 * "סטייק 200 גרם וגבינה צהובה" still open portion confirmation for items without a bound amount.
 */

import { userMessageImpliesFoodQuantity } from './userMessageQuantityHints';
import { normalizeExtractorItem } from '../api/foodQuantityNormalize';

const PACKAGED_HINT =
  /מגנום|magnum|סניקרס|snickers|קיט\s*קט|kit\s*kat|מקדונלד|mcdonald|בורגר\s*קינג|burger\s*king|קוקה|coke|פפסי|pepsi|משקה\s*אנרג|red\s*bull|חטיף|פריגת|תנובה|שטראוס|אוסם|עלית|במבה|ביסלי|טוויסט|קרקר|וופל|גלידת|גלידה|ארטיק|סורבה|פיצה\s*מוכנה|חטיף\s*חלבון|protein\s*bar|energy\s*bar/i;

function looksPackagedOrBranded(displayName) {
  return PACKAGED_HINT.test(String(displayName || ''));
}

const UNCERTAIN_NORMALIZATION = new Set([
  'unknown_unit',
  'unit_default',
  'portion_estimate',
  'unit_estimate',
  'gram_floored',
]);

/** True when grams came from a heuristic, not explicit user grams. */
export function foodNormalizationIsUncertain(rawFood) {
  const norm = normalizeExtractorItem(rawFood || {});
  if (UNCERTAIN_NORMALIZATION.has(norm.normalizedFrom)) return true;
  if (String(norm.normalizedFrom || '').startsWith('kitchen_')) return true;
  return false;
}

function findFoodStartIndex(lowerText, displayName) {
  const n = String(displayName ?? '').trim();
  if (!n || !lowerText) return -1;
  let idx = lowerText.indexOf(n.toLowerCase());
  if (idx !== -1) return idx;
  const parts = n
    .split(/\s+/)
    .filter((p) => p.length >= 2)
    .sort((a, b) => b.length - a.length);
  for (const p of parts) {
    idx = lowerText.indexOf(p.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * @param {string} userText
 * @param {string[]} foodNames
 * @returns {Map<string, number>}
 */
export function assignGramsGreedilyByProximity(userText, foodNames) {
  const text = String(userText ?? '');
  const lower = text.toLowerCase();
  const quantities = [];
  // Accept gram suffixes and unit-less numbers that look like a portion
  // ("חזה עוף 200" with implicit gram). The model already gates intent so
  // a number near a food name is overwhelmingly a portion in this app.
  const reGrams = /(\d+(?:\.\d+)?)\s*(?:גרם|גר׳|g\b|gr\b)/gi;
  let m;
  while ((m = reGrams.exec(text)) !== null) {
    quantities.push({
      grams: Math.max(1, Math.round(parseFloat(m[1]))),
      pos: m.index,
      explicit: true,
    });
  }
  // Also pick up bare numbers that aren't part of a gram pattern: this
  // catches "סטייק 200 וגבינה צהובה" where the gram suffix was dropped.
  const reBareNumber = /(?:^|\s|[,(])(\d{2,4})(?=\s|$|[,.)])/g;
  while ((m = reBareNumber.exec(text)) !== null) {
    const value = Number(m[1]);
    if (!Number.isFinite(value) || value < 5 || value > 2000) continue;
    const pos = m.index + (m[0].length - m[1].length);
    if (quantities.some((q) => Math.abs(q.pos - pos) < 6)) continue;
    quantities.push({
      grams: Math.round(value),
      pos,
      explicit: false,
    });
  }

  const foods = (foodNames || []).map((name) => ({
    name: String(name ?? '').trim(),
    pos: findFoodStartIndex(lower, name),
  }));

  const map = new Map();
  const usedQtyIdx = new Set();
  // Distance threshold tuned to typical Hebrew sentence length around one
  // food noun ("X גרם של Y", "Y בערך X גרם"). Generous enough to handle
  // verb fillers without leaking across an explicit clause boundary ("ו"/",").
  const THRESHOLD_EXPLICIT = 140;
  const THRESHOLD_BARE = 80;

  const clauseBoundaries = [];
  const reBoundary = /(\sו|,|\bוגם\b|\bו-)/g;
  while ((m = reBoundary.exec(text)) !== null) {
    clauseBoundaries.push(m.index);
  }

  const isCrossingBoundary = (a, b) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return clauseBoundaries.some((bIdx) => bIdx > lo && bIdx < hi);
  };

  const sortedFoods = foods.filter((f) => f.pos !== -1).sort((a, b) => a.pos - b.pos);

  for (const f of sortedFoods) {
    let bestIdx = -1;
    let bestD = Infinity;
    for (let i = 0; i < quantities.length; i++) {
      if (usedQtyIdx.has(i)) continue;
      if (isCrossingBoundary(quantities[i].pos, f.pos)) continue;
      const d = Math.abs(quantities[i].pos - f.pos);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) continue;
    const q = quantities[bestIdx];
    const limit = q.explicit ? THRESHOLD_EXPLICIT : THRESHOLD_BARE;
    if (bestD <= limit) {
      map.set(f.name, q.grams);
      usedQtyIdx.add(bestIdx);
    }
  }

  return map;
}

/**
 * Local text around a food mention for quantity-hint checks.
 * Uses a conjunction boundary (` ו` = space + ו) so a gram amount tied to an earlier
 * food (e.g. "סטייק 200 גרם **ו**גבינה") does not leak into the cheese window.
 */
export function getFoodMentionWindow(userText, foodDisplayName) {
  const text = String(userText ?? '');
  const lower = text.toLowerCase();
  const idx = findFoodStartIndex(lower, foodDisplayName);
  if (idx === -1) return null;
  const n = String(foodDisplayName ?? '').trim();

  const sliceBefore = text.slice(0, idx);
  let start = 0;
  const spacedWaw = sliceBefore.lastIndexOf(' ו');
  const comma = sliceBefore.lastIndexOf(',');

  const clauseStarts = [];
  if (spacedWaw !== -1) clauseStarts.push(spacedWaw + 2);
  if (comma !== -1) clauseStarts.push(comma + 1);

  const validClauseStarts = clauseStarts.filter((s) => s <= idx);
  if (validClauseStarts.length) {
    start = Math.max(...validClauseStarts);
    while (start < text.length && /\s/.test(text[start])) {
      start += 1;
    }
  } else {
    start = Math.max(0, idx - 16);
  }

  const end = Math.min(text.length, idx + Math.max(n.length, 1) + 56);
  return text.slice(start, end);
}

/**
 * @param {string} userText
 * @param {{ name?: string }[]} foodsFromModel
 * @returns {{ name: string, userAssignedGrams: number|null, needsQuantityConfirm: boolean }[]}
 */
export function buildFoodQuantityAssignment(userText, foodsFromModel) {
  const list = Array.isArray(foodsFromModel) ? foodsFromModel : [];
  const names = list.map((f) => String(f?.name ?? '').trim() || 'מזון');
  const gramMap = assignGramsGreedilyByProximity(userText, names);

  return names.map((name) => {
    const assigned = gramMap.get(name);
    if (assigned != null) {
      return { name, userAssignedGrams: assigned, needsQuantityConfirm: false };
    }
    const win = getFoodMentionWindow(userText, name);
    if (!win) {
      return { name, userAssignedGrams: null, needsQuantityConfirm: true };
    }
    const hinted = userMessageImpliesFoodQuantity(win);
    return {
      name,
      userAssignedGrams: null,
      needsQuantityConfirm: !hinted,
    };
  });
}

export function addFoodNeedsPortionConfirm(userText, foodsFromModel) {
  const meta = buildFoodQuantityAssignment(userText, foodsFromModel);
  if (meta.some((m) => m.needsQuantityConfirm)) return true;

  const list = Array.isArray(foodsFromModel) ? foodsFromModel : [];
  if (list.some((f) => foodNormalizationIsUncertain(f))) return true;
  if (list.some((f) => looksPackagedOrBranded(String(f?.name ?? '')))) return true;

  return false;
}

/** @deprecated alias — same gate as portion confirm */
export const addFoodNeedsNutritionConfirm = addFoodNeedsPortionConfirm;
