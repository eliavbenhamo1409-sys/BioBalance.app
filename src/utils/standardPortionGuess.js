import { STANDARD_PORTIONS } from '../api/referenceWeights';

/** כוס מדידה בישול ~240 מ״ל; ספל בית עד ~330 מ״ל; למעלה מ־400 מ״ל זה בקבוק */
const LIQ_CUP_HINT =
  'כוס מדידת נוזל כ־240 מ״ל; ספל בית טיפוסי עד ~330 מ״ל. למעלה מ־400 מ״ל בדרך כלל בקבוק/אריזה, לא כוס שתייה רגילה.';

/** מינימום–מקסימום תחת הסרגל ותוויות לפי מאכל */
export const PORTION_TICK_COUNT = 5;

/**
 * סולם לכל קטגוריה — מילה אחת, **קונקרטית ומדידה**:
 * כלי (כף/ספל/קערה/גביע), יחידה ידועה (פרוסה/חופן/כדור) או ספירה (שתיים/שלוש).
 * אסור: «גדול/רחב/רבע» לבד — הם מעורפלים בלי הקשר.
 */
const SOLID_UTENSIL_LADDER = Object.freeze({
  liquid_pour: null,
  liquid_beer: null,
  liquid_wine: null,
  liquid_oil: null,
  snack_dense: ['מעט', 'חופן', 'כוס', 'קערה', 'כפול'],
  starch_heavy: ['כף', 'ספל', 'צלחת', 'גדושה', 'קערה'],
  protein_piece: ['ביס', 'קטנה', 'יד', 'נדיבה', 'כפולה'],
  fish_piece: ['פיסה', 'קטן', 'פילה', 'עבה', 'גדוש'],
  veg_starch_side: ['חצי', 'יחידה', 'גדושה', 'שתיים', 'שלוש'],
  salad_plate: ['כף', 'קערית', 'צלחת', 'קערה', 'משפחתית'],
  chips_fried: ['כף', 'צד', 'מנה', 'גדושה', 'קערה'],
  dairy_yogurt: ['כפית', 'חצי', 'גביע', 'גדוש', 'שניים'],
  dairy_spoon: ['כפית', 'כף', 'שתיים', 'שלוש', 'גביע'],
  cheese_slices: ['פרוסה', 'שתיים', 'שלוש', 'ארבע', 'חמש'],
  sweet_scoop: ['טעימה', 'כדור', 'שניים', 'שלושה', 'קערה'],
  hummus_layer: ['כפית', 'כף', 'שתיים', 'קערית', 'קערה'],
  spread_spoon: ['כפית', 'כף', 'שתיים', 'שלוש', 'מריחה'],
  butter_pat: ['קוביה', 'פרוסה', 'שתיים', 'נדיב', 'גוש'],
  soup_bowl: ['כוס', 'ספל', 'קערה', 'גדושה', 'סיר'],
  solid_fallback: ['מעט', 'קטנה', 'רגילה', 'נדיבה', 'כפולה'],
});

/** נוזל — מילה אחת מתחת ל־~מ״ל; כלי ידוע במקום «רבע/חצי» לבד */
const LIQUID_UTENSIL_LADDER = Object.freeze({
  liquid_pour: ['לגימה', 'מזיגה', 'חצי', 'כוס', 'בקבוק'],
  liquid_beer: ['לגימה', 'מזיגה', 'חצי', 'פחית', 'ליטר'],
  liquid_wine: ['לגימה', 'חצי', 'כוס', 'מלאה', 'בקבוק'],
  liquid_oil: ['כפית', 'כף', 'מזיגה', 'כוס', 'בקבוק'],
});

function normalizeTickSlice(labels, count) {
  const a = [...labels];
  while (a.length < count) a.push(a[a.length - 1] || '⋯');
  return a.slice(0, count);
}

function roundDisplayGram(g) {
  if (!Number.isFinite(g)) return '—';
  const x = Math.max(0, g);
  if (x < 25) return String(Math.max(5, Math.round(x / 5) * 5));
  if (x < 200) return String(Math.round(x / 10) * 10);
  return String(Math.round(x / 25) * 25);
}

function roundDisplayMl(ml) {
  if (!Number.isFinite(ml)) return '—';
  const x = Math.max(0, ml);
  if (x < 80) return String(Math.max(10, Math.round(x / 10) * 10));
  if (x < 400) return String(Math.round(x / 25) * 25);
  return String(Math.round(x / 50) * 50);
}

function tickAnchorValues(minV, maxV, count = PORTION_TICK_COUNT) {
  if (!Number.isFinite(minV) || !Number.isFinite(maxV)) return [];
  if (maxV <= minV) return Array(count).fill(minV);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(minV + ((maxV - minV) * i) / (count - 1));
  }
  return out;
}

function solidLadderForGuess(guess) {
  const key =
    typeof guess.tickProfile === 'string' &&
    guess.tickProfile &&
    guess.tickProfile.startsWith('liquid_')
      ? 'solid_fallback'
      : guess.tickProfile || 'solid_fallback';
  return (
    SOLID_UTENSIL_LADDER[key] ||
    SOLID_UTENSIL_LADDER.solid_fallback
  );
}

