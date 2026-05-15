/**
 * Binds explicit {@code ... גרם} quantities in the user message to specific food names
 * (nearest match, each gram amount used at most once). Used so mixed messages like
 * "סטייק 200 גרם וגבינה צהובה" still open portion confirmation for items without a bound amount.
 */

import { userMessageImpliesFoodQuantity } from './userMessageQuantityHints';

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
  const re = /(\d+(?:\.\d+)?)\s*(?:גרם|גר׳)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1];
    quantities.push({
      grams: Math.max(1, Math.round(parseFloat(raw))),
      pos: m.index,
    });
  }

  const foods = (foodNames || []).map((name) => ({
    name: String(name ?? '').trim(),
    pos: findFoodStartIndex(lower, name),
  }));

  const map = new Map();
  const usedQtyIdx = new Set();
  const THRESHOLD = 95;

  const sortedFoods = foods.filter((f) => f.pos !== -1).sort((a, b) => a.pos - b.pos);

  for (const f of sortedFoods) {
    let bestIdx = -1;
    let bestD = Infinity;
    for (let i = 0; i < quantities.length; i++) {
      if (usedQtyIdx.has(i)) continue;
      const d = Math.abs(quantities[i].pos - f.pos);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    if (bestIdx !== -1 && bestD <= THRESHOLD) {
      map.set(f.name, quantities[bestIdx].grams);
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
  return meta.some((m) => m.needsQuantityConfirm);
}
