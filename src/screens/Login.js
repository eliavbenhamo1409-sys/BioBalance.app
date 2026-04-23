// Login Screen for BioBalance - Premium Minimalist Design with OTP Support
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  StatusBar,
  Image,
  ScrollView,
  Modal,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { sendOTP, verifyOTP } from '../api/supabaseClient';

const { width, height } = Dimensions.get('window');

// Fresh & Healthy Green Colors
const COLORS = {
  green: {
    primary: '#10B981',    // Fresh emerald green
    light: '#34D399',      // Bright mint
    lighter: '#6EE7B7',    // Light mint
    pale: '#A7F3D0',       // Pale mint
    bg: '#ECFDF5',         // Very light mint bg
  },
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  error: '#DC2626',
};

// Terms of Use Content
const TERMS_OF_USE = `תנאי שימוש – BioBalance

עודכן לאחרונה: דצמבר 2024

1. כללי

1.1. ברוך הבא ל־BioBalance (להלן: "האפליקציה" או "השירות").
האפליקציה מאפשרת מעקב אחר תזונה, קלוריות, מאקרונוטריינטים (חלבון, שומן, פחמימות), שתיית מים, ניתוח תמונות מזון באמצעות בינה מלאכותית, הצגת גרפים ותמריצים התנהגותיים, וכן אינטגרציה אפשרית עם אנשי מקצוע (תזונאים) ועם גורמי בריאות חיצוניים.

1.2. תנאי שימוש אלה ("התנאים") מסדירים את השימוש שלך בשירות. השימוש באפליקציה מהווה הסכמה מלאה לתנאים אלה. אם אינך מסכים לתנאים – אל תשתמש באפליקציה.

1.3. ייתכן שנעדכן מעת לעת את התנאים. עדכונים ייכנסו לתוקף במועד פרסומם באפליקציה. המשך שימושך בשירות לאחר העדכון יהווה הסכמה לתנאים המעודכנים.

2. אופי השירות – אין ייעוץ רפואי

2.1. השירות נועד למטרות מעקב, תובנות והרגלי אורח חיים בריא בלבד, ואינו מהווה ייעוץ רפואי, אבחון, טיפול או המלצה רפואית מכל סוג.

2.2. BioBalance אינה תחליף לייעוץ אישי מרופא, תזונאי קליני, דיאטנית מוסמכת או כל איש מקצוע אחר.

2.3. בכל שאלה רפואית, שינוי תרופות, חשד למחלה, מצבי חירום רפואיים וכדומה – עליך לפנות לרופא או לגורם רפואי מוסמך, או להתקשר לשירותי חירום בהתאם למצב. אל תסתמך על האפליקציה לצורך קבלת החלטות רפואיות.

3. זכאות לשימוש

3.1. השימוש באפליקציה מיועד בדרך כלל למשתמשים מעל גיל 16.

3.2. אם גילך נמוך מ־18, ייתכן שהדין מחייב אישור הורה/אפוטרופוס לשימוש בשירות ולמתן הסכמה לעיבוד מידע אישי/בריאותי. באחריותך לוודא שאישור כזה אכן קיים בהתאם לדין החל עליך.

3.3. אנו שומרים לעצמנו את הזכות להגביל את השימוש בשירות, לסרב לפתוח חשבון, או לחסום משתמש – לפי שיקול דעתנו הבלעדי, ובלא הודעה מוקדמת, במקרה של הפרת תנאים אלו או שימוש לרעה.

4. יצירת חשבון ומשתמש

4.1. לשם שימוש מלא באפליקציה, ייתכן שתידרש הרשמה ויצירת חשבון משתמש הכולל, בין היתר: כתובת דוא״ל, סיסמה ופרטים בסיסיים (לדוגמה: גיל, מין, משקל, גובה, יעדי תזונה/משקל).

4.2. אתה מתחייב לספק פרטים נכונים, מלאים ומדויקים, ולעדכן אותם לפי הצורך.

4.3. אתה אחראי לשמירה על סודיות פרטי הגישה שלך, ועל כל פעילות שתתבצע בחשבונך. עליך להודיע לנו מיד במקרה של שימוש לא מורשה או חשד כזה.

5. רישיון שימוש באפליקציה

5.1. בכפוף לעמידתך בתנאים אלה, אנו מעניקים לך רישיון אישי, בלתי בלעדי, בלתי ניתן להעברה, מוגבל בזמן, לשימוש באפליקציה למטרות פרטיות ולא מסחריות בלבד.

5.2. למעט אם הותר במפורש על ידינו, אינך רשאי:
• להעתיק, לשכפל, להפיץ, לשכור, להשכיר, למכור, להעניק רישיון משנה, לתרגם, לשנות, לבצע הנדסה הפוכה, לפרק או להרכיב מחדש כל חלק מהאפליקציה;
• להשתמש באפליקציה באופן היוצר עומס חריג על השרתים;
• להשתמש באפליקציה בניגוד לדין החל.

6. תוכן משתמש (User Content)

6.1. האפליקציה מאפשרת לך להזין ולשמור מידע כגון: יומני אכילה, נתוני שתייה, משקל, תמונות מזון, טקסטים בצ׳אט עם הבוט, והודעות אחרות ("תוכן משתמש").

6.2. אתה נותר בעל הזכויות בתוכן המשתמש שלך, אך בכך שאתה מעלה או מזין אותו לשירות, אתה מעניק לנו רישיון עולמי, לא בלעדי, חינמי, לשימוש בתוכן לצורך:
• הצגת הנתונים בחשבונך;
• ניתוח המידע לצורך מתן והשתפרות השירות;
• יצירת נתונים סטטיסטיים ואנונימיים.

6.3. אינך רשאי להעלות תוכן:
• בלתי חוקי, פוגעני, משמיץ, מאיים או הכולל הסתה;
• הפוגע בזכויות קניין רוחני של צדדים שלישיים;
• הכולל פרטי זיהוי של צדדים שלישיים ללא הסכמתם.

7. שימושים אסורים

מבלי לגרוע מכלליות האמור, חל איסור על:
• שימוש בשירות לצורך מתן ייעוץ רפואי לצדדים שלישיים ללא רישיון מתאים;
• ניסיון לעקוף מנגנוני אבטחה או הרשאה;
• שימוש ב־bots, scrapers, או אמצעים אוטומטיים לגישה לשירות ללא אישור;
• שימוש בשירות באופן שעלול לפגוע בפרטיות משתמשים אחרים או בצדדים שלישיים.

8. תשלום, מנויים ושירותים נוספים

8.1. ייתכן שחלק מתכונות האפליקציה יסופקו ללא תשלום, ואחרות – במסגרת מנוי בתשלום.

8.2. תנאי התשלום, סוגי המנויים, תקופות החיוב ומדיניות ביטול/החזר – יוצגו במסך הרלוונטי באפליקציה ומהווים חלק בלתי נפרד מתנאים אלה.

9. אינטגרציה עם תזונאים וקופות חולים

9.1. ייתכן שהאפליקציה תאפשר לך, לפי בחירתך, לשתף מידע מסוים מן החשבון שלך עם תזונאי/ת, דיאטנית, רופא, או עם גורם בריאות (למשל: קופת חולים) באמצעות ממשקים חיצוניים מאובטחים.

9.2. עצם השיתוף עם גורמים כאלה הוא באחריותך, ובכפוף להסכמתך המפורשת בכל פעם.

9.3. BioBalance אינה צד ליחסים המקצועיים/חוזיים בינך לבין אותו גורם בריאות, ואינה אחראית לכל ייעוץ, המלצה או טיפול הניתנים לך על ידו.

10. קניין רוחני

10.1. כל הזכויות באפליקציה, לרבות קוד מקור, עיצוב גרפי, לוגו, תכנים מערכתיים, טקסטים, אייקונים, בסיסי נתונים וכל רכיב אחר – שייכים ל־BioBalance ו/או למורשים מטעמו.

10.2. למעט כפי שהותר במפורש בתנאים אלה, אינך רשאי להשתמש בסימני המסחר, בשם המסחרי או בקניין הרוחני שלנו ללא אישור בכתב.

11. הגבלת אחריות

11.1. השימוש בשירות הוא על אחריותך הבלעדית. השירות מסופק "כמות שהוא" (AS IS) ו־"כפי שהוא זמין" (AS AVAILABLE), ללא כל אחריות מפורשת או משתמעת.

11.2. אנו לא נישא באחריות לכל נזק ישיר, עקיף, תוצאתי, מיוחד או עונשי, הנובע משימוש או אי־יכולת להשתמש באפליקציה, לרבות אך לא רק: טעויות בנתונים, פרשנות שגויה, החלטות תזונתיות/בריאותיות שגויות, או אובדן מידע.

11.3. אין באלגוריתמים, בחישובים או בהמלצות הנגזרות מן המידע באפליקציה כדי להבטיח תוצאות בריאותיות, ירידה במשקל, עליה במסת שריר, או כל תוצאה אחרת.

12. שיפוי

אתה מתחייב לשפות ולפצות את BioBalance ואת עובדיה, מנהליה, נציגיה וסוכניה בגין כל תביעה, נזק, הוצאה או עלות (לרבות שכר טרחת עו״ד סביר) שייגרמו עקב הפרת תנאים אלה או שימושך הלא חוקי/הפוגעני בשירות.

13. שינוי והפסקת השירות

13.1. אנו רשאים לעדכן, להרחיב, לצמצם, להשעות או להפסיק את השירות, כולו או חלקו, בכל עת, לפי שיקול דעתנו.

13.2. כאשר ניתן, נשתדל לעדכן מראש על שינויים מהותיים, אך איננו מתחייבים לכך.

14. דין ושיפוט

14.1. על תנאים אלה יחולו דיני מדינת ישראל.

14.2. סמכות השיפוט הבלעדית בכל מחלוקת הנובעת מתנאים אלה או מן השימוש בשירות – נתונה לבתי המשפט המוסמכים בתל אביב-יפו.

15. שימוש בבינה מלאכותית (AI)

15.1. חלק מיכולות האפליקציה, לרבות ניתוח תמונות מזון, יצירת תובנות תזונתיות, הצעת מתכונים, הערכת מאזן קלורי, זיהוי דפוסי אכילה ותזכורות מותאמות אישית, נשענים על מודלים של בינה מלאכותית (להלן: "המודלים").

15.2. המודלים עשויים להתבסס, בין היתר, על שירותי צד שלישי (למשל ספקי מודלי שפה/ראייה ממוחשבת), והמידע שאתה מזין עשוי להישלח לעיבוד אצל אותם ספקים, בכפוף למדיניות הפרטיות ולדיני הגנת הפרטיות החלים.

15.3. אף שאנו שואפים לדיוק מירבי, תוצאות המודלים (לרבות הערכות קלוריות, הרכב תזונתי, ניתוח תמונה או הצעות למתכונים) אינן מבטיחות נכונות מלאה, עשויות להיות חלקיות, שגויות או בלתי מעודכנות, ואינן מהוות ייעוץ מקצועי מכל סוג.

15.4. עליך להפעיל שיקול דעת עצמאי בכל שימוש בתוצאות המודלים, ובפרט בכל הקשור לבריאות, תזונה, פעילות גופנית או שינוי אורח חיים. אין להסתמך על המודלים כתחליף לייעוץ רפואי או תזונתי אישי.

15.5. ייתכן שתוכן שיוצג לך ייווצר באופן אוטומטי, ללא בדיקה אנושית מראש. אינך רשאי להסתמך על תוכן זה לצורך קבלת החלטות רפואיות, משפטיות או אחרות בעלות משמעות, מבלי להתייעץ עם גורם מוסמך.

15.6. אנו רשאים לעדכן, לשנות או להחליף את המודלים המשמשים באפליקציה מעת לעת, לשפר את איכותם, לשנות פרמטרים של האלגוריתמים, ולהוסיף או להסיר יכולות, הכל לפי שיקול דעתנו.

15.7. אתה מצהיר כי אתה מבין את המגבלות הטבועות בטכנולוגיות בינה מלאכותית וכי לא תהא לך כל טענה כלפינו עקב טעות, אי־דיוק או חוסר עקביות בתוצרים שנוצרו באמצעות המודלים, בכפוף להגבלות האחריות הקבועות בתנאים אלה.`;

