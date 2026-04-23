# 🍎 Apple Sign In - Quick Start (5 דקות)

## ✅ מה כבר עשינו עבורך:

- 🎨 כפתור Apple מעוצב ומוכן
- 🔐 OAuth flow מלא
- 📱 Deep link handler
- 💾 Session management

---

## 🚀 מה אתה צריך לעשות:

### 1️⃣ Apple Developer (2 דקות)

**A. Service ID (כבר קיים):**
```
✅ Services ID: com.naturebot.auth (כבר הוגדר)
✅ Domain: xnynrlctilanhcexkfse.supabase.co
✅ Return URL: https://xnynrlctilanhcexkfse.supabase.co/auth/v1/callback
```

**B. Private Key (כבר הורדת):**
```
✅ Key ID: 72265CV3H7
✅ Team ID: 4T29TB84F4
✅ .p8 file: AuthKey_72265CV3H7.p8 (קיים)
```

---

### 2️⃣ Supabase (1 דקה)

```
https://supabase.com/dashboard/project/xnynrlctilanhcexkfse
→ Authentication → Providers → Apple

הדבק:
✓ Services ID: com.naturebot.auth
✓ Team ID: 4T29TB84F4
✓ Key ID: 72265CV3H7
✓ Secret Key: [פתח את AuthKey_72265CV3H7.p8 והדבק את כל התוכן]
```

⚠️ **חשוב:** הדבק את תוכן קובץ ה-.p8 עצמו (BEGIN/END PRIVATE KEY), 
**לא JWT** שיצרת בעצמך!

**Save** ✅

---

### 3️⃣ בדיקה (30 שניות)

```bash
npm start
```

**לחץ על כפתור Apple** 🍎 → אמור לעבוד!

---

## 🐛 לא עובד?

### שגיאה: "Invalid client"
```
→ Services ID לא תואם
→ בדוק ב-Supabase שזה: com.naturebot.auth
```

### שגיאה: "Invalid redirect"
```
→ ב-Apple Developer:
   Return URL חייב להיות:
   https://xnynrlctilanhcexkfse.supabase.co/auth/v1/callback
```

### אפליקציה לא חוזרת
```
→ app.json:
   "scheme": "biobalance" ← וודא שקיים
```

---

## 📝 Notes:

- **iOS Only** - Apple Sign In זמין רק ל-iOS users
- **Email Relay** - Apple עשוי להסתיר אימייל אמיתי
- **TestFlight** - צריך build חדש, לא רק OTA update

---

## ✨ זהו!

**הכל מוכן.** פשוט הגדר ב-Apple Developer ו-Supabase ותתחיל לעבוד.

---

**Full Guide:** ראה `APPLE_OAUTH_SETUP.md` להסבר מפורט

