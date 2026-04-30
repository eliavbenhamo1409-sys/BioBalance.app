// ============================================================
// Smart Meal Planner
// ============================================================
// AI-driven meal planning and calorie-matched swaps.
//
// Architecture:
//   1. We compute the realistic-cap, slot grid, and headroom locally —
//      these are HARD CONSTRAINTS we never let the AI break.
//   2. We hand those constraints to Gemini ("the brain"), along with
//      the user's goal, name, and remaining macros, and ask it to
//      design the meals.
//   3. We re-validate the AI response (parse JSON, scale to fit
//      `allowed ± 5%`, enforce overshoot ceiling).
//   4. If the AI call fails or returns garbage, we fall back to a
//      goal-segmented local template builder. The user always gets a
//      plan; AI just makes it richer / more varied / more personal.
//
// Why this module exists:
// - "מה לאכול עכשיו" must NOT dump 2,000 cal at 22:00 just because the
//   user is behind. We cap by remaining meal-slots × per-slot ceiling
//   and surface a "מחר יום חדש" message when we cap.
// - The ↔ swap must keep the meal's calories close (±10%) AND must not
//   push the projected daily total above target × 1.05.
// - Recommendations are tailored to profile.goal (cut / maintain /
//   lean_bulk / bulk). For bulk we allow indulgent dense meals; for cut
//   we lean on lean protein + volume.

import { callGemini, RateLimitError } from './geminiClient';

// ------------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------------

// Per-slot realistic ceiling. Big enough to fit a real dinner, small
// enough that we won't recommend a 1,500-cal slam at 22:00.
export const PER_SLOT_CAL_CEILING = 600;

// Day ends here for planning purposes (no meals scheduled past this).
const DAY_END_HOUR = 23;

// Daily total we refuse to overshoot, as a multiple of the user's target.
// 5% buffer absorbs rounding noise from per-100g math.
export const OVERSHOOT_LIMIT = 1.05;

// Calorie matching tolerance for swaps.
const SWAP_TOLERANCE = 0.10;

// Cap-context apology lines. Random pick avoids robotic feel.
const CAP_MESSAGES = [
  'מחר יום חדש 🌅 היום נסיים מאוזן וזהו',
  'לא נדחוף קלוריות בכוח. נשלים מחר 💪',
  'היום קצת מאחור — בוא נסגור יפה ובמידה. מחר נשלים 🌱',
  'זה בסדר לא להגיע ליעד היום. הקפדנו על איזון, וזה מה שחשוב ✨',
];

const NEAR_GOAL_MESSAGES = [
  'כמעט סגרת היעד 🎯 רק כוס מים או נשנוש קטן',
  'נראה טוב! עוד נשנוש קל ונסיים יום מושלם ✨',
  'מצוין! נשארו פירורים — אל תכריח את עצמך לאכול יותר 🌿',
];

// ------------------------------------------------------------
// FOOD DATABASE - goal-segmented templates
// ------------------------------------------------------------
// Per-100g values; we scale grams to hit a target calorie load.
// Each entry is a recipe with multiple components, so the resulting
// meal looks like a real meal, not a single ingredient.

