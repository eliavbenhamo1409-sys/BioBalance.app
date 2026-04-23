# 🍎 Apple OAuth Setup Guide for BioBalance

## מה הושלם?

✅ **קוד מוכן ופועל:**
- כפתור "Continue with Apple" בעמוד ההתחברות
- OAuth flow מלא עם Supabase
- Deep link handler ל-`biobalance://auth/callback`
- Exchange code for session אוטומטי
- Auth state management

---

## 🔧 הגדרות נדרשות (חובה!)

### שלב 1: Apple Developer Console

#### 1.1 צור App ID
1. פתח: https://developer.apple.com/account/resources/identifiers/list
2. לחץ על **"+"** ליצירת Identifier חדש
3. בחר **"App IDs"** → **"Continue"**
4. בחר **"App"** → **"Continue"**
5. מלא את הפרטים:
   ```
   Description: BioBalance App
   Bundle ID: com.naturebot.app (explicit)
   ```
6. ב-**Capabilities**, סמן:
   - ✅ **Sign In with Apple**
7. לחץ **"Continue"** → **"Register"**

#### 1.2 צור Service ID (OAuth Client)
1. חזור ל: https://developer.apple.com/account/resources/identifiers/list
2. לחץ **"+"** → בחר **"Services IDs"** → **"Continue"**
3. מלא:
   ```
   Description: BioBalance Sign In with Apple
   Identifier: com.naturebot.auth
   ```
4. ✅ סמן **"Sign In with Apple"**
5. לחץ **"Configure"** ליד Sign In with Apple:
   - **Primary App ID**: בחר את ה-App ID שיצרת (com.naturebot.app)
   - **Domains and Subdomains**: הוסף:
     ```
     xnynrlctilanhcexkfse.supabase.co
     ```
   - **Return URLs**: הוסף:
     ```
     https://xnynrlctilanhcexkfse.supabase.co/auth/v1/callback
     ```
6. **Save** → **Continue** → **Register**

#### 1.3 צור Private Key
1. עבור ל: https://developer.apple.com/account/resources/authkeys/list
2. לחץ **"+"** ליצירת Key
3. מלא:
   ```
   Key Name: BioBalance Sign In with Apple Key
   ```
4. ✅ סמן **"Sign In with Apple"**
5. לחץ **"Configure"** → בחר את ה-App ID העיקרי (com.naturebot.app)
6. **Save** → **Continue** → **Register**
7. 💾 **הורד את הקובץ** (AuthKey_XXXXXXXXX.p8) - לא תוכל להוריד שוב!
8. שמור את:
   - **Key ID** (למשל: ABC123XYZ)
   - **Team ID** (בפינה השמאלית העליונה)

---

### שלב 2: Supabase Dashboard

1. פתח: https://supabase.com/dashboard/project/xnynrlctilanhcexkfse
2. עבור ל: **Authentication** → **Providers**
3. מצא את **"Apple"** ולחץ עליו
4. הפעל את ה-toggle: **Enable Sign in with Apple**
5. מלא את הפרטים:

```
Services ID: com.naturebot.auth
Team ID: 4T29TB84F4
Key ID: 72265CV3H7
Secret Key: [תוכן קובץ ה-.p8 - העתק והדבק את כל התוכן]
```

⚠️ **חשוב מאוד:** בשדה "Secret Key" הדבק את תוכן קובץ ה-.p8 הגולמי 
(BEGIN PRIVATE KEY ... END PRIVATE KEY), **לא JWT** שיצרת בעצמך!

#### 📝 דוגמה לתוכן Secret Key:
```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
[עוד שורות...]
-----END PRIVATE KEY-----
```

6. **Authorize Callback URL** (אוטומטי):
   ```
   https://xnynrlctilanhcexkfse.supabase.co/auth/v1/callback
   ```

7. לחץ **"Save"** 💾

---

### שלב 3: בדיקה

#### 3.1 Development (Expo Go)
```bash
npm start
# סרוק QR ב-Expo Go
# לחץ על כפתור Apple 🍎
```

#### 3.2 TestFlight / Production
```bash
# Build אפליקציה
eas build --platform ios

# או רק OTA update
eas update --branch production --message "Added Apple Sign In"
```

