# ✅ Facebook OAuth - מדריך השלמת ההגדרה

## 🎉 הקוד כבר מוכן!

**כל הקוד כבר מוכן ועובד** בפרויקט שלך!
- ✅ כפתור Facebook ב-Login screen
- ✅ `loginWithFacebook()` מוכן
- ✅ OAuth flow מלא עם redirect handling
- ✅ Session management עם AsyncStorage

---

## 🔧 מה נותר לעשות - הגדרות בלבד

### 1️⃣ הגדרת Facebook Provider ב-Supabase Dashboard

1. **פתח Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/xnynrlctilanhcexkfse
   ```

2. **נווט ל-Authentication**
   ```
   Dashboard → Authentication → Providers
   ```

3. **מצא "Facebook" ולחץ עליו**

4. **הזן את הפרטים הבאים:**
   ```
   Facebook App ID: 886567670596106
   Facebook App Secret: [תצטרך לקבל מ-Facebook Developers Console]
   ```

5. **הגדר Redirect URL**
   ```
   Authorized Redirect URIs:
   biobalance://auth
   https://xnynrlctilanhcexkfse.supabase.co/auth/v1/callback
   ```

6. **שמור וודא ש-Facebook Provider מופעל (Enabled)**

---

### 2️⃣ הגדרת Facebook App

1. **פתח Facebook Developers Console**
   ```
   https://developers.facebook.com/apps/886567670596106
   ```

2. **הוסף "Facebook Login" כ-Product**
   - בתפריט צד → Add Product
   - בחר "Facebook Login"
   - לחץ "Set up"

3. **הגדר OAuth Redirect URIs**
   
   נווט ל:
   ```
   Facebook Login → Settings
   ```

   הוסף את ה-URLs הבאים ב-"Valid OAuth Redirect URIs":
   ```
   https://xnynrlctilanhcexkfse.supabase.co/auth/v1/callback
   biobalance://auth
   ```

4. **הגדרות נוספות מומלצות:**

   **Settings → Basic:**
   - ✅ App Domains: `supabase.co`
   - ✅ Privacy Policy URL: [הוסף URL למדיניות פרטיות]
   - ✅ Terms of Service URL: [הוסף URL לתנאי שימוש]

   **Facebook Login → Settings:**
   - ✅ Client OAuth Login: ON
   - ✅ Web OAuth Login: ON
   - ✅ Enforce HTTPS: ON

5. **העבר את ה-App ל-Live Mode**
   ```
   Settings → Basic → App Mode
   לחץ על "Switch to Live"
   ```

---

### 3️⃣ קבלת Facebook App Secret

1. **נווט ל:**
   ```
   Facebook Developers → Settings → Basic
   ```

2. **תחת "App Secret":**
   - לחץ "Show"
   - אמת את הזהות שלך (סיסמה/2FA)
   - העתק את ה-Secret

3. **הזן ב-Supabase Dashboard:**
   ```
   Authentication → Providers → Facebook → Facebook App Secret
   ```

---

## 📱 בדיקת ההגדרה

### שלב 1: בדוק ש-Supabase מוכן
```bash
# הרץ את האפליקציה
npm start

# פתח באמולטור או מכשיר
```

### שלב 2: לחץ על כפתור Facebook
1. פתח את Login screen
2. לחץ על הכפתור עם "f" (Facebook)
3. אמור להיפתח דפדפן עם דף ההתחברות של Facebook

### שלב 3: בדוק הצלחה
אם הכל עובד:
- ✅ הדפדפן ייפתח עם Facebook login
- ✅ אחרי התחברות, תחזור לאפליקציה
- ✅ תראה את המסך הראשי (Home)
- ✅ ה-profile שלך יכיל נתוני Facebook

---

## 🐛 פתרון בעיות נפוצות

### 1. "אפליקציה לא מאושרת" ב-Facebook
**בעיה:** Facebook מראה אזהרה שה-App לא מאושר
**פתרון:** 
- זה נורמלי ב-Development Mode
- העבר את ה-App ל-Live Mode (ראה שלב 2.5)
- או הוסף testers ב-Facebook: Roles → Test Users

### 2. הדפדפן לא סוגר אחרי login
**בעיה:** הדפדפן נשאר פתוח אחרי התחברות
**פתרון:** וודא ש:
- ה-scheme ב-app.json הוא `biobalance`
- ה-redirectTo ב-useAuth.js הוא `biobalance://auth`
- Facebook Redirect URIs מכילים `biobalance://auth`

