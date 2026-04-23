# NATURE BOT - React Native (Expo)

אפליקציית React Native מלאה להסבה של NATURE BOT מאתר אינטרנט לאפליקציה נייטיבית.

## 📋 דרישות מערכת

- Node.js (גרסה 16 ומעלה)
- npm או yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app על הטלפון (iOS/Android)

## 🚀 התקנה והרצה

### 1. התקנת תלויות

```bash
cd nature-bot-react-native
npm install
```

### 2. הרצת הפרויקט

```bash
npm start
```

או:

```bash
npx expo start
```

### 3. פתיחת האפליקציה

**על טלפון:**
1. התקן את אפליקציית Expo Go מהחנות (App Store / Google Play)
2. סרוק את ה-QR code שמופיע בטרמינל עם האפליקציה

**על אמולטור:**
- iOS: לחץ `i` בטרמינל (נדרש Mac)
- Android: לחץ `a` בטרמינל (נדרש Android Studio)

## 📱 מבנה הפרויקט

```
nature-bot-react-native/
├── App.js                 # נקודת הכניסה הראשית עם ניווט
├── src/
│   ├── api/
│   │   └── base44Client.js    # לקוח API של base44
│   ├── components/
│   │   ├── DailyBalance.js    # קומפוננטת המאזן היומי
│   │   ├── icons.js           # אייקונים פשוטים
│   │   ├── chat/
│   │   │   ├── ChatMessage.js
│   │   │   ├── QuickActions.js
│   │   │   └── TypingIndicator.js
│   │   └── food/
│   │       └── FoodRecognitionModal.js
│   ├── context/
│   │   └── AppContext.js       # ניהול state גלובלי
│   └── screens/
│       ├── Home.js            # מסך הבית הראשי
│       ├── Statistics.js      # מסך סטטיסטיקות
│       └── Onboarding.js       # מסך התחלתי
├── package.json
├── app.json
└── README.md
```

## 🎨 תכונות עיקריות

### ✅ המרה מלאה מ-Web ל-React Native

- **ללא WebView**: כל הקוד נייטיבי לחלוטין
- **קומפוננטות נייטיביות**: View, Text, TouchableOpacity במקום div, p, button
- **StyleSheet**: כל הסטיילינג הומר ל-StyleSheet.create()
- **צבעים שמורים**: ירוק #3BB273, כחול #4C8BF5

### 📐 מבנה המסך הראשי

1. **Header קבוע**: לוגו ו-actions
2. **DailyBalance סטיקי**: המאזן היומי בראש המסך (לא גולל)
3. **אזור צ'אט גולל**: ScrollView עם כל ההודעות
4. **Input קבוע בתחתית**: כפתורי מצלמה ומים + שדה טקסט

### 🔧 פונקציונליות

- ✅ צילום מזון וזיהוי אוטומטי
- ✅ צ'אט עם בוט AI
- ✅ מעקב אחרי קלוריות, חלבון, שומן ומים
- ✅ סטטיסטיקות שבועיות
- ✅ מסך אונבורדינג מלא
- ✅ ניהול state עם Context API

## 📦 חבילות עיקריות

- `expo`: פלטפורמת Expo
- `@react-navigation/native`: ניווט
- `expo-image-picker`: בחירת תמונות
- `expo-camera`: גישה למצלמה
- `@base44/sdk`: SDK של base44
- `@tanstack/react-query`: ניהול queries
- `react-native-reanimated`: אנימציות
- `moment`: עבודה עם תאריכים

## 🔐 הרשאות

האפליקציה דורשת הרשאות ל:
- **מצלמה**: לצילום מזון
- **גלריית תמונות**: לבחירת תמונות

ההרשאות מוגדרות ב-`app.json` ומתבקשות אוטומטית בעת השימוש.

## 🐛 פתרון בעיות

### שגיאת הרשאות מצלמה
אם המצלמה לא עובדת, ודא שהרשאות הוגדרו ב-`app.json` ושה-app מבקש הרשאות.

### שגיאת חיבור ל-API
ודא שה-appId ב-`src/api/base44Client.js` נכון ושהמשתמש מחובר.

### בעיות בניווט
אם הניווט לא עובד, ודא ש-`react-native-screens` ו-`react-native-safe-area-context` מותקנים.

## 📝 הערות חשובות

1. **Expo Go**: הפרויקט מוכן להרצה ב-Expo Go ללא צורך ב-build נפרד
2. **RTL**: כל המסכים תומכים בעברית עם RTL
3. **State Management**: משתמש ב-Context API לניהול state גלובלי
4. **אייקונים**: משתמש באימוג'ים פשוטים במקום ספריית אייקונים מורכבת

## 🚀 בנייה לאפליקציה עצמאית

לבניית אפליקציה עצמאית:

```bash
expo build:android
# או
expo build:ios
```

או עם EAS Build:

```bash
eas build --platform android
eas build --platform ios
```

## 📄 רישיון

פרויקט זה נוצר כהסבה מלאה של NATURE BOT מ-Web ל-React Native.