function liquidLadder(guess) {
  const lp = guess.tickProfile || 'liquid_pour';
  return LIQUID_UTENSIL_LADDER[lp] || LIQUID_UTENSIL_LADDER.liquid_pour;
}

function formatTickPair(measureLine, wordLine) {
  return `${measureLine}\n${wordLine}`;
}

/** bounds: { minG, maxG } מאותו סליידר — התוויות מיושרות לנקודות שוות בטווח */
function portionGramLabelsFromGuess(guess, bounds, displayName) {
  if (
    guess &&
    guess.mode === 'grams' &&
    Array.isArray(guess.tickLabels) &&
    guess.tickLabels.length >= PORTION_TICK_COUNT
  ) {
    return normalizeTickSlice(guess.tickLabels, PORTION_TICK_COUNT);
  }

  const minG =
    bounds && Number.isFinite(bounds.minG)
      ? bounds.minG
      : Math.max(0, guess?.minGrams ?? 0);
  const maxGEff =
    bounds && Number.isFinite(bounds.maxG) ? bounds.maxG : guess?.maxGrams;
  const maxG = Number.isFinite(maxGEff)
    ? maxGEff
    : Number.isFinite(guess?.defaultGrams)
      ? Math.max(minG + 10, guess.defaultGrams * 2)
      : minG + 200;

  const anchors = tickAnchorValues(minG, maxG);

  let gMeta = guess && guess.mode === 'grams' ? { ...guess } : {};
  const hintName =
    typeof displayName === 'string' && displayName.trim()
      ? displayName.trim()
      : '';
  const nameHint = hintName ? guessPortionForName(hintName) : null;
  if (
    nameHint?.mode === 'grams' &&
    nameHint.tickProfile &&
    nameHint.tickProfile !== 'solid_fallback' &&
    nameHint.scaleMode !== 'liquid' &&
    gMeta.scaleMode !== 'liquid' &&
    (!gMeta.tickProfile || gMeta.tickProfile === 'solid_fallback')
  ) {
    gMeta = {
      ...gMeta,
      tickProfile: nameHint.tickProfile,
    };
  }
  const isLiquid = gMeta.scaleMode === 'liquid';
  if (isLiquid) {
    const names = normalizeTickSlice(liquidLadder(gMeta), PORTION_TICK_COUNT);
    const perMl =
      typeof gMeta.gramsPerMl === 'number' && gMeta.gramsPerMl > 0
        ? gMeta.gramsPerMl
        : 1;
    return anchors.map((gram, i) => {
      const ml = gram / perMl;
      const mls = roundDisplayMl(ml);
      return formatTickPair(`~${mls}מ״ל`, names[i]);
    });
  }

  const ladder = normalizeTickSlice(solidLadderForGuess(gMeta), PORTION_TICK_COUNT);

  return anchors.map((gram, i) => {
    const gStr = roundDisplayGram(gram);
    return formatTickPair(`~${gStr}ג׳`, ladder[i]);
  });
}

/** @param {object} guess - portionGuess
 *  @param {{ minG?: number, maxG?: number }} [bounds]
 *  @param {string} [displayName] כותרת הפריט — לבחירת סולם כלים כשזיהוי הגרם חלש או בשפה זרה (למשל olives)
 */
export function portionGramTickLabels(guess, bounds, displayName) {
  if (!guess || guess.mode !== 'grams') {
    const minG =
      bounds?.minG != null && Number.isFinite(bounds.minG) ? bounds.minG : 0;
    const maxG =
      bounds?.maxG != null && Number.isFinite(bounds.maxG)
        ? bounds.maxG
        : minG + 300;
    const anchors = tickAnchorValues(minG, maxG);
    const hint =
      typeof displayName === 'string' && displayName.trim()
        ? guessPortionForName(displayName.trim())
        : null;
    let ladderRow = SOLID_UTENSIL_LADDER.solid_fallback;
    if (hint?.mode === 'grams' && hint.tickProfile && hint.tickProfile !== 'solid_fallback') {
      const row = SOLID_UTENSIL_LADDER[hint.tickProfile];
      if (row && hint.scaleMode !== 'liquid') ladderRow = row;
    }
    const ladder = normalizeTickSlice(ladderRow, PORTION_TICK_COUNT);
    return anchors.map((gram, i) =>
      formatTickPair(`~${roundDisplayGram(gram)}ג׳`, ladder[i])
    );
  }
  return portionGramLabelsFromGuess(guess, bounds, displayName);
}

