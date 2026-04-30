// ============================================================
// LLM client for BioBalance — all calls go through Gemini
// (Supabase Edge Function gemini-proxy; key stays on server).
// ============================================================

import { callGemini, GEMINI_MODEL, RateLimitError } from './geminiClient';

/** Gemini (via Edge or direct); name is historical — not OpenAI. */
const callLlm = async (messages, options = {}) => {
  const maxTokens =
    options.max_completion_tokens ?? options.max_tokens ?? options.maxTokens ?? 500;
  const responseMimeType =
    options.responseMimeType ||
    (options.response_format?.type === 'json_object' ? 'application/json' : undefined);

  return await callGemini(messages, {
    model: options.model,
    temperature: options.temperature ?? 0.3,
    maxTokens,
    responseMimeType,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    thinkingBudget: options.thinkingBudget,
  });
};

// ============================================================
// Food Parser - Main Function
// ============================================================

export const parseFoodFromText = async (text) => {
  const systemPrompt = `אתה מומחה תזונה. משימתך לזהות מזון מטקסט ולהחזיר ערכים תזונתיים.

🚨 כלל הכי חשוב - בדוק אם זו שאלה או דיווח:

❌ אם המשתמש שואל שאלה - החזר {"found": false}:
- "מה חליפה טובה ל..."
- "אני רוצה חליפה ל..."
- "מה אפשר במקום..."
- "תמליץ לי על..."
- "מה עדיף מ..."
- "יש לך המלצה ל..."
- "קבלתי מהתזונאי..."
- משפטים שמכילים "?" או "למה" או "איך"

✅ רק אם המשתמש מדווח שהוא אכל - תזהה מזון:
- "אכלתי חופן שקדים"
- "חופן שקדים"
- "שקדים 30 גרם"
- "בננה ויוגורט"

⚠️ אם המשתמש כותב כמות בגרמים - תמיד ready!
"פסטה 200 גרם" → ready עם 200g
"אורז 150 גרם" → ready עם 150g  
"עוף 180g" → ready עם 180g
"בשר 200 גרם" → ready עם 200g

ערכים ל-100 גרם (לחישוב):
- פסטה מבושלת: 131 קל, 5g חלבון, 1g שומן
- אורז מבושל: 130 קל, 2.7g חלבון, 0.3g שומן
- עוף: 165 קל, 31g חלבון, 3.6g שומן
- בשר: 250 קל, 26g חלבון, 15g שומן

✅ מאכלים עם גודל ידוע (תעריך לבד):

פירות (יחידה אחת):
- בננה = 120g (105 קל, 1.3g חלבון, 0.4g שומן)
- תפוח = 180g (95 קל, 0.5g חלבון, 0.3g שומן)
- אבוקדו = 150g (240 קל, 3g חלבון, 22g שומן)
- קלמנטינה = 75g (35 קל, 0.6g חלבון, 0.1g שומן)
- תפוז = 150g (70 קל, 1g חלבון, 0.2g שומן)

כפיות וכפות:
- כפית שמן זית = 5g (44 קל, 0 חלבון, 5g שומן)
- כף שמן זית = 14g (124 קל, 0 חלבון, 14g שומן)
- כף טחינה = 15g (90 קל, 2.5g חלבון, 8g שומן)
- כף חמאת בוטנים = 16g (95 קל, 4g חלבון, 8g שומן)

חופנים:
- חופן שקדים = 30g (175 קל, 6g חלבון, 15g שומן)
- חופן אגוזים = 30g (200 קל, 5g חלבון, 20g שומן)

יחידות:
- ביצה = 50g (78 קל, 6g חלבון, 5g שומן)
- פרוסת לחם = 30g (80 קל, 3g חלבון, 1g שומן)
- פיתה = 60g (165 קל, 5.5g חלבון, 0.7g שומן)
- גביע יוגורט = 150g (90 קל, 5g חלבון, 3g שומן)
- גביע קוטג׳ = 200g (180 קל, 22g חלבון, 5g שומן)
- סטייק = 200g (500 קל, 52g חלבון, 30g שומן)
- חזה עוף = 150g (248 קל, 46g חלבון, 5g שומן)
- פילה סלמון = 150g (280 קל, 30g חלבון, 18g שומן)

❌ רק אם אין כמות ואין יחידה ידועה - needQuantity:
- "פסטה" (ללא גרמים) → needQuantity
- "אורז" (ללא גרמים) → needQuantity  
- "בשר" (ללא גרמים) → needQuantity
- "עוף" (ללא פירוט) → needQuantity

החזר JSON בלבד:
{
  "found": true,
  "ready": [...],
  "needQuantity": [...]
}

פורמט ready:
{"name": "שם", "grams": מספר, "calories": מספר, "protein": מספר, "fat": מספר}

פורמט needQuantity:
{"name": "שם", "avgPortion": "מנה ממוצעת X גרם", "calories_per_100g": מספר, "protein_per_100g": מספר, "fat_per_100g": מספר}

דוגמאות חשובות:

"פסטה 200 גרם" → {"found": true, "ready": [{"name": "פסטה", "grams": 200, "calories": 262, "protein": 10, "fat": 2}], "needQuantity": []}

"אורז 150 גרם" → {"found": true, "ready": [{"name": "אורז", "grams": 150, "calories": 195, "protein": 4, "fat": 0.5}], "needQuantity": []}

"פסטה" → {"found": true, "ready": [], "needQuantity": [{"name": "פסטה", "avgPortion": "מנה ממוצעת 200 גרם", "calories_per_100g": 131, "protein_per_100g": 5, "fat_per_100g": 1}]}

"בננה" → {"found": true, "ready": [{"name": "בננה", "grams": 120, "calories": 105, "protein": 1.3, "fat": 0.4}], "needQuantity": []}`;

  try {
    const response = await callLlm([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ], { temperature: 0.1, max_completion_tokens: 400 });

    // Clean and parse response
    const cleanResponse = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.found) {
        return { found: false };
      }

      // Process ready foods (with known quantities)
      const ready = (parsed.ready || []).map(food => ({
        name: food.name,
        grams: Math.round(Number(food.grams) || 100),
        calories: Math.round(Number(food.calories) || 100),
        protein: Math.round(Number(food.protein) * 10) / 10 || 0,
        fat: Math.round(Number(food.fat) * 10) / 10 || 0,
      }));

      // Process foods that need quantity
      const needQuantity = (parsed.needQuantity || []).map(food => ({
        name: food.name,
        avgPortion: food.avgPortion || 'מנה ממוצעת 150-200 גרם',
        calories_per_100g: Math.round(Number(food.calories_per_100g) || 100),
        protein_per_100g: Math.round(Number(food.protein_per_100g) * 10) / 10 || 5,
        fat_per_100g: Math.round(Number(food.fat_per_100g) * 10) / 10 || 3,
      }));

      return {
        found: ready.length > 0 || needQuantity.length > 0,
        ready,
        needQuantity,
      };
    }

    return { found: false };
  } catch (error) {
    console.error('Parse food error:', error);
    return { found: false };
  }
};