// Privacy Policy Content
const PRIVACY_POLICY = `מדיניות פרטיות – BioBalance

עודכן לאחרונה: דצמבר 2024

1. כללי

1.1. מדיניות פרטיות זו ("המדיניות") מתארת כיצד אנו, ב־BioBalance, אוספים, משתמשים, שומרים ומגנים על מידע אישי ומידע בריאותי שאתה משתף באפליקציה.

1.2. אנו מכבדים את פרטיות המשתמשים ופועלים בהתאם לדין החל, לרבות דיני פרטיות בישראל, ובמידת הצורך – גם רגולציות בינלאומיות כגון GDPR עבור משתמשים מאירופה.

1.3. השימוש באפליקציה מהווה הסכמה למדיניות זו. אם אינך מסכים – אנא אל תשתמש בשירות.

2. מי אנחנו וכיצד ליצור קשר

2.1. מפעילת השירות היא: BioBalance
דוא״ל לפניות פרטיות: support@biobalance.app

3. אילו סוגי מידע אנו אוספים

אנו עשויים לאסוף את הקטגוריות הבאות:

3.1. פרטי זיהוי בסיסיים:
• שם פרטי (ואולי שם משפחה);
• כתובת דוא״ל;
• שם משתמש;
• סיסמה (בצורתה המוצפנת בלבד).

3.2. נתוני פרופיל ותזונה:
• גיל, מין, גובה, משקל התחלתי, משקל יעד;
• יעד קלורי, יעד חלבון/שומן/פחמימות, יעד שתייה;
• הרגלי פעילות גופנית (אם תבחר להזין).

3.3. נתוני שימוש יומיומיים:
• יומני אכילה (מאכלים, כמויות, שעות);
• לוג שתיית מים;
• נתוני משקל לאורך זמן;
• תגובות/אינטרקציות עם הבוט.

3.4. תמונות מזון ותוצרי ניתוח בינה מלאכותית:
• תמונות שאתה מעלה של מזון/ארוחות;
• נתוני ניתוח: זיהוי סוג מזון, הערכות קלוריות, הרכב תזונתי.

3.5. מידע טכני:
• סוג מכשיר, מערכת הפעלה, מזהי מכשיר אנונימיים;
• כתובת IP (בכפוף לדין);
• זמני גישה, דפי/מסכים שנצפו, באגים ו-crash logs.

3.6. מידע על תשלומים (אם קיים):
• נתוני חיוב בסיסיים כפי שמתקבלים מספק הסליקה (למשל, אסימוני תשלום/token), לא מספר כרטיס מלא;
• היסטוריית רכישת מנויים באפליקציה.

3.7. תקשורת ותמיכה:
• הודעות שתשלח לנו בדוא״ל/טופס תמיכה;
• משוב, דיווח על באגים, בקשות פיצ׳רים.

4. למה אנחנו משתמשים במידע (מטרות עיבוד)

אנו משתמשים במידע שלך למטרות הבאות:

4.1. הפעלת השירות – מתן גישה לאפליקציה, ניהול חשבון, הצגת הנתונים שלך, חישוב מאזן יומי, שתל״מים, גרפים.

4.2. התאמה אישית (Personalization) – התאמת המלצות, תזכורות, תגמולים, גרפי התקדמות ודפוסי אכילה אישיים.

4.3. שיפור ופיתוח השירות – ניתוח אנונימי/מואנונם של נתוני שימוש לצורך שיפור אלגוריתמים, חוויית המשתמש ודיוק החישובים.

4.4. אבטחת מידע ומניעת ניצול לרעה – ניטור פעילות חריגה, הגנה מפני ניסיונות חדירה, מניעת שימוש לרעה.

4.5. עמידה בחוק – עיבוד מידע כנדרש לפי דיני מס, דיווחים לרשויות (במידה ונדרש), ניהול תביעות.

4.6. שיתוף עם תזונאים/גורמי בריאות (אופציונלי) – אם תבחר לשתף את הנתונים שלך עם תזונאי/ת או עם גורם בריאות, נשתמש במידע רק כדי לאפשר לך את השיתוף הזה, בכפוף להסכמתך המפורשת.

5. בסיס משפטי לעיבוד מידע

בהתאם לדין החל (למשל GDPR לגבי משתמשים מאירופה), אנו עשויים להסתמך על אחד או יותר מהבסיסים הבאים:
• הסכמה מפורשת שלך לעיבוד נתוני בריאות ותזונה;
• קיום חוזה – לצורך מתן השירות אליו נרשמת;
• אינטרס לגיטימי של המפעיל – שיפור השירות, הגנה מפני הונאות/באגים, בכפוף לאיזון מול זכויותיך;
• חובה חוקית – כאשר החוק מחייב אותנו לשמור או להעביר נתונים מסוימים.

6. שיתוף מידע עם צדדים שלישיים

איננו מוכרים את הנתונים האישיים שלך לצדדים שלישיים. עם זאת, אנו עשויים לשתף מידע עם:

6.1. ספקי שירות טכנולוגיים – אחסון בענן, שירותי אנליטיקה, שירותי דוא״ל, ניטור ביצועים וכדומה, בכפוף להסכמים המבטיחים הגנה נאותה על הנתונים.

6.2. ספקי סליקה ותשלום – לצורך עיבוד תשלומים, בכפוף למדיניות האבטחה שלהם.

6.3. אנשי מקצוע (תזונאים, דיאטנים, רופאים) – רק אם תבחר במפורש לשתף את המידע שלך עמם; השיתוף ייעשה בהתאם להגדרות שתבחר.

6.4. גורמי אכיפת חוק או רגולטור – כאשר אנו מחויבים לעשות זאת לפי דין, או כאשר הדבר נדרש להגנה על זכויותינו, על משתמשים אחרים או על הציבור.

6.5. מחקר וסטטיסטיקה – אנו עשויים לעשות שימוש בנתונים אנונימיים/מואנונמים לצורך מחקר, סטטיסטיקות, או פרסומים מקצועיים – ללא אפשרות לזהותך באופן אישי.

7. העברת מידע מחוץ לישראל / לאיחוד האירופי

7.1. ייתכן שהנתונים יאוחסנו או יעובדו בשרתים הנמצאים מחוץ למדינת מגוריך (למשל, באירופה או בארה"ב).

7.2. בכל העברה כזו נעשה מאמץ לוודא רמת הגנה נאותה, בהתאם לדרישות הדין החל (למשל, הסכמי עיבוד נתונים מתאימים, סטנדרטים חוזיים מאושרים וכו').

8. אבטחת מידע

8.1. אנו מיישמים אמצעי אבטחה טכניים וארגוניים סבירים, שנועדו להגן על המידע מפני גישה בלתי מורשית, שימוש לרעה, אובדן או שינוי.

8.2. אף מערכת אינה חסינת חדירה באופן מוחלט, ולכן איננו יכולים להבטיח אבטחה מוחלטת של הנתונים. עם זאת, אנו פועלים לצמצום סיכונים ולתיקון מהיר של תקלות אבטחה אם יתגלו.

9. שמירת מידע (Retention)

9.1. נשמור את המידע האישי שלך כל עוד חשבונך פעיל או כל עוד הדבר נחוץ למטרות המתוארות במדיניות זו.

9.2. באפשרותך לבקש מחיקת חשבונך והמידע הקשור אליו. בכפוף לדין, ייתכן שיישארו ברשותנו נתונים מסוימים לצורך עמידה בחובות משפטיות, מניעת הונאה או ניהול סכסוכים.

10. זכויותיך ביחס למידע

בהתאם לדין החל, ייתכן שתהיה זכאי/ת ל־:
• זכות גישה – לקבל עותק מן המידע האישי שנשמר עליך;
• זכות תיקון – לבקש לתקן מידע שגוי או לא מעודכן;
• זכות מחיקה – לבקש מחיקת מידע, בכפוף לחריגים חוקיים;
• זכות הגבלת עיבוד – במקרים מסוימים;
• זכות התנגדות לעיבוד – בפרט כאשר הבסיס הוא אינטרס לגיטימי;
• זכות ניידות נתונים – בקבלת המידע בפורמט מובנה וקריא ממוכנת (לפי רלוונטיות הדין).

ניתן לממש זכויות אלה באמצעות פנייה אלינו בכתובת הדוא״ל המופיעה בסעיף 2.

11. ילדים וקטינים

11.1. האפליקציה אינה מיועדת לילדים מתחת לגיל 16 ללא אישור הורה/אפוטרופוס, ואיננו אוספים ביודעין מידע אישי מילדים מתחת לגיל 13.

11.2. אם נודע לנו כי נאסף מידע מילד/ה שלא כדין, נפעל למחיקתו במידת האפשר בתוך זמן סביר.

12. עדכוני מדיניות

12.1. אנו עשויים לעדכן מדיניות זו מעת לעת. שינוי מהותי ייסומן באמצעות עדכון תאריך ה-"עודכן לאחרונה" וייתכן שנשלח גם הודעה באפליקציה.

12.2. המשך שימושך באפליקציה לאחר העדכון מהווה הסכמה למדיניות המעודכנת.

13. עיבוד מידע באמצעות מודלים של בינה מלאכותית

13.1. חלק מן השירותים באפליקציה עושים שימוש במודלים של בינה מלאכותית לצורך ניתוח והפקת תובנות, ובכלל זה:
• ניתוח תמונות מזון;
• הערכת ערכים תזונתיים וקלוריים;
• הצעת מתכונים מותאמים;
• זיהוי דפוסי אכילה והרגלים;
• התאמת תזכורות ותגמולים;
• הצגת תובנות והמלצות אישיות.

13.2. לצורך הפעלת יכולות אלה, אנו עשויים לעבד את המידע שאתה מזין (טקסט, תמונות, נתוני תזונה ונתוני שימוש) באמצעות מודלים פנימיים או שירותי צד שלישי המתמחים במודלי AI, בכפוף להסכמים מתאימים והתחייבויות לאבטחת המידע.

13.3. במידת האפשר, וככל שנדרש, אנו נשתדל לצמצם את המידע שנשלח למודלים החיצוניים למינימום הדרוש לצורך מתן השירות.

13.4. השימוש במודלי AI נעשה לצורך:
• שיפור חוויית המשתמש;
• דיוק ההערכות התזונתיות;
• פיתוח ושיפור יכולות האפליקציה;
• הפקת נתונים סטטיסטיים/אנליטיים (בפורמט אנונימי, ככל הניתן).

13.5. איננו משתמשים בתכנים שאתה מזין לצורך "אימון פתוח" של מודלים חיצוניים באופן שיאפשר לזרים לזהותך, אלא בכפוף להסכמים עם ספקי השירות, ובהתאם לדין החל.

14. יצירת קשר

לשאלות, בקשות או תלונות בנושא פרטיות, ניתן לפנות אלינו בכתובת:
דוא״ל: support@biobalance.app
נושא: בקשת פרטיות – BioBalance`;