/** יחידות — מילה מתחת ל־«N יח׳»; ספירה במילים, לא תארים מעורפלים */
const UNIT_UTENSIL_LADDER = Object.freeze({
  fruit: ['—', 'אחד', 'שניים', 'שלושה', 'ארבעה'],
  egg: ['—', 'אחת', 'שתיים', 'שלוש', 'ארבע'],
  omelette_eggs: ['אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש'],
  flatbread_pita: ['—', 'אחת', 'שתיים', 'שלוש', 'ארבע'],
  bread_slices: ['—', 'אחת', 'שתיים', 'שלוש', 'ארבע'],
  bread_roll: ['—', 'אחת', 'שתיים', 'שלוש', 'ארבע'],
  sandwich_unit: ['—', 'אחד', 'שניים', 'שלושה', 'ארבעה'],
});

function portionUnitLabelsFromGuess(guess, bounds) {
  let minU = bounds?.minU != null ? bounds.minU : guess?.minUnits ?? 0;
  let maxU = bounds?.maxU != null ? bounds.maxU : guess?.maxUnits ?? 8;
  if (!Number.isFinite(minU)) minU = 0;
  if (!Number.isFinite(maxU)) maxU = 8;
  if (maxU < minU) [minU, maxU] = [maxU, minU];

  if (!guess || guess.mode !== 'units') {
    const key = 'bread_roll';
    const ladder = normalizeTickSlice(UNIT_UTENSIL_LADDER[key], PORTION_TICK_COUNT);
    const anchors = tickAnchorValues(minU, maxU).map((v) => Math.round(v));
    return anchors.map((u, i) => formatTickPair(`~${u} יח׳`, ladder[i]));
  }

  if (Array.isArray(guess.unitTickLabels) && guess.unitTickLabels.length >= PORTION_TICK_COUNT) {
    return normalizeTickSlice(guess.unitTickLabels, PORTION_TICK_COUNT);
  }

  const uk = guess.unitTickProfile || 'bread_roll';
  const ladder = normalizeTickSlice(
    UNIT_UTENSIL_LADDER[uk] || UNIT_UTENSIL_LADDER.bread_roll,
    PORTION_TICK_COUNT
  );
  const anchors = tickAnchorValues(minU, maxU).map((v) =>
    Math.round(Math.min(maxU, Math.max(minU, v)))
  );

  return anchors.map((u, i) => formatTickPair(`~${u} יח׳`, ladder[i]));
}

/** @param {{ minU?: number, maxU?: number }} [bounds] */
export function portionUnitTickLabels(guess, bounds) {
  return portionUnitLabelsFromGuess(guess, bounds);
}

function portionGrams(key, portionIdx) {
  const list = STANDARD_PORTIONS[key]?.portions;
  if (!list?.length) return null;
  const i = Math.min(Math.max(portionIdx, 0), list.length - 1);
  return list[i]?.grams ?? null;
}

/** זיתים כמזון — לא שמן זית */
function isOlivesHeuristic(lower) {
  if (/שמן\s*זית|olive\s+oil/i.test(lower)) return false;
  if (/זית/.test(lower)) return true;
  return /\bolives\b/i.test(lower) || /\bolive\b/i.test(lower);
}

function isSnackDenseNutsOrSeedsHeuristic(lower) {
  if (/פיסטוק|בוטנ|שקד|קשיו|פקאן|מקדמיה|אגוז|גרעינ/i.test(lower))
    return true;
  return (
    /\b(cashews?|walnuts?|almonds?|peanuts?|pistachios?|pecans?|macadamias?|hazelnuts?|mixed\s+nuts|pine\s+nuts)\b/i.test(
      lower,
    ) || /\b(sunflower|pumpkin)\s+seeds?\b/i.test(lower)
  );
}

/** חטיף צפוף (זיתים ואגוזים) — אותו סרגל מתחת למחוון */
function gramSnackDense(standardLabel, isFem = false) {
  const g = portionGrams('nuts_handful', 1) || 30;
  return gramGuess(
    g,
    15,
    220,
    5,
    `חופון רגיל (בערך ${g} גרם)`,
    standardLabel,
    isFem,
    { tickProfile: 'snack_dense' },
  );
}

function gramGuess(
  defaultGrams,
  minGrams,
  maxGrams,
  step,
  summaryLine,
  standardLabel = null,
  isFem = true,
  scaleOpts = null
) {
  const so = scaleOpts && typeof scaleOpts === 'object' ? scaleOpts : {};
  return {
    mode: 'grams',
    defaultGrams,
    minGrams,
    maxGrams,
    step,
    summaryLine,
    standardLabel,
    isFem,
    scaleMode: so.scaleMode === 'liquid' ? 'liquid' : 'solid',
    gramsPerMl:
      typeof so.gramsPerMl === 'number' && so.gramsPerMl > 0 ? so.gramsPerMl : 1,
    liquidFoot: typeof so.liquidFoot === 'string' ? so.liquidFoot : null,
    solidCupGrams:
      typeof so.solidCupGrams === 'number' && so.solidCupGrams > 0
        ? so.solidCupGrams
        : null,
    solidFoot: typeof so.solidFoot === 'string' ? so.solidFoot : null,
    tickProfile:
      typeof so.tickProfile === 'string'
        ? so.tickProfile
        : so.scaleMode === 'liquid'
          ? 'liquid_pour'
          : 'solid_fallback',
    tickLabels: Array.isArray(so.tickLabels) ? so.tickLabels : null,
  };
}

