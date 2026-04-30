/**
 * מתכון מפורט מארוחה מתוכננת — ללא קריאת AI.
 * כולל תבלינים ובשמים כרשימה מפורשת + סימון אופציונלי.
 */

function normalizeItems(meal) {
  const raw =
    meal.items ||
    (meal.foods
      ? meal.foods.map((f) => ({
          food: typeof f === 'string' ? f : f.name || f.food,
          amount: '',
          calories: 0,
        }))
      : []);
  return raw.filter((x) => x && (x.food || x.name));
}

function formatAmountLine(item) {
  const food = item.food || item.name || '';
  const amt = String(item.amount || '').trim();
  if (!amt) return food;
  const g = /^(\d+(?:\.\d+)?)\s*g$/i.exec(amt);
  if (g) return `${food} — ${g[1]} גרם`;
  return `${food} — ${amt}`;
}

/** טקסט מאוחד לזיהוי סוג בישול */
function foodsHaystack(items) {
  return items.map((i) => String(i.food || i.name || '')).join(' ');
}

/**
 * תבלינים ותוספי טעם מפורשים — כולם אופציונליים;
 * המשתמש רואה מה יש לבחור ממנו במקום ניסוח כללי.
 */
const OPTIONAL_SPICE_PRESETS = {
  default: [
    'פלפל שחור גרוס חדש או גרוס ארוז',
    'מלח דק (שומר ידיים יבשות בעת המלחה)',
    'פפריקה מתוקה או מעושנת — חצי כפית להתחלה',
    'שום כתוש או רבע כפית אבקת שום',
    'בצל יבש גרוס או שיניים קצוצות דק',
    'זעתר — ריסוס קל על קינואה/סלט/חלבון לפני ההגשה',
    'כורכום — רבע כפית בלבד (משמש גם לצבע; זהירות מכתמים)',
    'כוסברה או פטרוזיליה טרייה קצוצה להגשה',
    'פתיתי צ׳ילי יבשים או רוטב חריף בכמות קטנה',
    'עלי אורגנו יבשים או רוזמרין יבש לעוף/ירקות בתנור',
  ],
  fish: [
    'מלח דק ופלפל לבן לדגים עדינים',
    'קצף לימון טרי או כף לימון סחוט בסוף הבישול',
    'שום כתוש עם קצת שמן זית למרינדה קצרה (5–10 דק׳)',
    'שמיר או שום פטרוזיליה קצוצים להגשה',
    'פפריקה מתוקה בשכבה דקה על הפילה לפני צלייה',
    'כמון טחון בריסוס קטן על דג לבן',
  ],
  eggs: [
    'פלפל שחור טחון טרי',
    'מלח דק',
    'פפריקה מתוקה על חביתה או עיניים',
    'עשבי תיבול יבשים (אורגנו/בזיליקום) קצת לפני סיום הבישול',
  ],
  dairy_fruit: [
    'וניל טבעי טיפה ביוגורט (אופציונלי)',
    'קינמון טחון על פירות או יוגורט',
    'דבש או סירופ מייפל — התחלה מכפית קטנה ולפי טעם',
    'גרעיני צ׳יה או פשתן טחון להטמעה ביוגורט',
  ],
};

function inferKind(haystack) {
  const s = haystack;
  if (/סלמון|טונה|דג|פילה|פיש|טרוטה|מושט/.test(s)) return 'fish';
  if (/חזה עוף|עוף|הודו|שוק עוף|כנף|שניצל|סטייק|בשר|טחון/.test(s)) return 'meat_poultry';
  if (/ביצים|חביתה|שקשוקה|חלבון/.test(s)) return 'eggs';
  if (/יוגורט|קוטג׳|גריק|גבינה|קוטג׳|שמנת חמוצה/.test(s)) return 'dairy';
  if (/פסטה|ספגטי|פנה|נודלס|רביולי/.test(s)) return 'pasta';
  if (/אורז|קינואה|בורגול|שעורה|פריקה/.test(s)) return 'grain';
  if (/סלט|חסה|עגבנייה|מלפפון|גזר חי/.test(s)) return 'salad';
  return 'mixed';
}