// Hero Image - The fitness high-five image
const HERO_IMAGE = require('../../assets/hero.jpg');
// Logo
const LOGO_IMAGE = require('../../assets/logo.png');

const Login = ({ navigation }) => {
  const [mode, setMode] = useState('login'); // 'login', 'register', 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState('terms'); // 'terms' or 'privacy'
  
  const { 
    loginWithGoogle,
    loginWithFacebook,
    loginWithApple,
    loginWithEmail, 
    registerWithEmail, 
    loading, 
    error,
    googleAuthReady,
    facebookAuthReady,
    appleAuthReady,
  } = useAuth();

  const [localLoading, setLocalLoading] = useState(false);

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert('שגיאה', 'נא למלא את כל השדות');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      Alert.alert('שגיאה', 'הסיסמאות לא תואמות');
      return;
    }

    if (mode === 'login') {
      const result = await loginWithEmail(email, password);
      if (!result.success) {
        Alert.alert('שגיאה', result.error || 'ההתחברות נכשלה');
      }
    } else {
      const result = await registerWithEmail(email, password);
      if (result.success) {
        setLocalLoading(true);
        const otpResult = await sendOTP(email);
        setLocalLoading(false);
        
        if (otpResult.error) {
          Alert.alert('הצלחה', 'נרשמת בהצלחה! כעת תוכל להתחבר.');
          setMode('login');
        } else {
          setOtpEmail(email);
          setMode('otp');
          Alert.alert('קוד אימות נשלח', `שלחנו קוד אימות ל-${email}`);
        }
      } else {
        Alert.alert('שגיאה', result.error || 'ההרשמה נכשלה');
      }
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 6) {
      Alert.alert('שגיאה', 'נא להזין קוד אימות בן 6 ספרות');
      return;
    }

    setLocalLoading(true);
    const result = await verifyOTP(otpEmail, otpCode);
    setLocalLoading(false);

    if (result.error) {
      Alert.alert('שגיאה', 'קוד האימות שגוי. נסה שוב.');
    } else {
      Alert.alert('הצלחה', 'החשבון אומת בהצלחה!');
    }
  };

  const handleResendOTP = async () => {
    setLocalLoading(true);
    const result = await sendOTP(otpEmail);
    setLocalLoading(false);

    if (result.error) {
      Alert.alert('שגיאה', 'לא הצלחנו לשלוח קוד חדש');
    } else {
      Alert.alert('נשלח!', 'קוד אימות חדש נשלח לאימייל שלך');
    }
  };

  const handleGoogleLogin = async () => {
    await loginWithGoogle();
  };

  const handleFacebookLogin = async () => {
    await loginWithFacebook();
  };

  const handleAppleLogin = async () => {
    await loginWithApple();
  };

  const openModal = (content) => {
    setModalContent(content);
    setModalVisible(true);
  };

  const isLoading = loading || localLoading;

  // Legal Modal Component
  const LegalModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {modalContent === 'terms' ? 'תנאי שימוש' : 'מדיניות פרטיות'}
            </Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView 
            style={styles.modalScroll}
            showsVerticalScrollIndicator={true}
          >
            <Text style={styles.modalText}>
              {modalContent === 'terms' ? TERMS_OF_USE : PRIVACY_POLICY}
            </Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.modalAcceptBtn}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.modalAcceptText}>הבנתי</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // OTP Verification Screen
  if (mode === 'otp') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <LegalModal />
        
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.otpHeader}>
              <View style={styles.otpIconContainer}>
                <Text style={styles.otpIconText}>✉</Text>
              </View>
              <Text style={styles.otpTitle}>אימות אימייל</Text>
              <Text style={styles.otpSubtitle}>שלחנו קוד אימות ל-{otpEmail}</Text>
            </View>

            {/* OTP Input */}
            <View style={styles.formContainer}>
              <Text style={styles.inputLabel}>קוד אימות (6 ספרות)</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="000000"
                placeholderTextColor={COLORS.gray[400]}
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
              />

              <TouchableOpacity
                style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                onPress={handleVerifyOTP}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>אמת</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkBtn}
                onPress={handleResendOTP}
                disabled={isLoading}
              >
                <Text style={styles.linkBtnText}>לא קיבלת? שלח שוב</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => setMode('login')}
              >
                <Text style={styles.linkBtnTextSecondary}>חזור להתחברות</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // Main Login/Register Screen
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <LegalModal />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Image Section */}
          <View style={styles.heroSection}>
            <Image
              source={HERO_IMAGE}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.heroOverlay} />
          </View>

          {/* Brand Section */}
          <View style={styles.brandSection}>
            <Image source={LOGO_IMAGE} style={styles.brandLogoImage} resizeMode="contain" />
            <Text style={styles.brandSlogan}>Balanced by data. Personalized for you.</Text>
            <View style={styles.brandLine} />
          </View>

          {/* Form Section */}
          <View style={styles.formContainer}>
            <Text style={styles.formSubtitle}>היי 👋 בוא נתחיל</Text>

            {/* Google Sign In */}
            {/* Social Login Buttons - Circular */}
            <View style={styles.socialCirclesRow}>
              <TouchableOpacity
                style={[styles.socialCircle, !googleAuthReady && styles.btnDisabled]}
                onPress={handleGoogleLogin}
                disabled={isLoading || !googleAuthReady}
                activeOpacity={0.8}
              >
                <Image 
                  source={{ uri: 'https://www.google.com/favicon.ico' }}
                  style={styles.socialCircleLogo}
                />
              </TouchableOpacity>

              {/* Facebook Login - זמנית מושבת עד תיקון הגדרות */}
              {false && (
                <TouchableOpacity
                  style={[styles.socialCircle, !facebookAuthReady && styles.btnDisabled]}
                  onPress={handleFacebookLogin}
                  disabled={isLoading || !facebookAuthReady}
                  activeOpacity={0.8}
                >
                  <Text style={styles.facebookCircleLogo}>f</Text>
                </TouchableOpacity>
              )}

              {/* Apple Sign In */}
              <TouchableOpacity
                style={[styles.socialCircle, !appleAuthReady && styles.btnDisabled]}
                onPress={handleAppleLogin}
                disabled={isLoading || !appleAuthReady}
                activeOpacity={0.8}
              >
                <Image 
                  source={{ uri: 'https://cdn-icons-png.flaticon.com/512/0/747.png' }}
                  style={styles.socialCircleLogo}
                />
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>או</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email Input */}
            <TextInput
              style={styles.input}
              placeholder="אימייל"
              placeholderTextColor={COLORS.gray[400]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              textAlign="right"
            />
            
            {/* Password Input */}
            <TextInput
              style={styles.input}
              placeholder="סיסמה"
              placeholderTextColor={COLORS.gray[400]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textAlign="right"
            />

            {/* Forgot Password */}
            {mode === 'login' && (
              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={styles.forgotText}>שכחת סיסמה?</Text>
              </TouchableOpacity>
            )}

            {/* Confirm Password (Registration only) */}
            {mode === 'register' && (
              <TextInput
                style={styles.input}
                placeholder="אימות סיסמה"
                placeholderTextColor={COLORS.gray[400]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                textAlign="right"
              />
            )}

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.primaryBtn, 
                isLoading && styles.btnDisabled,
                (!email || !password) && styles.btnDisabledLight
              ]}
              onPress={handleEmailAuth}
              disabled={isLoading || !email || !password}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {mode === 'login' ? 'התחברות ל-BioBalance' : 'הירשם ל-BioBalance'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle Login/Register */}
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleText}>
                {mode === 'login' ? 'אין לך חשבון? ' : 'יש לך חשבון? '}
                <Text style={styles.toggleTextHighlight}>
                  {mode === 'login' ? 'הירשם עכשיו' : 'התחבר'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer - Legal Links */}
          <TouchableOpacity 
            style={styles.footer}
            onPress={() => openModal('terms')}
            activeOpacity={0.7}
          >
            <Text style={styles.footerText}>
              בהמשך, אתה מסכים ל<Text style={styles.footerLink}>תנאי השימוש</Text> ו<Text style={styles.footerLink}>מדיניות הפרטיות</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Hero Section
  heroSection: {
    height: height * 0.30,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // Brand Section
  brandSection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 60,
  },
  brandWelcome: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.gray[400],
    marginBottom: 2,
  },
  brandLogoImage: {
    width: 180,
    height: 42,
    marginBottom: 8,
  },
  brandSlogan: {
    fontSize: 12,
    color: COLORS.gray[400],
    marginTop: 10,
    fontWeight: '400',
  },
  brandLine: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.green.primary,
    marginTop: 14,
    borderRadius: 1,
  },

  // Form Section
  formContainer: {
    paddingHorizontal: 28,
    paddingBottom: 10,
  },
  formSubtitle: {
    fontSize: 14,
    color: COLORS.gray[500],
    textAlign: 'center',
    marginBottom: 14,
  },

  // Social Buttons - Circular
  socialCirclesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
  },
  socialCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  socialCircleLogo: {
    width: 24,
    height: 24,
  },
  facebookCircleLogo: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1877F2',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.gray[200],
  },
  dividerText: {
    marginHorizontal: 14,
    color: COLORS.gray[400],
    fontSize: 12,
  },

  // Input Fields
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray[500],
    marginBottom: 6,
    textAlign: 'right',
  },
  input: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: COLORS.gray[800],
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    marginBottom: 12,
  },

  // OTP Input
  otpInput: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 12,
    padding: 18,
    fontSize: 28,
    fontWeight: '600',
    color: COLORS.gray[800],
    letterSpacing: 8,
    borderWidth: 2,
    borderColor: COLORS.green.light,
    marginBottom: 24,
  },

  // OTP Screen
  otpHeader: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
  },
  otpIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.green.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  otpIconText: {
    fontSize: 32,
    color: COLORS.green.primary,
  },
  otpTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: COLORS.gray[800],
    marginBottom: 8,
  },
  otpSubtitle: {
    fontSize: 14,
    color: COLORS.gray[500],
    textAlign: 'center',
  },

  // Error
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
    fontSize: 14,
  },

  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  forgotText: {
    fontSize: 12,
    color: COLORS.green.primary,
    fontWeight: '500',
  },

  // Primary Button
  primaryBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnDisabledLight: {
    backgroundColor: COLORS.gray[300],
    shadowOpacity: 0,
    elevation: 0,
  },

  // Link Buttons
  linkBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkBtnText: {
    color: COLORS.green.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  linkBtnTextSecondary: {
    color: COLORS.gray[500],
    fontSize: 14,
  },

  // Toggle
  toggleBtn: {
    marginTop: 10,
    alignItems: 'center',
  },
  toggleText: {
    color: COLORS.gray[500],
    fontSize: 13,
  },
  toggleTextHighlight: {
    color: COLORS.green.primary,
    fontWeight: '600',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  footerText: {
    color: COLORS.gray[400],
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 16,
  },
  footerLink: {
    color: COLORS.green.primary,
    fontWeight: '500',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.85,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.gray[800],
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: COLORS.gray[600],
    fontWeight: '500',
  },
  modalScroll: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.gray[700],
    textAlign: 'right',
  },
  modalAcceptBtn: {
    marginHorizontal: 24,
    marginTop: 16,
    backgroundColor: COLORS.green.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalAcceptText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Login;
