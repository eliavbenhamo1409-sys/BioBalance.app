# 🔧 הוראות התקנת Supabase

## שלב 1: יצירת פרויקט Supabase

1. לך ל-[supabase.com](https://supabase.com) והתחבר (עם Google או GitHub)
2. לחץ **"New Project"**
3. בחר שם לפרויקט (למשל: `nature-bot`)
4. בחר סיסמה למסד הנתונים (שמור אותה!)
5. בחר Region קרוב (למשל: Frankfurt EU)
6. לחץ **"Create new project"** והמתן 2 דקות

---

## שלב 2: קבלת המפתחות

1. בפרויקט שנוצר, לך ל-**Settings** (גלגל השיניים למטה בצד)
2. לחץ על **API**
3. העתק את:
   - **Project URL** - נראה ככה: `https://abcdefgh.supabase.co`
   - **anon public key** - מתחיל ב-`eyJhbGciOi...`

---

## שלב 3: עדכון הקוד

פתח את הקובץ `src/api/supabaseClient.js` ועדכן:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'; // ← הכנס את ה-URL שלך
const SUPABASE_ANON_KEY = 'eyJ...'; // ← הכנס את ה-anon key שלך
```

---

## שלב 4: יצירת הטבלאות במסד הנתונים

1. ב-Supabase Dashboard, לחץ על **SQL Editor** (בתפריט הצד)
2. לחץ **"New Query"**
3. פתח את הקובץ `SUPABASE_SETUP.sql` מהפרויקט
4. העתק את כל התוכן והדבק ב-SQL Editor
5. לחץ **"Run"** (או Ctrl+Enter)
6. אמור לראות הודעת הצלחה ✅

---

## שלב 5: הפעלת Google Authentication

1. ב-Supabase, לך ל-**Authentication** → **Providers**
2. מצא את **Google** ולחץ עליו
3. הפעל את הטוגל
4. תצטרך ליצור OAuth credentials ב-Google Cloud:

### יצירת Google OAuth:
1. לך ל-[Google Cloud Console](https://console.cloud.google.com)
2. צור פרויקט חדש או בחר קיים
3. לך ל-**APIs & Services** → **Credentials**
4. לחץ **"Create Credentials"** → **"OAuth client ID"**
5. בחר **"Web application"**
6. הוסף ל-Authorized redirect URIs:
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```
7. העתק את ה-**Client ID** ו-**Client Secret**
8. חזור ל-Supabase והכנס אותם

---

## שלב 6: בדיקה

הרץ את האפליקציה:
```bash
npx expo start
```

נסה להירשם עם אימייל או Google ובדוק ש:
- המשתמש נוצר ב-Authentication → Users
- הנתונים נשמרים בטבלאות

---

## ⚠️ חשוב לדעת

- **Row Level Security (RLS)** מופעל - משתמשים רואים רק את הנתונים שלהם
- הקובץ `SUPABASE_SETUP.sql` כבר מכיל את כל הגדרות האבטחה
- תוכנית החינם של Supabase מספיקה לרוב האפליקציות

---

## 🆘 בעיות נפוצות

### "Invalid API key"
- וודא שהעתקת את ה-anon key הנכון (לא את ה-service_role!)

### "Permission denied"
- וודא שהרצת את קוד ה-SQL ליצירת הטבלאות

### Google Sign In לא עובד
- וודא שהגדרת את ה-redirect URI נכון ב-Google Cloud
- וודא שהפעלת את Google Provider ב-Supabase

---

## 📱 לאחר ההגדרה

האפליקציה תתמוך ב:
- ✅ התחברות עם Google
- ✅ התחברות עם אימייל/סיסמה
- ✅ שמירת נתונים מאובטחת בענן
- ✅ סנכרון בין מכשירים

