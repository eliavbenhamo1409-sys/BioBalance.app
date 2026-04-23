import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
  Keyboard,
  Dimensions,
  Modal,
  Pressable,
  Image,
} from 'react-native';

// Preload menu hero image
const MENU_HERO_IMAGE = require('../../assets/hero2.jpg');
// Logo for top bar - BioBalance logo
const LOGO_IMAGE = require('../../assets/logo.png');
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { saveRecipe as saveRecipeToSupabase } from '../api/supabaseClient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  interpolate,
  Extrapolate,
  Easing
} from 'react-native-reanimated';
import { base44 } from '../api/base44Client';
import { chatWithBot, analyzeFoodFromImage, parseFoodFromText, estimate3DWeight } from '../api/openaiClient';
import { processUserMessage, INTENTS, getGreeting, getSmartFollowUp } from '../api/smartChatbot';
import { useApp } from '../context/AppContext';
import ChatMessage from '../components/chat/ChatMessage';
import TypingIndicator from '../components/chat/TypingIndicator';
import FoodCard from '../components/chat/FoodCard';
import RecipeCard from '../components/chat/RecipeCard';
import RecipeSaveBanner from '../components/chat/RecipeSaveBanner';
import InputBar from '../components/chat/InputBar';
import FoodRecognitionModal from '../components/food/FoodRecognitionModal';
import Multi3DCapture from '../components/food/Multi3DCapture';
import SideMenu from '../components/SideMenu';
import ConfettiCannon from '../components/ConfettiCannon';
import BalanceHeader from '../components/BalanceHeader';
import GoalCelebration from '../components/GoalCelebration';
import DailyGoalCelebration from '../components/DailyGoalCelebration';
import DailyMealPlanCard from '../components/chat/DailyMealPlanCard';
import moment from 'moment';
import 'moment/locale/he';

moment.locale('he');

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Animated Loading Dots Component
const LoadingDots = () => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    // Animate dots in sequence
    dot1.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 400 }),
        withTiming(0, { duration: 400 })
      ),
      -1
    );

    dot2.value = withDelay(
      150,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 400 }),
          withTiming(0, { duration: 400 })
        ),
        -1
      )
    );

    dot3.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 400 }),
          withTiming(0, { duration: 400 })
        ),
        -1
      )
    );
  }, []);

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1.value }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2.value }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3.value }],
  }));

  return (
    <View style={styles.dotsContainer}>
      <Animated.View style={[styles.dot, dot1Style]} />
      <Animated.View style={[styles.dot, dot2Style]} />
      <Animated.View style={[styles.dot, dot3Style]} />
    </View>
  );
};

const HEADER_EXPANDED = 400; // Show all nutrient bars
const HEADER_COLLAPSED = 90; // Spacious collapsed state

// Ultra-smooth spring config
const SPRING_CONFIG = {
  damping: 18,
  stiffness: 85,
  mass: 0.9,
  overshootClamping: false,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.001,
};

