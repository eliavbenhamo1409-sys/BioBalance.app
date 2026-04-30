import { callGemini, RateLimitError } from './geminiClient';
import { BRACHOT_FOOD_KNOWLEDGE_BASE } from '../data/brachotFoodKnowledgeBase';
import { BRACHOT_HALACHA_RULES_LUSTIGMAN } from '../data/brachotHalachaRules';

const buildSystemPrompt = () => `אתה סוכן יועץ ברכות לפני ואחרי אכילה, בעברית, בסגנון **קצר ומעשי**.

## חובת זהירות (חמור)
- דיני ברכות עלולים להכשיל אם מחמירים או מקילים שלא כהלכה. **אל תנחה בביטחון חסר** אם יש ספק, מחלוקת פוסקים, או פרט מכריע (כשרות, הרכב מדויק, נוסח עדה).
- אם אינך ודאי — ציין בבירור: "יש לברר עם רב/מקור מהימן" ואל תמציא פסק. עדיף ספק מרשע מאשר הכשלה.

## סדר עדיפויות לענות
1. **כללים ההלכתיים המפורטים** למטה (לוח ברכות — מבוסס מאמר מאת יעקב לוסטיגמן: סוגי ברכות, "פת" מול מזונות, מצה אחרי הפסח, חלה מתוקה, קמח כדבק, הגפן מול ענבים, עץ מול אדמה, שהכל במיוחד כהלכה).
2. **טבלת המאכלים הפנימית** — להתאמות מהירות כשיש שורה מתאימה במפורש.
3. אם נראית **סתירה** בין כלל לבין שורה בטבלה, או שאלה חוצה-עדות (ספרד/אשכנז) — הדגש את המחלוקת והפנה לברר; אל תכריע חד-צדדי בשאלות מורכבות.
4. מידע חסר על מוצר תעשייתי — הנחיה לפי הכללים הכלליים + הצעה לאמת בחותמת כשרות/רב.

## פורמט תשובה (חובה)
החזר **רק** אובייקט JSON תקף — בלי טקסט לפני או אחרי, בלי markdown.
השדות:
- \`before\` (string): **ברכה ראשונה בלבד** — שם הברכה המלא (למשל "בורא מיני מזונות") + אם צריך משפט הקשר קצר מאוד באותה מחרוזת.
- \`after\` (string): **ברכה אחרונה בלבד** — שם/סוג (למשל "בורא נפשות", "ברכת המזון") או המילה **"אין"** כשאין חיוב.
- \`afterBlessing\` (string): אחד בדיוק מ: \`"hamazon"\` | \`"mein"\` | \`"michya"\` | \`"short"\` | \`"none"\`.
  - \`hamazon\` — ברכת המזון.
  - \`mein\` — מעין שלוש **מלא** (כשצריך את כל הנוסח: חמשת מיני דגן יחד עם יין או פירות עץ וכו׳).
  - \`michya\` — **רק** ברכת על המחיה (אחרי מזונות / חמשת מיני דגן בכמות המחייבת — בלי יין ובלי פירות עץ במנה).
  - \`short\` — מסך **בורא נפשות** (בורא נפשות וכו׳ אחרי מה שאינו מזון שמחייב על המחיה).
  - \`none\` — אין ברכה אחרונה (למשל מים בלבד, או מצב שאין חיוב בירכתא).
- \`note\` (string, **אופציונלי**): רק כשהמצב **מורכב** — ספק הלכתי, מחלוקת פוסקים, או "יש לברר עם רב"; **משפט–שניים לכל היותר**, שפה פשוטה. אם התשובה פשוטה — אל תשלח שדה זה או שלח מחרוזת ריקה.

דוגמה מזונות: {"before":"בורא מיני מזונות","after":"על המחיה","afterBlessing":"michya","note":""}
דוגמה אחר: {"before":"בורא פרי העץ","after":"בורא נפשות","afterBlessing":"short","note":""}

---

### כללים הלכתיים (מפורט)
${BRACHOT_HALACHA_RULES_LUSTIGMAN}

---

### טבלת ידע פנימית (מאכל — חלוקה — ברכה אחרונה / הערות)
${BRACHOT_FOOD_KNOWLEDGE_BASE}
`;

const AFTER_KEYS = new Set(['hamazon', 'mein', 'michya', 'short', 'none']);

/**
 * @param {string} raw
 * @returns {{
 *   reply: string,
 *   afterBlessing: 'hamazon'|'mein'|'michya'|'short'|'none'|null,
 *   before: string,
 *   after: string,
 *   note: string,
 * }}
 */
export function parseBrachotAssistantJson(raw) {
  const s = String(raw || '').trim();
  const tryObject = (obj) => {
    if (!obj || typeof obj !== 'object') return null;
    const ab = String(obj.afterBlessing || '').toLowerCase().trim();
    const afterBlessing = AFTER_KEYS.has(ab) ? ab : null;

    const before = typeof obj.before === 'string' ? obj.before.trim() : '';
    const after = typeof obj.after === 'string' ? obj.after.trim() : '';
    const note = typeof obj.note === 'string' ? obj.note.trim() : '';
    let reply = typeof obj.reply === 'string' ? obj.reply.trim() : '';

    if (!reply && (before || after || note)) {
      const parts = [];
      if (before) parts.push(`לפני: ${before}`);
      if (after) parts.push(`אחרי: ${after}`);
      if (note) parts.push(note);
      reply = parts.join('\n\n');
    }
    if (!reply) return null;
    return { reply, afterBlessing, before, after, note };
  };

  try {
    const direct = JSON.parse(s);
    const out = tryObject(direct);
    if (out) return out;
  } catch {
    // continue
  }

  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      const out = tryObject(JSON.parse(fence[1].trim()));
      if (out) return out;
    } catch {
      // continue
    }
  }

  const brace = s.match(/\{[\s\S]*\}/);
  if (brace) {
    try {
      const out = tryObject(JSON.parse(brace[0]));
      if (out) return out;
    } catch {
      // continue
    }
  }

  return { reply: s, afterBlessing: null, before: '', after: '', note: '' };
}

/**
 * שאלת «מה לברך» על מאכל או מנה — דרך Gemini (אותה מכסה כמו צ'אט).
 * @param {string} userQuery
 * @param {{ signal?: AbortSignal }} options
 * @returns {Promise<{ reply: string, afterBlessing: 'hamazon'|'mein'|'michya'|'short'|'none'|null, before: string, after: string, note: string }>}
 */
export async function askBrachotAssistant(userQuery, options = {}) {
  const q = String(userQuery || '').trim();
  if (!q) {
    throw new Error('חסר טקסט');
  }

  const text = await callGemini(
    [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content:
          `המשתמש כותב מה הוא רוצה לאכול או שואל על מאכל:\n«${q}»\n\n` +
          'החזר רק JSON לפי הפורמט בהנחיות המערכת (before, after, afterBlessing כולל michya או mein לפי הצורך; note רק אם מורכב).',
      },
    ],
    {
      temperature: 0.25,
      maxTokens: 800,
      thinkingBudget: 0,
      signal: options.signal,
      timeoutMs: 25000,
    },
  );
  return parseBrachotAssistantJson(text);
}
