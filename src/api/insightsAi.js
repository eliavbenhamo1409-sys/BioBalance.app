// ============================================================
// Insights AI — long-memory aware nutrition analysis.
// ============================================================
// Builds a rich prompt from analyzeInsights() (today + 7d + 30d + known facts)
// and asks Gemini for a structured report that includes a per-day conclusion.

import { callGemini, GEMINI_MODEL, RateLimitError } from './geminiClient';

const SYSTEM_PROMPT =
  'אתה דיאטן קליני שתפקידו לקרוא נתונים ארוכי-טווח של המשתמש (היום, שבוע, חודש, ועובדות זיכרון) ולתת מסקנה מדויקת. תענה תמיד בפורמט JSON בלבד, ללא טקסט מחוץ ל-JSON.';

function safeJson(content) {
  if (!content) return null;
  const clean = String(content).replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Generate a full insights report.
 *
 * @param {object} args
 * @param {object} args.profile
 * @param {object} args.targets       { calories, protein, fat, carbs, water }
 * @param {object} args.baseline      { today, week, month, scores }
 * @param {Array}  args.knownFacts    rows from ai_pattern_facts
 * @param {Array}  args.detectedFacts freshly detected facts (this run)
 * @param {Array}  args.recentReports last N rows from ai_insight_reports (for memory)
 * @param {Array}  args.weeklyCheckins last N user feedback rows
 * @param {string} args.narrative     analyzer's prebuilt narrative
 * @param {string} args.reportType    'daily' | 'weekly'
 */
export async function generateInsightsReport(args) {
  const {
    profile,
    targets,
    baseline,
    knownFacts = [],
    detectedFacts = [],
    recentReports = [],
    weeklyCheckins = [],
    narrative = '',
    reportType = 'daily',
  } = args || {};

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'בוקר' : hour < 17 ? 'צהריים' : hour < 21 ? 'ערב' : 'לילה';

  const recentReportsBlock = recentReports.length
    ? recentReports
        .slice(0, 5)
        .map(
          (r) =>
            `• [${r.report_date}] ציון ${r.overall_score ?? '?'}% — ${r.main_insight || ''} (${r.report_type})`,
        )
        .join('\n')
    : 'אין דוחות קודמים שמורים.';

  const checkinsBlock = weeklyCheckins.length
    ? weeklyCheckins
        .slice(0, 4)
        .map((c) => {
          const arrow = c.reaction === 'positive' ? '👍' : c.reaction === 'negative' ? '👎' : '·';
          return `• [${c.week_start}→${c.week_end}] ${arrow} ${c.feedback_text ? c.feedback_text : '(ללא טקסט)'}`;
        })
        .join('\n')
    : 'אין פידבק שבועי קודם.';

  const goalText =
    profile?.goal === 'cut'
      ? 'ירידה במשקל / חיטוב'
      : profile?.goal === 'bulk'
        ? 'עלייה במסה'
        : profile?.goal === 'lean_bulk'
          ? 'עלייה מתונה (lean bulk)'
          : 'שמירה';

  const prompt = `אתה דיאטן קליני מקצועי. נתח לעומק את הנתונים והחזר דוח ${reportType === 'weekly' ? 'שבועי' : 'יומי'} מדויק.

📊 פרופיל
- שם: ${profile?.name || 'משתמש'}
- מטרה: ${goalText}
- רמת פעילות: ${(profile?.activity_level_notes || '').trim() || profile?.activity_level || 'בינונית'}
- השעה כעת: ${hour}:00 (${timeOfDay})

📈 נתונים אמיתיים מהמסד
${narrative}

🧠 דוחות אחרונים (זיכרון):
${recentReportsBlock}

💬 פידבק שבועי קודם של המשתמש:
${checkinsBlock}

🎯 משימה
החזר JSON בלבד בפורמט הבא, **ללא** טקסט נוסף:

{
  "overallScore": ${baseline?.scores?.today ?? baseline?.scores?.week ?? 0},
  "status": "מצוין/טוב/בינוני/דורש שיפור",
  "recommendation": "שמירה/שיפור",
  "mainInsight": "תובנה עיקרית קצרה וחכמה — מה הסיפור של התקופה",
  "todayConclusion": "מסקנה ספציפית על היום: מה שונה היום לעומת השבוע/החודש, מה היה טוב, מה לתקן בשעות הקרובות. חייב להישען על הנתונים שלמעלה.",
  "strengths": ["דברים שעובדים טוב — 2-3 פריטים, ספציפיים עם נתונים"],
  "improvements": ["מה דורש שיפור — 2-3 פריטים, כל אחד עם נימוק מהנתונים ופתרון פרקטי"],
  "actionItems": ["פעולות ספציפיות לעכשיו / לשעות הקרובות"],
  "personalizedTip": "טיפ אישי לאור המטרה והשעה",
  "motivationalMessage": "מסר קצר ותומך — לא קלישאה",
  "memoryUpdates": [
    { "fact_key": "מזהה_עברי_לטינית_קצר", "title": "כותרת קצרה", "description": "תיאור עם מספרים", "severity": "positive|neutral|warning", "confidence": 0.0 }
  ]
}

⚠️ חוקים קריטיים:
1. ה־todayConclusion חייב להשוות את היום לבייסליין השבוע/החודש (למשל "היום אכלת 78% מהקלוריות לעומת ממוצע שבועי 92%").
2. אם זיהית דפוס חדש שלא מופיע בעובדות הזיכרון, הוסף אותו ל־memoryUpdates עם fact_key באנגלית קצר (snake_case).
3. אם המשתמש נתן פידבק שלילי על דוח קודם — הימנע מאותם דברים.
4. אל תמציא מספרים. אם אין מספיק היסטוריה, ציין זאת בקצרה.
5. הטון: תומך, ישיר, ללא שיפוטיות. בלי "אח/אחי". בלי קלישאות.`;

  try {
    const content = await callGemini(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      {
        temperature: 0.3,
        maxTokens: 2400,
        responseMimeType: 'application/json',
      },
    );

    const parsed = safeJson(content);
    if (!parsed) throw new Error('No valid JSON in response');

    return {
      success: true,
      ...parsed,
      detectedFacts,
      knownFacts,
      baseline,
      targets,
      reportType,
      model: GEMINI_MODEL,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof RateLimitError) {
      if (__DEV__) console.warn('[insightsAi] daily quota reached');
    } else if (__DEV__) {
      console.warn('[insightsAi] LLM error:', error?.message || error);
    }
    return buildLocalFallback({
      profile,
      targets,
      baseline,
      knownFacts,
      detectedFacts,
      reportType,
    });
  }
}

// ----------- Local fallback (no AI cost, runs on every device) -----------

function buildLocalFallback({ profile, targets, baseline, knownFacts, detectedFacts, reportType }) {
  const today = baseline?.today || {};
  const week = baseline?.week || {};
  const month = baseline?.month || {};
  const todayScore = baseline?.scores?.today ?? 0;
  const weekScore = baseline?.scores?.week ?? 0;
  const monthScore = baseline?.scores?.month ?? 0;

  const goal = profile?.goal || 'maintain';

  const strengths = [];
  const improvements = [];
  const actionItems = [];

  if (today.protein >= targets.protein * 0.85) strengths.push('💪 חלבון טוב היום — תומך בשרירים.');
  if (today.water >= targets.water * 0.85) strengths.push('💧 שתיית מים יפה.');
  if (week.days_hit_goal >= 5) strengths.push(`🎯 ${week.days_hit_goal}/${week.days} ימים ביעד השבוע.`);

  if (today.protein < targets.protein * 0.6) {
    const missing = Math.max(0, Math.round(targets.protein - today.protein));
    improvements.push(`חסרים ${missing}g חלבון להיום.`);
    actionItems.push(`🥚 הוסף מקור חלבון בארוחה הקרובה (${missing}g חסרים)`);
  }
  if (today.water < targets.water * 0.6) {
    const missing = Math.max(0, targets.water - today.water);
    improvements.push(`חסרות ${missing} כוסות מים.`);
    actionItems.push('💧 שתה כוס מים עכשיו');
  }
  if (today.calories > targets.calories * 1.15 && goal === 'cut') {
    improvements.push('הקלוריות מעל היעד היום — מומלץ להקל בערב.');
  }
  if (today.calories < targets.calories * 0.6 && (goal === 'bulk' || goal === 'lean_bulk')) {
    improvements.push('הקלוריות נמוכות מדי היום למטרת עלייה.');
    actionItems.push('🥜 הוסף חופן אגוזים / שייק דחוס לסגור את היעד.');
  }

  if (strengths.length === 0) strengths.push('🌱 ממשיכים לעקוב — כל יום של תיעוד מצטבר.');

  let todayConclusion;
  if (week.days >= 3) {
    const diff = todayScore - weekScore;
    if (diff >= 10) todayConclusion = `היום אתה ${diff} נק׳ מעל הממוצע השבועי (${weekScore}%) — יום חזק.`;
    else if (diff <= -10) todayConclusion = `היום אתה ${Math.abs(diff)} נק׳ מתחת לממוצע השבועי (${weekScore}%) — שווה לסגור פערים בערב.`;
    else todayConclusion = `היום בקו עם הממוצע השבועי (${weekScore}%).`;
  } else {
    todayConclusion = `ציון היום ${todayScore}%. עוד אין מספיק נתונים לבסיס שבועי יציב.`;
  }

  return {
    success: true,
    overallScore: todayScore,
    status: todayScore >= 80 ? 'מצוין' : todayScore >= 60 ? 'טוב' : todayScore >= 40 ? 'בינוני' : 'דורש שיפור',
    recommendation: todayScore >= 80 ? 'שמירה' : 'שיפור',
    mainInsight:
      monthScore >= 70
        ? `המגמה החודשית יציבה (${monthScore}%). תמשיך באותו קצב, רק תהדק היכן שיש פערים.`
        : `יש מקום לחדד את העקביות (ציון חודשי ${monthScore}%). נתחיל מהיום.`,
    todayConclusion,
    strengths,
    improvements: improvements.length ? improvements : ['אין הערות מיוחדות — שמור על הרמה.'],
    actionItems: actionItems.length ? actionItems : ['המשך לתעד ארוחות'],
    personalizedTip:
      goal === 'cut'
        ? 'בארוחת הערב, תעדף נפח (סלט גדול + חלבון רזה) על קלוריות סמויות.'
        : goal === 'bulk' || goal === 'lean_bulk'
          ? 'הוסף נשנוש דחוס בין ארוחות (אגוזים / טחינה) כדי לסגור קלוריות בלי לעמוס.'
          : 'שמור על האיזון — חלבון + ירקות בכל ארוחה.',
    motivationalMessage: 'כל יום של תיעוד הוא צעד קדימה — אנחנו רואים את התמונה המלאה.',
    memoryUpdates: [],
    detectedFacts,
    knownFacts,
    baseline,
    targets,
    reportType,
    model: 'fallback',
    timestamp: new Date().toISOString(),
  };
}