---

## 🔍 בדיקת תקלות

### ❌ "Invalid client"
**פתרון:**
- וודא שה-Services ID ב-Supabase הוא: `com.naturebot.auth`
- בדוק שה-Return URL ב-Apple תואם: `https://xnynrlctilanhcexkfse.supabase.co/auth/v1/callback`

### ❌ "Invalid redirect URI"
**פתרון:**
- ב-Apple Developer Console → Services ID → Configure
- הוסף: `https://xnynrlctilanhcexkfse.supabase.co/auth/v1/callback`
- הוסף: `biobalance://auth/callback` (לאפליקציה native)

### ❌ "Key not found" או "Invalid token"
**פתרון:**
- וודא שה-Key ID הוא: `72265CV3H7`
- וודא שה-Team ID הוא: `4T29TB84F4`
- **חשוב:** הדבק את תוכן קובץ ה-.p8 עצמו (כולל BEGIN/END PRIVATE KEY)
- **לא** להדביק JWT שיצרת בעצמך - Supabase יוצר את ה-JWT בשבילך!

### ❌ אפליקציה לא חוזרת אחרי התחברות
**פתרון:**
```javascript
// app.json - וודא:
{
  "expo": {
    "scheme": "biobalance"
  }
}
```

---

## 📱 איך זה עובד?

### Flow מלא:

1. **משתמש לוחץ על כפתור Apple** 🍎
   ```javascript
   handleAppleLogin() → loginWithApple()
   ```

2. **OAuth מתחיל:**
   ```javascript
   supabase.auth.signInWithOAuth({
     provider: 'apple',
     options: {
       redirectTo: 'biobalance://auth/callback'
     }
   })
   ```

3. **נפתח דפדפן למסך Apple Sign In**
   - משתמש מאשר
   - Apple מחזיר code

4. **אפליקציה מתעוררת עם deep link:**
   ```
   biobalance://auth/callback?code=...
   ```

5. **Exchange code למען session:**
   ```javascript
   supabase.auth.exchangeCodeForSession(url)
   ```

6. **Session נשמר אוטומטית** → ניווט למסך ראשי ✅

---

## 🎯 מה המשתמש מקבל?

```javascript
// User object:
{
  id: "uuid",
  email: "user@privaterelay.appleid.com", // או אימייל אמיתי
  user_metadata: {
    full_name: "John Doe",
    provider: "apple",
    sub: "001234.abc123...", // Apple User ID
  }
}
```

**Note:** Apple עשוי להסתיר את האימייל האמיתי ולספק relay email.

---

## ✅ Checklist מהיר

- [ ] App ID מוגדר ב-Apple Developer
- [ ] Services ID מוגדר ב-Apple Developer
- [ ] Return URL תואם ב-Apple: `https://xnynrlctilanhcexkfse.supabase.co/auth/v1/callback`
- [ ] Domain מוגדר ב-Apple: `xnynrlctilanhcexkfse.supabase.co`
- [ ] Private Key (.p8) נוצר והורד
- [ ] Key ID, Team ID, Services ID הועתקו ל-Supabase
- [ ] תוכן קובץ .p8 הודבק ב-Supabase
- [ ] Apple Provider מופעל ב-Supabase
- [ ] `app.json` מכיל: `"scheme": "biobalance"`
- [ ] אפליקציה נבנתה עם ה-Bundle ID הנכון

---

## 🚀 הכל מוכן!

כפתור Apple פועל ומחכה לך בעמוד ההתחברות.

**זכור:** Sign in with Apple זמין רק ל-iOS users. ב-Android הכפתור יהיה מושבת (או מוסתר).

---

## 📞 צריך עזרה?

בעיות נפוצות:
1. וודא שה-Bundle ID באפליקציה תואם ל-Apple Developer
2. וודא שהקובץ .p8 הועתק במלואו
3. בדוק ב-Supabase Logs: Authentication → Logs
4. בדוק ב-Xcode Console את הלוגים

---

**Created:** December 2025  
**Project:** BioBalance  
**OAuth Provider:** Apple