const TEMPLATES = {
  cut: {
    main: [
      {
        name: 'חזה עוף עם סלט וקינואה',
        components: [
          { food: 'חזה עוף צלוי',     ratio: 0.55, per100g: { calories: 165, protein: 31,  fat: 3.6 } },
          { food: 'קינואה מבושלת',     ratio: 0.30, per100g: { calories: 120, protein: 4.4, fat: 1.9 } },
          { food: 'סלט ירקות עם לימון', ratio: 0.15, per100g: { calories: 25,  protein: 1,   fat: 0.2 } },
        ],
      },
      {
        name: 'חביתת ירקות עם פרוסה מלאה',
        components: [
          { food: 'ביצים',           ratio: 0.55, per100g: { calories: 155, protein: 13, fat: 11 } },
          { food: 'ירקות מוקפצים',    ratio: 0.20, per100g: { calories: 45,  protein: 2,  fat: 1  } },
          { food: 'לחם מלא',         ratio: 0.25, per100g: { calories: 247, protein: 13, fat: 4  } },
        ],
      },
      {
        name: 'טונה עם בטטה וירקות',
        components: [
          { food: 'טונה במים',        ratio: 0.45, per100g: { calories: 116, protein: 26, fat: 1   } },
          { food: 'בטטה אפויה',       ratio: 0.40, per100g: { calories: 90,  protein: 2,  fat: 0.1 } },
          { food: 'ברוקולי מאודה',    ratio: 0.15, per100g: { calories: 35,  protein: 2.8,fat: 0.4 } },
        ],
      },
      {
        name: 'סלמון אפוי עם ירקות',
        components: [
          { food: 'סלמון אפוי',       ratio: 0.55, per100g: { calories: 208, protein: 20, fat: 13 } },
          { food: 'אורז לבן מבושל',    ratio: 0.30, per100g: { calories: 130, protein: 2.7,fat: 0.3 } },
          { food: 'ירקות מאודים',     ratio: 0.15, per100g: { calories: 35,  protein: 2,  fat: 0.3 } },
        ],
      },
    ],
    snack: [
      {
        name: 'יוגורט יווני 0% עם פירות יער',
        components: [
          { food: 'יוגורט יווני 0%', ratio: 0.70, per100g: { calories: 59, protein: 10, fat: 0.4 } },
          { food: 'פירות יער',       ratio: 0.30, per100g: { calories: 57, protein: 1,  fat: 0.3 } },
        ],
      },
      {
        name: 'גזר ומלפפון עם חומוס',
        components: [
          { food: 'גזר',     ratio: 0.40, per100g: { calories: 41,  protein: 1, fat: 0.2 } },
          { food: 'מלפפון',  ratio: 0.30, per100g: { calories: 16,  protein: 1, fat: 0.1 } },
          { food: 'חומוס',   ratio: 0.30, per100g: { calories: 166, protein: 8, fat: 10  } },
        ],
      },
      {
        name: 'קוטג׳ 5% עם עגבנייה',
        components: [
          { food: 'קוטג׳ 5%',  ratio: 0.75, per100g: { calories: 98,  protein: 11,  fat: 4.3 } },
          { food: 'עגבנייה',   ratio: 0.25, per100g: { calories: 18,  protein: 0.9, fat: 0.2 } },
        ],
      },
    ],
  },

  maintain: {
    main: [
      {
        name: 'אורז עם חזה עוף וירקות',
        components: [
          { food: 'חזה עוף צלוי',  ratio: 0.45, per100g: { calories: 165, protein: 31, fat: 3.6 } },
          { food: 'אורז לבן מבושל', ratio: 0.40, per100g: { calories: 130, protein: 2.7,fat: 0.3 } },
          { food: 'ירקות מאודים',  ratio: 0.15, per100g: { calories: 35,  protein: 2,  fat: 0.3 } },
        ],
      },
      {
        name: 'שקשוקה עם לחם',
        components: [
          { food: 'ביצים',        ratio: 0.45, per100g: { calories: 155, protein: 13, fat: 11 } },
          { food: 'רוטב עגבניות', ratio: 0.25, per100g: { calories: 40,  protein: 1.5,fat: 1  } },
          { food: 'לחם',          ratio: 0.30, per100g: { calories: 265, protein: 9,  fat: 3.2 } },
        ],
      },
      {
        name: 'פסטה ברוטב עגבניות',
        components: [
          { food: 'פסטה מבושלת',   ratio: 0.55, per100g: { calories: 131, protein: 5,  fat: 1.1 } },
          { food: 'רוטב עגבניות',  ratio: 0.25, per100g: { calories: 50,  protein: 2,  fat: 1   } },
          { food: 'גבינה צהובה',   ratio: 0.20, per100g: { calories: 402, protein: 25, fat: 33  } },
        ],
      },
      {
        name: 'פיתה עם חומוס וביצה',
        components: [
          { food: 'פיתה',   ratio: 0.45, per100g: { calories: 275, protein: 9, fat: 1.2 } },
          { food: 'חומוס',  ratio: 0.30, per100g: { calories: 166, protein: 8, fat: 10  } },
          { food: 'ביצים',  ratio: 0.25, per100g: { calories: 155, protein: 13,fat: 11  } },
        ],
      },
    ],
    snack: [
      {
        name: 'יוגורט עם גרנולה ודבש',
        components: [
          { food: 'יוגורט',  ratio: 0.55, per100g: { calories: 59,  protein: 10, fat: 0.4 } },
          { food: 'גרנולה',  ratio: 0.30, per100g: { calories: 450, protein: 10, fat: 18  } },
          { food: 'דבש',     ratio: 0.15, per100g: { calories: 304, protein: 0.3,fat: 0   } },
        ],
      },
      {
        name: 'תפוח וחופן שקדים',
        components: [
          { food: 'תפוח',   ratio: 0.65, per100g: { calories: 52,  protein: 0.3,fat: 0.2 } },
          { food: 'שקדים',  ratio: 0.35, per100g: { calories: 579, protein: 21, fat: 50  } },
        ],
      },
      {
        name: 'בננה עם חמאת בוטנים',
        components: [
          { food: 'בננה',           ratio: 0.65, per100g: { calories: 89,  protein: 1.1,fat: 0.3 } },
          { food: 'חמאת בוטנים',     ratio: 0.35, per100g: { calories: 588, protein: 25, fat: 50  } },
        ],
      },
    ],
  },

  lean_bulk: {
    main: [
      {
        name: 'אורז עם עוף ואבוקדו',
        components: [
          { food: 'חזה עוף צלוי',  ratio: 0.40, per100g: { calories: 165, protein: 31, fat: 3.6 } },
          { food: 'אורז לבן מבושל', ratio: 0.40, per100g: { calories: 130, protein: 2.7,fat: 0.3 } },
          { food: 'אבוקדו',        ratio: 0.20, per100g: { calories: 160, protein: 2,  fat: 15  } },
        ],
      },
      {
        name: 'פסטה עם בשר טחון',
        components: [
          { food: 'פסטה מבושלת',  ratio: 0.50, per100g: { calories: 131, protein: 5,  fat: 1.1 } },
          { food: 'בשר טחון 15%', ratio: 0.40, per100g: { calories: 250, protein: 26, fat: 15  } },
          { food: 'רוטב עגבניות', ratio: 0.10, per100g: { calories: 50,  protein: 2,  fat: 1   } },
        ],
      },
      {
        name: 'שקשוקה עשירה',
        components: [
          { food: 'ביצים',         ratio: 0.45, per100g: { calories: 155, protein: 13, fat: 11 } },
          { food: 'גבינה צהובה',   ratio: 0.20, per100g: { calories: 402, protein: 25, fat: 33 } },
          { food: 'לחם',           ratio: 0.35, per100g: { calories: 265, protein: 9,  fat: 3.2 } },
        ],
      },
    ],
    snack: [
      {
        name: 'שייק חלבון עם בננה',
        components: [
          { food: 'חלב',             ratio: 0.50, per100g: { calories: 61,  protein: 3.2,fat: 3.3 } },
          { food: 'בננה',            ratio: 0.30, per100g: { calories: 89,  protein: 1.1,fat: 0.3 } },
          { food: 'אבקת חלבון',      ratio: 0.20, per100g: { calories: 400, protein: 80, fat: 5   } },
        ],
      },
      {
        name: 'טוסט אבוקדו וביצים',
        components: [
          { food: 'לחם מלא',  ratio: 0.40, per100g: { calories: 247, protein: 13, fat: 4  } },
          { food: 'אבוקדו',   ratio: 0.30, per100g: { calories: 160, protein: 2,  fat: 15 } },
          { food: 'ביצים',    ratio: 0.30, per100g: { calories: 155, protein: 13, fat: 11 } },
        ],
      },
    ],
  },

  bulk: {
    main: [
      {
        name: 'פיצה ביתית עם חזה עוף',
        components: [
          { food: 'בצק פיצה',         ratio: 0.45, per100g: { calories: 270, protein: 9, fat: 4 } },
          { food: 'גבינה מוצרלה',     ratio: 0.25, per100g: { calories: 280, protein: 28,fat: 17 } },
          { food: 'חזה עוף',          ratio: 0.20, per100g: { calories: 165, protein: 31,fat: 3.6 } },
          { food: 'רוטב עגבניות',     ratio: 0.10, per100g: { calories: 50,  protein: 2, fat: 1   } },
        ],
      },
      {
        name: 'פסטה ברוטב שמנת ובשר',
        components: [
          { food: 'פסטה מבושלת',  ratio: 0.45, per100g: { calories: 131, protein: 5,  fat: 1.1 } },
          { food: 'בשר טחון 15%', ratio: 0.35, per100g: { calories: 250, protein: 26, fat: 15  } },
          { food: 'רוטב שמנת',    ratio: 0.20, per100g: { calories: 195, protein: 3,  fat: 19  } },
        ],
      },
      {
        name: 'בורגר ביתי בלחמנייה',
        components: [
          { food: 'קציצת בקר',     ratio: 0.45, per100g: { calories: 250, protein: 26, fat: 15 } },
          { food: 'לחמנייה',       ratio: 0.30, per100g: { calories: 280, protein: 9,  fat: 5  } },
          { food: 'גבינה צהובה',   ratio: 0.15, per100g: { calories: 402, protein: 25, fat: 33 } },
          { food: 'אבוקדו',        ratio: 0.10, per100g: { calories: 160, protein: 2,  fat: 15 } },
        ],
      },
      {
        name: 'סטייק עם תפוחי אדמה ואבוקדו',
        components: [
          { food: 'סטייק אנטריקוט', ratio: 0.50, per100g: { calories: 280, protein: 26, fat: 19 } },
          { food: 'תפוחי אדמה',     ratio: 0.30, per100g: { calories: 93,  protein: 2,  fat: 0.1 } },
          { food: 'אבוקדו',         ratio: 0.20, per100g: { calories: 160, protein: 2,  fat: 15  } },
        ],
      },
    ],
    snack: [
      {
        name: 'שייק חלבון עם חמאת בוטנים',
        components: [
          { food: 'חלב מלא',        ratio: 0.45, per100g: { calories: 61,  protein: 3.2,fat: 3.3 } },
          { food: 'בננה',           ratio: 0.20, per100g: { calories: 89,  protein: 1.1,fat: 0.3 } },
          { food: 'חמאת בוטנים',     ratio: 0.20, per100g: { calories: 588, protein: 25, fat: 50  } },
          { food: 'אבקת חלבון',      ratio: 0.15, per100g: { calories: 400, protein: 80, fat: 5   } },
        ],
      },
      {
        name: 'יוגורט עם גרנולה וחמאת בוטנים',
        components: [
          { food: 'יוגורט יווני', ratio: 0.50, per100g: { calories: 97,  protein: 9,  fat: 5  } },
          { food: 'גרנולה',       ratio: 0.30, per100g: { calories: 450, protein: 10, fat: 18 } },
          { food: 'חמאת בוטנים',   ratio: 0.20, per100g: { calories: 588, protein: 25, fat: 50 } },
        ],
      },
    ],
  },
};

