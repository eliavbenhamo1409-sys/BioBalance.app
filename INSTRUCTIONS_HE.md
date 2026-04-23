# הוראות התקנה והרצה - NATURE BOT React Native

## 📦 שלב 1: התקנת תלויות

פתח טרמינל בתיקיית הפרויקט והרץ:

```bash
npm install
```

או עם yarn:

```bash
yarn install
```

## 🚀 שלב 2: הרצת הפרויקט

הרץ את הפקודה הבאה:

```bash
npm start
```

או:

```bash
npx expo start
```

## 📱 שלב 3: פתיחת האפליקציה

### אפשרות א': עם Expo Go על הטלפון (מומלץ לבדיקה מהירה)

1. התקן את **Expo Go** מהחנות:
   - [App Store (iOS)](https://apps.apple.com/app/expo-go/id982107779)
   - [Google Play (Android)](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. סרוק את ה-QR code שמופיע בטרמינל עם האפליקציה

3. האפליקציה תיטען אוטומטית

### אפשרות ב': עם אמולטור

**iOS (נדרש Mac):**
- לחץ `i` בטרמינל
- האמולטור יפתח אוטומטית

**Android:**
- לחץ `a` בטרמינל
- ודא ש-Android Studio מותקן ואמולטור מוכן

## ⚙️ הגדרות נוספות

### הרשאות מצלמה

האפליקציה תבקש הרשאות מצלמה אוטומטית בעת השימוש הראשוני. אם ההרשאות נדחו, ניתן לאשר אותן בהגדרות הטלפון.

### חיבור ל-API

ודא שה-`appId` ב-`src/api/base44Client.js` נכון ושהמשתמש מחובר למערכת base44.

## 🐛 פתרון בעיות נפוצות

### שגיאת "Cannot find module"
```bash
rm -rf node_modules
npm install
```

### שגיאת Metro bundler
```bash
npx expo start --clear
```

### בעיות בניווט
ודא שהחבילות הבאות מותקנות:
- `react-native-screens`
- `react-native-safe-area-context`
- `react-native-gesture-handler`

## 📝 מבנה המסכים

1. **Onboarding**: מסך התחלתי עם הגדרת פרופיל
2. **Home**: המסך הראשי עם:
   - מאזן יומי קבוע בראש
   - אזור צ'אט גולל
   - כפתורי פעולה בתחתית
3. **Statistics**: מסך סטטיסטיקות עם גרפים והיסטוריית ארוחות

## ✅ מה הושלם

- ✅ המרה מלאה מ-HTML/CSS ל-React Native
- ✅ ללא WebView - כל הקוד נייטיבי
- ✅ סטיילינג עם StyleSheet.create()
- ✅ ניווט מלא עם React Navigation
- ✅ ניהול state עם Context API
- ✅ אינטגרציה עם base44 SDK
- ✅ תמיכה בעברית ו-RTL
- ✅ צילום מזון וזיהוי אוטומטי
- ✅ צ'אט עם בוט AI
- ✅ מעקב תזונתי מלא

## 🎯 מוכן להרצה!

הפרויקט מוכן להרצה מיידית עם `npm start` ו-Expo Go.