function pickSpices(kind) {
  if (kind === 'fish') return OPTIONAL_SPICE_PRESETS.fish;
  if (kind === 'eggs') return OPTIONAL_SPICE_PRESETS.eggs;
  if (kind === 'dairy') return OPTIONAL_SPICE_PRESETS.dairy_fruit;
  if (kind === 'salad') {
    return [
      ...OPTIONAL_SPICE_PRESETS.default.slice(0, 6),
      'זעתר או סומק על ירקות קשים או לפני טיגון קצר',
      'גרידת קליפת לימון טרייה (בלי השכבה הלבנה המרה)',
    ];
  }
  return OPTIONAL_SPICE_PRESETS.default;
}

function estimateMinutes(kind, itemCount) {
  const base =
    kind === 'fish'
      ? 18
      : kind === 'meat_poultry'
        ? 28
        : kind === 'eggs'
          ? 12
          : kind === 'pasta'
            ? 22
            : kind === 'grain'
              ? 26
              : kind === 'salad'
                ? 15
                : kind === 'dairy'
                  ? 10
                  : 22;
  const hi = base + Math.min(15, itemCount * 2);
  const lo = Math.max(10, base - 8);
  return `${lo}–${hi}`;
}

function buildSteps(kind, items) {
  const haystack = foodsHaystack(items);
  const hasCarb = /אורז|פסטה|קינואה|בטטה|תפוח אדמה|לחם|פיתה|בורגול/.test(haystack);
  const hasVeg = /ירק|סלט|ברוקולי|גזר|בצל|עגבנייה|מלפפון|פלפל/.test(haystack);

  const prep = [
    'סדר את כל הרכיבים על משטח נקי. אם יש עוף/בשר/דג קירור — הוצא מהמקרר כ‑15 דק׳ לפני בישול כדי לצלייה אחידה.',
    'שקול או מדוד כמויות לפי הרשימה. במנה משולבת התחל מהרכיב הארוך ביותר בזמן (פסטה/אורז או רוטב בסיס).',
  ];

  const poultryCook = [
    'חמם מחבת או תבנית על חום בינוני‑גבוה (או תנור ל‑190°C לצלייה). הוסף כף עד שתיים שמן זית.',
    'ייבש את פרוסות הבשר במגבת נייר. תבל במלח דק ופלפל שחור גרוס משני הצדדים לפני המחבת — פחות התזות שומן וצלייה ישרה יותר.',
    'הנח את הבשר והמתן ללא הזזה עד קליפה זהובה (כ‑5–7 דק׳ לצד ראשון, לפי עובי). הפוך פעם אחת.',
    'בדוק עשוי בעוף: לא נשאר ורוד דחוס במרכז; במידת הצורך כיסוי קצר או דקה נוספת על צד שטוח.',
    'הורד מהאש, המתן 3 דק׳ מנוחה ואז פרוס להגשה — הנוזלים מתפזרים בתוך הסיבים.',
  ];

  const fishCook = [
    'חמם מחבת עם כף שמן זית על חום בינוני‑גבוה עד שהשמן מתחיל להבריק.',
    'ייבש את פילה הדג במגבת נייר. תבל במלח דק ופלפל לבן דק משני הצדדים.',
    'הנח את הפילה הצד היפה למטה; אל תזוז 3–4 דק׳ עד קליפה זהובה.',
    'הפוך בעדינות לצד שני 2–4 דק׳ — דג עדין עדיף מעט לח במרכז מאשר יבש.',
    'בדיקת התבשילות: כשהסיבים מתפרדים במזלג והמרכז שקוף מעט בלבד — הורד מהאש מיד (דג יבש פחות טעים).',
  ];

  const eggs = [
    'חמם מחבת נון־סטיק עם כף קטנה של שמן או קוביית חמאה קטנה על חום בינוני.',
    'טפטף את הביצים בעדינות; נטר עם כף רכה כל 20–30 שניות לקפיצים רכים או השאר להיקשר לחביתה מוצקת.',
    'כבה את האש כשהגבינה הרכה נראית עדיין לחה במעט — השארית חום תסיים בישול.',
  ];

  const pastaGrain = [
    'בסיר בינוני הרתח מים עם כף מלח גס — יחס נפחי למים נטול קיפוח כדי שהפסטה/אורז לא יידבקו.',
    'אם יש פסטה: בישול לפי זמן על האריזה פחות דקה למנה אל דנטה; שמרו כוס מים מהסיר לפני סינון לדילול רוטב.',
    'אם יש אורז/קינואה: טיגון קצר בצל בשמן לפני נוזל הרתחה משפר טעם; כוס נוזל לכוס דגנית ככלל אצבע לאורז לבן.',
    'ערבב עם הרוטב או השמן והירקות רק בסוף — טעם וכוון מלח לאחר צילוף חום.',
  ];

  const dairy = [
    'ערבב את יוגורט/קוטג׳ עם כף מים או חלב עד מרקם אחיד.',
    'הוסף פירות או דגנים ברגע האחרון כדי שלא יירככו.',
    'הגש בקערה רחבה כדי שהפריטים לא יידחסו ולא ישחררו נוזל מיותר.',
  ];

  const salad = [
    'שטוף ירקות במים קרים וייבש בספין או במגבת נקייה.',
    'חתוך לאחידות דומה כדי שכל כף תקבל טעם דומה.',
    'הכן רוטב נפרד בצנצנת: 3 חלקים שמן זית ל־1 חלק חומץ יין או מיץ לימון, קורטוב מלח דק וטיפת חרדל — טלטל מחוץ לסלט ושפוך רק לפני האכילה.',
  ];

  const assemble = [];

  if (hasCarb && (kind === 'meat_poultry' || kind === 'fish' || kind === 'mixed')) {
    assemble.push(
      'הרכבה: פרוס את החלבון על מיטת הפחמימה המוכנה. אם הרוטב נפרד — ייצב על הצלחת את הפחמימה, ירקות צד ומעל החלבון כדי לשמור על פריכות.',
    );
  } else if (hasVeg) {
    assemble.push(
      'הרכבה: סדר את הירקות כבסיס, מעלה את החלבון/הפחמימה במרכז, והוסף רוטב או שמן זית בריסוס דק.',
    );
  } else {
    assemble.push(
      'הרכבה: סדר על הצלחת מהחם למחמם כדי שהקערה התחתונה לא תתרכך.',
    );
  }

  const finish = [
    'בדיקה אחרונה: טעם תיבול אחרי שהמנה צונחת דקה — לעיתים צריך קורטוב מלח בלבד לאחר שהחום פיזר את השומנים.',
    'שמירה: ארוז במיכל אטום במקרר עד 48 שעות; חזור חימום עד רתיחה בעוף ובשר.',
  ];

  let core = [];
  if (kind === 'fish') {
    core = [...prep.slice(0, 1), ...fishCook, ...assemble, ...finish];
  } else if (kind === 'meat_poultry') {
    core = [...prep, ...poultryCook, ...assemble, ...finish];
  } else if (kind === 'eggs') {
    core = [...prep.slice(0, 1), ...eggs, ...assemble, finish[0]];
  } else if (kind === 'pasta' || kind === 'grain') {
    core = [...prep.slice(0, 1), ...pastaGrain, ...assemble, ...finish];
  } else if (kind === 'dairy') {
    core = [...prep.slice(0, 1), ...dairy, ...finish];
  } else if (kind === 'salad') {
    core = [...prep.slice(0, 1), ...salad, finish[0]];
  } else {
    core = [
      ...prep,
      ...(hasCarb ? pastaGrain.slice(0, 3) : []),
      ...(haystack.match(/דג|טונה|סלמון|פילה/)
        ? fishCook.slice(0, 4)
        : haystack.match(/עוף|בשר|שניצל/)
          ? poultryCook.slice(0, 4)
          : eggs.slice(0, 2)),
      ...assemble,
      ...finish,
    ];
  }

  return core.map((line, i) => ({
    label: `שלב ${i + 1}`,
    text: line,
  }));
}

export function buildMealRecipeDraft(meal) {
  const items = normalizeItems(meal);
  const title = meal.name || 'ארוחה';
  const ingredients = items.map(formatAmountLine);
  const haystack = foodsHaystack(items);
  const kind = inferKind(haystack);

  const spiceLines = pickSpices(kind);

  const stepsDetailed = buildSteps(kind, items);

  const estimatedMinutes = estimateMinutes(kind, items.length);

  return {
    title,
    ingredients,
    estimatedMinutes,
    spiceSectionTitle: 'תבלינים ועשבי תיבול מוצעים (הכל אופציונלי)',
    spiceIntro:
      'אין חובה להשתמש בהכל — זו רשימת הצעות קונקרטיות; התחל במלח ופלפל ובחר עוד 1–2 תוספות טעם שלא יציפו את המנה.',
    optionalSeasonings: spiceLines,
    steps: stepsDetailed,
    headline: ingredients.length
      ? `${title}: ${ingredients.slice(0, 3).join(' · ')}${ingredients.length > 3 ? '…' : ''}`
      : title,
  };
}