// Default slot grid for the day. We never schedule past DAY_END_HOUR.
// `isMain` controls calorie weighting (75% main / 25% snack).
const SLOT_GRID = [
  { hour: 8,  type: 'breakfast',       isMain: true,  label: 'ארוחת בוקר'    },
  { hour: 10, type: 'morning_snack',   isMain: false, label: 'נשנוש בוקר'    },
  { hour: 13, type: 'lunch',           isMain: true,  label: 'ארוחת צהריים'  },
  { hour: 16, type: 'afternoon_snack', isMain: false, label: 'נשנוש אחה״צ'   },
  { hour: 19, type: 'dinner',          isMain: true,  label: 'ארוחת ערב'     },
  { hour: 21, type: 'evening_snack',   isMain: false, label: 'נשנוש לילה'    },
];

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickRandomDifferent = (arr, exclude) => {
  if (!arr || arr.length === 0) return null;
  const filtered = arr.filter((x) => x !== exclude && x?.name !== exclude?.name);
  if (filtered.length === 0) return arr[0];
  return filtered[Math.floor(Math.random() * filtered.length)];
};

// Some legacy profile values may use different keys; normalize.
const normalizeGoal = (goal) => {
  if (!goal) return 'maintain';
  if (TEMPLATES[goal]) return goal;
  if (goal === 'gain' || goal === 'mass') return 'bulk';
  if (goal === 'cutting' || goal === 'lose') return 'cut';
  return 'maintain';
};

const getBucket = (goal) => TEMPLATES[normalizeGoal(goal)] || TEMPLATES.maintain;