function unitGuess(
  defaultUnits,
  minUnits,
  maxUnits,
  gramsPerUnit,
  summaryLine,
  standardLabel = null,
  isFem = true,
  unitOpts = null
) {
  const uo = unitOpts && typeof unitOpts === 'object' ? unitOpts : {};
  return {
    mode: 'units',
    defaultUnits,
    minUnits,
    maxUnits,
    gramsPerUnit,
    summaryLine,
    standardLabel,
    isFem,
    unitFoot: typeof uo.unitFoot === 'string' ? uo.unitFoot : null,
    unitTickProfile:
      typeof uo.unitTickProfile === 'string' ? uo.unitTickProfile : 'bread_roll',
    unitTickLabels: Array.isArray(uo.unitTickLabels) ? uo.unitTickLabels : null,
  };
}

function defaultGramGuess() {
  return gramGuess(150, 50, 400, 10, 'בערך 150 גרם', null, true, {
    tickProfile: 'solid_fallback',
    solidFoot:
      'מוצק: «כוס מלאה» שונה מנוזל — כוס פסטה מבושלת שוקלת הרבה יותר מכוס חלב באותו נפח.',
  });
}

/**
 * Heuristic standard portion for vague food logs (Hebrew names).
 * Attached to chat quantity flow for Yes / Other UX.
 *
 * Each guess carries:
 *   - summaryLine: short fallback hint (e.g. "בערך 150 גרם")
 *   - standardLabel: natural Hebrew portion phrase ("מנה סטנדרטית של פסטה",
 *     "כוס חלב רגילה", "חופן בוטנים") used to ask "האם זו הייתה ___?"
 *   - isFem: gender of the head noun in `standardLabel`, used to pick
 *     "האם זו הייתה" (fem) vs "האם זה היה" (masc) so the question reads naturally.
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

  // ---------- Drinks (cup-based) ----------
  if (/חלב/.test(lower) && !/חלבון|חלבונים/.test(lower)) {
    return gramGuess(
      250,
      100,
      400,
      10,
      'כוס רגילה (בערך 250 מ"ל)',
      'כוס חלב רגילה',
      true,
      {
        scaleMode: 'liquid',
        gramsPerMl: 1.03,
        liquidFoot: LIQ_CUP_HINT,
        tickProfile: 'liquid_pour',
      }
    );
  }
  // מיץ, שייק, נקטר
  if (
    /\b(smoothie|shake|juice|nectar)\b|שייק|מיץ(?!\s*מתרכז)/i.test(lower) &&
    !/חלבון|חלבונים/.test(lower)
  ) {
    return gramGuess(
      220,
      60,
      500,
      10,
      'כוס מיץ / שייק (בערך 220 מ״ל)',
      'כוס משקה מתוק',
      false,
      {
        scaleMode: 'liquid',
        gramsPerMl: 1.02,
        liquidFoot: LIQ_CUP_HINT,
        tickProfile: 'liquid_pour',
      }
    );
  }
  if (/קפה/.test(lower)) {
    return gramGuess(
      200,
      50,
      500,
      10,
      'ספל רגיל (בערך 200 מ"ל)',
      'ספל קפה רגיל',
      false,
      {
        scaleMode: 'liquid',
        liquidFoot: `${LIQ_CUP_HINT} קפה עם חלב — לפי נפח המשקה.`,
        tickProfile: 'liquid_pour',
      }
    );
  }
  if (/(^|\s)תה($|\s)/.test(lower)) {
    return gramGuess(
      250,
      100,
      600,
      10,
      'כוס רגילה (בערך 250 מ"ל)',
      'כוס תה רגילה',
      true,
      {
        scaleMode: 'liquid',
        liquidFoot: LIQ_CUP_HINT,
        tickProfile: 'liquid_pour',
      }
    );
  }
  if (/(^|\s)מים($|\s)/.test(lower)) {
    return gramGuess(
      250,
      50,
      800,
      10,
      'כוס רגילה (בערך 250 מ"ל)',
      'כוס מים רגילה',
      true,
      {
        scaleMode: 'liquid',
        liquidFoot: LIQ_CUP_HINT,
        tickProfile: 'liquid_pour',
      }
    );
  }
  if (/יין/.test(lower)) {
    return gramGuess(
      150,
      50,
      500,
      10,
      'כוס רגילה (בערך 150 מ"ל)',
      'כוס יין רגילה',
      true,
      {
        scaleMode: 'liquid',
        liquidFoot:
          'יין נמדד במ״ל; כוס יין טיפוסית קטנה מכוס מים (בערך ‎150 מ״ל).',
        tickProfile: 'liquid_wine',
      }
    );
  }
  if (/בירה/.test(lower)) {
    return gramGuess(
      330,
      100,
      750,
      10,
      'פחית רגילה (בערך 330 מ"ל)',
      'פחית בירה רגילה',
      true,
      {
        scaleMode: 'liquid',
        liquidFoot: 'בירה: פחית ‎330 מ״ל · חצי ליטר ‎500 מ״ל.',
        tickProfile: 'liquid_beer',
      }
    );
  }

  // שמני בישול / מ״ל — לא זיתים לאכילה
  if (
    /שמן\s*זית|שמן\s*קנולה|שמן\s*גלעיני|שמן\s*סויה|שמן\s*חמניה|שמן\s*גרעיני|שמן\s*אגוז|שמן\s*פשתן|vegetable\s+oil|olive\s+oil|sesame\s+oil|coconut\s+oil|cooking\s+oil|walnut\s+oil|\bcanola\b|\bpeanut\s+oil\b|^שמן\s*$/i.test(
      lower,
    ) ||
    /גרעיני\s+חמניה|גרעיני\s+חמנייה/i.test(lower)
  ) {
    return gramGuess(
      14,
      3,
      120,
      2,
      'כף שמן בישול (בערך 14 מ״ל)',
      'כף שמן בישול',
      false,
      {
        scaleMode: 'liquid',
        gramsPerMl: 0.92,
        liquidFoot: `${LIQ_CUP_HINT} כף בישול טיפוסית בערך 14–15 מ״ל שמן.`,
        tickProfile: 'liquid_oil',
      }
    );
  }

  // --------- זיתים ואגוזים — סרגל אחיד (מעט…כפול)
  if (isOlivesHeuristic(lower)) {
    return gramSnackDense('חופון זיתים', false);
  }
  if (isSnackDenseNutsOrSeedsHeuristic(lower)) {
    let label = 'חופון אגוזים';
    if (/פיסטוק/i.test(lower)) label = 'חופון פיסטוקים';
    else if (/בוטנ/i.test(lower)) label = 'חופון בוטנים';
    else if (/שקד/i.test(lower)) label = 'חופון שקדים';
    else if (/קשיו/i.test(lower)) label = 'חופון קשיו';
    else if (/פקאן/i.test(lower)) label = 'חופון פקאנים';
    else if (/מקדמיה/i.test(lower)) label = 'חופון אגוזי מקדמיה';
    else if (/גרעינ/i.test(lower)) label = 'חופון גרעינים';
    return gramSnackDense(label, false);
  }

  // ---------- Vegetables / starches (לפי יחידה — הכי מדיד) ----------
  if (/בטטה/.test(lower)) {
    return unitGuess(
      1,
      1,
      4,
      200,
      'בטטה אחת בינונית (בערך 200 גרם)',
      'בטטה אחת בינונית',
      true,
      { unitTickProfile: 'fruit' }
    );
  }
  if (/תפוחי?\s*אדמה|\bbaked\s+potato\b/i.test(lower)) {
    return unitGuess(
      1,
      1,
      4,
      170,
      'תפוח אדמה אחד בינוני (בערך 170 גרם)',
      'תפוח אדמה אחד בינוני',
      false,
      { unitTickProfile: 'fruit' }
    );
  }
  if (/צ['׳]?יפס/.test(lower)) {
    return gramGuess(
      150,
      50,
      400,
      10,
      'מנה רגילה (בערך 150 גרם)',
      'מנה רגילה של צ׳יפס',
      true,
      { tickProfile: 'chips_fried' }
    );
  }
  if (/סלט/.test(lower)) {
    return gramGuess(
      200,
      80,
      500,
      10,
      'צלחת רגילה (בערך 200 גרם)',
      'צלחת סלט רגילה',
      true,
      { tickProfile: 'salad_plate' }
    );
  }

  // ---------- Meats ----------
  if (/(אנטריקוט|ריב\s*איי|ribeye)/i.test(name)) {
    const g = portionGrams('meat_steak', 2) || 250;
    return gramGuess(
      g,
      120,
      420,
      10,
      `סטייק בינוני־גדול (בערך ${g} גרם)`,
      'סטייק אנטריקוט בינוני־גדול',
      false,
      { tickProfile: 'protein_piece' }
    );
  }
  if (/המבורגר/.test(lower)) {
    const g = portionGrams('meat_steak', 1) || 180;
    return gramGuess(
      g,
      80,
      350,
      10,
      `יחידה אחת (בערך ${g} גרם)`,
      'המבורגר אחד רגיל',
      false,
      { tickProfile: 'protein_piece' }
    );
  }
  if (/קבב/.test(lower)) {
    const g = portionGrams('meat_steak', 1) || 180;
    return gramGuess(
      g,
      80,
      350,
      10,
      `מנה רגילה (בערך ${g} גרם)`,
      'מנה רגילה של קבב',
      true,
      { tickProfile: 'protein_piece' }
    );
  }
  if (/קציצ/.test(lower)) {
    return gramGuess(
      150,
      60,
      300,
      10,
      'מנה רגילה (בערך 150 גרם)',
      'מנה של קציצות בשר',
      true,
      { tickProfile: 'protein_piece' }
    );
  }
  if (
    /סטייק|צלי|פילה|בשר/.test(lower) &&
    !/כבד|עוף|דג|טונה|סלמון/.test(lower)
  ) {
    const g = portionGrams('meat_steak', 1) || 180;
    return gramGuess(
      g,
      100,
      400,
      10,
      `חתיכה בינונית (בערך ${g} גרם)`,
      'חתיכת בשר בינונית',
      true,
      { tickProfile: 'protein_piece' }
    );
  }
  if (/חזה\s*עוף|סטייק\s*עוף|עוף/.test(lower)) {
    const g = portionGrams('chicken_breast', 1) || 150;
    return gramGuess(
      g,
      80,
      280,
      10,
      `חתיכה בינונית (בערך ${g} גרם)`,
      'חתיכת עוף בינונית',
      true,
      { tickProfile: 'protein_piece' }
    );
  }
  if (/דג|סלמון|טונה/.test(lower)) {
    const g = portionGrams('fish_fillet', 1) || 150;
    return gramGuess(
      g,
      80,
      280,
      10,
      `מנה רגילה (בערך ${g} גרם)`,
      'מנה רגילה של דג',
      true,
      { tickProfile: 'fish_piece' }
    );
  }

  // ---------- Fruits ----------
  if (/בננה/.test(lower)) {
    const g = portionGrams('banana', 1) || 120;
    return unitGuess(
      1,
      1,
      8,
      g,
      `בננה אחת בגודל בינוני (בערך ${g} גרם)`,
      'בננה אחת בגודל בינוני',
      true,
      { unitTickProfile: 'fruit' }
    );
  }
  if (/תפוח/.test(lower) && !/תפוחי?\s*אדמה/.test(lower)) {
    const g = portionGrams('apple', 1) || 180;
    return unitGuess(
      1,
      1,
      6,
      g,
      `תפוח אחד בגודל בינוני (בערך ${g} גרם)`,
      'תפוח אחד בגודל בינוני',
      false,
      { unitTickProfile: 'fruit' }
    );
  }

  // ---------- Eggs / omelette / shakshuka ----------
  // חביתה — נמדדת לפי **מספר ביצים** (הכי מדיד שיש). 1 ביצה ≈ ‎55 גרם עם תוסף קטן.
  if (/חביתה|חביתות|אומלט|\bomelet(te)?\b|שקשוק|\bshakshuka\b/i.test(lower)) {
    return unitGuess(
      2,
      1,
      5,
      55,
      'חביתה משתי ביצים (בערך 110 גרם)',
      'חביתה משתי ביצים',
      true,
      { unitTickProfile: 'omelette_eggs' }
    );
  }
  if (/ביצה\s*עין|ביצת\s*עין|sunny[-\s]?side|fried\s+egg/i.test(lower)) {
    const g = portionGrams('egg', 0) || 50;
    return unitGuess(
      1,
      1,
      4,
      g,
      `ביצת עין (בערך ${g} גרם)`,
      'ביצת עין',
      true,
      { unitTickProfile: 'egg' }
    );
  }
  if (/ביצה|ביצים/.test(lower)) {
    const g = portionGrams('egg', 0) || 50;
    return unitGuess(
      1,
      1,
      8,
      g,
      `ביצה אחת בגודל בינוני (בערך ${g} גרם)`,
      'ביצה אחת בגודל בינוני',
      true,
      { unitTickProfile: 'egg' }
    );
  }

  // ---------- Dairy ----------
  if (/יוגורט|(^|\s)סקי(\s|$)|\bskyr\b/i.test(lower)) {
    const g = portionGrams('yogurt_container', 1) || 150;
    return gramGuess(
      g,
      100,
      300,
      5,
      `גביע אחד (בערך ${g} גרם)`,
      'גביע יוגורט סטנדרטי',
      false,
      { tickProfile: 'dairy_yogurt' }
    );
  }
  if (
    /קוטג|קוטג׳|ריקוטה|\bricotta\b|שמנת\s*חמוצה|\bsour\s+cream\b|טבורוג|קרם\s+טבורוג|\bfromage\s+blanc\b|\bquark\b|קווארק/i.test(
      lower,
    )
  ) {
    const g = portionGrams('cottage_cheese', 1) || 120;
    return gramGuess(
      g,
      40,
      280,
      5,
      `כמה כפות / חצי גביע (בערך ${g} גרם)`,
      'מנה בכף–גביע (קוטג׳/רך)',
      true,
      { tickProfile: 'dairy_spoon' }
    );
  }
  if (
    /גבינה\s*לבנה|לבנה\b|קרם\s*צ['׳]?יז|פטה|בולגרית|\bfeta\b|\bcream\s+cheese\b|גבינת\s*עזים|\bgoat\s+cheese\b|ניפול/i.test(
      lower,
    )
  ) {
    return gramGuess(
      45,
      15,
      180,
      5,
      'מנת גבינה רכה (בערך 45 גרם)',
      'מנת גבינה לבנה',
      true,
      { tickProfile: 'spread_spoon' }
    );
  }
  if (
    /גבינה\s*צהובה|מוצרל|פרמזן|פארמה|קשקבל|גאודה|אמנטל|צ׳דר|cheddar|gouda|קולבי|אדם|מנצג|מנצ׳|פרוסות?\s*גבינה|גבינה\s*בפרוסות|גבינה\s*קשה|גבינה\s*מגורדת/i.test(
      lower,
    ) ||
    (/גבינה/.test(lower) &&
      /צהוב|מותכת|קשה|פרוס|טוסט|בורקס|פיצה/i.test(lower) &&
      !/לבנה|פטה|קרם\s*צ|ריקוטה|\bricotta\b|עזים|בולגר/i.test(lower))
  ) {
    return gramGuess(
      60,
      20,
      150,
      5,
      'כשתי פרוסות (בערך 60 גרם)',
      'מנת גבינה צהובה (פרוסות)',
      true,
      { tickProfile: 'cheese_slices' }
    );
  }
  if (/גלידה/.test(lower)) {
    return gramGuess(
      120,
      50,
      300,
      10,
      'מנה רגילה (בערך 120 גרם)',
      'מנת גלידה רגילה',
      true,
      { tickProfile: 'sweet_scoop' }
    );
  }

  // ---------- Carbs / grains ----------
  if (/פסטה|ספגטי/.test(lower)) {
    const g = portionGrams('pasta_cooked', 1) || 180;
    const cupG = portionGrams('pasta_cooked', 3) || 140;
    return gramGuess(
      g,
      80,
      350,
      10,
      `מנה רגילה אחרי בישול (בערך ${g} גרם)`,
      'מנה סטנדרטית של פסטה',
      true,
      {
        solidCupGrams: cupG,
        solidFoot: `כוס מדידה של פסטה מבושלת (צפופה) ≈ ${cupG} גרם — לא אותו משקל כמו כוס חלב באותו נפח.`,
        tickProfile: 'starch_heavy',
      }
    );
  }
  if (/אורז/.test(lower)) {
    const g = portionGrams('rice_cooked', 1) || 150;
    const cupG = portionGrams('rice_cooked', 3) || 158;
    return gramGuess(
      g,
      80,
      300,
      10,
      `מנה רגילה אחרי בישול (בערך ${g} גרם)`,
      'מנה סטנדרטית של אורז',
      true,
      {
        solidCupGrams: cupG,
        solidFoot: `כוס מדידה של אורז מבושל ≈ ${cupG} גרם — יותר כבד מכוס מים ריקה.`,
        tickProfile: 'starch_heavy',
      }
    );
  }
  if (/שיבולת\s*שועל|דייסה|\boatmeal\b|\boats?\b|קוואקר/i.test(lower)) {
    return gramGuess(
      45,
      20,
      120,
      5,
      'מנת יבש (בערך 45 גרם)',
      'מנת שיבולת שועל',
      true,
      { tickProfile: 'starch_heavy' }
    );
  }
  if (/חומוס/.test(lower)) {
    return gramGuess(
      30,
      15,
      120,
      5,
      'מריחה רגילה (בערך 30 גרם)',
      'מריחת חומוס רגילה',
      true,
      { tickProfile: 'hummus_layer' }
    );
  }
  if (/חמאת\s*בוטנים|\bpeanut\s+butter\b|\bnutella\b|נוטלה/i.test(lower)) {
    return gramGuess(
      32,
      10,
      120,
      5,
      'כף מרוחה (בערך 32 גרם)',
      'כף ממרח',
      true,
      { tickProfile: 'spread_spoon' }
    );
  }
  if (/טחינה|\btahini\b|ריבה|דבש|מייפל|maple|ממרח(?!י)/i.test(lower)) {
    return gramGuess(
      20,
      5,
      80,
      5,
      'כף מרוחה (בערך 20 גרם)',
      'כף ממרח',
      true,
      { tickProfile: 'spread_spoon' }
    );
  }
  if (/חמאה|\bbutter\b|מרגרינ|margarine/i.test(lower)) {
    return gramGuess(
      10,
      3,
      40,
      2,
      'פרוסה דקה (בערך 10 גרם)',
      'פרוסת חמאה',
      true,
      { tickProfile: 'butter_pat' }
    );
  }
  if (/מרק|soup|מיסו|ramen|אטריות?\s*במרק/i.test(lower)) {
    return gramGuess(
      300,
      120,
      600,
      20,
      'קערה בינונית (בערך 300 גרם)',
      'קערת מרק',
      true,
      { tickProfile: 'soup_bowl' }
    );
  }

  // ---------- Bread family ----------
  if (/פיתה/.test(lower)) {
    const g = portionGrams('pita', 0) || 60;
    return unitGuess(
      1,
      1,
      4,
      g,
      `פיתה אחת (בערך ${g} גרם)`,
      'פיתה אחת רגילה',
      true,
      { unitTickProfile: 'flatbread_pita' }
    );
  }
  if (/לחמני/.test(lower)) {
    return unitGuess(
      1,
      1,
      4,
      80,
      'לחמניה אחת (בערך 80 גרם)',
      'לחמניה אחת רגילה',
      true,
      { unitTickProfile: 'bread_roll' }
    );
  }
  if (/באגט/.test(lower)) {
    return unitGuess(
      1,
      1,
      3,
      200,
      'יחידה אחת (בערך 200 גרם)',
      'באגט אחד',
      false,
      { unitTickProfile: 'bread_roll' }
    );
  }
  if (/כריך|סנדוויץ|סנד/.test(lower)) {
    return unitGuess(
      1,
      1,
      3,
      200,
      'כריך אחד (בערך 200 גרם)',
      'כריך אחד רגיל',
      false,
      { unitTickProfile: 'sandwich_unit' }
    );
  }
  if (/לחם|טוסט|פרוסת/.test(lower)) {
    const g = portionGrams('bread_slice', 0) || 30;
    return unitGuess(
      2,
      1,
      5,
      g,
      `שתי פרוסות (בערך ${g * 2} גרם)`,
      'שתי פרוסות לחם',
      true,
      { unitTickProfile: 'bread_slices' }
    );
  }

  return defaultGramGuess();
}

/** אותה לוגיקה כמו במזון שזוהה בצ׳אט — לצירוף מתאים בסיסי עם גרם נעול מהטקסט */
export function buildHeuristicPortionGuessForDisplayName(displayName) {
  return guessPortionForName(String(displayName ?? '').trim());
}