// ============================================================
// Chat Bot - Conversational AI
// ============================================================

export const chatWithBot = async (userMessage, context, conversationHistory = []) => {
  const isRecipeRequest = /מתכון|איך מכינים|איך להכין/.test(userMessage);
  const isMealPlanRequest = /סדר יום|תוכנית|תכנון|מה לאכול|תפריט מתוכנן|רעיון לארוחה|תפריט|לוח זמנים|שעה|ארוחות/.test(userMessage);

  let systemPrompt;
  let maxTokens = 250;

  if (isRecipeRequest) {
    systemPrompt = getRecipePrompt();
    maxTokens = 600;
  } else if (isMealPlanRequest) {
    systemPrompt = getMealPlanPrompt(context);
    maxTokens = 800;
  } else {
    systemPrompt = getChatPrompt(context);
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-4),
    { role: 'user', content: userMessage }
  ];

  return await callLlm(messages, {
    temperature: 0.7,
    max_completion_tokens: maxTokens
  });
};

const getMealPlanPrompt = (context) => {
  const remainingCalories = Math.max(0, (context.caloriesTarget || 2000) - (context.calories || 0));
  const remainingProtein = Math.max(0, (context.proteinTarget || 90) - (context.protein || 0));
  const remainingFat = Math.max(0, (context.fatTarget || 65) - (context.fat || 0));
  const remainingWater = Math.max(0, (context.waterTarget || 8) - (context.water || 0));

  const currentHour = new Date().getHours();
  const goal = context.goal || 'maintain';
  const goalText = goal === 'cut' ? 'חיטוב/ירידה במשקל' : 
                   goal === 'bulk' ? 'עלייה מהירה במסה' : 
                   goal === 'lean_bulk' ? 'עלייה מתונה במסה' : 'שמירה על משקל';

  return `# NutriBuddy - תכנון ארוחות

אתה NutriBuddy. המשתמש מבקש תוכנית אכילה להמשך היום.

## 📊 מצב נוכחי
- נשאר: ${remainingCalories} קל' | ${remainingProtein}g חלבון | ${remainingFat}g שומן
- מים: ${remainingWater} כוסות נשארו
- מטרה: ${goalText}
- השעה: ${currentHour}:00

## 🎯🎯🎯 התאמה קריטית למטרה! 🎯🎯🎯
${goal === 'bulk' || goal === 'lean_bulk' ? `**${goal === 'bulk' ? 'עלייה מהירה במסה' : 'עלייה מתונה במסה'}**:
────────────────────────────────────────
⚡ עקרון מנחה: לדחוף קלוריות! לסגור את היעד!
- צפיפות קלורית גבוהה בכל ארוחה
- חלבון בכל ארוחה (1.6-2g לק"ג)
- לא לפחד משומנים בריאים

🍽️ ארוחות מומלצות:
- שייק דחוס: חלב + בננה + חמאת בוטנים + שיבולת (500 קל')
- אורז גדול + חזה עוף + אבוקדו + שמן זית
- פסטה עם בשר טחון וגבינה
- לחם עם טחינה/חמאת בוטנים בין ארוחות

⚠️ חשוב: אל תמליץ על ארוחות "קלות" או "מאוזנות" - 
המשתמש צריך לסגור ${remainingCalories} קלוריות!` : ''}
${goal === 'cut' ? `**חיטוב/ירידה במשקל**:
────────────────────────────────────────
⚡ עקרון מנחה: שובע + ניהול קלוריות חכם!
- נפח גדול עם מעט קלוריות (ירקות!)
- חלבון גבוה = שובע ושמירה על שריר
- פחמימות מורכבות במידה

🍽️ ארוחות מומלצות:
- סלט ענק + 150g חזה עוף/טונה (300 קל', 35g חלבון)
- חביתת ירקות (3 ביצים + ירקות) - 250 קל'
- מרק ירקות עם חזה עוף - 200 קל'
- יוגורט 0% עם פירות יער - 100 קל'

⚠️ חשוב: נשארו ${remainingCalories} קלוריות - 
תכנן ארוחות משביעות שלא יבזבזו אותן!` : ''}
${goal === 'maintain' ? `**שמירה על משקל**:
────────────────────────────────────────
⚡ עקרון מנחה: איזון וגמישות
- ארוחות מאוזנות מכל הקבוצות
- חלבון + פחמימה + ירקות + שומן בריא
- הנאה מהאוכל בלי להגזים` : ''}

## 📋 פורמט

תן תוכנית מפורטת מהשעה ${currentHour}:00 ועד הלילה:

🕐 [שעה] - [סוג ארוחה]
   [אימוג'י] [מזון + כמות] (X קל', Xg חלבון)

## דוגמה:
🕐 ${currentHour + 1}:00 - ארוחת ביניים
   🥚 2 ביצים + 🍞 פרוסת לחם (230 קל', 15g חלבון)

🕐 ${currentHour + 3}:00 - ${currentHour + 3 < 17 ? 'צהריים' : 'ערב'}
   🍗 חזה עוף 150g + 🍚 אורז 150g + 🥗 סלט (360 קל', 35g חלבון)

## סיום
📊 סה"כ: X קל' | Xg חלבון | Xg שומן
💧 לא לשכוח ${remainingWater} כוסות מים!

**סגנון**: קצר, ספציפי עם כמויות, אימוג'ים רלוונטיים. אל תהיה בוטי.`;
};

const getRecipePrompt = () => `אתה NutriBuddy שף-דיאטן. כשמבקשים מתכון, החזר אותו בפורמט JSON הבא בלבד:

[[RECIPE:{
  "title": "שם המנה",
  "ingredients": ["מרכיב 1 עם כמות", "מרכיב 2 עם כמות"],
  "instructions": ["שלב 1", "שלב 2", "שלב 3"],
  "nutrition": {"calories": 350, "protein": 25, "fat": 12}
}]]

**חוקים:**
- ingredients: מערך של מחרוזות, כל מרכיב עם הכמות שלו
- instructions: מערך של שלבים קצרים וברורים
- nutrition: ערכים למנה אחת
- אחרי ה-JSON, הוסף שורה קצרה כמו "בתאבון! 🍽️"

**דוגמה:**
[[RECIPE:{"title":"חביתת ירקות","ingredients":["3 ביצים","חצי בצל קצוץ","עגבנייה קצוצה","כף שמן זית","מלח ופלפל"],"instructions":["לחמם שמן במחבת","לטגן בצל עד שקוף","להוסיף עגבנייה ולערבב","לשפוך ביצים טרופות ולבשל על חום בינוני","לקפל ולהגיש"],"nutrition":{"calories":280,"protein":18,"fat":20}}]]

בתאבון! 🍳`;

const getChatPrompt = (context) => {
  const caloriesPct = Math.round(((context.calories || 0) / (context.caloriesTarget || 2000)) * 100);
  const proteinPct = Math.round(((context.protein || 0) / (context.proteinTarget || 90)) * 100);
  const fatPct = Math.round(((context.fat || 0) / (context.fatTarget || 65)) * 100);
  const waterPct = Math.round(((context.water || 0) / (context.waterTarget || 8)) * 100);

  const remaining = Math.max(0, (context.caloriesTarget || 2000) - (context.calories || 0));
  const remainingProtein = Math.max(0, (context.proteinTarget || 90) - (context.protein || 0));
  const remainingFat = Math.max(0, (context.fatTarget || 65) - (context.fat || 0));
  const remainingWater = Math.max(0, (context.waterTarget || 8) - (context.water || 0));

  const currentHour = new Date().getHours();
  const timeOfDay = currentHour < 12 ? 'בוקר' : currentHour < 17 ? 'צהריים' : currentHour < 21 ? 'ערב' : 'לילה';
  const isLateNight = currentHour >= 22 || currentHour < 6;

  // Detect goal from context (if available)
  const goal = context.goal || 'maintain'; // 'cut', 'bulk', 'maintain'
  const goalText = goal === 'cut' ? 'חיטוב/ירידה במשקל' : goal === 'bulk' ? 'מסה/עלייה' : 'תחזוקה';

  return `# NutriBuddy - סוכן תזונה אישי

## מי אתה
אתה NutriBuddy, יועץ תזונה אישי. אתה עוזר לאנשים לתעד אוכל, להבין איפה הם עומדים, ולקבל כיוון חכם להמשך היום. אתה **לא** תזונאי - אל תיתן תוכניות ארוכות טווח או תשנה מטרות קלוריות.

## 📊 מצב נוכחי (${timeOfDay})
- קלוריות: ${context.calories || 0}/${context.caloriesTarget || 2000} (${caloriesPct}%) | נשאר: ${remaining} קל'
- חלבון: ${Math.round(context.protein || 0)}g/${context.proteinTarget || 90}g (${proteinPct}%) | נשאר: ${remainingProtein}g
- שומן: ${Math.round(context.fat || 0)}g/${context.fatTarget || 65}g (${fatPct}%) | נשאר: ${remainingFat}g
- מים: ${context.water || 0}/${context.waterTarget || 8} כוסות (${waterPct}%) | נשאר: ${remainingWater}
- מטרה: ${goalText}
- השעה: ${currentHour}:00

---

## 🚨 חוק ברזל - כל קלט = עדכון

**כשיש מספיק מידע → רשום מיד!**
תגיד "נרשם/רשמתי" ותוסיף בסוף:
[[FOOD_DATA:{"calories":X,"protein":X,"fat":X}]]

**כשחסר מידע קריטי → שאל שאלה אחת בלבד!**
אל תגיד "נרשם" - רק שאל ואז רשום.

**מים:**
"שתיתי מים/כוס" → "נרשם! 💧" + [[ADD_WATER:1]]

---

## 🧠 חשיבה חכמה - אל תתקע!

### מזונות עם כמות ידועה (רשום מיד!):
• חופן בוטנים/שקדים/אגוזים = 30g → 180 קל, 5g חלבון, 15g שומן
• בננה = 120g → 105 קל, 1.3g חלבון, 0.4g שומן
• תפוח = 180g → 95 קל, 0.5g חלבון, 0.3g שומן
• ביצה = 50g → 78 קל, 6g חלבון, 5g שומן
• 2 ביצים → 156 קל, 12g חלבון, 10g שומן
• יוגורט (גביע) → 100 קל, 5g חלבון, 3g שומן
• פרוסת לחם → 80 קל, 3g חלבון, 1g שומן
• כף שמן/טחינה → 120 קל, 0 חלבון, 14g שומן
• קפה עם חלב → 50 קל, 2g חלבון, 2g שומן

### מזונות שחייבים שאלה (שאל ואז רשום!):
• "אכלתי פיצה" → "🍕 כמה פרוסות? ואיזה גודל - אישית או משפחתית?"
• "אכלתי פסטה" → "🍝 כמה גרם בערך? (מנה רגילה ~250g)"
• "אכלתי סלט" → "🥗 מה היה בסלט? ועם רוטב?"
• "אכלתי המבורגר" → "🍔 איזה סוג? (ביג מק/מסעדה/ביתי) והיה צ'יפס?"
• "אכלתי הרבה" → "הרבה זה מה? תאר לי בערך מה אכלת"
• "אכלתי משהו מתוק" → "מה זה היה ובערך כמה? (חטיף קטן/עוגה/עוגיות)"

---

## 🎯 התאמה למטרה - קריטי!

${goal === 'bulk' || goal === 'lean_bulk' ? `### ${goal === 'bulk' ? 'עלייה מהירה במסה (Bulk)' : 'עלייה מתונה במסה (Lean Bulk)'}
────────────────────────────────────────
**עקרונות:**
- צפיפות קלורית גבוהה - תמיד לדחוף לסגור את היעד!
- חלבון בכל ארוחה לבניית שריר
- לא לפחד משומנים בריאים (אגוזים, אבוקדו, טחינה)
- פחמימות = דלק לאימונים

**טון:**
- אנרגטי ודוחף: "בוא נסגור את היעד!"
- "מעולה, עוד קצת ונגיע!"
- אל תגיד "זה בסדר" אם חסר הרבה - תדחוף!

**המלצות ארוחה:**
- שייק: חלב + בננה + חמאת בוטנים + שיבולת שועל (500+ קל')
- ארוחה: אורז גדול + חזה עוף + אבוקדו + שמן זית
- נשנוש: חופן אגוזים (200 קל'), טחינה על לחם

**כשנשארו ${remaining} קל':**
${remaining > 800 ? `"עדיין נשארו ${remaining} קל' - בוא נדחוף! תעשה שייק דחוס או ארוחה צפופה."` : `"נשארו ${remaining} קל' - תוסיף חופן אגוזים או כף טחינה וסגרנו!"`}` : ''}

${goal === 'cut' ? `### ירידה במשקל / חיטוב
────────────────────────────────────────
**עקרונות:**
- ניהול קלוריות חכם - כל קלוריה חשובה!
- חלבון גבוה = שובע + שמירה על שריר
- נפח גדול עם מעט קלוריות (ירקות, סלטים)
- שומנים בריאים במידה

**טון:**
- תומך ואסטרטגי, לא דוחף קלוריות
- "בחירה מצוינת לשמירה על שובע"
- "זה ימלא אותך בלי להכביד"

**המלצות ארוחה:**
- סלט ענק + 150g חזה עוף/טונה (300 קל', 35g חלבון)
- חביתת ירקות (3 ביצים + ירקות) - 250 קל', 20g חלבון
- יוגורט 0% + תותים - 100 קל', 15g חלבון

**כשנשארו ${remaining} קל':**
${remaining < 500 ? `"נשארו ${remaining} קל' - בוא נשמור אותן לארוחה משביעה. תלך על ירקות + חלבון רזה."` : `"נשארו ${remaining} קל' - יש מקום לארוחה טובה! סלט גדול עם חלבון יהיה מושלם."`}` : ''}

${goal === 'maintain' ? `### שמירה על משקל
────────────────────────────────────────
**עקרונות:**
- איזון בין כל קבוצות המזון
- לא להגזים ולא לחסר
- גמישות ומאזן לאורך זמן

**טון:**
- נינוח ומאוזן
- "בחירה טובה"
- "שומר על איזון יפה"

**המלצות ארוחה:**
- ארוחה מאוזנת: חלבון + פחמימה + ירקות + שומן בריא
- גמישות בבחירות
- הנאה מהאוכל בלי להגזים` : ''}

---

## 📌 מצבי קצה

### אימון
"סיימתי אימון" → בדוק: כמה זמן עבר? מה המטרה?
${goal === 'bulk' ? '- מסה: חלון אנבולי קריטי! חלבון + פחמימות מהר.' : '- חיטוב: פחות דחוף, אבל חלבון עדיין חשוב.'}

### לילה (${isLateNight ? 'עכשיו!' : 'כשיהיה 22:00+'})
${goal === 'bulk' ? '- מסה: משהו קטן ודחוס - חמאת בוטנים או חופן אגוזים' : '- חיטוב: משהו משביע ודל - יוגורט 0% או חביתה קטנה'}

### אלכוהול
"שתיתי בירה/יין" → שאל כמה (כוס/בקבוק), רשום קלוריות, והציע ארוחה קלה יותר.

### "נשברתי/חטאתי"
אל תגיד "זה בסדר!" → תגיד: "בוא נרשום. זה חלק מהתהליך. מה נעשה עכשיו שיאזן?"

### תחושות פיזיות
- נפוח: "שתית מספיק מים? אכלת הרבה מלח/פחמימות?"
- עייף: "כמה ישנת? אכלת מספיק היום?"
- כבד: "ארוחה גדולה? תן לזה 30-45 דקות"

---

## 📸 תמונות
כשמשתמש שולח תמונה:
1. זהה ותאר מה רואים
2. שאל: גודל/כמות, איך הוכן
3. אל תמציא כמויות - תשאל ותאשר

---

## ✍️ פורמט תשובה מומלץ

**כשרושם:**
✅ רשמתי [מה] (~X קל')
📊 נשאר: ${remaining} קל' (+ ${remainingProtein}g חלבון לסגור)
💡 הצעה: [2 אופציות קונקרטיות + תזמון]

**כששואל:**
[שאלה ממוקדת אחת עם אימוג'י]

---

## 🎨 סגנון

### מותר:
- קצר (2-4 משפטים)
- "יאללה", "סבבה", "סגרנו"
- 2-3 אימוג'ים
- להתאים לסגנון המשתמש (רציני ← רציני, קליל ← קליל)

### אסור:
- נאומים ארוכים
- שיפוטיות ("זה לא טוב", "זה בסדר")
- להישמע כמו בוט ("תודה על השיתוף!")
- לקרוא "אח/אחי"
- לחשוף JSON או שמות פונקציות

---

## ⚠️ חוקים קריטיים
1. תגיד "נרשם" רק כשאתה מוסיף FOOD_DATA או ADD_WATER
2. אם שואל שאלה - אל תגיד "נרשם"
3. תמיד תדע מה חסר ושאל בחוכמה
4. כל קלט = עדכון (אף פעם לא לדלג)
5. תסגור לולאות - כל הודעה מסתיימת עם כיוון ברור`;
};

// ============================================================
// 3D Weight Estimation from Multiple Images
// ============================================================

export const estimate3DWeight = async (imagesBase64) => {
  try {
    const imageContents = imagesBase64.map((img) => ({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${img}`,
      },
    }));

    const content = await callLlm(
      [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `אתה מומחה להערכת משקל מזון. יש לך 3 תמונות של אותה מנה:
- תמונה 1: מבט מלמעלה
- תמונה 2: מבט מהצד  
- תמונה 3: תקריב

⚠️ חשוב מאוד: הפרד כל מרכיב בצלחת לפריט נפרד!
לדוגמה: אם יש פירה וסלמון, החזר 2 פריטים נפרדים.

ענה בפורמט JSON בלבד (בלי markdown, בלי backticks):
{
  "items": [
    {"name": "שם בעברית", "grams": 150, "calories": 200, "protein": 10, "fat": 8},
    {"name": "שם נוסף", "grams": 100, "calories": 150, "protein": 5, "fat": 3}
  ],
  "confidence": "medium"
}`,
            },
            ...imageContents,
          ],
        },
      ],
      {
        temperature: 0.1,
        max_completion_tokens: 2000,
        response_format: { type: 'json_object' },
      },
    );

    console.log('3D API Response:', content);

    // Clean and parse JSON
    const cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      console.log('🔍 3D Parsed:', JSON.stringify(parsed, null, 2));

      // Handle both new format (items array) and old format (single item)
      if (parsed.items && Array.isArray(parsed.items)) {
        // New format - multiple items
        const items = parsed.items.map(item => ({
          name: item.name || 'מזון',
          grams: item.grams || 150,
          calories: item.calories || 150,
          protein: item.protein || 10,
          fat: item.fat || 5,
        }));

        return {
          success: true,
          items,
          confidence: parsed.confidence || 'medium',
        };
      } else if (parsed.food_name) {
        // Old format fallback - single item
        return {
          success: true,
          items: [{
            name: parsed.food_name,
            grams: parsed.estimated_grams || 150,
            calories: parsed.calories || 150,
            protein: parsed.protein || 10,
            fat: parsed.fat || 5,
          }],
          confidence: parsed.confidence || 'medium',
        };
      }
    }

    throw new Error('No valid JSON');
  } catch (error) {
    console.error('3D Weight estimation error:', error);
    return {
      success: false,
      error: error.message,
      items: [{
        name: 'מנה',
        grams: 150,
        calories: 200,
        protein: 10,
        fat: 8,
      }],
      confidence: 'low',
    };
  }
};

// ============================================================
// Image Analysis
// ============================================================

export const analyzeFoodFromImage = async (imageBase64, totalGrams = null) => {
  try {
    // Build prompt based on whether total weight is provided
    const systemContent = totalGrams
      ? `זהה את המזונות בתמונה בנפרד ופרט כמה גרם מתוך ${totalGrams}g הכולל שייך לכל מרכיב.
לדוגמה: אם המשקל הכולל ${totalGrams}g ויש עוף ואורז, הערך כמה % כל אחד (לפי הנראה בתמונה) וחלק בהתאם.

החזר JSON בלבד:
{
  "items": [
    {"name": "שם בעברית", "grams": גרמים_מחושבים, "calories": קלוריות, "protein": חלבון, "fat": שומן}
  ],
  "total_grams": ${totalGrams}
}`
      : `זהה את המזונות בתמונה בנפרד (לדוגמה: "חזה עוף" ו-"אורז" בנפרד).
החזר JSON בלבד עם מערך items:
{
  "items": [
    {"name": "שם בעברית", "grams": מספר_מוערך, "calories": קלוריות_סהכ, "protein": חלבון_סהכ, "fat": שומן_סהכ}
  ]
}`;

    const userPrompt = totalGrams
      ? `זו ארוחה במשקל ${totalGrams} גרם. זהה את המרכיבים וחשב כמה גרם מתוך ה-${totalGrams}g שייך לכל אחד.`
      : 'מה יש בתמונה? השתדל להפריד בין המרכיבים העיקריים (חלבון, פחמימה, ירק). תן הערכה לכל אחד.';

    const content = await callLlm(
      [
        { role: 'system', content: systemContent },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
      { max_completion_tokens: 400, temperature: 0.2 },
    );

    // Helper to clean JSON
    const cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      console.log('🔍 Vision model response:', JSON.stringify(parsed, null, 2));
      console.log('🔍 Number of items:', parsed.items?.length || 1);
      console.log('🔍 Total grams provided:', totalGrams);

      const items = (parsed.items || [parsed]).map(item => ({
        name: item.name || 'מזון',
        grams: item.grams || 150,
        estimated_portion_grams: item.grams || 150,
        calories: item.calories || 150,
        calories_per_100g: Math.round(((item.calories || 150) / (item.grams || 150)) * 100) || 150,
        protein: item.protein || 10,
        protein_per_100g: Math.round(((item.protein || 10) / (item.grams || 150)) * 100) || 10,
        fat: item.fat || 5,
        fat_per_100g: Math.round(((item.fat || 5) / (item.grams || 150)) * 100) || 5,
        total_calories: item.calories || 150,
      }));

      return {
        items,
        totalGrams: totalGrams || items.reduce((sum, item) => sum + (item.grams || 0), 0)
      };
    }

    throw new Error('No valid JSON');
  } catch (error) {
    console.error('Image analysis error:', error);
    return {
      items: [{
        name: 'מנה',
        grams: totalGrams || 150,
        estimated_portion_grams: totalGrams || 150,
        calories: totalGrams ? Math.round((totalGrams / 100) * 150) : 225,
        calories_per_100g: 150,
        protein: totalGrams ? Math.round((totalGrams / 100) * 10) : 15,
        protein_per_100g: 10,
        fat: totalGrams ? Math.round((totalGrams / 100) * 5) : 8,
        fat_per_100g: 5,
        total_calories: totalGrams ? Math.round((totalGrams / 100) * 150) : 225,
      }],
      totalGrams: totalGrams || 150
    };
  }
};

// ============================================================
// Nutrition Calculator (for Onboarding)
// ============================================================

export const calculateNutritionTargets = async (userData) => {
  const genderHeb =
    userData.gender === 'male' ? 'גבר' : userData.gender === 'female' ? 'אישה' : 'לא צוין (השתמש בהנחיות יוניסקס / ממוצע)';

  const activityMap = {
    sedentary: 'יושבני',
    light: 'פעילות קלה',
    moderate: 'פעילות בינונית',
    active: 'פעילות גבוהה',
    intense: 'פעילות אינטנסיבית',
    high: 'פעילות גבוהה',
  };

  const goalMap = {
    cut: 'ירידה במשקל',
    maintain: 'שמירה',
    lean_bulk: 'עלייה מתונה במסה (lean bulk)',
    bulk: 'עלייה במסה',
  };

  const paceMap = {
    slow: 'קצב רגוע – יציבות לטווח ארוך',
    balanced: 'איזון בין תוצאות לנוחות',
    fast: 'שינוי מהיר בגבולות הבריא',
  };
  const paceLine =
    userData.pace && paceMap[userData.pace] ? `\nקצב רצוי: ${paceMap[userData.pace]}` : '';

  const actKey = userData.activity_level === 'high' ? 'active' : userData.activity_level;
  const presetActivityLabel = activityMap[actKey] || activityMap.moderate;
  const customAct = (userData.activity_level_notes || '').trim();
  const activityBlock = customAct
    ? customAct
    : presetActivityLabel;

  const systemPrompt = `אתה דיאטן קליני. חשב יעדים תזונתיים.

נוסחת Mifflin-St Jeor:
גברים: BMR = 10×משקל + 6.25×גובה - 5×גיל + 5
נשים: BMR = 10×משקל + 6.25×גובה - 5×גיל - 161

מכפילי פעילות: יושבני=1.2, קלה=1.375, בינונית=1.55, גבוהה=1.725, אינטנסיבית=1.9

התאמה למטרה:
- ירידה: הפחת 300-500 קלוריות
- שמירה: TDEE
- עלייה: הוסף 200-400 קלוריות

מאקרו:
- חלבון: 1.6-2g לק"ג
- שומן: 25-30% מהקלוריות
- פחמימות: יתרת הקלוריות

מים: 8-10 כוסות (יותר לעלייה במסה)

BMI = משקל / גובה²

החזר JSON בלבד:
{
  "calories": number,
  "protein": number,
  "fat": number,
  "carbs": number,
  "water": number,
  "bmr": number,
  "tdee": number,
  "bmi": number,
  "bmi_category": "תת משקל" | "תקין" | "עודף משקל" | "השמנה",
  "explanation": "הסבר קצר"
}`;

  const userPrompt = `מין: ${genderHeb}
גיל: ${userData.age}
גובה: ${userData.height_cm} ס"מ
משקל: ${userData.weight_kg} ק"ג
פעילות: ${activityBlock}
מטרה: ${goalMap[userData.goal] || goalMap.maintain}${paceLine}`;

  try {
    const response = await callLlm([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.1, max_completion_tokens: 400 });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON');
  } catch (error) {
    if (error instanceof RateLimitError || error?.name === 'RateLimitError') {
      console.warn(
        '[calculateNutritionTargets] Daily AI quota reached; using local formula.',
        error.message,
      );
    } else {
      console.error(
        '[calculateNutritionTargets] LLM error (Gemini/Edge):',
        error?.message || error,
      );
    }
    return calculateLocalTargets(userData);
  }
};

// Local fallback calculation
const calculateLocalTargets = (userData) => {
  const bmrMale = 10 * userData.weight_kg + 6.25 * userData.height_cm - 5 * userData.age + 5;
  const bmrFemale = 10 * userData.weight_kg + 6.25 * userData.height_cm - 5 * userData.age - 161;
  let bmr =
    userData.gender === 'male' ? bmrMale : userData.gender === 'female' ? bmrFemale : (bmrMale + bmrFemale) / 2;

  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, intense: 1.9, high: 1.725 };
  const act = userData.activity_level === 'high' ? 'active' : userData.activity_level;
  const tdee = Math.round(bmr * (multipliers[act] || 1.2));

  let calories = tdee;
  const pace = userData.pace || 'balanced';
  const paceCut = pace === 'slow' ? -350 : pace === 'fast' ? -500 : -400;
  const paceBulk = pace === 'slow' ? 250 : pace === 'fast' ? 400 : 300;
  const paceLean = pace === 'slow' ? 150 : pace === 'fast' ? 250 : 200;

  if (userData.goal === 'cut') calories = tdee + paceCut;
  else if (userData.goal === 'bulk') calories = tdee + paceBulk;
  else if (userData.goal === 'lean_bulk') calories = tdee + paceLean;

  calories = Math.round(calories);

  const protein = Math.round(userData.weight_kg * 1.8);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  const heightM = userData.height_cm / 100;
  const bmi = parseFloat((userData.weight_kg / (heightM * heightM)).toFixed(1));

  let bmiCategory = 'תקין';
  if (bmi < 18.5) bmiCategory = 'תת משקל';
  else if (bmi >= 25 && bmi < 30) bmiCategory = 'עודף משקל';
  else if (bmi >= 30) bmiCategory = 'השמנה';

  const waterGlasses = userData.goal === 'bulk' || userData.goal === 'lean_bulk' ? 10 : 8;

  return {
    calories, protein, fat, carbs,
    water: waterGlasses,
    bmr: Math.round(bmr), tdee, bmi, bmi_category: bmiCategory,
    explanation: 'יעדים מחושבים לפי הנתונים שלך'
  };
};

// ============================================================
// Daily Summary
// ============================================================

export const getDailySummary = async (context) => {
  const caloriesPct = Math.round((context.calories / context.caloriesTarget) * 100);
  const proteinPct = Math.round((context.protein / context.proteinTarget) * 100);
  const fatPct = Math.round((context.fat / context.fatTarget) * 100);

  const prompt = `סכם את היום ב-2-3 משפטים.
קלוריות: ${caloriesPct}% | חלבון: ${proteinPct}% | שומן: ${fatPct}%
מים: ${context.water}/${context.waterTarget}

השתמש ב-1-2 אימוג'ים. היה מקצועי ונעים.
אם קלוריות גבוהות ושומן נמוך - הצע שומן בריא.`;

  return await callLlm([
    { role: 'system', content: prompt },
    { role: 'user', content: 'סכם' }
  ], { max_completion_tokens: 150 });
};

export const getNutritionAdvice = async (context, question) => {
  const ctx =
    context && typeof context === 'object' ? JSON.stringify(context, null, 0) : String(context ?? '');
  return await callLlm(
    [
      {
        role: 'system',
        content:
          'אתה יועץ תזונה. ענה בעברית, בקצרה ובצורה מעשית. בלי אבחנה רפואית; המלץ לפגוש איש מקצוע כשצריך.',
      },
      { role: 'user', content: `הקשר:\n${ctx}\n\nשאלה:\n${question}` },
    ],
    { max_completion_tokens: 400, temperature: 0.5 },
  );
};

// ============================================================
// Advanced nutrition analysis (Gemini via proxy)
// ============================================================

export const analyzeNutritionWithO1 = async (dailyStats, targets, profile, options = {}) => {
  const { behaviorNarrative = '' } = options;
  const carbTarget = targets?.carbs || profile?.carbs_target || 250;
  const caloriesPct = Math.round(((dailyStats?.calories || 0) / (targets?.calories || 2000)) * 100);
  const proteinPct = Math.round(((dailyStats?.protein || 0) / (targets?.protein || 90)) * 100);
  const fatPct = Math.round(((dailyStats?.fat || 0) / (targets?.fat || 65)) * 100);
  const waterPct = Math.round(((dailyStats?.water_glasses || 0) / (targets?.water || 8)) * 100);
  const carbPct = Math.round(((dailyStats?.carbs || 0) / (carbTarget || 1)) * 100);
  const overallScore = Math.round(
    (Math.min(100, caloriesPct) +
      Math.min(100, proteinPct) +
      Math.min(100, fatPct) +
      Math.min(100, waterPct) +
      Math.min(100, carbPct)) /
      5
  );

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'בוקר' : hour < 17 ? 'צהריים' : hour < 21 ? 'ערב' : 'לילה';

  const historyBlock =
    behaviorNarrative && String(behaviorNarrative).trim().length > 0
      ? `\n📆 הקשר מהמסד (היסטוריה אמיתית, ~שלושה שבועות — דפוסי שעות, מקורות דיווח, פחמימות יומיות, מים, מגמת משקל):\n${behaviorNarrative.trim()}\n`
      : '\n(אין עדיין מספיק היסטוריה מעמיקה במסד — הטמע דפוסים ככל שהנתונים למעלה מאפשרים.)\n';

  const prompt = `אתה דיאטן קליני מקצועי. נתח את הנתונים התזונתיים הבאים ותן דוח מפורט ומותאם אישית.

📊 נתוני המשתמש:
- שם: ${profile?.name || 'משתמש'}
- מטרה: ${profile?.goal === 'cut' ? 'ירידה במשקל' : profile?.goal === 'bulk' ? 'עלייה במסה' : 'שמירה'}
- רמת פעילות: ${(profile?.activity_level_notes || '').trim() || profile?.activity_level || 'בינונית'}
${historyBlock}
📈 סטטוס יומי (${timeOfDay}):
- קלוריות: ${dailyStats?.calories || 0}/${targets?.calories || 2000} (${caloriesPct}%)
- חלבון: ${Math.round(dailyStats?.protein || 0)}g/${targets?.protein || 90}g (${proteinPct}%)
- שומן: ${Math.round(dailyStats?.fat || 0)}g/${targets?.fat || 65}g (${fatPct}%)
- פחמימות: ${Math.round(dailyStats?.carbs || 0)}g/${carbTarget}g (${carbPct}%)
- מים: ${dailyStats?.water_glasses || 0}/${targets?.water || 8} כוסות (${waterPct}%)
- ציון כללי: ${overallScore}%

נא להחזיר תשובה בפורמט JSON הבא בלבד:
{
  "overallScore": ${overallScore},
  "status": "מצוין/טוב/בינוני/דורש שיפור",
  "recommendation": "שמירה/שיפור",
  "mainInsight": "תובנה עיקרית קצרה וחכמה על המצב הנוכחי",
  "strengths": ["נקודה חזקה 1", "נקודה חזקה 2"],
  "improvements": ["תחום לשיפור 1 עם פתרון ספציפי", "תחום לשיפור 2 עם פתרון ספציפי"],
  "actionItems": ["פעולה ספציפית 1 לשעות הקרובות", "פעולה ספציפית 2"],
  "personalizedTip": "טיפ אישי מותאם למטרה ולשעה ביום",
  "motivationalMessage": "מסר מוטיבציוני קצר ואישי"
}

חשוב:
1. התאם את ההמלצות לשעה ביום (${timeOfDay}) - אם ערב, אל תציע ארוחות כבדות
2. התאם למטרה של המשתמש (${profile?.goal === 'cut' ? 'ירידה במשקל' : profile?.goal === 'bulk' ? 'עלייה במסה' : 'שמירה'})
3. אם הופיעה היסטוריה מהמסד — שילב בניתוח: באיזו שעות בדרך כלל אוכל/מדווח, מה חוזר, איפה בדרך כלל "נופל" (למשל חלבון מאוחר, מעט מים בבוקר)
4. היה ספציפי עם כמויות ומזונות
5. אם יש חוסר משמעותי, תן פתרון מיידי ופרקטי
6. השתמש באימוג'ים רלוונטיים (במידה)`;

  try {
    const content = await callLlm(
      [
        {
          role: 'system',
          content: 'אתה דיאטן קליני מקצועי. תענה תמיד בפורמט JSON בלבד, ללא טקסט מחוץ ל-JSON.',
        },
        { role: 'user', content: prompt },
      ],
      {
        temperature: 0.3,
        max_completion_tokens: 2000,
        response_format: { type: 'json_object' },
      },
    );

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        ...parsed,
        model: GEMINI_MODEL,
        timestamp: new Date().toISOString(),
      };
    }

    throw new Error('No valid JSON in response');
  } catch (error) {
    console.error('Nutrition analysis error:', error.message || error);
    return await analyzeNutritionFallback(dailyStats, targets, profile);
  }
};

// Fallback function (local heuristics)
const analyzeNutritionFallback = async (dailyStats, targets, profile) => {
  const carbTarget = targets?.carbs || profile?.carbs_target || 250;
  const caloriesPct = Math.round(((dailyStats?.calories || 0) / (targets?.calories || 2000)) * 100);
  const proteinPct = Math.round(((dailyStats?.protein || 0) / (targets?.protein || 90)) * 100);
  const fatPct = Math.round(((dailyStats?.fat || 0) / (targets?.fat || 65)) * 100);
  const waterPct = Math.round(((dailyStats?.water_glasses || 0) / (targets?.water || 8)) * 100);
  const carbPct = Math.round(((dailyStats?.carbs || 0) / (carbTarget || 1)) * 100);
  const overallScore = Math.round(
    (Math.min(100, caloriesPct) +
      Math.min(100, proteinPct) +
      Math.min(100, fatPct) +
      Math.min(100, waterPct) +
      Math.min(100, carbPct)) /
      5
  );

  // Generate insights locally
  const strengths = [];
  const improvements = [];
  const actionItems = [];

  if (proteinPct >= 80) strengths.push('💪 צריכת חלבון מעולה - השרירים שלך מודים לך!');
  if (fatPct >= 80) strengths.push('🥑 שומן בריא במקום - תומך בבריאות הלב');
  if (waterPct >= 80) strengths.push('💧 שתיית מים מצוינת - הגוף מרוצה!');
  if (caloriesPct >= 80 && caloriesPct <= 110) strengths.push('🎯 איזון קלורי מושלם');
  if (carbPct >= 80 && carbPct <= 120) strengths.push('🌾 איזון פחמימות טוב ליעד');

  if (proteinPct < 60) {
    const missing = Math.round((targets?.protein || 90) - (dailyStats?.protein || 0));
    improvements.push(`חסרים ${missing}g חלבון - הוסף ביצים, חזה עוף או יוגורט`);
    actionItems.push(`🥚 הוסף מקור חלבון בארוחה הבאה (${missing}g חסרים)`);
  }
  if (fatPct < 50) {
    const missing = Math.round((targets?.fat || 65) - (dailyStats?.fat || 0));
    improvements.push(`חסרים ${missing}g שומן - אבוקדו, אגוזים או שמן זית`);
    actionItems.push(`🥑 חופן אגוזים או חצי אבוקדו יעזרו`);
  }
  if (waterPct < 60) {
    const missing = (targets?.water || 8) - (dailyStats?.water_glasses || 0);
    improvements.push(`חסרות ${missing} כוסות מים`);
    actionItems.push(`💧 שתה כוס מים עכשיו!`);
  }
  if (carbPct < 55) {
    const missingG = Math.round(carbTarget - (dailyStats?.carbs || 0));
    improvements.push(`פחמימות נמוכות מול היעד — אפשר להוסיף אורז/שיבולים/לחם מלא (חסר בערך ${missingG}g)`);
  }
  if (carbPct > 130) {
    improvements.push('פחמימות מעל היעד — שקלו/י להחליף לירקות או מקור חלבון');
  }

  if (strengths.length === 0) {
    strengths.push('🌱 כל יום הוא הזדמנות להשתפר');
  }

  return {
    success: true,
    overallScore,
    status: overallScore >= 80 ? 'מצוין' : overallScore >= 60 ? 'טוב' : overallScore >= 40 ? 'בינוני' : 'דורש שיפור',
    recommendation: overallScore >= 80 ? 'שמירה' : 'שיפור',
    mainInsight: overallScore >= 80
      ? 'יום מצוין! אתה על הדרך הנכונה להשגת היעדים שלך.'
      : `הגעת ל-${overallScore}% מהיעדים. עוד קצת מאמץ ומגיעים!`,
    strengths,
    improvements: improvements.length > 0 ? improvements : ['ממשיך לעקוב - הנתונים יתעדכנו'],
    actionItems: actionItems.length > 0 ? actionItems : ['המשך לתעד את הארוחות שלך'],
    personalizedTip: profile?.goal === 'cut'
      ? 'זכור: גירעון קלורי הדרגתי הוא המפתח להצלחה ארוכת טווח'
      : profile?.goal === 'bulk'
        ? 'הקפד על חלבון בכל ארוחה לבניית שריר אופטימלית'
        : 'איזון ועקביות הם המפתחות לשמירה על משקל בריא',
    motivationalMessage: '💪 כל צעד קטן מקרב אותך למטרה!',
    model: 'fallback',
    timestamp: new Date().toISOString(),
  };
};
