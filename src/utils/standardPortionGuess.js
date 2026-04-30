import { STANDARD_PORTIONS } from '../api/referenceWeights';

function portionGrams(key, portionIdx) {
  const list = STANDARD_PORTIONS[key]?.portions;
  if (!list?.length) return null;
  const i = Math.min(Math.max(portionIdx, 0), list.length - 1);
  return list[i]?.grams ?? null;
}

function gramGuess(defaultGrams, minGrams, maxGrams, step, summaryLine) {
  return {
    mode: 'grams',
    defaultGrams,
    minGrams,
    maxGrams,
    step,
    summaryLine,
  };
}

function unitGuess(defaultUnits, minUnits, maxUnits, gramsPerUnit, summaryLine) {
  return {
    mode: 'units',
    defaultUnits,
    minUnits,
    maxUnits,
    gramsPerUnit,
    summaryLine,
  };
}

function defaultGramGuess() {
  return gramGuess(150, 50, 400, 10, 'מנה מוערכת (~150 גרם)?');
}

/**
 * Heuristic standard portion for vague food logs (Hebrew names).
 * Attached to chat quantity flow for Yes / Other UX.
 */
export function attachPortionGuesses(items) {
  return (items || []).map((item) => ({
    ...item,
    portionGuess: guessPortionForName(String(item?.name ?? '').trim()),
  }));
}

function guessPortionForName(name) {
  if (!name) return defaultGramGuess();
  const lower = name.toLowerCase();

  if (/תפוחי?\s*אדמה|בטטה/.test(lower)) {
    const g = portionGrams('vegetables_cooked', 1) || 150;
    return gramGuess(g, 80, 320, 10, `מנת תפוחי אדמה / ירק מבושל (~${g} גרם)?`);
  }

  if (/(אנטריקוט|ריב\s*איי|ribeye)/i.test(name)) {
    const g = portionGrams('meat_steak', 2) || 250;
    return gramGuess(g, 120, 420, 10, `חתיכת אנטריקוט בינונית־גדולה (~${g} גרם)?`);
  }

  if (
    /סטייק|צלי|פילה|בשר|המבורגר|קבב|קציצת/.test(lower) &&
    !/כבד|עוף|דג|טונה|סלמון/.test(lower)
  ) {
    const g = portionGrams('meat_steak', 1) || 180;
    return gramGuess(g, 100, 400, 10, `חתיכת בשר בינונית (~${g} גרם)?`);
  }

  if (/חזה\s*עוף|סטייק\s*עוף|עוף/.test(lower)) {
    const g = portionGrams('chicken_breast', 1) || 150;
    return gramGuess(g, 80, 280, 10, `חתיכת עוף בינונית (~${g} גרם)?`);
  }

  if (/בננה/.test(lower)) {
    const g = portionGrams('banana', 1) || 120;
    return unitGuess(1, 1, 8, g, `בננה אחת בגודל בינוני (~${g} גרם להערכה)?`);
  }

  if (/תפוח/.test(lower) && !/תפוחי?\s*אדמה/.test(lower)) {
    const g = portionGrams('apple', 1) || 180;
    return unitGuess(1, 1, 6, g, `תפוח בינוני אחד (~${g} גרם להערכה)?`);
  }

  if (/ביצה|ביצים/.test(lower)) {
    const g = portionGrams('egg', 0) || 50;
    return unitGuess(1, 1, 8, g, `ביצה בינונית אחת (~${g} גרם)?`);
  }

  if (/יוגורט|יוגורטי/.test(lower)) {
    const g = portionGrams('yogurt_container', 1) || 150;
    return gramGuess(g, 100, 300, 5, `גביע יוגורט טיפוסי (~${g} גרם)?`);
  }

  if (/קוטג|קוטג׳/.test(lower)) {
    const g = portionGrams('cottage_cheese', 1) || 200;
    return gramGuess(g, 120, 300, 10, `מנת קוטג׳ טיפוסית (~${g} גרם)?`);
  }

  if (/גבינה|צהובה|מוצרלה|פרמזן|פארמה|קשקבל|גאודה|עזים/.test(lower)) {
    return gramGuess(60, 20, 150, 5, 'כמות גבינה כמו שתי פרוסות (~60 גרם)?');
  }

  if (/פסטה|ספגטי/.test(lower)) {
    const g = portionGrams('pasta_cooked', 1) || 180;
    return gramGuess(g, 80, 350, 10, `מנת פסטה מבושלת (~${g} גרם)?`);
  }

  if (/אורז/.test(lower)) {
    const g = portionGrams('rice_cooked', 1) || 150;
    return gramGuess(g, 80, 300, 10, `מנת אורז מבושל (~${g} גרם)?`);
  }

  if (/חומוס/.test(lower)) {
    return gramGuess(30, 15, 120, 5, 'מריחת חומוס בינונית (~30 גרם)?');
  }

  if (/לחמניה|פיתה|באגט|כריך|סנד/.test(lower)) {
    let g = 80;
    if (/פיתה/.test(lower)) g = portionGrams('pita', 0) || 60;
    else if (/פרוסת|לחם|טוסט/.test(lower)) g = portionGrams('bread_slice', 0) || 30;
    return unitGuess(1, 1, 4, g, `יחידה אחת (~${g} גרם להערכה)?`);
  }

  if (/דג|סלמון|טונה/.test(lower)) {
    const g = portionGrams('fish_fillet', 1) || 150;
    return gramGuess(g, 80, 280, 10, `מנת דג / טונה (~${g} גרם)?`);
  }

  return defaultGramGuess();
}