// Build a single concrete meal (with grams, calories, protein, fat) from
// a recipe template scaled to `targetCalories`.
const buildMealFromTemplate = (template, targetCalories) => {
  if (!template || !template.components || targetCalories <= 0) {
    return { name: template?.name || 'ארוחה', items: [], totalCalories: 0, totalProtein: 0, totalFat: 0 };
  }

  let totalCal = 0;
  let totalProt = 0;
  let totalFat = 0;
  const items = [];

  for (const comp of template.components) {
    const compCalTarget = targetCalories * comp.ratio;
    if (compCalTarget < 5) continue;

    // grams = (compCalTarget / per100g.calories) * 100
    const rawGrams = (compCalTarget / comp.per100g.calories) * 100;
    // Round to nearest 5g for natural-feeling portions.
    const grams = Math.max(5, Math.round(rawGrams / 5) * 5);
    const factor = grams / 100;

    const cal  = Math.round(comp.per100g.calories * factor);
    const prot = Math.round(comp.per100g.protein * factor * 10) / 10;
    const fat  = Math.round(comp.per100g.fat * factor * 10) / 10;

    items.push({
      food: comp.food,
      amount: `${grams}g`,
      calories: cal,
      protein: prot,
      fat,
    });

    totalCal += cal;
    totalProt += prot;
    totalFat += fat;
  }

  return {
    name: template.name,
    items,
    totalCalories: totalCal,
    totalProtein: Math.round(totalProt * 10) / 10,
    totalFat: Math.round(totalFat * 10) / 10,
  };
};

// Slot-aware label so the card reads naturally.
const labelForSlot = (slot, template) => template?.name || slot?.label || 'ארוחה';

// ------------------------------------------------------------
// PUBLIC: getDailyTargetSnapshot
// ------------------------------------------------------------
export const getDailyTargetSnapshot = (profile, dailyStats, targets, currentHour) => {
  const safeTargets = targets || {
    calories: profile?.calories_target || 2000,
    protein:  profile?.protein_target  || 90,
    fat:      profile?.fat_target      || 65,
  };

  const remaining = {
    calories: Math.max(0, (safeTargets.calories || 0) - (dailyStats?.calories || 0)),
    protein:  Math.max(0, (safeTargets.protein  || 0) - (dailyStats?.protein  || 0)),
    fat:      Math.max(0, (safeTargets.fat      || 0) - (dailyStats?.fat      || 0)),
  };

  const hour = typeof currentHour === 'number' ? currentHour : new Date().getHours();
  const slotsLeft = computeSlotsLeft(hour);

  return {
    remaining,
    slotsLeft,
    targets: safeTargets,
    currentHour: hour,
  };
};

const computeSlotsLeft = (currentHour) => {
  if (currentHour >= DAY_END_HOUR) return 1; // late-night safety net (one tiny slot)
  return SLOT_GRID.filter((s) => s.hour >= currentHour - 1).length || 1;
};

// ------------------------------------------------------------
// CONSTRAINT BUILDER
// ------------------------------------------------------------
// All the math the AI is NOT allowed to fudge: realistic cap, slot
// list, per-slot budgets, capMessage. Both AI and local builders run
// under the same constraint object.
const buildPlanConstraints = ({ profile, dailyStats, targets, currentHour }) => {
  const snap = getDailyTargetSnapshot(profile, dailyStats, targets, currentHour);
  const goal = normalizeGoal(profile?.goal);

  // Edge: nothing meaningful left to add.
  if (snap.remaining.calories <= 200) {
    return {
      goal,
      remaining: snap.remaining,
      allowed: 0,
      capped: true,
      capMessage: pickRandom(NEAR_GOAL_MESSAGES),
      slots: [],
      mainBudget: 0,
      snackBudget: 0,
      empty: true,
    };
  }

  let availableSlots = SLOT_GRID.filter((s) => s.hour >= snap.currentHour - 1);
  if (availableSlots.length === 0) {
    availableSlots = [{
      hour: Math.min(snap.currentHour + 1, DAY_END_HOUR),
      type: 'evening_snack',
      isMain: false,
      label: 'נשנוש אחרון',
    }];
  }

  const cap = availableSlots.length * PER_SLOT_CAL_CEILING;
  const allowed = Math.min(snap.remaining.calories, cap);
  const capped = allowed < snap.remaining.calories - 200;

  const mains = availableSlots.filter((s) => s.isMain);
  const snacks = availableSlots.filter((s) => !s.isMain);

  let mainBudget = 0;
  let snackBudget = 0;
  if (mains.length > 0 && snacks.length > 0) {
    mainBudget = (allowed * 0.75) / mains.length;
    snackBudget = (allowed * 0.25) / snacks.length;
  } else if (mains.length > 0) {
    mainBudget = allowed / mains.length;
  } else {
    snackBudget = allowed / snacks.length;
  }

  return {
    goal,
    remaining: snap.remaining,
    allowed,
    capped,
    capMessage: capped ? pickRandom(CAP_MESSAGES) : '',
    slots: availableSlots,
    mainBudget,
    snackBudget,
    empty: false,
    targets: snap.targets,
    currentHour: snap.currentHour,
  };
};

// ------------------------------------------------------------
// LOCAL FALLBACK BUILDER (template-driven)
// ------------------------------------------------------------
// Used when AI is unavailable (offline, rate-limited, malformed
// response). Same shape as the AI output so the screen doesn't care
// which path produced the plan.
const buildPlanFromTemplates = (constraints) => {
  if (constraints.empty) {
    return [];
  }
  const bucket = getBucket(constraints.goal);

  const meals = [];
  for (const slot of constraints.slots) {
    const target = slot.isMain ? constraints.mainBudget : constraints.snackBudget;
    if (target < 60) continue;

    const templates = slot.isMain ? bucket.main : bucket.snack;
    const template = pickRandom(templates);
    const built = buildMealFromTemplate(template, target);

    meals.push({
      time: `${String(slot.hour).padStart(2, '0')}:00`,
      type: slot.type,
      name: labelForSlot(slot, template),
      items: built.items,
      totalCalories: built.totalCalories,
      totalProtein: built.totalProtein,
      totalFat: built.totalFat,
    });
  }
  return meals;
};