function approxGramsForGuess(g) {
  if (!g) return null;
  if (g.mode === 'units') {
    const u = g.defaultUnits ?? 1;
    const per = g.gramsPerUnit ?? 100;
    return Math.max(1, Math.round(u * per));
  }
  return Math.max(1, Math.round(g.defaultGrams ?? 150));
}

/** מזהה תוויות ברבים כמו «שתי פרוסות», «שלוש ביצים», «כמה אגוזים» */
const PLURAL_PREFIX_RE =
  /^(שתי|שני|שלוש|שלושה|ארבע|ארבעה|חמש|חמישה|שש|שישה|כמה|מספר|מנת)\b/;
const PLURAL_NOUN_RE =
  /\b(פרוסות|ביצים|כפות|כפיות|כדורים|כוסות|חתיכות|אגוזים|זיתים|פיתות|לחמניות|תפוחים|בננות|פירות|ירקות|חופנים)\b/;

function isPluralLabel(label) {
  const s = String(label || '').trim();
  if (!s) return false;
  return PLURAL_PREFIX_RE.test(s) || PLURAL_NOUN_RE.test(s);
}

function questionLead(isFem, label) {
  if (isPluralLabel(label)) return 'האם אלו היו';
  return isFem ? 'האם זו הייתה' : 'האם זה היה';
}

