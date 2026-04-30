// ============================================================
// Sources screen
// ============================================================
// A dedicated, easy-to-find page that lists every authoritative
// source the app uses for nutritional and health information,
// the formulas behind the calculations, and a clear non-medical-
// advice disclaimer.
//
// Required by Apple App Store Guideline 1.4.1 — citations for
// medical information must be easy for the user to find.
// ============================================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const SOURCES = [
  {
    title: 'נתוני מזון וערכים תזונתיים',
    description:
      'ערכי הקלוריות, החלבונים, השומנים והפחמימות שמוצגים על מאכלים, ארוחות ומתכונים נשענים על מסד הנתונים הרשמי של USDA — FoodData Central — שהוא הסטנדרט הציבורי המובי\u0301ל לערכים תזונתיים.',
    links: [
      { label: 'USDA FoodData Central', url: 'https://fdc.nal.usda.gov/' },
      { label: 'משרד החקלאות האמריקאי (USDA)', url: 'https://www.usda.gov/' },
    ],
  },
  {
    title: 'מדד מסת גוף (BMI)',
    description:
      'מדד ה-BMI מחושב לפי הנוסחה הבינלאומית: משקל בק"ג חלקי גובה במטרים בריבוע. קטגוריות (תת-משקל / תקין / עודף משקל / השמנה) מבוססות על הסיווג של ארגון הבריאות העולמי (WHO) ו-CDC.',
    links: [
      {
        label: 'WHO — מדד BMI וסיווג השמנה',
        url: 'https://www.who.int/health-topics/obesity',
      },
      {
        label: 'CDC — Adult BMI Calculator',
        url: 'https://www.cdc.gov/healthyweight/assessing/bmi/',
      },
    ],
  },
  {
    title: 'חישוב BMR ו-TDEE (קלוריות בסיסיות וצריכה יומית)',
    description:
      'יעד הקלוריות היומי שלך מבוסס על נוסחת Mifflin–St Jeor לחישוב Basal Metabolic Rate, מוכפל במקדם רמת פעילות (Sedentary / Light / Moderate / Active / Intense) לקבלת ה-TDEE. נוסחה זו היא הסטנדרט המקובל היום בקרב דיאטנים קליניים.',
    links: [
      {
        label: 'Mifflin et al., 1990 (PubMed)',
        url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
      },
    ],
  },
  {
    title: 'המלצות חלבון, שומן ופחמימות',
    description:
      'התפלגות המאקרו-נוטריינטים מבוססת על Acceptable Macronutrient Distribution Ranges (AMDR) של ה-Dietary Reference Intakes שפורסמו על ידי The National Academies (לשעבר Institute of Medicine).',
    links: [
      {
        label: 'NIH — Dietary Reference Intakes (DRI)',
        url: 'https://ods.od.nih.gov/HealthInformation/Dietary_Reference_Intakes.aspx',
      },
    ],
  },
  {
    title: 'המלצת שתיית מים',
    description:
      'יעד צריכת המים היומי מבוסס על המלצות ה-NASEM/IOM למבוגרים בריאים, עם התאמה למשתמשים במטרת עליית מסה.',
    links: [
      {
        label: 'NASEM — DRI for Water and Electrolytes',
        url: 'https://nap.nationalacademies.org/catalog/10925',
      },
    ],
  },
  {
    title: 'תוכן AI ודוחות תזונה',
    description:
      'דוחות וניתוחי AI שמופיעים באפליקציה מנותחים על בסיס היעדים והנתונים שלך ומסתמכים על המקורות לעיל. הם נועדו לעזור לך לעקוב, לא להחליף ייעוץ רפואי או תזונתי מקצועי.',
    links: [],
  },
];

const Section = ({ item }) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{item.title}</Text>
      <Text style={styles.sectionBody}>{item.description}</Text>
      {item.links.length > 0 && (
        <View style={styles.linkList}>
          {item.links.map((link) => (
            <TouchableOpacity
              key={link.url}
              style={styles.linkRow}
              onPress={() => Linking.openURL(link.url).catch(() => {})}
              activeOpacity={0.7}
            >
              <Text style={styles.linkArrow}>↗</Text>
              <Text style={styles.linkText}>{link.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

export default function Sources() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>אודות ומקורות</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text style={styles.introTitle}>שקיפות מלאה</Text>
          <Text style={styles.introBody}>
            כל ערך תזונתי, יעד יומי ומדד בריאותי באפליקציה מבוסס על מקורות ציבוריים מוכרים. ריכזנו אותם כאן כדי שתוכל לבחון את המידע באופן עצמאי בכל רגע.
          </Text>
        </View>

        {SOURCES.map((item) => (
          <Section key={item.title} item={item} />
        ))}

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerTitle}>הצהרה רפואית</Text>
          <Text style={styles.disclaimerBody}>
            BioBalance הוא כלי אינפורמטיבי בלבד לעקיבה תזונתית ואורח חיים. המידע, היעדים, ההמלצות והדוחות באפליקציה אינם תחליף לייעוץ, אבחון או טיפול רפואי. אם יש לך מצב רפואי, את/ה בהיריון/הנקה, או שינוי תזונתי שעשוי להשפיע על הבריאות — יש להתייעץ עם רופא/ה או דיאטן/ית מוסמך/ת לפני יישום.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#16A34A',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  intro: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  introTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#166534',
    textAlign: 'right',
    marginBottom: 6,
  },
  introBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#15803D',
    textAlign: 'right',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
    textAlign: 'right',
  },
  linkList: {
    marginTop: 10,
    gap: 6,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  linkText: {
    fontSize: 13,
    color: '#16A34A',
    fontWeight: '600',
    textAlign: 'right',
  },
  linkArrow: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '700',
  },
  disclaimerBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    textAlign: 'right',
    marginBottom: 6,
  },
  disclaimerBody: {
    fontSize: 12.5,
    lineHeight: 19,
    color: '#78350F',
    textAlign: 'right',
  },
});