// ------------------------------------------------------------
// FINAL GUARD
// ------------------------------------------------------------
// Re-scale meals proportionally if the sum drifts more than ±5% off
// `allowed`. This fixes rounding noise from per-100g math AND tames an
// AI response that might overshoot slightly.
const fitPlanToAllowed = (meals, allowed) => {
  const grandTotal = meals.reduce((sum, m) => sum + (m.totalCalories || 0), 0);
  if (grandTotal <= 0 || allowed <= 0) return meals;
  if (Math.abs(grandTotal - allowed) / allowed <= 0.05) return meals;

  const factor = allowed / grandTotal;
  for (const m of meals) {
    m.totalCalories = Math.round((m.totalCalories || 0) * factor);
    m.totalProtein  = Math.round((m.totalProtein || 0) * factor * 10) / 10;
    m.totalFat      = Math.round((m.totalFat || 0) * factor * 10) / 10;
    for (const it of (m.items || [])) {
      it.calories = Math.round((it.calories || 0) * factor);
      it.protein  = Math.round((it.protein  || 0) * factor * 10) / 10;
      it.fat      = Math.round((it.fat      || 0) * factor * 10) / 10;
      const gMatch = /^(\d+)\s*g$/.exec(it.amount || '');
      if (gMatch) {
        const newG = Math.max(5, Math.round((parseInt(gMatch[1], 10) * factor) / 5) * 5);
        it.amount = `${newG}g`;
      }
    }
  }
  return meals;
};

// ------------------------------------------------------------
// AI BRAIN — Gemini meal plan
// ------------------------------------------------------------
const goalDirective = (goal) => {
  switch (goal) {
    case 'cut':
      return 'המשתמש בחיטוב — בחר חלבונים רזים, ירקות בנפח גבוה, פחמימות פחות צפופות (קוטג׳ 5%, חזה עוף, קינואה, יוגורט 0%, סלטים).';
    case 'bulk':
      return 'המשתמש בעלייה במסה — מותר ואף עדיף מאכלים צפופים בקלוריות וטעימים: פיצה ביתית, פסטה עם בשר, סטייק, שייקי חלבון עם חמאת בוטנים, אבוקדו.';
    case 'lean_bulk':
      return 'המשתמש בעלייה מתונה — תפריט מאוזן עם נטייה לחלבון איכותי ופחמימות מורכבות (אורז, חזה עוף, אבוקדו, שייק חלבון).';
    default:
      return 'המשתמש בשימור — שמור על תפריט מאוזן: חלבון איכותי, פחמימה מורכבת, ירקות. כל המקרו-נוטריינטים ביחס סביר.';
  }
};

const buildPlanPrompt = (constraints, profile) => {
  const userName = profile?.name ? ` (השם: ${profile.name})` : '';
  const slotsTable = constraints.slots
    .map((s, i) => {
      const budget = s.isMain ? constraints.mainBudget : constraints.snackBudget;
      const slotLabel = s.label || s.type;
      return `${i + 1}. ${String(s.hour).padStart(2, '0')}:00 — ${slotLabel} (${s.type}) — תקציב: ${Math.round(budget)} קל'`;
    })
    .join('\n');

  return `אתה תזונאי-AI מקצועי שעובד בתוך אפליקציית BioBalance. המטרה שלך: לבנות תפריט אמיתי, ריאליסטי וטעים לסיום היום עבור המשתמש${userName}.

## פרופיל המשתמש
- מטרה: ${constraints.goal}
- ${goalDirective(constraints.goal)}

## מאזן יומי (מה שכבר נצרך, מה שנותר)
- שעה נוכחית: ${String(constraints.currentHour).padStart(2, '0')}:00
- קלוריות שנותרו ביעד: ${constraints.remaining.calories}
- חלבון שנותר: ${Math.round(constraints.remaining.protein)}g
- שומן שנותר: ${Math.round(constraints.remaining.fat)}g

## אילוצים חובה (אסור לחרוג!)
- סך כל הקלוריות בתפריט שתחזיר חייב להיות **${Math.round(constraints.allowed)} קל'** (סטייה של עד 5% מותרת).
${constraints.capped ? `- ⚠️ המשתמש מאחור ב-${Math.round(constraints.remaining.calories - constraints.allowed)} קל' מהיעד היומי. **אל תנסה לסגור את היעד בכוח** — ${Math.round(constraints.allowed)} קל' זו הכמות הריאלית והבריאה לסיים איתה את היום.` : ''}
- הקפד על שיבוץ הארוחות בסלוטים הבאים, עם התקציב המדויק לכל סלוט:
${slotsTable}

## פורמט התשובה
החזר **JSON תקין בלבד**, ללא הסברים, ללא markdown, בפורמט הבא בדיוק:
{
  "meals": [
    {
      "time": "HH:MM",
      "type": "<type מהסלוט>",
      "name": "שם הארוחה בעברית",
      "items": [
        { "food": "שם המרכיב", "amount": "כמות (למשל 150g או 1 יחידה)", "calories": <int>, "protein": <number>, "fat": <number> }
      ],
      "totalCalories": <int>,
      "totalProtein": <number>,
      "totalFat": <number>
    }
  ]
}

## הנחיות איכות
- כל ארוחה היא ארוחה אמיתית עם 2-4 מרכיבים שמשלימים זה את זה (חלבון + פחמימה + ירק/שומן).
- ערכים תזונתיים מדויקים ככל הניתן (USDA-style).
- שמות בעברית, טבעיים. בלי "ארוחה כללית".
- לארוחות בולק — מותר וטעים: פיצה, פסטה ברוטב שמנת, בורגר ביתי, שייק חלבון. אל תהיה שמרני.
- לארוחות חיטוב — שובע גבוה, נפח גדול, חלבון רזה. לא חביתות שמנות.
- ${constraints.capped ? 'אל תוסיף בארוחה האחרונה הערה כמו "תאכל עוד" — סוגרים את היום במידה.' : ''}

החזר רק את ה-JSON, כלום אחר.`;
};

