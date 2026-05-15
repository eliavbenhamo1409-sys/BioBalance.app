// ============================================================
// Insights analyzer — derives long-term patterns from raw history.
// ============================================================
// Runs entirely on-device (no AI cost). Produces:
//   • baseline   — week / month / today numeric snapshot used by the AI prompt
//   • facts      — array of {fact_key, title, description, severity, confidence, evidence}
//                  to upsert into ai_pattern_facts (long-term memory).
//   • narrative  — short Hebrew narrative for the Gemini prompt.
//
// Heuristics here intentionally favor *stability*: a fact is only emitted
// once enough evidence accumulates (≥4 of ~7-30 days for short signals).

import moment from 'moment';

const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function hourOf(iso) {
  if (!iso) return null;
  const m = moment(iso);
  return m.isValid() ? m.hour() : null;
}

function bucketForHour(h) {
  if (h == null) return 'unknown';
  if (h < 6) return '00-06';
  if (h < 10) return '06-10';
  if (h < 14) return '10-14';
  if (h < 18) return '14-18';
  if (h < 22) return '18-22';
  return '22-24';
}

function round(n, p = 0) {
  const k = Math.pow(10, p);
  return Math.round((Number(n) || 0) * k) / k;
}

function avg(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((s, x) => s + (Number(x) || 0), 0) / arr.length;
}

function pct(value, target) {
  if (!target || target <= 0) return 0;
  return ((Number(value) || 0) / target) * 100;
}

/**
 * Build a structured analysis used by both the UI and the AI prompt.
 *
 * @param {object} params
 * @param {object} params.profile        user_profiles row
 * @param {object} params.todayStats     { calories, protein, fat, carbs, water_glasses }
 * @param {Array}  params.dailyHistory   daily_stats rows (newest first), ~30 days
 * @param {Array}  params.meals          meals rows in lookback window
 * @param {Array}  params.waterLogs      water_logs rows in lookback window
 * @param {Array}  params.weightLogs     weight_logs rows in lookback window
 * @param {Array}  params.knownFacts     previously stored ai_pattern_facts rows
 */