export default function Home() {
  const navigation = useNavigation();
  const scrollViewRef = useRef(null);
  const { profile, dailyStats, setDailyStats, messages, addMessage, clearMessages, today, isLoading, addWater: contextAddWater, hasCompletedOnboarding, user, addMeal } = useApp();

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [foodData, setFoodData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const hasGreetedRef = useRef(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [pendingFoods, setPendingFoods] = useState([]); // Foods waiting for quantity
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [celebratedGoals, setCelebratedGoals] = useState({});
  const [currentTime, setCurrentTime] = useState(moment());
  const [celebration, setCelebration] = useState({ visible: false, goalType: null });
  const [showDailyCelebration, setShowDailyCelebration] = useState(false);
  const [pendingRecipe, setPendingRecipe] = useState(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true); // Start collapsed
  const [showImageModal, setShowImageModal] = useState(false);
  const [dailyMealPlan, setDailyMealPlan] = useState(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [show3DModal, setShow3DModal] = useState(false);
  const [is3DAnalyzing, setIs3DAnalyzing] = useState(false);
  const [showConfirmButtons, setShowConfirmButtons] = useState(false); // כפתורי אישור לאחר זיהוי



  // ================================================
  // CHAT SESSION MANAGEMENT - Reset daily at 3:00 AM
  // ================================================
  
  // Use ref to always have latest clearMessages function
  const clearMessagesRef = useRef(clearMessages);
  clearMessagesRef.current = clearMessages;

  // Check if we need to reset chat (past 3 AM of a new day)
  useEffect(() => {
    const checkDailyReset = async () => {
      try {
        const CHAT_DATE_KEY = '@chat_session_date';
        const savedDate = await AsyncStorage.getItem(CHAT_DATE_KEY);
        
        // Calculate "today" with 3 AM reset logic
        const now = moment();
        const threeAM = moment().startOf('day').add(3, 'hours');
        const effectiveDate = now.isBefore(threeAM) 
          ? moment().subtract(1, 'day').format('YYYY-MM-DD')
          : moment().format('YYYY-MM-DD');
        
        console.log('[Home] Chat date check - saved:', savedDate, 'effective:', effectiveDate);
        
        if (savedDate !== effectiveDate) {
          // New day (past 3 AM) - reset chat
          console.log('[Home] New day detected - resetting chat');
          await clearMessagesRef.current();
          setPendingFoods([]);
          setPendingRecipe(null);
          setShowConfirmButtons(false);
          hasGreetedRef.current = false;
          setConversationHistory([]);
          await AsyncStorage.setItem(CHAT_DATE_KEY, effectiveDate);
        }
      } catch (error) {
        console.error('[Home] Error checking daily reset:', error);
      }
    };
    
    checkDailyReset();
  }, []);

  // Bubble animation for image picker
  useEffect(() => {
    if (showImageModal) {
      bubbleScale.value = withSpring(1, {
        damping: 15,
        stiffness: 150,
        mass: 0.8,
      });
      bubbleOpacity.value = withTiming(1, { duration: 200 });
    } else {
      bubbleScale.value = withTiming(0, { duration: 150 });
      bubbleOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [showImageModal]);

  // Reanimated shared values for buttery smooth animations
  const animatedHeight = useSharedValue(HEADER_COLLAPSED); // Start collapsed
  const contentProgress = useSharedValue(0); // 0 = collapsed, 1 = expanded - Start collapsed
  const bubbleScale = useSharedValue(0);
  const bubbleOpacity = useSharedValue(0);

  // Load celebrated goals from storage on mount
  useEffect(() => {
    const loadCelebratedGoals = async () => {
      try {
        const stored = await AsyncStorage.getItem('celebrated_goals');
        if (stored) {
          const parsed = JSON.parse(stored);
          // Only keep today's celebrations
          const todayKey = today;
          const todayGoals = {};
          Object.keys(parsed).forEach(key => {
            if (key.startsWith(todayKey)) {
              todayGoals[key] = parsed[key];
            }
          });
          setCelebratedGoals(todayGoals);
        }
      } catch (e) {
        console.log('Error loading celebrated goals:', e);
      }
    };
    loadCelebratedGoals();
  }, [today]);

  // Save celebrated goals to storage whenever they change
  useEffect(() => {
    const saveCelebratedGoals = async () => {
      try {
        if (Object.keys(celebratedGoals).length > 0) {
          await AsyncStorage.setItem('celebrated_goals', JSON.stringify(celebratedGoals));
        }
      } catch (e) {
        console.log('Error saving celebrated goals:', e);
      }
    };
    saveCelebratedGoals();
  }, [celebratedGoals]);

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(moment()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Preload menu hero image
  useEffect(() => {
    const imageUri = Image.resolveAssetSource(MENU_HERO_IMAGE).uri;
    if (imageUri) {
      Image.prefetch(imageUri).catch(() => { });
    }
  }, []);

  useEffect(() => {
    // Only scroll to end on new messages - NOT on every typing tick
    if (messages.length > 0) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]); // Track length instead of array reference to be safer

  // Keyboard listeners
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      collapseHeader();
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Initial greeting - shows when chat is empty
  useEffect(() => {
    if (profile && messages.length === 0 && !hasGreetedRef.current) {
      hasGreetedRef.current = true; // Set immediately to prevent double call
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב';
      const userName = profile?.name || '';
      addBotMessage(`${greeting} ${userName} 👋\n\nמה אכלת היום?`);
    }
  }, [profile, messages.length]);

  const targets = useMemo(() => ({
    calories: profile?.calories_target || 2000,
    protein: profile?.protein_target || 90,
    fat: profile?.fat_target || 65,
    water: profile?.water_target || 8,
  }), [profile]);

  const formattedDate = useMemo(() =>
    currentTime.format('dddd, D MMMM') + ' · ' + currentTime.format('HH:mm'),
    [currentTime]);

  const collapseHeader = useCallback(() => {
    if (isHeaderCollapsed) return;
    setIsHeaderCollapsed(true);
    // Slow elegant close
    animatedHeight.value = withTiming(HEADER_COLLAPSED, {
      duration: 800,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1)
    });
    contentProgress.value = withTiming(0, {
      duration: 700,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1)
    });
  }, [isHeaderCollapsed]);

  const expandHeader = useCallback(() => {
    if (!isHeaderCollapsed) return;
    setIsHeaderCollapsed(false);
    // Smooth open - balanced speed
    animatedHeight.value = withTiming(HEADER_EXPANDED, {
      duration: 1100,
      easing: Easing.bezier(0.25, 0.8, 0.25, 1),
    });
    contentProgress.value = withDelay(100, withTiming(1, {
      duration: 1000,
      easing: Easing.bezier(0.25, 0.8, 0.25, 1)
    }));
  }, [isHeaderCollapsed]);

  const expandHeaderForUpdate = useCallback(() => {
    if (!isHeaderCollapsed) return;
    setIsHeaderCollapsed(false);
    // Smooth open - balanced speed
    animatedHeight.value = withTiming(HEADER_EXPANDED, {
      duration: 1100,
      easing: Easing.bezier(0.25, 0.8, 0.25, 1),
    });
    contentProgress.value = withDelay(100, withTiming(1, {
      duration: 1000,
      easing: Easing.bezier(0.25, 0.8, 0.25, 1)
    }));
  }, [isHeaderCollapsed]);

  const toggleHeader = useCallback(() => {
    if (isHeaderCollapsed) {
      expandHeader();
    } else {
      collapseHeader();
    }
  }, [isHeaderCollapsed, expandHeader, collapseHeader]);

  const handleChatPress = useCallback(() => {
    if (!isHeaderCollapsed) {
      collapseHeader();
    }
  }, [isHeaderCollapsed, collapseHeader]);

  const handleScroll = useCallback((event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (offsetY > 60 && !isHeaderCollapsed) {
      collapseHeader();
    }
  }, [isHeaderCollapsed, collapseHeader]);

  const getContext = () => ({
    calories: dailyStats?.calories || 0,
    caloriesTarget: targets.calories,
    protein: dailyStats?.protein || 0,
    proteinTarget: targets.protein,
    fat: dailyStats?.fat || 0,
    fatTarget: targets.fat,
    water: dailyStats?.water_glasses || 0,
    waterTarget: targets.water,
    goal: profile?.goal || 'maintain', // מסה/חיטוב/תחזוקה
  });

  // Random picker helper
  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Get success message with nutritional insight - LOTS OF VARIETY
  const getSuccessMessage = (addedCalories, newTotalCalories) => {
    const remaining = targets.calories - newTotalCalories;
    const percentage = Math.round((newTotalCalories / targets.calories) * 100);

    // Check nutritional balance
    const currentProtein = dailyStats?.protein || 0;
    const currentFat = dailyStats?.fat || 0;
    const proteinPercent = (currentProtein / targets.protein) * 100;
    const fatPercent = (currentFat / targets.fat) * 100;

    // High calories but low fat - suggest healthy fats
    if (percentage >= 70 && fatPercent < 50) {
      const lowFatMessages = [
        `נרשם ✅ הקלוריות מתקדמות יפה, אבל השומן קצת נמוך.\nמה דעתך על קצת אגוזים או אבוקדו? 🥑`,
        `רשמתי! 📝 שים לב שהשומן הבריא היום נמוך.\nכדאי להוסיף שמן זית לסלט או חופן שקדים 🥜`,
        `עודכן ✅ טיפ קטן: השומן שלך נמוך יחסית.\nאפשר לאזן עם טחינה, אבוקדו או אגוזי מלך 🌰`,
      ];
      return pickRandom(lowFatMessages);
    }

    // High calories but low protein
    if (percentage >= 70 && proteinPercent < 50) {
      const lowProteinMessages = [
        `נרשם ✅ החלבון היום קצת נמוך.\nמומלץ להוסיף ביצה, יוגורט או חזה עוף 💪`,
        `רשמתי! 📝 שים לב - החלבון מפגר קצת.\nאולי לקנח עם יוגורט יווני או קוטג׳? 🥛`,
        `עודכן ✅ החלבון צריך חיזוק!\nגבינה, טונה או ביצים יעשו את העבודה 🥚`,
      ];
      return pickRandom(lowProteinMessages);
    }

    // Goal reached!
    if (remaining <= 0) {
      const goalReachedMessages = [
        `הגעת ליעד הקלורי! 🎯 אפשר לסיים או להמשיך לפי התחושה.`,
        `היעד הושג! 🏆 מעולה. תקשיב לגוף אם עדיין רעב.`,
        `השלמת את היעד! ✨ עבודה יפה. מכאן לפי ההרגשה.`,
        `יעד קלורי - וי! 🎉 סיימת. הגוף שלך מודה לך.`,
      ];
      return pickRandom(goalReachedMessages);
    }

    // Above 75%
    if (percentage >= 75) {
      const above75Messages = [
        `נרשם ✅ נותרו ${remaining} קלוריות להיום.`,
        `מעולה! 🌟 עוד ${remaining} קלוריות ומגיעים ליעד.`,
        `רשמתי! נשארו ${remaining} קלוריות - כמעט שם! 💪`,
        `עודכן ✅ ${remaining} קלוריות עד היעד. קו הסיום קרוב!`,
        `יופי! 📊 נותרו ${remaining} קלוריות. ממשיכים חזק!`,
      ];
      return pickRandom(above75Messages);
    }

    // Above 50%
    if (percentage >= 50) {
      const above50Messages = [
        `נרשם ✅ עברת את האמצע! נותרו ${remaining} קלוריות.`,
        `יפה! 🔥 עברנו את ה-50%. עוד ${remaining} קלוריות.`,
        `רשמתי! חצי מהיעד מאחורינו 💪 נשארו ${remaining}.`,
        `עודכן ✅ במחצית הדרך! ${remaining} קלוריות להשלמה.`,
        `מצוין! 📈 ${percentage}% מהיעד. עוד ${remaining} קלוריות.`,
      ];
      return pickRandom(above50Messages);
    }

    // Below 50%
    const below50Messages = [
      `נרשם ✅ נותרו ${remaining} קלוריות להשלמת היעד.`,
      `רשמתי! 📝 עוד ${remaining} קלוריות ביום.`,
      `עודכן ✅ ${remaining} קלוריות נשארו. יום טוב לבנות! 🏗️`,
      `יופי! התחלנו 🌅 נשארו ${remaining} קלוריות.`,
      `נרשם! ${remaining} קלוריות עד היעד. ממשיכים! 💫`,
      `✅ עודכן. יש לך עוד ${remaining} קלוריות להיום.`,
    ];
    return pickRandom(below50Messages);
  };

  // Get current time period
  const getTimePeriod = () => {
    const hour = new Date().getHours();
    if (hour < 10) return 'morning';
    if (hour < 14) return 'noon';
    if (hour < 17) return 'afternoon';
    if (hour < 20) return 'evening';
    return 'night';
  };

  // Get Hebrew date with gematria
  const getHebrewDate = () => {
    try {
      // Get Hebrew calendar formatted string
      const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      // Get the full formatted string (e.g., "12 בכסלו 5785")
      const fullDate = formatter.format(new Date());

      // Parse the string - format is "day month year"
      const match = fullDate.match(/(\d+)\s+(.+?)\s+(\d+)/);
      if (!match) return fullDate;

      const [, dayStr, month, yearStr] = match;
      const day = parseInt(dayStr);
      const year = parseInt(yearStr);

      // Convert day to Hebrew gematria
      const numberToHebrew = (num) => {
        const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
        const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];

        if (num === 15) return 'ט"ו';
        if (num === 16) return 'ט"ז';

        const t = Math.floor(num / 10);
        const o = num % 10;

        let result = tens[t] + ones[o];
        if (result.length === 2) {
          result = result[0] + '"' + result[1];
        } else if (result.length === 1) {
          result = result + "'";
        }
        return result;
      };

      // Convert year to Hebrew (e.g., 5785 -> תשפ"ה)
      const yearToHebrew = (yearNum) => {
        const y = yearNum % 1000; // Get last 3 digits (785 from 5785)
        const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
        const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
        const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];

        const h = Math.floor(y / 100);
        const t = Math.floor((y % 100) / 10);
        const o = y % 10;

        let result = hundreds[h];

        // Handle 15 and 16
        if (t === 1 && o === 5) {
          result += 'ט"ו';
        } else if (t === 1 && o === 6) {
          result += 'ט"ז';
        } else {
          result += tens[t] + ones[o];
          // Add gershayim before last letter
          if (result.length >= 2) {
            result = result.slice(0, -1) + '"' + result.slice(-1);
          }
        }

        return result;
      };

      const hebrewDay = numberToHebrew(day);
      const hebrewYear = yearToHebrew(year);

      return `${hebrewDay} ${month} ${hebrewYear}`;
    } catch (e) {
      console.log('Hebrew date error:', e);
      return '';
    }
  };

  // Get follow-up message with actionable time-based recommendations
  const getFollowUpMessage = (stats) => {
    const caloriesPct = Math.round((stats.calories / targets.calories) * 100);
    const proteinPct = Math.round((stats.protein / targets.protein) * 100);
    const fatPct = Math.round((stats.fat / targets.fat) * 100);
    const waterPct = Math.round(((stats.water_glasses || 0) / targets.water) * 100);
    const waterLeft = Math.max(0, targets.water - (stats.water_glasses || 0));

    const remaining = Math.max(0, targets.calories - stats.calories);
    const proteinLeft = Math.max(0, Math.round(targets.protein - stats.protein));
    const fatLeft = Math.max(0, Math.round(targets.fat - stats.fat));

    const period = getTimePeriod();

    // Build what's missing list
    let missing = [];
    if (proteinPct < 80 && proteinLeft > 10) missing.push(`${proteinLeft}g חלבון`);
    if (fatPct < 80 && fatLeft > 10) missing.push(`${fatLeft}g שומן`);
    if (waterLeft > 2) missing.push(`${waterLeft} כוסות מים`);

    const missingText = missing.length > 0 ? `חסר לך: ${missing.join(', ')}` : '';

    // Near goal - VERY CLOSE!
    if (caloriesPct >= 90) {
      const nearGoalMessages = [
        `🎯 אתה על ${caloriesPct}%! עוד רגע מסיימים יום מוצלח.\n${missingText ? missingText : 'תתחייב לסיים את היעד! 💪'}`,
        `🏁 ${caloriesPct}% מהיעד! קו הסיום בהישג יד.\n${waterLeft > 0 ? `תן ${Math.min(2, waterLeft)} כוסות מים עכשיו!` : 'יופי של יום! ✨'}`,
        `✨ עוד ${remaining} קלוריות וסגרת את היום!\n${missingText ? missingText : 'ממש מצוין, תמשיך ככה!'}`,
        `🔥 ${caloriesPct}% - כמעט שם! ${waterLeft > 0 ? `💧 עוד ${waterLeft} כוסות מים` : 'סגרת את זה! 🎉'}`,
      ];
      return pickRandom(nearGoalMessages);
    }

    // Time-based recommendations
    const timeBasedAdvice = {
      morning: [
        `☀️ יום טוב! עוד ${remaining} קלוריות.\nעד הצהריים תשתדל להגיע ל-50% מהיעד.`,
        `🌅 בוקר טוב! ${missingText}\nעד 14:00 - ארוחת בוקר עשירה בחלבון תעזור!`,
        `🌤️ התחלה טובה! ${remaining} קלוריות נשארו.\n${waterLeft > 4 ? `תן 2 כוסות מים עכשיו! 💧` : 'המשך ככה!'}`,
      ],
      noon: [
        `🍽️ נותרו ${remaining} קלוריות.\n${proteinLeft > 20 ? `ארוחת צהריים עם חלבון - חזה עוף או דג?` : 'ממשיכים חזק!'}`,
        `☀️ אמצע היום! ${caloriesPct}% מהיעד.\n${missingText ? missingText : 'בכיוון הנכון! 🎯'}`,
        `📊 עד השעה 17:00 תשתדל להגיע ל-70%.\n${waterLeft > 3 ? `💧 שתה ${Math.min(2, waterLeft)} כוסות מים עכשיו!` : 'ממשיכים!'}`,
      ],
      afternoon: [
        `🌤️ אחה״צ! נותרו ${remaining} קלוריות.\n${fatLeft > 15 ? `חופן אגוזים או אבוקדו יעזרו לשומן 🥑` : 'יופי של התקדמות!'}`,
        `⏰ עד 20:00 תשתדל לסגור את היעדים.\n${missingText ? missingText : 'אתה בכיוון הנכון!'}`,
        `💪 ${caloriesPct}% מהיעד! ${waterLeft > 2 ? `תתחייב לשתות עוד ${waterLeft} כוסות! 💧` : 'ממשיכים!'}`,
      ],
      evening: [
        `🌙 ערב טוב! נותרו ${remaining} קלוריות.\n${missingText ? missingText : 'מתקרבים לסיום! 🎯'}`,
        `🌆 עוד ${remaining} קלוריות להיום.\n${proteinLeft > 15 ? `יוגורט או קוטג׳ לפני השינה? 💪` : 'כל הכבוד!'}`,
        `✨ ${caloriesPct}% מהיעד! ${waterLeft > 0 ? `אל תשכח ${waterLeft} כוסות מים לפני השינה 💧` : 'יום מעולה!'}`,
      ],
      night: [
        `🌙 לילה טוב! ${caloriesPct}% מהיעד.\n${waterLeft > 0 ? `כוס מים אחרונה לפני השינה? 💧` : 'סיימת יום טוב!'}`,
        `🌟 סוף יום: ${remaining} קלוריות נשארו.\n${missingText ? `מחר נשלים: ${missingText}` : 'יום מצוין! 🎉'}`,
        `😴 ${caloriesPct}% מהיעד היומי.\n${missingText ? `לזכור למחר: ${missingText}` : 'לילה טוב!'}`,
      ],
    };

    // Below 50% - encouragement
    if (caloriesPct < 50) {
      const below50 = [
        `💡 ${caloriesPct}% מהיעד, עוד הרבה קדימה!\n${missingText ? missingText : `נותרו ${remaining} קלוריות.`}`,
        `🚀 רק ${caloriesPct}%? יש לך עוד ${remaining} קלוריות!\nתתחייב לתהליך - ארוחות קבועות יעזרו 🍽️`,
        `📈 התחלנו! ${remaining} קלוריות נשארו.\n${waterLeft > 5 ? `תתחיל עם 2 כוסות מים עכשיו! 💧` : 'קדימה!'}`,
      ];
      return pickRandom(below50);
    }

    return pickRandom(timeBasedAdvice[period]);
  };

  // Get emoji for food type
  const getFoodEmoji = (foodName) => {
    const name = foodName.toLowerCase();
    if (name.includes('פסטה') || name.includes('ספגטי')) return '🍝';
    if (name.includes('אורז')) return '🍚';
    if (name.includes('עוף') || name.includes('חזה')) return '🍗';
    if (name.includes('בשר') || name.includes('סטייק')) return '🥩';
    if (name.includes('דג') || name.includes('סלמון')) return '🐟';
    if (name.includes('סלט') || name.includes('ירק')) return '🥗';
    if (name.includes('ביצ')) return '🥚';
    if (name.includes('לחם')) return '🍞';
    return '🍽️';
  };

  // Process foods that are ready (have all nutritional data)
  const processReadyFood = async (foods) => {
    console.log('[Home] processReadyFood called with:', foods);
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;

    for (const food of foods) {
      totalCalories += food.calories || 0;
      totalProtein += food.protein || 0;
      totalFat += food.fat || 0;
    }

    // Step 1: Bot encouragement message
    const successMsg = getSuccessMessage(totalCalories, (dailyStats?.calories || 0) + totalCalories);
    await addBotMessage(successMsg);

    // Step 2: Update balance (stay collapsed - animations happen in mini rings)
    setTimeout(async () => {
      const newStats = await updateBalanceWithoutGoalCheck(totalCalories, totalProtein, totalFat);
      
      // Step 3: Save each food as a meal to the database (skip stats update - already done above)
      console.log('[Home] processReadyFood: Saving', foods.length, 'meals');
      for (const food of foods) {
        console.log('[Home] processReadyFood: Calling addMeal for:', food.name);
        await addMeal({
          name: food.name || 'ארוחה',
          calories: food.calories || 0,
          protein: food.protein || 0,
          fat: food.fat || 0,
        }, true); // skipStatsUpdate = true
      }
      console.log('[Home] processReadyFood: Done saving meals');

      // Wait a moment then check goals
      setTimeout(() => {
        // Check if goal reached
        const goalReached = checkGoalReached(newStats);

        if (!goalReached) {
          // No goal - send follow-up message
          setTimeout(async () => {
            const followUp = getFollowUpMessage(newStats);
            await addBotMessage(followUp);
          }, 900);
        }
        // If goal reached, handleCelebrationComplete will close header
      }, 2000);
    }, 600);
  };

  // ============================================
  // DAILY MEAL PLAN FEATURE
  // ============================================
  
  // Generate AI-powered meal plan with accurate nutritional data
  const generateAIMealPlan = async (remaining, goal, currentHour, userName) => {
    const goalText = goal === 'cut' ? 'ירידה במשקל/חיטוב' 
                   : goal === 'bulk' ? 'עלייה במסה/בניית שריר'
                   : goal === 'lean_bulk' ? 'עלייה מתונה במסה'
                   : 'שמירה על משקל';
    
    const prompt = `אתה תזונאי מקצועי. בנה תפריט מפורט לשארית היום.

📊 נתונים:
- שעה נוכחית: ${currentHour}:00
- קלוריות שנותרו: ${remaining.calories}
- חלבון שנותר: ${Math.round(remaining.protein)}g
- שומן שנותר: ${Math.round(remaining.fat)}g
- מטרה: ${goalText}

📋 הנחיות:
1. חלק את הקלוריות בין הארוחות הנותרות להיום
2. ${goal === 'bulk' ? 'תן ארוחות צפופות בקלוריות וחלבון' : goal === 'cut' ? 'תן ארוחות משביעות ודלות קלוריות' : 'תן ארוחות מאוזנות'}
3. הוסף נשנושים בין הארוחות (פירות, חטיפי חלבון, אגוזים)
4. תן ערכים תזונתיים מדויקים לכל מרכיב

החזר JSON בלבד בפורמט הבא:
{
  "meals": [
    {
      "time": "17:00",
      "type": "afternoon_snack",
      "name": "נשנוש חלבון",
      "items": [
        { "food": "חטיף חלבון", "amount": "1 יחידה (60g)", "calories": 200, "protein": 20, "fat": 6 },
        { "food": "תפוח", "amount": "1 בינוני (180g)", "calories": 95, "protein": 0, "fat": 0 }
      ],
      "totalCalories": 295,
      "totalProtein": 20,
      "totalFat": 6
    },
    {
      "time": "19:30",
      "type": "dinner",
      "name": "ארוחת ערב מאוזנת",
      "items": [
        { "food": "חזה עוף צלוי", "amount": "200g", "calories": 330, "protein": 62, "fat": 7 },
        { "food": "אורז לבן מבושל", "amount": "200g", "calories": 260, "protein": 5, "fat": 1 },
        { "food": "ברוקולי מאודה", "amount": "150g", "calories": 50, "protein": 4, "fat": 1 }
      ],
      "totalCalories": 640,
      "totalProtein": 71,
      "totalFat": 9
    }
  ]
}

חשוב: 
- השתמש בערכים תזונתיים מדויקים (USDA)
- סה"כ הקלוריות צריך להתקרב ל-${remaining.calories}
- type יכול להיות: breakfast, morning_snack, lunch, afternoon_snack, dinner, evening_snack`;

    try {
      const result = await processUserMessage(prompt, {
        conversationHistory: [],
        pendingAction: null,
        dailyStats: dailyStats || {},
        targets: targets || {},
        goal: goal,
        userName: userName,
      });
      
      // Try to extract JSON from response
      if (result.response) {
        const jsonMatch = result.response.match(/\{[\s\S]*"meals"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.meals && parsed.meals.length > 0) {
              return parsed;
            }
          } catch (e) {
            console.log('JSON parse failed, using fallback');
          }
        }
      }
      
      // Fallback to local builder if AI fails
      return buildMealPlanFallback(remaining, goal, currentHour);
    } catch (error) {
      console.error('AI meal plan error:', error);
      return buildMealPlanFallback(remaining, goal, currentHour);
    }
  };
  
  // Fallback meal plan builder - USES ALL REMAINING CALORIES
  const buildMealPlanFallback = (remaining, goal, currentHour) => {
    const meals = [];
    const totalCalories = remaining.calories;
    
    console.log(`[MealPlan] Building plan for ${totalCalories} remaining calories, hour: ${currentHour}, goal: ${goal}`);
    
    // Define ALL possible meal slots from current hour until end of day
    const allSlots = [
      { hour: 7, type: 'breakfast', isMain: true },
      { hour: 10, type: 'morning_snack', isMain: false },
      { hour: 13, type: 'lunch', isMain: true },
      { hour: 16, type: 'afternoon_snack', isMain: false },
      { hour: 19, type: 'dinner', isMain: true },
      { hour: 21, type: 'evening_snack', isMain: false },
    ];
    
    // Filter slots that are still available (hour >= currentHour)
    let availableSlots = allSlots.filter(s => s.hour >= currentHour);
    
    // If no slots available or it's very late, create 1-2 meals
    if (availableSlots.length === 0) {
      availableSlots = [
        { hour: Math.min(currentHour + 1, 23), type: 'dinner', isMain: true },
      ];
      if (totalCalories > 800) {
        availableSlots.push({ hour: Math.min(currentHour + 2, 23), type: 'evening_snack', isMain: false });
      }
    }
    
    // Count main meals and snacks
    const mainMeals = availableSlots.filter(s => s.isMain);
    const snacks = availableSlots.filter(s => !s.isMain);
    
    // Distribute calories: 75% to main meals, 25% to snacks
    const mainMealCalories = mainMeals.length > 0 ? Math.round((totalCalories * 0.75) / mainMeals.length) : 0;
    const snackCalories = snacks.length > 0 ? Math.round((totalCalories * 0.25) / snacks.length) : 0;
    
    // If no snacks, give all to main meals
    const adjustedMainCal = snacks.length === 0 ? Math.round(totalCalories / mainMeals.length) : mainMealCalories;
    
    console.log(`[MealPlan] ${mainMeals.length} main meals @ ${adjustedMainCal} cal, ${snacks.length} snacks @ ${snackCalories} cal`);
    
    // Food database with per100g values
    const foodDB = {
      proteins: [
        { food: 'חזה עוף צלוי', per100g: { calories: 165, protein: 31, fat: 3.6 } },
        { food: 'סלמון אפוי', per100g: { calories: 208, protein: 20, fat: 13 } },
        { food: 'סטייק בקר', per100g: { calories: 250, protein: 26, fat: 15 } },
        { food: 'טונה במים', per100g: { calories: 116, protein: 26, fat: 1 } },
        { food: 'ביצים', per100g: { calories: 155, protein: 13, fat: 11 } },
      ],
      carbs: [
        { food: 'אורז לבן מבושל', per100g: { calories: 130, protein: 2.7, fat: 0.3 } },
        { food: 'פסטה מבושלת', per100g: { calories: 131, protein: 5, fat: 1.1 } },
        { food: 'בטטה אפויה', per100g: { calories: 90, protein: 2, fat: 0.1 } },
        { food: 'תפוחי אדמה', per100g: { calories: 77, protein: 2, fat: 0.1 } },
        { food: 'קינואה מבושלת', per100g: { calories: 120, protein: 4.4, fat: 1.9 } },
      ],
      veggies: [
        { food: 'ברוקולי מאודה', per100g: { calories: 35, protein: 2.8, fat: 0.4 } },
        { food: 'סלט ירקות', per100g: { calories: 20, protein: 1, fat: 0.2 } },
        { food: 'שעועית ירוקה', per100g: { calories: 31, protein: 1.8, fat: 0.1 } },
      ],
      snackFoods: [
        { food: 'בננה', per100g: { calories: 89, protein: 1.1, fat: 0.3 } },
        { food: 'תפוח', per100g: { calories: 52, protein: 0.3, fat: 0.2 } },
        { food: 'יוגורט יווני', per100g: { calories: 97, protein: 9, fat: 5 } },
        { food: 'שקדים', per100g: { calories: 579, protein: 21, fat: 50 } },
        { food: 'חמאת בוטנים', per100g: { calories: 588, protein: 25, fat: 50 } },
        { food: 'גבינת קוטג\'', per100g: { calories: 98, protein: 11, fat: 4.3 } },
        { food: 'חטיף חלבון', per100g: { calories: 350, protein: 33, fat: 10 } },
        { food: 'גרנולה', per100g: { calories: 450, protein: 10, fat: 18 } },
      ],
    };
    
    // Build each meal
    for (const slot of availableSlots) {
      const targetCal = slot.isMain ? adjustedMainCal : snackCalories;
      
      if (targetCal < 50) continue;
      
      const items = [];
      let totalCal = 0, totalProt = 0, totalFat = 0;
      
      if (slot.isMain) {
        // MAIN MEAL: Scale portions to hit target calories
        // Typical ratio: 40% protein, 45% carbs, 15% veggies
        const proteinCals = targetCal * 0.40;
        const carbCals = targetCal * 0.45;
        const veggieCals = targetCal * 0.15;
        
        // Pick random foods
        const protein = foodDB.proteins[Math.floor(Math.random() * foodDB.proteins.length)];
        const carb = foodDB.carbs[Math.floor(Math.random() * foodDB.carbs.length)];
        const veggie = foodDB.veggies[Math.floor(Math.random() * foodDB.veggies.length)];
        
        // Calculate grams needed for each
        const proteinGrams = Math.round((proteinCals / protein.per100g.calories) * 100);
        const carbGrams = Math.round((carbCals / carb.per100g.calories) * 100);
        const veggieGrams = Math.round((veggieCals / veggie.per100g.calories) * 100);
        
        // Add protein
        const pCal = Math.round((protein.per100g.calories * proteinGrams) / 100);
        const pProt = Math.round((protein.per100g.protein * proteinGrams) / 100);
        const pFat = Math.round((protein.per100g.fat * proteinGrams) / 100);
        items.push({ food: protein.food, amount: `${proteinGrams}g`, calories: pCal, protein: pProt, fat: pFat });
        totalCal += pCal; totalProt += pProt; totalFat += pFat;
        
        // Add carbs
        const cCal = Math.round((carb.per100g.calories * carbGrams) / 100);
        const cProt = Math.round((carb.per100g.protein * carbGrams) / 100);
        const cFat = Math.round((carb.per100g.fat * carbGrams) / 100);
        items.push({ food: carb.food, amount: `${carbGrams}g`, calories: cCal, protein: cProt, fat: cFat });
        totalCal += cCal; totalProt += cProt; totalFat += cFat;
        
        // Add veggies
        const vCal = Math.round((veggie.per100g.calories * veggieGrams) / 100);
        const vProt = Math.round((veggie.per100g.protein * veggieGrams) / 100);
        const vFat = Math.round((veggie.per100g.fat * veggieGrams) / 100);
        items.push({ food: veggie.food, amount: `${veggieGrams}g`, calories: vCal, protein: vProt, fat: vFat });
        totalCal += vCal; totalProt += vProt; totalFat += vFat;
        
      } else {
        // SNACK: Build to hit target calories
        let remainingCal = targetCal;
        const usedFoods = new Set();
        
        // Add 2-3 snack items
        while (remainingCal > 50 && items.length < 3) {
          const availableFoods = foodDB.snackFoods.filter(f => !usedFoods.has(f.food));
          if (availableFoods.length === 0) break;
          
          const snack = availableFoods[Math.floor(Math.random() * availableFoods.length)];
          usedFoods.add(snack.food);
          
          // Calculate grams to use portion of remaining calories
          const calToUse = items.length === 0 ? remainingCal * 0.6 : remainingCal;
          const grams = Math.round((calToUse / snack.per100g.calories) * 100);
          const adjustedGrams = Math.min(grams, 150); // Cap at 150g per item
          
          const sCal = Math.round((snack.per100g.calories * adjustedGrams) / 100);
          const sProt = Math.round((snack.per100g.protein * adjustedGrams) / 100);
          const sFat = Math.round((snack.per100g.fat * adjustedGrams) / 100);
          
          items.push({ food: snack.food, amount: `${adjustedGrams}g`, calories: sCal, protein: sProt, fat: sFat });
          totalCal += sCal; totalProt += sProt; totalFat += sFat;
          remainingCal -= sCal;
        }
      }
      
      const mealName = slot.isMain 
        ? (slot.type === 'dinner' ? 'ארוחת ערב' : slot.type === 'lunch' ? 'ארוחת צהריים' : 'ארוחת בוקר')
        : 'נשנוש';
      
      meals.push({
        time: `${slot.hour}:00`,
        type: slot.type,
        name: mealName,
        items: items,
        totalCalories: totalCal,
        totalProtein: totalProt,
        totalFat: totalFat,
      });
      
      console.log(`[MealPlan] Added ${mealName} @ ${slot.hour}:00 with ${totalCal} cal`);
    }
    
    const grandTotal = meals.reduce((sum, m) => sum + m.totalCalories, 0);
    console.log(`[MealPlan] Total plan: ${grandTotal} cal (target: ${totalCalories})`);
    
    return { meals };
  };
  
  // Generate daily meal plan
  const handleGenerateDailyPlan = async () => {
    setIsGeneratingPlan(true);
    setIsTyping(true);
    
    try {
      // Calculate remaining
      const remaining = {
        calories: Math.max(0, targets.calories - (dailyStats?.calories || 0)),
        protein: Math.max(0, targets.protein - (dailyStats?.protein || 0)),
        fat: Math.max(0, targets.fat - (dailyStats?.fat || 0)),
      };
      
      const currentHour = new Date().getHours();
      const goal = profile?.goal || 'maintain';
      const userName = profile?.name || '';
      
      // Try AI-powered meal plan first, fallback to local builder
      let mealPlan;
      try {
        mealPlan = await generateAIMealPlan(remaining, goal, currentHour, userName);
      } catch (e) {
        console.log('AI meal plan failed, using fallback');
        mealPlan = buildMealPlanFallback(remaining, goal, currentHour);
      }
      
      setIsTyping(false);
      
      if (mealPlan && mealPlan.meals && mealPlan.meals.length > 0) {
        setDailyMealPlan(mealPlan);
        
        // Add intro message
        const introText = goal === 'bulk' 
          ? `💪 ${userName}, הנה התפריט שלך להיום! נשארו ${remaining.calories} קלוריות - בוא נדחוף!`
          : goal === 'cut'
          ? `🎯 ${userName}, הנה התפריט המותאם שלך! נשארו ${remaining.calories} קלוריות - נשמור על איזון.`
          : `📋 ${userName}, הנה התפריט שלך להיום!`;
        
        const uniqueId = `plan_${Date.now()}`;
        addMessage({ 
          text: introText, 
          isBot: true, 
          id: uniqueId, 
          type: 'meal_plan', 
          data: mealPlan 
        });
      } else {
        await addBotMessage('😅 לא נשארו הרבה קלוריות להיום. אולי כוס מים?');
      }
      
    } catch (error) {
      console.error('Error generating meal plan:', error);
      setIsTyping(false);
      await addBotMessage('הייתה בעיה בבניית התפריט 😅 נסה שוב.');
    } finally {
      setIsGeneratingPlan(false);
    }
  };
  
  // Handle request to change a meal in the plan - returns detailed alternatives
  const handleRequestMealChange = async (meal, mealIndex) => {
    const goal = profile?.goal || 'maintain';
    const targetCal = meal.totalCalories || meal.calories || 400;
    
    // Detailed alternatives with items breakdown
    const alternativesDB = {
      cut: {
        main: [
          {
            name: 'סלט עם חזה עוף',
            items: [
              { food: 'חזה עוף צלוי', amount: '150g', calories: 248, protein: 47, fat: 5 },
              { food: 'סלט ירקות', amount: '200g', calories: 40, protein: 2, fat: 0 },
              { food: 'שמן זית', amount: '1 כף', calories: 120, protein: 0, fat: 14 },
            ],
            totalCalories: 408, totalProtein: 49, totalFat: 19,
          },
          {
            name: 'טונה עם קינואה',
            items: [
              { food: 'טונה במים', amount: '140g', calories: 140, protein: 32, fat: 1 },
              { food: 'קינואה מבושלת', amount: '150g', calories: 180, protein: 6, fat: 3 },
              { food: 'ירקות טריים', amount: '100g', calories: 25, protein: 1, fat: 0 },
            ],
            totalCalories: 345, totalProtein: 39, totalFat: 4,
          },
          {
            name: 'חביתת ירקות',
            items: [
              { food: 'ביצים', amount: '3 יחידות', calories: 234, protein: 18, fat: 15 },
              { food: 'ירקות מוקפצים', amount: '150g', calories: 45, protein: 2, fat: 1 },
              { food: 'לחם מלא', amount: '1 פרוסה', calories: 81, protein: 4, fat: 1 },
            ],
            totalCalories: 360, totalProtein: 24, totalFat: 17,
          },
        ],
        snack: [
          {
            name: 'יוגורט עם פירות',
            items: [
              { food: 'יוגורט יווני 0%', amount: '170g', calories: 100, protein: 17, fat: 1 },
              { food: 'פירות יער', amount: '100g', calories: 57, protein: 1, fat: 0 },
            ],
            totalCalories: 157, totalProtein: 18, totalFat: 1,
          },
          {
            name: 'ירקות עם חומוס',
            items: [
              { food: 'גזר', amount: '100g', calories: 41, protein: 1, fat: 0 },
              { food: 'מלפפון', amount: '100g', calories: 16, protein: 1, fat: 0 },
              { food: 'חומוס', amount: '50g', calories: 83, protein: 4, fat: 5 },
            ],
            totalCalories: 140, totalProtein: 6, totalFat: 5,
          },
        ],
      },
      bulk: {
        main: [
          {
            name: 'פסטה עם בשר',
            items: [
              { food: 'פסטה מבושלת', amount: '250g', calories: 328, protein: 13, fat: 3 },
              { food: 'בשר טחון 15%', amount: '200g', calories: 430, protein: 42, fat: 28 },
              { food: 'רוטב עגבניות', amount: '100g', calories: 50, protein: 2, fat: 1 },
            ],
            totalCalories: 808, totalProtein: 57, totalFat: 32,
          },
          {
            name: 'אורז עם עוף ואבוקדו',
            items: [
              { food: 'אורז לבן', amount: '250g', calories: 325, protein: 7, fat: 1 },
              { food: 'חזה עוף', amount: '200g', calories: 330, protein: 62, fat: 7 },
              { food: 'אבוקדו', amount: '100g', calories: 160, protein: 2, fat: 15 },
            ],
            totalCalories: 815, totalProtein: 71, totalFat: 23,
          },
          {
            name: 'סטייק עם בטטה',
            items: [
              { food: 'סטייק אנטריקוט', amount: '250g', calories: 550, protein: 55, fat: 36 },
              { food: 'בטטה אפויה', amount: '200g', calories: 180, protein: 4, fat: 0 },
              { food: 'ברוקולי', amount: '100g', calories: 35, protein: 3, fat: 0 },
            ],
            totalCalories: 765, totalProtein: 62, totalFat: 36,
          },
        ],
        snack: [
          {
            name: 'שייק חלבון דחוס',
            items: [
              { food: 'חלב מלא', amount: '300ml', calories: 183, protein: 10, fat: 10 },
              { food: 'בננה', amount: '1 גדולה', calories: 121, protein: 1, fat: 0 },
              { food: 'חמאת בוטנים', amount: '2 כפות', calories: 188, protein: 8, fat: 16 },
              { food: 'אבקת חלבון', amount: '1 סקופ', calories: 120, protein: 24, fat: 2 },
            ],
            totalCalories: 612, totalProtein: 43, totalFat: 28,
          },
          {
            name: 'טוסט עם אבוקדו וביצים',
            items: [
              { food: 'לחם מלא', amount: '2 פרוסות', calories: 162, protein: 8, fat: 2 },
              { food: 'אבוקדו', amount: '100g', calories: 160, protein: 2, fat: 15 },
              { food: 'ביצים', amount: '2 יחידות', calories: 156, protein: 12, fat: 10 },
            ],
            totalCalories: 478, totalProtein: 22, totalFat: 27,
          },
        ],
      },
      maintain: {
        main: [
          {
            name: 'עוף עם אורז וירקות',
            items: [
              { food: 'חזה עוף', amount: '150g', calories: 248, protein: 47, fat: 5 },
              { food: 'אורז', amount: '150g', calories: 195, protein: 4, fat: 0 },
              { food: 'ירקות מאודים', amount: '150g', calories: 50, protein: 3, fat: 0 },
            ],
            totalCalories: 493, totalProtein: 54, totalFat: 5,
          },
          {
            name: 'שקשוקה',
            items: [
              { food: 'ביצים', amount: '3 יחידות', calories: 234, protein: 18, fat: 15 },
              { food: 'רוטב עגבניות', amount: '200g', calories: 80, protein: 3, fat: 2 },
              { food: 'לחם', amount: '2 פרוסות', calories: 162, protein: 6, fat: 2 },
            ],
            totalCalories: 476, totalProtein: 27, totalFat: 19,
          },
        ],
        snack: [
          {
            name: 'יוגורט עם גרנולה',
            items: [
              { food: 'יוגורט', amount: '150g', calories: 89, protein: 15, fat: 1 },
              { food: 'גרנולה', amount: '40g', calories: 180, protein: 4, fat: 7 },
              { food: 'דבש', amount: '1 כף', calories: 64, protein: 0, fat: 0 },
            ],
            totalCalories: 333, totalProtein: 19, totalFat: 8,
          },
        ],
      },
    };
    
    const templates = alternativesDB[goal] || alternativesDB.maintain;
    const isSnack = meal.type?.includes('snack');
    const options = isSnack ? templates.snack : templates.main;
    
    return options || templates.main;
  };
  
  // Handle selecting an alternative meal
  const handleSelectAlternative = (alternative, mealIndex) => {
    if (!dailyMealPlan || !dailyMealPlan.meals) return;
    
    const updatedMeals = [...dailyMealPlan.meals];
    const originalMeal = updatedMeals[mealIndex];
    
    updatedMeals[mealIndex] = {
      ...originalMeal,
      name: alternative.name,
      items: alternative.items,
      totalCalories: alternative.totalCalories,
      totalProtein: alternative.totalProtein,
      totalFat: alternative.totalFat,
    };
    
    const updatedPlan = { ...dailyMealPlan, meals: updatedMeals };
    setDailyMealPlan(updatedPlan);
  };

  const addBotMessage = async (text, type = 'text', data = null) => {
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, 400));
    setIsTyping(false);
    const uniqueId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    addMessage({ text, isBot: true, id: uniqueId, type, data });
    if (type === 'text') {
      setConversationHistory(prev => [...prev, { role: 'assistant', content: text }]);
    }
  };

  const addUserMessage = (text) => {
    const uniqueId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    addMessage({ text, isBot: false, id: uniqueId, type: 'text' });
    setConversationHistory(prev => [...prev, { role: 'user', content: text }]);
  };

  const checkGoalReached = (newStats) => {
    const todayKey = today;

    // Calculate all percentages first
    const caloriesPct = (newStats.calories / targets.calories) * 100;
    const proteinPct = (newStats.protein / targets.protein) * 100;
    const fatPct = (newStats.fat / targets.fat) * 100;
    const waterPct = ((newStats.water_glasses || 0) / targets.water) * 100;

    // Check if ALL goals are reached - THIS TAKES PRIORITY!
    const allGoalsReached =
      caloriesPct >= 90 && caloriesPct <= 115 &&
      proteinPct >= 100 &&
      fatPct >= 100 &&
      waterPct >= 100;

    // PRIORITY 1: Daily complete celebration (most important!)
    if (allGoalsReached && !celebratedGoals[`${todayKey}_daily_complete`]) {
      // Mark ALL goals as celebrated to prevent individual celebrations from triggering
      setCelebratedGoals(prev => ({
        ...prev,
        [`${todayKey}_daily_complete`]: true,
        [`${todayKey}_protein`]: true,
        [`${todayKey}_fat`]: true,
        [`${todayKey}_water`]: true,
        [`${todayKey}_calories`]: true,
      }));
      setShowDailyCelebration(true);
      return true; // Special daily celebration - SKIP individual ones
    }

    // If daily complete was already celebrated OR not all goals reached, check individual goals

    // Check protein goal
    if (newStats.protein >= targets.protein && !celebratedGoals[`${todayKey}_protein`]) {
      setCelebratedGoals(prev => ({ ...prev, [`${todayKey}_protein`]: true }));
      triggerGoalCelebration('protein');
      return true;
    }

    // Check fat goal
    if (newStats.fat >= targets.fat && !celebratedGoals[`${todayKey}_fat`]) {
      setCelebratedGoals(prev => ({ ...prev, [`${todayKey}_fat`]: true }));
      triggerGoalCelebration('fat');
      return true;
    }

    // Check water goal
    if (newStats.water_glasses >= targets.water && !celebratedGoals[`${todayKey}_water`]) {
      setCelebratedGoals(prev => ({ ...prev, [`${todayKey}_water`]: true }));
      triggerGoalCelebration('water');
      return true;
    }

    // Check calories goal (90-110% range)
    if (caloriesPct >= 90 && caloriesPct <= 110 && !celebratedGoals[`${todayKey}_calories`]) {
      setCelebratedGoals(prev => ({ ...prev, [`${todayKey}_calories`]: true }));
      triggerGoalCelebration('calories');
      return true;
    }

    return false; // No goal reached
  };

  const triggerGoalCelebration = (goalType) => {
    // Show celebration immediately - header stays open
    setCelebration({ visible: true, goalType });
  };

  const handleCelebrationComplete = async () => {
    const goalType = celebration.goalType;
    setCelebration({ visible: false, goalType: null });

    // Now close the header after celebration
    collapseHeader();

    // Show congratulations message in chat after header closes
    setTimeout(async () => {
      const messages = {
        calories: '🎯 מדהים! הגעת ליעד הקלורי היומי! המשך כך!',
        protein: '💪 אלוף! השלמת את יעד החלבון! השרירים שלך מודים לך!',
        fat: '🥑 יופי! הגעת ליעד השומן הבריא! גוף בריא = נפש בריאה!',
        water: '💧 נהדר! שתית מספיק מים היום! הגוף שלך אוהב אותך!',
      };

      await addBotMessage(messages[goalType] || '🎉 השלמת יעד! כל הכבוד!');
    }, 600);
  };

  const handleDailyCelebrationComplete = async () => {
    setShowDailyCelebration(false);
    collapseHeader();

    // Special message for completing all daily goals
    setTimeout(async () => {
      await addBotMessage(`🏆 וואו! השלמת את כל היעדים להיום!\n\n✅ קלוריות\n✅ חלבון\n✅ שומן\n✅ מים\n\nיום מושלם! המשך כך מחר 💪`);
    }, 600);
  };

  const updateBalanceWithoutGoalCheck = async (calories, protein, fat, waterGlasses = null) => {
    console.log('[Home] updateBalanceWithoutGoalCheck:', { calories, protein, fat, waterGlasses });
    // Round values to avoid floating point precision issues
    const newStats = {
      calories: Math.round((dailyStats?.calories || 0) + calories),
      protein: Math.round(((dailyStats?.protein || 0) + protein) * 10) / 10,
      fat: Math.round(((dailyStats?.fat || 0) + fat) * 10) / 10,
      water_glasses: waterGlasses !== null ? waterGlasses : (dailyStats?.water_glasses || 0),
    };

    console.log('[Home] New stats to save:', newStats);
    // setDailyStats now automatically syncs to Supabase via AppContext
    await setDailyStats(newStats);

    return newStats;
  };

  const updateBalance = async (calories, protein, fat, waterGlasses = null) => {
    const newStats = await updateBalanceWithoutGoalCheck(calories, protein, fat, waterGlasses);
    checkGoalReached(newStats);
    return newStats;
  };

  // Ref to prevent double processing
  const isProcessingRef = useRef(false);

  // ============================================================
  // NEW SMART CHATBOT - Context-Aware Message Handler
  // ============================================================
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    // Prevent double processing
    if (isProcessingRef.current) {
      console.log('⚠️ Already processing, skipping...');
      return;
    }
    isProcessingRef.current = true;

    const userText = inputText.trim();
    setInputText('');
    addUserMessage(userText);

    // Check if user wants to save the last recipe (special case - keep as is)
    const wantsSaveRecipe = userText.includes('שמור') && (userText.includes('מתכון') || pendingRecipe);
    if (wantsSaveRecipe && pendingRecipe) {
      await saveRecipe();
      isProcessingRef.current = false;
      return;
    }

    setIsTyping(true);

    try {
      // Build context for smart chatbot
      const context = {
        conversationHistory: messages.slice(-10).map(m => ({ 
          isBot: m.isBot, 
          text: m.text || '' 
        })),
        pendingAction: pendingFoods.length > 0 ? {
          type: 'waiting_quantity',
          foods: pendingFoods,
        } : null,
        dailyStats: dailyStats || {},
        targets: targets || {},
        userName: profile?.first_name || '',
        goal: profile?.goal || 'maintain', // User goal: cut, maintain, bulk, lean_bulk
      };

      // Call smart chatbot
      const result = await processUserMessage(userText, context);
      setIsTyping(false);

      console.log('🤖 Smart Bot Result:', result.intent, result.action?.type);

      // Handle the response based on intent and action
      await handleSmartBotAction(result);

    } catch (error) {
      console.error('Smart chatbot error:', error);
      setIsTyping(false);
      await addBotMessage('אופס, משהו השתבש 😅 נסה שוב?');
      isProcessingRef.current = false;
    }
  };

  // Handle actions from smart chatbot
  const handleSmartBotAction = async (result) => {
    const { intent, response, action } = result;

    // Always show the bot's response first
    if (response) {
      await addBotMessage(response);
    }

    // Handle specific actions
    if (action) {
      switch (action.type) {
        case 'add_food':
          // Process foods with nutritional data
          if (action.data?.foods?.length > 0) {
            setTimeout(async () => {
              await processReadyFood(action.data.foods);
            }, 500);
          }
          break;

        case 'add_water':
          // Add water glasses
          const glasses = action.data?.glasses || 1;
          for (let i = 0; i < glasses; i++) {
            await contextAddWater();
          }
          // Show follow-up
          setTimeout(async () => {
            const newWater = (dailyStats?.water_glasses || 0) + glasses;
            const remaining = (targets.water || 8) - newWater;
            if (remaining > 0) {
              await addBotMessage(`💧 נותרו ${remaining} כוסות מים להיום.`);
            }
          }, 800);
          break;

        case 'ask_quantity':
          // Set pending foods and wait for quantity
          if (action.data?.foods?.length > 0) {
            setPendingFoods(action.data.foods);
          }
          break;

        case 'show_alternatives':
          // Alternatives are shown in the response text
          // No additional action needed
          break;

        case 'show_recipe':
          // Handle recipe display
          if (action.data?.recipe) {
            setPendingRecipe({
              title: action.data.recipe.title || 'מתכון',
              content: response,
            });
            setTimeout(() => {
              addMessage({
                id: `recipe_banner_${Date.now()}`,
                isBot: true,
                type: 'recipe_save_banner',
                data: { recipeName: action.data.recipe.title },
              });
            }, 600);
          }
          break;

        default:
          // No specific action needed
          break;
      }
    }

    // Handle intent-specific logic
    switch (intent) {
      case INTENTS.CANCEL:
        // Clear any pending state
        setPendingFoods([]);
        setShowConfirmButtons(false);
        break;

      case INTENTS.CONFIRM:
        // If we have pending foods, process them
        console.log('[Home] CONFIRM intent, pendingFoods:', pendingFoods.length);
        if (pendingFoods.length > 0) {
          const currentPendingFoods = [...pendingFoods];
          setPendingFoods([]);
          
          // Check if foods have direct calories or need calculation from per_100g
          console.log('[Home] Processing foods for confirmation:', currentPendingFoods);
          const processedFoods = currentPendingFoods.map(food => {
            if (food.calories !== undefined) {
              // Already has calculated calories (from 3D or other source)
              return food;
            } else if (food.calories_per_100g !== undefined) {
              // Need to calculate from per_100g values (from image recognition)
              const grams = food.estimated_portion_grams || 100;
              const multiplier = grams / 100;
              return {
                name: food.name,
                grams,
                calories: Math.round(food.calories_per_100g * multiplier),
                protein: Math.round((food.protein_per_100g || 0) * multiplier * 10) / 10,
                fat: Math.round((food.fat_per_100g || 0) * multiplier * 10) / 10,
              };
            }
            return food;
          });
          
          await processReadyFood(processedFoods);
        }
        break;

      case INTENTS.PROVIDE_QUANTITY:
        // Extract number and process pending foods
        if (pendingFoods.length > 0) {
          const gramsMatch = result.response?.match(/(\d+)/g) || [];
          if (gramsMatch.length > 0) {
            const processedFoods = [];
            const currentPendingFoods = [...pendingFoods];
            setPendingFoods([]);

            for (let i = 0; i < currentPendingFoods.length; i++) {
              const food = currentPendingFoods[i];
              const grams = parseInt(gramsMatch[i] || gramsMatch[0]);
              const multiplier = grams / 100;

              processedFoods.push({
                name: food.name,
                grams,
                calories: Math.round((food.calories_per_100g || 100) * multiplier),
                protein: Math.round((food.protein_per_100g || 5) * multiplier * 10) / 10,
                fat: Math.round((food.fat_per_100g || 3) * multiplier * 10) / 10,
              });
            }

            await processReadyFood(processedFoods);
          }
        }
        break;

      default:
        // General chat - just show the response (already done above)
        break;
    }

    isProcessingRef.current = false;
  };

  const saveRecipe = async () => {
    if (!pendingRecipe) return;

    try {
      if (user) {
        // Save to Supabase if logged in
        await saveRecipeToSupabase(user.id, {
          title: pendingRecipe.title,
          content: pendingRecipe.content,
        });
      } else {
        // Fallback to AsyncStorage for guest users
        const savedRecipes = await AsyncStorage.getItem('saved_recipes');
        const recipes = savedRecipes ? JSON.parse(savedRecipes) : [];
        recipes.push({
          id: Date.now().toString(),
          ...pendingRecipe,
          savedAt: new Date().toISOString(),
        });
        await AsyncStorage.setItem('saved_recipes', JSON.stringify(recipes));
      }
      await addBotMessage('המתכון נשמר. תמצא אותו בתפריט.');
    } catch (error) {
      console.log('Error saving recipe:', error);
    }
    setPendingRecipe(null);
  };

  const dismissRecipeSave = () => {
    setPendingRecipe(null);
  };

  const pickImage = async (source) => {
    console.log('📷 pickImage called with source:', source);
    console.log('📷 ImagePicker object:', ImagePicker ? 'exists' : 'null');
    console.log('📷 launchCameraAsync:', typeof ImagePicker?.launchCameraAsync);
    console.log('📷 launchImageLibraryAsync:', typeof ImagePicker?.launchImageLibraryAsync);

    try {
      let result;
      if (source === 'camera') {
        console.log('📷 Requesting camera permissions...');
        const permResult = await ImagePicker.requestCameraPermissionsAsync();
        console.log('📷 Camera permission result:', JSON.stringify(permResult));
        if (permResult.status !== 'granted') {
          Alert.alert('שגיאה', 'נדרשת הרשאה למצלמה. אנא אשר בהגדרות המכשיר.');
          return;
        }
        console.log('📷 Launching camera NOW...');
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
          base64: true,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
        console.log('📷 Camera result received:', JSON.stringify(result));
      } else {
        console.log('🖼️ Requesting gallery permissions...');
        const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log('🖼️ Gallery permission result:', JSON.stringify(permResult));
        if (permResult.status !== 'granted') {
          Alert.alert('שגיאה', 'נדרשת הרשאה לגלריה. אנא אשר בהגדרות המכשיר.');
          return;
        }
        console.log('🖼️ Launching gallery NOW...');
        result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
          base64: true,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
        console.log('🖼️ Gallery result received:', JSON.stringify(result));
      }

      console.log('📷 Checking result...');
      if (result && !result.canceled && result.assets && result.assets[0]) {
        console.log('✅ Got image, uploading...');
        await handleImageUpload(result.assets[0]);
      } else {
        console.log('⚠️ No image selected or canceled');
      }
    } catch (error) {
      console.log('❌ pickImage Error:', error);
      console.log('❌ Error message:', error?.message);
      console.log('❌ Error stack:', error?.stack);
      Alert.alert('שגיאה', `אירעה שגיאה: ${error?.message || 'לא ידוע'}`);
    }
  };

  const showImagePicker = useCallback(() => {
    console.log('📸 showImagePicker called');
    setShowImageModal(true);
  }, []);

  const handleImageChoice = useCallback((type) => {
    console.log('🎯 handleImageChoice called with:', type);
    setShowImageModal(false);
    // Wait for modal to fully close before opening picker
    setTimeout(() => {
      console.log('⏰ Timeout fired, calling pickImage...');
      pickImage(type);
    }, 600);
  }, []);

  const addWater = async () => {
    const newWater = (dailyStats?.water_glasses || 0) + 1;
    const newStats = { ...dailyStats, water_glasses: newWater };

    // סנכרון ברקע - לא מחכים
    contextAddWater();

    // הודעה מיידית
    const goalReached = checkGoalReached(newStats);

    if (!goalReached) {
      const remaining = targets.water - newWater;
      if (remaining > 0) {
        addBotMessage(`נרשם 💧 נותרו ${remaining} כוסות מים להיום.`);
      }
    }
  };

  const handleImageUpload = async (asset) => {
    // 1. Show Typing Indicator (Thinking...)
    console.log('🔄 handleImageUpload: Setting isTyping to true');
    setIsTyping(true);
    setFoodData(null);

    try {
      let base64Image = asset.base64;
      if (!base64Image && asset.uri) {
        base64Image = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      }

      const result = await analyzeFoodFromImage(base64Image);

      // Stop typing
      setIsTyping(false);

      // 2. Handle Logic: Multiple vs Single
      if (result.items && result.items.length > 1) {
        // --- MULTIPLE ITEMS DETECTED ---

        // Add to pending foods so user answers "150 200"
        const foodsForPending = result.items.map(item => ({
          name: item.name,
          avgPortion: `זיהיתי בערך ${item.estimated_portion_grams}g`,
          estimated_portion_grams: item.estimated_portion_grams || 100,
          calories_per_100g: item.calories_per_100g,
          protein_per_100g: item.protein_per_100g,
          fat_per_100g: item.fat_per_100g,
        }));

        setPendingFoods(foodsForPending);

        let totalCal = 0;

        const foodList = result.items.map(item => {
          const emoji = getFoodEmoji(item.name);
          // Calculate per portion
          const portionMultiplier = (item.estimated_portion_grams || 100) / 100;
          const portionCal = Math.round(item.calories_per_100g * portionMultiplier);
          const portionProt = Math.round(item.protein_per_100g * portionMultiplier * 10) / 10;
          const portionFat = Math.round(item.fat_per_100g * portionMultiplier * 10) / 10;

          totalCal += portionCal;

          return `• ${emoji} ${item.name} (~${item.estimated_portion_grams}g)\n  └─ 🔥 ${portionCal} | 💪 ${portionProt}g | 🥑 ${portionFat}g`;
        }).join('\n\n');

        await addBotMessage(
          `זיהיתי בצלחת (סה"כ: ${totalCal} קל'):\n\n${foodList}\n\nרשום לי את המשקלים אם אתה רוצה לשנות (למשל: "150 200") או כתוב "אישור" כדי לקבל את מה שזיהיתי.`
        );

      } else if (result.items && result.items.length === 1) {
        // --- SINGLE ITEM DETECTED ---
        const item = result.items[0];
        setFoodData({ ...item, image_url: asset.uri });
        setShowFoodModal(true); // Open the slider modal for single item
      } else {
        await addBotMessage('לא הצלחתי לזהות אוכל ברור בתמונה 😕 נסה לכתוב לי מה אכלת.');
      }

    } catch (error) {
      setIsTyping(false);
      console.log('Analysis Error:', error);
      await addBotMessage('הייתה בעיה בניתוח התמונה. נסה שוב.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmFood = async (food) => {
    console.log('[Home] handleConfirmFood called with:', food);
    setShowFoodModal(false);

    // Bot confirmation message
    await addBotMessage(`✅ ${food.name} נרשם! מעדכן את המאזן...`);

    // Update balance (stay collapsed - mini rings animate)
    setTimeout(async () => {
      const newStats = await updateBalanceWithoutGoalCheck(food.calories, food.protein, food.fat);
      
      // Save meal to database (skip stats update - already done above)
      await addMeal({
        name: food.name || 'ארוחה',
        calories: food.calories || 0,
        protein: food.protein || 0,
        fat: food.fat || 0,
      }, true);

      // Wait then check goals
      setTimeout(() => {
        const goalReached = checkGoalReached(newStats);

        if (!goalReached) {
          setTimeout(async () => {
            const followUp = getFollowUpMessage(newStats);
            await addBotMessage(followUp);
          }, 500);
        }
      }, 1000);
    }, 600);
  };

  // Handle 3D weight estimation completion
  const handle3DComplete = async (photosBase64) => {
    // הצג את הנקודות הקופצות בצ'אט
    setIsTyping(true);
    setIs3DAnalyzing(false);

    try {
      const result = await estimate3DWeight(photosBase64);

      // עצור את הנקודות אחרי שהתשובה מוכנה
      setIsTyping(false);

      if (result.success && result.items && result.items.length > 0) {
        const confidenceText = {
          high: '✅ ודאות גבוהה',
          medium: '🟡 ודאות בינונית',
          low: '🟠 ודאות נמוכה',
        };

        // חשב סה"כ
        let totalCal = 0;
        let totalProt = 0;
        let totalFat = 0;

        // בנה רשימה נקייה - רק שם וגרמים
        const foodList = result.items.map(item => {
          const emoji = getFoodEmoji(item.name);
          totalCal += item.calories;
          totalProt += item.protein;
          totalFat += item.fat;
          return `${emoji} ${item.name} • ${item.grams}g`;
        }).join('\n');

        await addBotMessage(
          `📸 זיהיתי:\n\n${foodList}\n\n` +
          `📊 ${totalCal} קל' | ${totalProt}g חלבון | ${totalFat}g שומן`
        );

        // הפעל כפתורי אישור
        setShowConfirmButtons(true);

        // שמור לאישור
        setPendingFoods(result.items.map(item => ({
          name: item.name,
          grams: item.grams,
          calories: item.calories,
          protein: item.protein,
          fat: item.fat,
          is3DEstimate: true,
        })));
      } else {
        await addBotMessage('😕 לא הצלחתי לזהות. נסה לצלם שוב עם תאורה טובה, או כתוב לי מה אכלת.');
      }
    } catch (error) {
      setIsTyping(false);
      setIs3DAnalyzing(false);
      console.error('3D analysis error:', error);
      await addBotMessage('😕 משהו השתבש. נסה שוב או כתוב לי מה אכלת.');
    }
  };

  const renderMessage = (msg, index) => {
    // Food card (used for image recognition)
    if (msg.type === 'food_card' && msg.data) {
      return (
        <FoodCard
          key={msg.id || `msg_${index}`}
          foodName={msg.data.foodName}
          calories={msg.data.calories}
          protein={msg.data.protein}
          fat={msg.data.fat}
        />
      );
    }

    // Recipe card - כרטיסיית מתכון
    if (msg.type === 'recipe_card' && msg.data) {
      return (
        <RecipeCard
          key={msg.id || `msg_${index}`}
          title={msg.data.title}
          ingredients={msg.data.ingredients}
          instructions={msg.data.instructions}
          nutrition={msg.data.nutrition}
        />
      );
    }
    if (msg.type === 'recipe_save_banner' && pendingRecipe) {
      return (
        <RecipeSaveBanner
          key={msg.id || `msg_${index}`}
          recipeName={pendingRecipe.title}
          onSave={saveRecipe}
          onDismiss={dismissRecipeSave}
        />
      );
    }
    
    // Daily Meal Plan Card
    if (msg.type === 'meal_plan' && msg.data) {
      return (
        <View key={msg.id || `msg_${index}`} style={{ gap: 8 }}>
          {/* Show intro text as chat bubble */}
          {msg.text && (
            <ChatMessage
              message={msg.text}
              isBot={true}
            />
          )}
          {/* Show meal plan card */}
          <DailyMealPlanCard
            data={msg.data}
            onRequestMealChange={handleRequestMealChange}
            onSelectAlternative={handleSelectAlternative}
            isLoading={isGeneratingPlan}
          />
        </View>
      );
    }
    
    if (!msg.text) return null;
    return (
      <ChatMessage
        key={msg.id || `msg_${index}`}
        message={msg.text}
        isBot={msg.isBot}
      />
    );
  };

  if (isLoading) {
    const loadingNow = moment();
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingDateBox}>
          <View style={styles.loadingDateLine} />
          <Text style={styles.loadingDateText}>
            {loadingNow.format('HH:mm')} • {loadingNow.format('DD/MM/YY')}
          </Text>
        </View>
        <Image
          source={LOGO_IMAGE}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <Text style={styles.loadingTagline}>Balance by data, personalized for you.</Text>
        <LoadingDots />
      </View>
    );
  }

  if (!profile) return null;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Top Bar - Premium Design */}
        <View style={styles.topBar}>
          {/* Left - Date/Time */}
          <View style={styles.topBarSide}>
            <Text style={styles.dateTimeText}>
              {currentTime.format('DD.MM')} • {currentTime.format('HH:mm')}
            </Text>
          </View>

          {/* Center - Logo */}
          <View style={styles.topBarCenter}>
            <Image
              source={LOGO_IMAGE}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Right - Menu */}
          <View style={styles.topBarRight}>
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => {
                Keyboard.dismiss();
                setIsMenuOpen(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Content Area - Chat with floating Balance Header */}
        <View style={styles.mainContent}>
          {/* Chat Area - Behind Balance Header */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatArea}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onScrollBeginDrag={handleChatPress}
            onTouchStart={handleChatPress}
          >
            {messages.map((msg, index) => renderMessage(msg, index))}
            {isTyping && <TypingIndicator />}
          </ScrollView>

          {/* Floating Balance Header - Above Chat */}
          <BalanceHeader
            dailyStats={dailyStats}
            targets={targets}
            isCollapsed={isHeaderCollapsed}
            onToggle={toggleHeader}
            animatedHeight={animatedHeight}
            contentProgress={contentProgress}
            userName={profile?.name}
            onRecentMealsPress={() => navigation.navigate('RecentMeals')}
          />
        </View>

        {/* כרטיסיית אישור */}
        {showConfirmButtons && (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>להוסיף למאזן?</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmBtnCancel}
                onPress={() => {
                  setShowConfirmButtons(false);
                  setPendingFoods([]);
                  addBotMessage('בוטל ❌');
                }}
              >
                <Text style={styles.confirmBtnCancelText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtnApprove}
                onPress={async () => {
                  setShowConfirmButtons(false);
                  const currentPendingFoods = [...pendingFoods];
                  setPendingFoods([]);
                  await processReadyFood(currentPendingFoods);
                }}
              >
                <Text style={styles.confirmBtnApproveText}>אישור ✓</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Input Area - הסתר כשהמצלמה פתוחה */}
        {!show3DModal && (
          <InputBar
            inputText={inputText}
            onChangeText={setInputText}
            onSend={handleSendMessage}
            onCameraPress={showImagePicker}
            onWater={addWater}
            onFocus={collapseHeader}
            onDailyPlanPress={handleGenerateDailyPlan}
            on3DPress={() => setShow3DModal(true)}
          />
        )}

        {/* Side Menu */}
        <SideMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          onNavigate={(screen) => navigation.navigate(screen)}
          profile={profile}
        />

        {/* Food Modal */}
        <FoodRecognitionModal
          isOpen={showFoodModal}
          onClose={() => setShowFoodModal(false)}
          foodData={foodData}
          isLoading={isAnalyzing}
          onConfirm={handleConfirmFood}
        />

        {/* 3D Weight Estimation Modal */}
        <Multi3DCapture
          visible={show3DModal}
          onClose={() => setShow3DModal(false)}
          onComplete={handle3DComplete}
        />

        {/* Image Picker - Bubble Card */}
        {showImageModal && (
          <View style={[styles.bubbleOverlay, { paddingBottom: keyboardHeight > 0 ? keyboardHeight - 10 : (Platform.OS === 'ios' ? 90 : 70) }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setShowImageModal(false)}
            />
            <Animated.View
              style={[
                styles.bubbleCard,
                {
                  transform: [{ scale: bubbleScale }],
                  opacity: bubbleOpacity,
                },
              ]}
            >
              <View style={styles.bubbleOptions}>
                <TouchableOpacity
                  style={styles.bubbleButton}
                  onPress={() => handleImageChoice('camera')}
                  activeOpacity={0.7}
                >
                  <View style={styles.bubbleIconContainer}>
                    <Ionicons name="camera" size={26} color="#007AFF" />
                  </View>
                  <Text style={styles.bubbleButtonText}>צלם</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bubbleButton}
                  onPress={() => handleImageChoice('gallery')}
                  activeOpacity={0.7}
                >
                  <View style={styles.bubbleIconContainer}>
                    <Ionicons name="images" size={26} color="#007AFF" />
                  </View>
                  <Text style={styles.bubbleButtonText}>גלריה</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bubbleButton}
                  onPress={() => setShowImageModal(false)}
                  activeOpacity={0.7}
                >
                  <View style={styles.bubbleIconContainer}>
                    <Ionicons name="close" size={26} color="#8E8E93" />
                  </View>
                  <Text style={[styles.bubbleButtonText, styles.bubbleButtonTextGray]}>ביטול</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        )}

        {/* Confetti */}
        {showConfetti && <ConfettiCannon />}

        {/* Goal Celebration Animation */}
        <GoalCelebration
          visible={celebration.visible}
          goalType={celebration.goalType}
          userName={profile?.name}
          onComplete={handleCelebrationComplete}
        />

        <DailyGoalCelebration
          visible={showDailyCelebration}
          userName={profile?.name}
          onComplete={handleDailyCelebrationComplete}
        />

        {/* 3D Analyzing Modal */}
        {is3DAnalyzing && (
          <Modal visible={is3DAnalyzing} transparent animationType="fade">
            <View style={styles.analyzing3DOverlay}>
              <View style={styles.analyzing3DCard}>
                <Image source={LOGO_IMAGE} style={styles.analyzing3DLogo} resizeMode="contain" />
                <Text style={styles.analyzing3DTitle}>מנתח נפח...</Text>
                <View style={styles.analyzing3DDots}>
                  <LoadingDots />
                </View>
                <Text style={styles.analyzing3DSubtitle}>מעריך משקל מ-3 זוויות</Text>
              </View>
            </View>
          </Modal>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingLogo: {
    width: 280,
    height: 70,
    marginBottom: 20,
  },
  loadingTagline: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    marginBottom: 24,
    letterSpacing: 0.3,
  },
  loadingDateBox: {
    position: 'absolute',
    right: 20,
    top: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingDateLine: {
    width: 10,
    height: 1.5,
    backgroundColor: '#CBD5E1',
    borderRadius: 1,
  },
  loadingDateText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16A34A',
  },

  // Top Bar - Minimalist Design
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 2,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  topBarSide: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 80,
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 170,
    height: 42,
  },
  logoSlogan: {
    fontSize: 8,
    color: '#9CA3AF',
    marginTop: 1,
    letterSpacing: 0.2,
  },
  dateTimeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    letterSpacing: 0.5,
  },
  menuBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLine: {
    width: 20,
    height: 2.5,
    backgroundColor: '#6B7280',
    borderRadius: 1,
    marginVertical: 2.5,
  },

  // Chat
  mainContent: {
    flex: 1,
    position: 'relative',
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingTop: 98,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 8,
  },

  // Bubble Card Style
  bubbleOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 110 : 90,
    pointerEvents: 'box-none',
  },
  bubbleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  bubbleOptions: {
    flexDirection: 'row',
    gap: 16,
  },
  bubbleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  bubbleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  bubbleButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#007AFF',
  },
  bubbleButtonTextGray: {
    color: '#8E8E93',
  },
  // 3D Analyzing Modal
  analyzing3DOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzing3DCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: SCREEN_WIDTH - 64,
    borderWidth: 1,
    borderColor: '#333',
  },
  analyzing3DLogo: {
    width: 140,
    height: 40,
    marginBottom: 20,
  },
  analyzing3DTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
  },
  analyzing3DDots: {
    marginBottom: 16,
  },
  analyzing3DSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  // Confirm Card - Clean White Design
  confirmCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  confirmBtnCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmBtnApprove: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#22C55E',
    alignItems: 'center',
  },
  confirmBtnApproveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
