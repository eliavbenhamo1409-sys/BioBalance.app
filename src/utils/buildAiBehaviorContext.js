import moment from 'moment';

function hourLabel(iso) {
  if (!iso) return null;
  const m = moment(iso);
  return m.isValid() ? m.hour() : null;
}

function bucketForHour(h) {
  if (h == null) return 'לא ידוע';
  if (h < 6) return '00–06';
  if (h < 10) return '06–10';
  if (h < 14) return '10–14';
  if (h < 18) return '14–18';
  if (h < 22) return '18–22';
  return '22–24';
}

function countMap(items) {
  const m = {};
  for (const k of items) {
    if (!k) continue;
    const key = String(k).trim().slice(0, 80);
    if (!key) continue;
    m[key] = (m[key] || 0) + 1;
  }
  return m;
}

/**
 * @param {object} params
 * @param {object} params.profile
 * @param {Array} params.dailyStatsHistory  rows from daily_stats, newest first ok
 * @param {Array} params.meals
 * @param {Array} params.waterLogs
 * @param {Array} params.weightLogs
 * @param {number} [params.lookbackDays=21]
 */
export function buildAiBehaviorNarrative({
  profile,
  dailyStatsHistory = [],
  meals = [],
  waterLogs = [],
  weightLogs = [],
  lookbackDays = 21,
}) {
  const calT = profile?.calories_target || 2000;
  const proT = profile?.protein_target || 90;
  const fatT = profile?.fat_target || 65;
  const carbT = profile?.carbs_target || 250;
  const waterT = profile?.water_target || 8;

  const lines = [];
  lines.push(
    `טווח ניתוח: ${lookbackDays} יום אחורה, בהתאם לרשומות במסד (לא “זיכרון” של הצ׳אט).`
  );

  if (
    !meals.length &&
    !dailyStatsHistory.length &&
    !waterLogs.length &&
    !weightLogs.length
  ) {
    return `${lines[0]}\nעדיין אין מספיק רשומות היסטוריות—הדוח מבוסס בעיקר על היום הנוכחי.`;
  }

  const byMealHour = {};
  const byType = { breakfast: 0, lunch: 0, dinner: 0, snack: 0, unknown: 0 };
  for (const meal of meals) {
    const h = hourLabel(meal.created_at);
    const b = bucketForHour(h);
    byMealHour[b] = (byMealHour[b] || 0) + 1;
    const t = meal.meal_type;
    if (t && byType[t] !== undefined) byType[t] += 1;
    else byType.unknown += 1;
  }

  if (meals.length) {
    const topNames = Object.entries(countMap(meals.map((m) => m.name)))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    lines.push(
      `ארוחות נרשמו: ${meals.length} רשומות. התפלגות לפי שעת דיווח (מקובץ): ${Object.entries(
        byMealHour
      )
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}.`
    );
    lines.push(
      `לפי סוג ארוחה: בוקר ${byType.breakfast}, צהריים ${byType.lunch}, ערב ${byType.dinner}, נשנוש ${byType.snack}${
        byType.unknown ? `, לא מסווג ${byType.unknown}` : ''
      }.`
    );
    if (topNames.length) {
      lines.push(
        `מזונים חוזרים (שם, מס׳): ${topNames.map(([n, c]) => `"${n}"×${c}`).join(' · ')}.`
      );
    }
    const bySource = countMap(meals.map((m) => m.source || 'לא ידוע'));
    if (Object.keys(bySource).length) {
      lines.push(
        `מקור דיווח ארוחות (ספירה): ${Object.entries(bySource)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}.`
      );
    }
  }

  if (dailyStatsHistory.length) {
    let lowProteinDays = 0;
    let lowCalDays = 0;
    let overCarbDays = 0;
    let lowCarbDays = 0;
    const days = dailyStatsHistory.slice(0, lookbackDays);
    for (const row of days) {
      const p = Number(row.protein) || 0;
      const cal = Number(row.calories) || 0;
      const c = Number(row.carbs) || 0;
      if (p < proT * 0.7) lowProteinDays += 1;
      if (cal < calT * 0.55) lowCalDays += 1;
      if (carbT > 0) {
        if (c > carbT * 1.1) overCarbDays += 1;
        if (c < carbT * 0.5 && c > 0) lowCarbDays += 1;
      }
    }
    lines.push(
      `מגמות ימים (לעומת יעדים: קלוריות ${calT}, חלבון ${proT}g, שומן ${fatT}g, פחמימות ~${carbT}g, מים ${waterT} כוסות): ` +
        `ב־${lowProteinDays} ימים חלבון <70% מהיעד; ב־${lowCalDays} ימים קלוריות <55% מהיעד; ` +
        `ימים עם פחמימות גבוהות מאוד (>${Math.round(carbT * 1.1)}g): ${overCarbDays}; ימים נמוכים בפחמימות: ${lowCarbDays}.`
    );
  }

  if (waterLogs.length) {
    const wh = {};
    const sortedW = [...waterLogs].sort(
      (a, b) => moment(a.logged_at).valueOf() - moment(b.logged_at).valueOf()
    );
    for (const w of waterLogs) {
      const h = hourLabel(w.logged_at);
      const b = bucketForHour(h);
      wh[b] = (wh[b] || 0) + (Number(w.glasses) || 1);
    }
    const first = sortedW.length ? moment(sortedW[0].logged_at) : null;
    const last = sortedW.length ? moment(sortedW[sortedW.length - 1].logged_at) : null;
    lines.push(
      `מים: ${waterLogs.length} דיווחי כוס/ות. התפלגות לפי שעה (מקובצת): ${Object.entries(wh)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}.`
    );
    if (first?.isValid() && last?.isValid()) {
      lines.push(
        `דוגמה: דיווח מוקדם/מאוחר בטווח — ${first.format('DD/MM HH:mm')} עד ${last.format('DD/MM HH:mm')}.`
      );
    }
  }

  if (weightLogs.length) {
    const sorted = [...weightLogs].sort(
      (a, b) => moment(a.logged_at).valueOf() - moment(b.logged_at).valueOf()
    );
    const w0 = Number(sorted[0].weight_kg);
    const w1 = Number(sorted[sorted.length - 1].weight_kg);
    const delta = Math.round((w1 - w0) * 10) / 10;
    const dir = delta > 0.1 ? 'עלייה' : delta < -0.1 ? 'ירידה' : 'יציב';
    lines.push(
      `משקל: ${weightLogs.length} דיווחים בטווח. מהראשון (${
        sorted[0].day_date
      }, ${w0}kg) לאחרון (${sorted[sorted.length - 1].day_date}, ${w1}kg) — שינוי ${delta}kg (${dir}).`
    );
  }

  lines.push(
    'השתמש בנתונים האלה לזיהוי דפוסי זמן (מתי אוכל/מתי מדווח), מזונים חוזרים, ואיפה בדרך כלל חסר (חלבון/קלוריות/מים).'
  );

  return lines.join('\n');
}