const cleanJsonString = (raw) => {
  if (!raw) return null;
  // Strip markdown fences if present.
  let txt = raw.trim();
  txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  // Find the first balanced object.
  const firstBrace = txt.indexOf('{');
  const lastBrace = txt.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  return txt.substring(firstBrace, lastBrace + 1);
};

const parseAiPlan = (raw) => {
  const cleaned = cleanJsonString(raw);
  if (!cleaned) return null;
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed?.meals || !Array.isArray(parsed.meals)) return null;
    // Light validation + coercion
    const meals = parsed.meals
      .filter((m) => m && Array.isArray(m.items) && m.items.length > 0)
      .map((m) => ({
        time: String(m.time || ''),
        type: String(m.type || 'meal'),
        name: String(m.name || 'ארוחה'),
        items: m.items.map((it) => ({
          food: String(it.food || 'מרכיב'),
          amount: String(it.amount || ''),
          calories: Math.max(0, Math.round(Number(it.calories) || 0)),
          protein:  Math.max(0, Math.round((Number(it.protein) || 0) * 10) / 10),
          fat:      Math.max(0, Math.round((Number(it.fat) || 0) * 10) / 10),
        })),
        totalCalories: Math.max(0, Math.round(Number(m.totalCalories) || 0)),
        totalProtein:  Math.max(0, Math.round((Number(m.totalProtein) || 0) * 10) / 10),
        totalFat:      Math.max(0, Math.round((Number(m.totalFat) || 0) * 10) / 10),
      }));
    return meals.length > 0 ? meals : null;
  } catch (e) {
    console.log('[smartMealPlanner] AI plan JSON parse failed:', e.message);
    return null;
  }
};

const callAiForMealPlan = async (constraints, profile) => {
  try {
    const prompt = buildPlanPrompt(constraints, profile);
    const raw = await callGemini(
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.6,
        maxTokens: 1400,
        thinkingBudget: 0, // we want fast structured output, not chain-of-thought
      },
    );
    const meals = parseAiPlan(raw);
    if (!meals) {
      console.log('[smartMealPlanner] AI plan response unusable, falling back');
      return null;
    }
    return meals;
  } catch (e) {
    if (e instanceof RateLimitError) {
      console.log('[smartMealPlanner] AI plan rate-limited, falling back');
    } else {
      console.log('[smartMealPlanner] AI plan error:', e?.message || e);
    }
    return null;
  }
};

// ------------------------------------------------------------
// PUBLIC: buildMealPlan  (AI-driven, with local fallback)
// ------------------------------------------------------------
// Returns: { meals, capped, capMessage, allowedCalories, remaining,
//            goal, source: 'ai' | 'local' | 'empty' }
//
// `capped: true` means we deliberately recommended LESS than what the
// user technically needs to hit the daily goal, because pushing more
// would be unhealthy at the current hour.
export const buildMealPlan = async ({ profile, dailyStats, targets, currentHour } = {}) => {
  const constraints = buildPlanConstraints({ profile, dailyStats, targets, currentHour });

  if (constraints.empty) {
    return {
      meals: [],
      capped: true,
      capMessage: constraints.capMessage,
      allowedCalories: 0,
      remaining: constraints.remaining,
      goal: constraints.goal,
      source: 'empty',
    };
  }

  // 1) Ask the AI brain.
  let meals = await callAiForMealPlan(constraints, profile);
  let source = 'ai';

  // 2) Fall back to templates if AI failed.
  if (!meals || meals.length === 0) {
    meals = buildPlanFromTemplates(constraints);
    source = 'local';
  }

  // 3) Always re-fit to the realistic cap. AI drifts; we don't.
  fitPlanToAllowed(meals, constraints.allowed);

  return {
    meals,
    capped: constraints.capped,
    capMessage: constraints.capMessage,
    allowedCalories: constraints.allowed,
    remaining: constraints.remaining,
    goal: constraints.goal,
    source,
  };
};

// ------------------------------------------------------------
// SWAP CONSTRAINTS
// ------------------------------------------------------------
const buildSwapConstraints = ({ meal, allMeals = [], targets, dailyStats }) => {
  const targetCal = meal?.totalCalories || meal?.calories || 400;
  const safeTargets = targets || { calories: 2000 };
  const dailyConsumed = dailyStats?.calories || 0;

  const otherPlanCals = allMeals
    .filter((m) => m !== meal)
    .reduce((sum, m) => sum + (m.totalCalories || m.calories || 0), 0);

  const ceiling = (safeTargets.calories || 2000) * OVERSHOOT_LIMIT;
  const headroom = Math.max(0, ceiling - dailyConsumed - otherPlanCals);

  // Per-alternative calorie target: meal cal ±10%, but clamped by headroom.
  const minMatch = Math.round(targetCal * (1 - SWAP_TOLERANCE));
  const maxMatch = Math.round(targetCal * (1 + SWAP_TOLERANCE));
  const altCalTarget = Math.min(Math.max(targetCal, minMatch), maxMatch);
  const cappedTarget = Math.min(altCalTarget, Math.max(120, headroom));

  return {
    targetCal,
    minMatch: Math.min(minMatch, cappedTarget),
    maxMatch: Math.min(maxMatch, cappedTarget),
    cappedTarget,
    headroom,
    isSnack: (meal?.type || '').includes('snack'),
    mealName: meal?.name || 'הארוחה הנוכחית',
  };
};

