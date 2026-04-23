# 🚀 Facebook OAuth - Quick Start (5 דקות)

## ✅ מה כבר מוכן
**הכל מוכן בקוד!** רק צריך הגדרות בלבד.

---

## ⚡ 3 צעדים פשוטים

### 1️⃣ Supabase Dashboard (2 דקות)

```
🔗 https://supabase.com/dashboard/project/xnynrlctilanhcexkfse
```

**נווט ל:**
`Authentication` → `Providers` → `Facebook`

**הזן:**
```
Facebook App ID: 886567670596106
Facebook App Secret: [מ-Facebook Developers]
```

**Redirect URL:**
```
biobalance://auth
```

**שמור** ✅

---

### 2️⃣ Facebook Developers (2 דקות)

```
🔗 https://developers.facebook.com/apps/886567670596106
```

**Settings → Basic:**
1. העתק את **App Secret** (לחץ "Show")
2. הזן אותו ב-Supabase (שלב 1)

**Facebook Login → Settings:**
הוסף ב-"Valid OAuth Redirect URIs":
```
https://xnynrlctilanhcexkfse.supabase.co/auth/v1/callback
biobalance://auth
```

**App Mode:**
לחץ "Switch to Live" 🟢

---

### 3️⃣ בדיקה (1 דקה)

```bash
npm start
```

1. פתח את האפליקציה
2. לחץ על כפתור Facebook (⭕ עם "f")
3. התחבר עם Facebook
4. 🎉 אמור לעבוד!

---

## 🐛 לא עובד?

### בדיקה מהירה:
```
☑️ App Secret הוזן ב-Supabase?
☑️ Redirect URIs תואמים?
☑️ App ב-Live Mode ב-Facebook?
```

### Logs:
```bash
npx react-native log-android
```

---

## 📖 מדריך מפורט
קרא את `FACEBOOK_OAUTH_SETUP.md` להוראות מלאות.

---

**זהו! עכשיו ה-Facebook OAuth אמור לעבוד** 🎯