export function analyzeInsights({
  profile,
  todayStats,
  dailyHistory = [],
  meals = [],
  waterLogs = [],
  weightLogs = [],
  knownFacts = [],
}) {
  const targets = {
    calories: Number(profile?.calories_target) || 2000,
    protein: Number(profile?.protein_target) || 90,
    fat: Number(profile?.fat_target) || 65,
    carbs: Number(profile?.carbs_target) || 250,
    water: Number(profile?.water_target) || 8,
  };

  const todayKey = moment().format('YYYY-MM-DD');

  const byDate = {};
  for (const row of dailyHistory || []) {
    if (row?.date) byDate[row.date] = row;
  }

  const last7 = [];
  const last30 = [];
  for (let i = 0; i < 30; i += 1) {
    const d = moment().subtract(i, 'days').format('YYYY-MM-DD');
    const row = byDate[d];
    if (row) {
      last30.push(row);
      if (i < 7) last7.push(row);
    }
  }

  const todayLive = {
    calories: Math.max(Number(byDate[todayKey]?.calories) || 0, Number(todayStats?.calories) || 0),
    protein: Math.max(Number(byDate[todayKey]?.protein) || 0, Number(todayStats?.protein) || 0),
    fat: Math.max(Number(byDate[todayKey]?.fat) || 0, Number(todayStats?.fat) || 0),
    carbs: Math.max(Number(byDate[todayKey]?.carbs) || 0, Number(todayStats?.carbs) || 0),
    water: Math.max(Number(byDate[todayKey]?.water) || 0, Number(todayStats?.water_glasses) || 0),
  };

  const baselineFor = (rows) => ({
    days: rows.length,
    avg_calories: round(avg(rows.map((r) => r.calories)), 0),
    avg_protein: round(avg(rows.map((r) => r.protein)), 1),
    avg_fat: round(avg(rows.map((r) => r.fat)), 1),
    avg_carbs: round(avg(rows.map((r) => r.carbs)), 1),
    avg_water: round(avg(rows.map((r) => r.water)), 1),
    days_hit_goal: rows.filter((r) => {
      const score =
        (Math.min(100, pct(r.calories, targets.calories)) +
          Math.min(100, pct(r.protein, targets.protein)) +
          Math.min(100, pct(r.fat, targets.fat)) +
          Math.min(100, pct(r.carbs, targets.carbs)) +
          Math.min(100, pct(r.water, targets.water))) /
        5;
      return score >= 80;
    }).length,
  });

  const baseline = {
    today: todayLive,
    week: baselineFor(last7),
    month: baselineFor(last30),
    targets,
  };

  // ----------------- Fact detection (lightweight heuristics) -----------------
  const facts = [];

  // 1) "Falls in protein later in the day" — relevant for both cut & bulk.
  const proteinDays = last30.filter(
    (r) => Number(r.protein) > 0 && Number(r.protein) < targets.protein * 0.7,
  ).length;
  if (proteinDays >= 4 && last30.length >= 7) {
    facts.push({
      fact_key: 'low_protein_overall',
      title: 'חלבון מתחת ליעד ברוב הימים',
      description: `ב־${proteinDays} מתוך ${last30.length} הימים האחרונים החלבון היה מתחת ל־70% מהיעד (${targets.protein}g).`,
      severity: 'warning',
      confidence: Math.min(0.95, 0.5 + proteinDays / Math.max(1, last30.length)),
      evidence: { days_below_70pct: proteinDays, sample_size: last30.length, target_g: targets.protein },
    });
  }

  // 2) Water gap.
  const waterDays = last7.filter((r) => Number(r.water) < targets.water * 0.6).length;
  if (waterDays >= 4) {
    facts.push({
      fact_key: 'low_water_recent',
      title: 'שתיית מים מתחת ליעד בשבוע האחרון',
      description: `ב־${waterDays} מתוך ${last7.length} הימים האחרונים נשתו פחות מ־60% מיעד המים (${targets.water} כוסות).`,
      severity: 'warning',
      confidence: 0.6 + waterDays * 0.05,
      evidence: { week_days_low: waterDays, target_glasses: targets.water },
    });
  } else if (last7.length >= 5) {
    const goodWaterDays = last7.filter((r) => Number(r.water) >= targets.water * 0.9).length;
    if (goodWaterDays >= 5) {
      facts.push({
        fact_key: 'strong_water_recent',
        title: 'שתיית מים עקבית',
        description: `ב־${goodWaterDays} מתוך ${last7.length} הימים האחרונים עמדת כמעט מלא ביעד המים.`,
        severity: 'positive',
        confidence: 0.8,
        evidence: { week_days_good: goodWaterDays, target_glasses: targets.water },
      });
    }
  }

  // 3) Calorie cluster — overshooting / undershooting most days.
  const calOver = last7.filter((r) => Number(r.calories) > targets.calories * 1.15).length;
  const calUnder = last7.filter(
    (r) => Number(r.calories) > 0 && Number(r.calories) < targets.calories * 0.7,
  ).length;
  if (calOver >= 3) {
    facts.push({
      fact_key: 'calories_high_recent',
      title: 'קלוריות מעל היעד ברוב השבוע',
      description: `ב־${calOver} מימי השבוע האחרון אכלת יותר מ־115% מהיעד הקלורי.`,
      severity: profile?.goal === 'cut' ? 'warning' : 'neutral',
      confidence: 0.7,
      evidence: { days_over: calOver, target_kcal: targets.calories },
    });
  }
  if (calUnder >= 3 && (profile?.goal === 'bulk' || profile?.goal === 'lean_bulk')) {
    facts.push({
      fact_key: 'calories_low_recent_bulk',
      title: 'גירעון קלורי בעלייה',
      description: `ב־${calUnder} מימי השבוע האחרון אכלת פחות מ־70% מהיעד — מקשה על המטרה.`,
      severity: 'warning',
      confidence: 0.75,
      evidence: { days_under: calUnder, target_kcal: targets.calories, goal: profile?.goal },
    });
  }

  // 4) Meal hour pattern (when do you typically log meals?).
  const mealHours = (meals || []).map((m) => hourOf(m.eaten_at || m.created_at)).filter((h) => h != null);
  if (mealHours.length >= 6) {
    const buckets = {};
    mealHours.forEach((h) => {
      const b = bucketForHour(h);
      buckets[b] = (buckets[b] || 0) + 1;
    });
    const top = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= Math.max(3, mealHours.length * 0.35)) {
      facts.push({
        fact_key: 'main_meal_window',
        title: `רוב הארוחות מדווחות בין ${top[0]}`,
        description: `${top[1]} מתוך ${mealHours.length} הדיווחים האחרונים היו בחלון השעות ${top[0]}.`,
        severity: 'neutral',
        confidence: 0.55 + Math.min(0.35, top[1] / Math.max(1, mealHours.length)),
        evidence: { window: top[0], count: top[1], sample_size: mealHours.length },
      });
    }
  }

  // 5) Weight trend.
  if ((weightLogs || []).length >= 2) {
    const sorted = [...weightLogs].sort(
      (a, b) => moment(a.logged_at).valueOf() - moment(b.logged_at).valueOf(),
    );
    const w0 = Number(sorted[0].weight_kg);
    const w1 = Number(sorted[sorted.length - 1].weight_kg);
    const delta = round(w1 - w0, 1);
    if (Math.abs(delta) >= 0.5) {
      const dir = delta > 0 ? 'עלייה' : 'ירידה';
      const aligned =
        (profile?.goal === 'cut' && delta < 0) ||
        ((profile?.goal === 'bulk' || profile?.goal === 'lean_bulk') && delta > 0);
      facts.push({
        fact_key: 'weight_trend',
        title: `מגמת משקל: ${dir} ${Math.abs(delta)}kg`,
        description: `בין ${sorted[0].day_date} ל־${sorted[sorted.length - 1].day_date} השינוי הוא ${delta}kg. ${aligned ? 'תואם למטרה.' : 'בכיוון הפוך מהמטרה.'}`,
        severity: aligned ? 'positive' : 'warning',
        confidence: 0.6 + Math.min(0.3, (weightLogs.length - 2) * 0.05),
        evidence: { delta_kg: delta, days_logged: weightLogs.length, goal: profile?.goal },
      });
    }
  }

  // 6) Variety check — count of distinct meal names in last 14 days.
  const last14CutoffMs = moment().subtract(14, 'days').valueOf();
  const recentMealsNames = (meals || [])
    .filter((m) => moment(m.eaten_at || m.created_at).valueOf() >= last14CutoffMs)
    .map((m) => String(m.name || '').trim().toLowerCase())
    .filter(Boolean);
  if (recentMealsNames.length >= 8) {
    const unique = new Set(recentMealsNames).size;
    const ratio = unique / recentMealsNames.length;
    if (ratio < 0.45) {
      facts.push({
        fact_key: 'low_variety_meals',
        title: 'גיוון נמוך בארוחות',
        description: `ב־14 הימים האחרונים נרשמו ${recentMealsNames.length} ארוחות אבל רק ${unique} שמות שונים — חזרה גבוהה על אותם מזונות.`,
        severity: 'warning',
        confidence: 0.65,
        evidence: { unique_names: unique, total: recentMealsNames.length, ratio: round(ratio, 2) },
      });
    } else if (unique >= 10) {
      facts.push({
        fact_key: 'good_variety_meals',
        title: 'גיוון טוב בארוחות',
        description: `ב־14 הימים האחרונים נרשמו ${unique} מאכלים שונים — מגוון יפה.`,
        severity: 'positive',
        confidence: 0.6,
        evidence: { unique_names: unique, total: recentMealsNames.length },
      });
    }
  }

  // 7) Weekend dip (Friday/Saturday underperform).
  const byDow = {};
  for (const row of last30) {
    if (!row?.date) continue;
    const d = moment(row.date).day();
    const score =
      (Math.min(100, pct(row.calories, targets.calories)) +
        Math.min(100, pct(row.protein, targets.protein)) +
        Math.min(100, pct(row.fat, targets.fat)) +
        Math.min(100, pct(row.carbs, targets.carbs)) +
        Math.min(100, pct(row.water, targets.water))) /
      5;
    byDow[d] = byDow[d] || [];
    byDow[d].push(score);
  }
  const avgScores = Object.fromEntries(
    Object.entries(byDow).map(([d, arr]) => [d, round(avg(arr), 0)]),
  );
  const worstDay = Object.entries(avgScores).sort((a, b) => a[1] - b[1])[0];
  const bestDay = Object.entries(avgScores).sort((a, b) => b[1] - a[1])[0];
  if (worstDay && bestDay && Number(bestDay[1]) - Number(worstDay[1]) >= 20) {
    facts.push({
      fact_key: `weak_day_${worstDay[0]}`,
      title: `יום ${HEB_DAYS[Number(worstDay[0])]} בדרך כלל החלש בשבוע`,
      description: `הציון הממוצע ביום ${HEB_DAYS[Number(worstDay[0])]} הוא ${worstDay[1]}% לעומת ${bestDay[1]}% ביום ${HEB_DAYS[Number(bestDay[0])]}.`,
      severity: 'warning',
      confidence: 0.6,
      evidence: { dow_scores: avgScores },
    });
  }

  // ----------------- Today vs baseline -----------------
  const todayScore =
    (Math.min(100, pct(todayLive.calories, targets.calories)) +
      Math.min(100, pct(todayLive.protein, targets.protein)) +
      Math.min(100, pct(todayLive.fat, targets.fat)) +
      Math.min(100, pct(todayLive.carbs, targets.carbs)) +
      Math.min(100, pct(todayLive.water, targets.water))) /
    5;

  const weekScore = baseline.week.days
    ? (Math.min(100, pct(baseline.week.avg_calories, targets.calories)) +
        Math.min(100, pct(baseline.week.avg_protein, targets.protein)) +
        Math.min(100, pct(baseline.week.avg_fat, targets.fat)) +
        Math.min(100, pct(baseline.week.avg_carbs, targets.carbs)) +
        Math.min(100, pct(baseline.week.avg_water, targets.water))) /
      5
    : 0;

  const monthScore = baseline.month.days
    ? (Math.min(100, pct(baseline.month.avg_calories, targets.calories)) +
        Math.min(100, pct(baseline.month.avg_protein, targets.protein)) +
        Math.min(100, pct(baseline.month.avg_fat, targets.fat)) +
        Math.min(100, pct(baseline.month.avg_carbs, targets.carbs)) +
        Math.min(100, pct(baseline.month.avg_water, targets.water))) /
      5
    : 0;

  baseline.scores = {
    today: round(todayScore, 0),
    week: round(weekScore, 0),
    month: round(monthScore, 0),
  };

  // ----------------- Narrative (compact prompt block for the LLM) -----------------
  const narrativeLines = [];
  narrativeLines.push(
    `יעדים יומיים: ${targets.calories} קל׳ · ${targets.protein}g חלבון · ${targets.fat}g שומן · ${targets.carbs}g פחמ׳ · ${targets.water} כוסות מים.`,
  );
  narrativeLines.push(
    `היום: ${round(todayLive.calories, 0)} קל׳ · ${round(todayLive.protein, 0)}g חלבון · ${round(todayLive.fat, 0)}g שומן · ${round(todayLive.carbs, 0)}g פחמ׳ · ${round(todayLive.water, 0)} כוסות (ציון ${baseline.scores.today}%).`,
  );
  if (baseline.week.days) {
    narrativeLines.push(
      `ממוצע 7 ימים (${baseline.week.days} ימי מידע): ${baseline.week.avg_calories} קל׳ · ${baseline.week.avg_protein}g חלבון · ${baseline.week.avg_fat}g שומן · ${baseline.week.avg_carbs}g פחמ׳ · ${baseline.week.avg_water} כוסות. ימים ביעד: ${baseline.week.days_hit_goal}/${baseline.week.days} (ציון ממוצע ${baseline.scores.week}%).`,
    );
  }
  if (baseline.month.days) {
    narrativeLines.push(
      `ממוצע 30 ימים (${baseline.month.days} ימי מידע): ${baseline.month.avg_calories} קל׳ · ${baseline.month.avg_protein}g חלבון · ${baseline.month.avg_fat}g שומן · ${baseline.month.avg_carbs}g פחמ׳ · ${baseline.month.avg_water} כוסות (ציון ממוצע ${baseline.scores.month}%).`,
    );
  }
  if (knownFacts?.length) {
    narrativeLines.push('עובדות מהזיכרון לטווח ארוך:');
    for (const f of knownFacts.slice(0, 8)) {
      narrativeLines.push(`• ${f.title} — ${f.description || ''} (severity=${f.severity}, seen=${f.seen_count})`);
    }
  }
  if (facts.length) {
    narrativeLines.push('דפוסים שזיהינו עכשיו (לעדכון בזיכרון):');
    for (const f of facts) {
      narrativeLines.push(`• ${f.title} — ${f.description || ''}`);
    }
  }

  return {
    targets,
    baseline,
    facts,
    knownFacts,
    narrative: narrativeLines.join('\n'),
  };
}