### 3. "Invalid redirect URI"
**בעיה:** שגיאה מ-Facebook או Supabase
**פתרון:**
- וודא ש-Redirect URIs תואמים בדיוק בכל 3 המקומות:
  1. Supabase Provider settings
  2. Facebook App settings  
  3. useAuth.js code

### 4. "Session not found"
**בעיה:** לא מצליח להתחבר אחרי redirect
**פתרון:**
- בדוק שיש רשת (Internet)
- נסה מחדש - לפעמים token לוקח שניה להגיע
- בדוק שה-AsyncStorage לא מלא

---

## 🔍 איך לבדוק logs

### React Native Console
```bash
npx react-native log-android
# או
npx react-native log-ios
```

חפש:
```
Auth event: SIGNED_IN
OAuth result: { type: 'success' }
```

### Supabase Dashboard Logs
```
Dashboard → Logs → Auth logs
```

חפש:
- `Sign in via OAuth: facebook`
- `User signed in: [email]`

---

## 📝 קוד רלוונטי

### Login Button (כבר קיים!)
```javascript
// src/screens/Login.js - שורות 616-623
<TouchableOpacity
  style={[styles.socialCircle, !facebookAuthReady && styles.btnDisabled]}
  onPress={handleFacebookLogin}
  disabled={isLoading || !facebookAuthReady}
>
  <Text style={styles.facebookCircleLogo}>f</Text>
</TouchableOpacity>
```

### Handler (כבר קיים!)
```javascript
// src/screens/Login.js - שורות 443-445
const handleFacebookLogin = async () => {
  await loginWithFacebook();
};
```

### OAuth Logic (כבר קיים!)
```javascript
// src/hooks/useAuth.js - שורות 80-135
const loginWithOAuth = async (provider) => {
  // ... OAuth flow עם WebBrowser
};
```

---

## ✨ מה יקרה אחרי login מוצלח

1. **Supabase ייצור User**
   ```javascript
   {
     id: "uuid",
     email: "user@example.com",
     user_metadata: {
       full_name: "John Doe",
       avatar_url: "https://...",
       provider: "facebook"
     }
   }
   ```

2. **Session יישמר ב-AsyncStorage**
   - הפעלה הבאה: התחברות אוטומטית

3. **Profile ייטען מהדאטהבייס**
   ```javascript
   const { profile } = useAuth();
   // profile.name, profile.email, etc.
   ```

4. **Navigation ל-Home Screen**
   - משתמש מחובר → יעבור ל-Home אוטומטית

---

## 🎯 סיכום

| מה | סטטוס |
|----|-------|
| קוד באפליקציה | ✅ מוכן |
| Supabase Provider | ⚠️ צריך להגדיר |
| Facebook App | ⚠️ צריך להגדיר |
| Testing | ⏳ אחרי הגדרות |

**אחרי שתגדיר את Supabase + Facebook (10 דקות), הכל יעבוד!** 🚀

---

## 📞 עזרה נוספת

אם משהו לא עובד:
1. בדוק את ה-console logs
2. בדוק את Supabase Dashboard → Logs
3. וודא ש-redirect URIs תואמים בכל מקום
4. נסה logout ו-login מחדש

**זה צריך לעבוד ב-10 דקות!** מוכן? 💪