// Local fallback: picks 3 distinct templates, scales each to cappedTarget.
const buildSwapFromTemplates = (constraints, meal, profile) => {
  const goal = normalizeGoal(profile?.goal);
  const bucket = getBucket(goal);
  const pool = constraints.isSnack ? bucket.snack : bucket.main;

  const candidates = pool.filter((t) => t.name !== meal?.name);
  const pickPool = candidates.length > 0 ? candidates : pool;

  const alternatives = [];
  const used = new Set();
  for (let i = 0; i < Math.min(3, pickPool.length); i++) {
    let template;
    let attempts = 0;
    do {
      template = pickRandom(pickPool);
      attempts++;
    } while (used.has(template.name) && attempts < 8);
    used.add(template.name);

    const built = buildMealFromTemplate(template, constraints.cappedTarget);
    alternatives.push(built);
  }
  return alternatives;
};

// ------------------------------------------------------------
// AI BRAIN — Gemini swap suggestions
// ------------------------------------------------------------
const buildSwapPrompt = (constraints, meal, profile) => {
  const goal = normalizeGoal(profile?.goal);
  const userName = profile?.name ? ` (${profile.name})` : '';
  const itemsList = (meal?.items || [])
    .map((it) => `- ${it.food} (${it.amount}) — ${it.calories || 0} קל'`)
    .join('\n');

  return `אתה תזונאי-AI מקצועי באפליקציית BioBalance. המשתמש${userName} רוצה להחליף ארוחה ספציפית בתפריט היומי שלו.

## הארוחה הנוכחית
- שם: ${meal?.name || 'ארוחה'}
- קלוריות: ${meal?.totalCalories || 0}
- מרכיבים:
${itemsList || '- (לא צוין)'}

## פרופיל
- מטרת המשתמש: ${goal}
- ${goalDirective(goal)}

## אילוצים חובה
- כל חלופה חייבת להיות בטווח ${constraints.minMatch}–${constraints.maxMatch} קל'.
- אל תחרוג מ-${Math.round(constraints.cappedTarget)} קל' לחלופה. זה גג קשיח כדי לא לעבור את המאזן היומי.
- ${constraints.isSnack ? 'מדובר בנשנוש — תן חלופות נשנוש (לא ארוחה מלאה).' : 'מדובר בארוחה עיקרית — תן חלופות שהן ארוחות אמיתיות עם 2-4 מרכיבים.'}
- אל תחזור על הארוחה המקורית.

## פורמט התשובה
החזר **JSON בלבד**, ללא הסברים:
{
  "alternatives": [
    {
      "name": "שם החלופה בעברית",
      "items": [
        { "food": "מרכיב", "amount": "כמות", "calories": <int>, "protein": <number>, "fat": <number> }
      ],
      "totalCalories": <int>,
      "totalProtein": <number>,
      "totalFat": <number>
    }
  ]
}

תחזיר 3 חלופות שונות זו מזו, מותאמות למטרת המשתמש. החזר רק JSON.`;
};

const parseAiSwap = (raw) => {
  const cleaned = cleanJsonString(raw);
  if (!cleaned) return null;
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed?.alternatives || !Array.isArray(parsed.alternatives)) return null;
    const list = parsed.alternatives
      .filter((a) => a && Array.isArray(a.items) && a.items.length > 0)
      .map((a) => ({
        name: String(a.name || 'חלופה'),
        items: a.items.map((it) => ({
          food: String(it.food || 'מרכיב'),
          amount: String(it.amount || ''),
          calories: Math.max(0, Math.round(Number(it.calories) || 0)),
          protein:  Math.max(0, Math.round((Number(it.protein) || 0) * 10) / 10),
          fat:      Math.max(0, Math.round((Number(it.fat) || 0) * 10) / 10),
        })),
        totalCalories: Math.max(0, Math.round(Number(a.totalCalories) || 0)),
        totalProtein:  Math.max(0, Math.round((Number(a.totalProtein) || 0) * 10) / 10),
        totalFat:      Math.max(0, Math.round((Number(a.totalFat) || 0) * 10) / 10),
      }));
    return list.length > 0 ? list : null;
  } catch (e) {
    console.log('[smartMealPlanner] AI swap JSON parse failed:', e.message);
    return null;
  }
};

const callAiForSwap = async (constraints, meal, profile) => {
  try {
    const prompt = buildSwapPrompt(constraints, meal, profile);
    const raw = await callGemini(
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.7,
        maxTokens: 1100,
        thinkingBudget: 0,
      },
    );
    return parseAiSwap(raw);
  } catch (e) {
    if (e instanceof RateLimitError) {
      console.log('[smartMealPlanner] AI swap rate-limited, falling back');
    } else {
      console.log('[smartMealPlanner] AI swap error:', e?.message || e);
    }
    return null;
  }
};