export function buildPortionConfirmIntro(items) {
  const list = (items || []).filter(Boolean);
  const lines = list.map((it) => {
    const g = it.portionGuess;
    const label = it.name || 'מזון';
    if (!g) return `• **${label}**`;
    const hint = String(g.summaryLine || '').replace(/\?$/, '').trim();
    return `• **${label}** — ${hint}`;
  });

  let headline;
  if (list.length === 0) {
    headline = '**האם זו הייתה המנה?**';
  } else if (list.length === 1) {
    const it = list[0];
    const g = it.portionGuess;
    const label = it.name || 'מזון';
    if (!g) {
      headline = `**האם זו הייתה ${label}?**`;
    } else {
      const hint = String(g.summaryLine || '').replace(/\?$/, '').trim();
      headline = `**האם זו הייתה ${label} — ${hint}?**`;
    }
  } else {
    headline = '**האם אלה היו המנות והכמויות?**';
  }

  return (
    `${headline}\n\n${lines.join('\n')}\n\n` +
    `**הוסף** — נכנסות למאזן. **לא** — עריכה לפני הרישום.`
  );
}

export function defaultTotalGramsForFood(item) {
  const g = item?.portionGuess;
  if (!g) return null;
  if (g.mode === 'units') {
    const u = g.defaultUnits ?? 1;
    const per = g.gramsPerUnit ?? 100;
    return Math.max(1, Math.round(u * per));
  }
  return Math.max(1, Math.round(g.defaultGrams ?? 150));
}

export function gramsFromPortionDraft(item, draft) {
  const g = item?.portionGuess;
  if (!g) {
    const grams = draft?.grams ?? 150;
    return Math.max(1, Math.round(grams));
  }
  if (g.mode === 'units') {
    const u = Math.round(draft?.units ?? g.defaultUnits ?? 1);
    const per = g.gramsPerUnit || 100;
    return Math.max(1, Math.round(u * per));
  }
  const grams = draft?.grams ?? g.defaultGrams ?? 150;
  return Math.max(1, Math.round(grams));
}

export function buildFoodsFromPortionDrafts(items, drafts) {
  return (items || []).map((food, i) => {
    const grams = gramsFromPortionDraft(food, drafts[i]);
    const mult = grams / 100;
    const k100 = food.calories_per_100g ?? 100;
    const p100 = food.protein_per_100g ?? 5;
    const f100 = food.fat_per_100g ?? 3;
    const c100 = food.carbs_per_100g ?? 15;
    return {
      name: food.name,
      grams,
      calories: Math.round(k100 * mult),
      protein: Math.round(p100 * mult * 10) / 10,
      fat: Math.round(f100 * mult * 10) / 10,
      carbs: Math.round(c100 * mult * 10) / 10,
    };
  });
}