export function buildPortionConfirmIntro(items) {
  const list = (items || []).filter(Boolean);

  const cleanHint = (g) =>
    String(g?.summaryLine || '').replace(/\?$/, '').trim();

  if (list.length === 0) {
    return `**רק כדי לוודא:**`;
  }

  if (list.length === 1) {
    const it = list[0];
    const g = it.portionGuess;
    const label = it.name || 'מזון';

    if (g?.standardLabel) {
      const grams = approxGramsForGuess(g);
      const weightHint = grams != null ? ` (בערך ${grams} גרם)` : '';
      return (
        `**רק כדי לוודא:**\n\n` +
        `${questionLead(g.isFem, g.standardLabel)} **${g.standardLabel}**${weightHint}?`
      );
    }

    const hint = cleanHint(g);
    const detail = hint ? ` — ${hint}` : '';
    return (
      `**רק כדי לוודא:**\n\n` +
      `${questionLead(false, label)} **${label}**${detail}?`
    );
  }

  const lines = list.map((it) => {
    const g = it.portionGuess;
    const label = it.name || 'מזון';

    if (g?.standardLabel) {
      const grams = approxGramsForGuess(g);
      const weight = grams != null ? ` — בערך ${grams} גרם` : '';
      return `• **${g.standardLabel}**${weight}`;
    }

    const hint = cleanHint(g);
    return hint ? `• **${label}** — ${hint}` : `• **${label}**`;
  });

  return (
    `**רק כדי לוודא מה אכלתם:**\n\n` +
    `${lines.join('\n')}`
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
    return Math.max(0, Math.round(grams));
  }
  if (g.mode === 'units') {
    const u = Math.round(draft?.units ?? g.defaultUnits ?? 1);
    const per = g.gramsPerUnit || 100;
    return Math.max(0, Math.round(u * per));
  }
  const grams = draft?.grams ?? g.defaultGrams ?? 150;
  return Math.max(0, Math.round(grams));
}

export function buildFoodsFromPortionDrafts(items, drafts) {
  return (items || [])
    .map((food, i) => {
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
    })
    .filter((row) => row.grams > 0);
}