// Clamp each alternative so its calories ∈ [minMatch, maxMatch]. We
// scale items proportionally if the AI strayed off the band.
const clampAlternative = (alt, constraints) => {
  const totalCal = alt.totalCalories || 0;
  if (totalCal === 0) return alt;
  const target = Math.min(Math.max(totalCal, constraints.minMatch), constraints.maxMatch);
  if (target === totalCal) return alt;
  const factor = target / totalCal;
  return {
    ...alt,
    totalCalories: Math.round(totalCal * factor),
    totalProtein:  Math.round((alt.totalProtein || 0) * factor * 10) / 10,
    totalFat:      Math.round((alt.totalFat || 0) * factor * 10) / 10,
    items: (alt.items || []).map((it) => {
      const next = { ...it };
      next.calories = Math.round((it.calories || 0) * factor);
      next.protein  = Math.round((it.protein  || 0) * factor * 10) / 10;
      next.fat      = Math.round((it.fat      || 0) * factor * 10) / 10;
      const gMatch = /^(\d+)\s*g$/.exec(it.amount || '');
      if (gMatch) {
        const newG = Math.max(5, Math.round((parseInt(gMatch[1], 10) * factor) / 5) * 5);
        next.amount = `${newG}g`;
      }
      return next;
    }),
  };
};

// ------------------------------------------------------------
// PUBLIC: swapMeal  (AI-driven, with local fallback)
// ------------------------------------------------------------
// Returns up to 3 calorie-matched alternatives that, when placed back
// into the plan, do NOT push the projected daily total over the limit.
export const swapMeal = async ({ meal, allMeals = [], targets, dailyStats, profile } = {}) => {
  const constraints = buildSwapConstraints({ meal, allMeals, targets, dailyStats });

  let alternatives = await callAiForSwap(constraints, meal, profile);

  if (!alternatives || alternatives.length === 0) {
    alternatives = buildSwapFromTemplates(constraints, meal, profile);
  }

  // Final clamp — even AI output goes through the calorie-band guard.
  return alternatives.map((a) => clampAlternative(a, constraints));
};

// ------------------------------------------------------------
// PUBLIC: enforceOvershootGuard
// ------------------------------------------------------------
// Re-scale a chosen alternative if placing it into the plan would push
// projected total above target * OVERSHOOT_LIMIT. Used after the user
// taps a swap option.
export const enforceOvershootGuard = ({ alternative, otherMeals = [], targets, dailyStats }) => {
  const ceiling = ((targets?.calories) || 2000) * OVERSHOOT_LIMIT;
  const dailyConsumed = dailyStats?.calories || 0;
  const otherCals = otherMeals.reduce((sum, m) => sum + (m.totalCalories || m.calories || 0), 0);

  const headroom = Math.max(0, ceiling - dailyConsumed - otherCals);
  const altCal = alternative.totalCalories || alternative.calories || 0;

  if (altCal <= headroom || altCal === 0) {
    return alternative; // safe
  }

  const factor = headroom / altCal;
  const scaled = {
    ...alternative,
    totalCalories: Math.round(altCal * factor),
    totalProtein:  Math.round((alternative.totalProtein || 0) * factor * 10) / 10,
    totalFat:      Math.round((alternative.totalFat || 0) * factor * 10) / 10,
    items: (alternative.items || []).map((it) => {
      const next = { ...it };
      next.calories = Math.round((it.calories || 0) * factor);
      next.protein  = Math.round((it.protein  || 0) * factor * 10) / 10;
      next.fat      = Math.round((it.fat      || 0) * factor * 10) / 10;
      const gMatch = /^(\d+)\s*g$/.exec(it.amount || '');
      if (gMatch) {
        const newG = Math.max(5, Math.round((parseInt(gMatch[1], 10) * factor) / 5) * 5);
        next.amount = `${newG}g`;
      }
      return next;
    }),
  };
  return scaled;
};

// ------------------------------------------------------------
// PUBLIC: buildPlanIntro
// ------------------------------------------------------------
// Goal-aware first-line copy for the chat bubble that introduces the
// generated plan. The card itself shows totals; this is the warmup.
export const buildPlanIntro = ({ plan, profile }) => {
  const userName = profile?.name || '';
  const goal = normalizeGoal(profile?.goal);
  const remaining = plan?.remaining?.calories ?? 0;
  const allowed = plan?.allowedCalories ?? remaining;

  const namePart = userName ? `${userName}, ` : '';

  if (!plan?.meals || plan.meals.length === 0) {
    return `${namePart}${plan?.capMessage || 'יום מאוזן! אין צורך לדחוף עוד 🎯'}`;
  }

  const goalIntros = {
    cut: [
      `${namePart}הנה הצעה מאוזנת ודלת קלוריות לסיום היום 🎯`,
      `${namePart}תפריט חכם להמשך — שובע גבוה, קלוריות בשליטה ✨`,
    ],
    maintain: [
      `${namePart}הנה תפריט מאוזן להמשך היום 🥗`,
      `${namePart}הצעה מאוזנת לסיום היום — לפי המאזן שלך 🍽️`,
    ],
    lean_bulk: [
      `${namePart}הנה תפריט מותאם לבניית מסה — צפוף וטעים 💪`,
      `${namePart}תפריט שמסיים את היעד בלי מאמץ מיותר 🚀`,
    ],
    bulk: [
      `${namePart}הנה תפריט עשיר לסיום היעד — בוא נדחוף 💪`,
      `${namePart}תפריט דחוס וטעים — הכל לגיטימי כשהמטרה היא מסה 🍕`,
    ],
  };

  const intro = pickRandom(goalIntros[goal] || goalIntros.maintain);
  const capLine = plan.capped ? `\n\n${plan.capMessage}` : '';
  const allowedLine = plan.capped
    ? `\nממליץ על ${allowed} קל׳ בלבד — נסיים את היום באיזון.`
    : `\nנשארו ${remaining} קל׳ — חילקתי אותן לארוחות הבאות.`;

  return `${intro}${allowedLine}${capLine}`;
};

export default {
  buildMealPlan,
  swapMeal,
  enforceOvershootGuard,
  getDailyTargetSnapshot,
  buildPlanIntro,
  PER_SLOT_CAL_CEILING,
  OVERSHOOT_LIMIT,
};
