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
  Alert,
  Keyboard,
  Dimensions,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { chatWithBot, analyzeFoodFromImage, parseFoodFromText, estimate3DWeight } from '../api/aiClient';
import { processUserMessage, INTENTS, getGreeting, getSmartFollowUp, newMealGroupId } from '../api/smartChatbot';
import { prefillAskQuantityHints } from '../api/chatFoodResolver';
import {
  attachPortionGuesses,
  buildPortionConfirmIntro,
  defaultTotalGramsForFood,
} from '../utils/standardPortionGuess';
import PortionConfirmCard from '../components/chat/PortionConfirmCard';
import { userMessageImpliesFoodQuantity } from '../utils/userMessageQuantityHints';
import { getDailyUsage, RateLimitError } from '../api/geminiClient';
import { askBrachotAssistant } from '../api/brachotAssistant';
import {
  buildMealPlan,
  swapMeal,
  enforceOvershootGuard,
  buildPlanIntro,
} from '../api/smartMealPlanner';
import useNotifications from '../hooks/useNotifications';
import { useApp } from '../context/AppContext';
import ChatMessage from '../components/chat/ChatMessage';
import TypingIndicator from '../components/chat/TypingIndicator';
import FoodCard from '../components/chat/FoodCard';
import RecipeCard from '../components/chat/RecipeCard';
import RecipeSaveBanner from '../components/chat/RecipeSaveBanner';
import InputBar from '../components/chat/InputBar';
import BrachotAskModal from '../components/chat/BrachotAskModal';
import { SHOW_CHAT_CAMERA_CAPTURE_IN_UI } from '../constants/featureFlags';
import GrayIconChip from '../components/chat/GrayIconChip';
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

/** כפתור «ברכה אחרונה» אחרי ייעוץ מה לברך — ניווט למסך עם הטקסט המתאים */
const BRACHOT_AFTER_NAV = {
  hamazon: { label: 'לברכת המזון', prayer: 'hamazon' },
  mein: { label: 'למעין שלוש', prayer: 'mein' },
  michya: { label: 'על המחיה', prayer: 'michya' },
  short: { label: 'בורא נפשות', prayer: 'short' },
};

const _log = console.log.bind(console);
const devLog = (...args) => {
  if (__DEV__) _log(...args);
};

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

/** True when chat-resolved food names overlap pending portion-confirm foods (clear stale pending). */
function portionPendingOverlapsIncoming(pendingFoods, resolvedFoodRows) {
  const norm = (s) =>
    String(s ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/['׳]/g, '');

  const pendingNs = (pendingFoods || []).map((f) => norm(f?.name)).filter(Boolean);
  const incomingNs = (resolvedFoodRows || []).map((f) => norm(f?.name)).filter(Boolean);
  if (!pendingNs.length || !incomingNs.length) return false;

  const overlaps = (a, b) =>
    !!(a &&
      b &&
      (a === b ||
        (a.length >= 2 &&
          b.length >= 2 &&
          (a.includes(b) || b.includes(a)))));

  return incomingNs.some((iname) =>
    pendingNs.some((pname) => overlaps(pname, iname)),
  );
}

export default function Home() {
  const navigation = useNavigation();
  const scrollViewRef = useRef(null);
  const { profile, dailyStats, setDailyStats, messages, addMessage, setMessages, clearMessages, today, isLoading, addWater: contextAddWater, hasCompletedOnboarding, user, addMeal } = useApp();
  // Inactivity-nudge wiring: every meal log calls `updateLastFoodLog`,
  // which also re-arms the 3.5h schedule.
  const { updateLastFoodLog } = useNotifications();

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [foodData, setFoodData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const hasGreetedRef = useRef(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [pendingFoods, setPendingFoods] = useState([]); // Foods waiting for quantity
  /** bot message ids for `portion_confirm` cards already submitted */
  const [appliedPortionIds, setAppliedPortionIds] = useState({});
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
  /** Syncs meal-plan swaps with chat message data + render source of truth */
  const mealPlanMsgIdRef = useRef(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [show3DModal, setShow3DModal] = useState(false);
  const [showBrachotAskModal, setShowBrachotAskModal] = useState(false);
  const [is3DAnalyzing, setIs3DAnalyzing] = useState(false);
  const [showConfirmButtons, setShowConfirmButtons] = useState(false); // כפתורי אישור לאחר זיהוי

  // ================================================
  // API SAFETY / RATE LIMIT STATE
  // ================================================
  // Guards against the runaway-retry cost blow-up:
  //  - cooldownUntilMs: button disabled until this timestamp (ms).
  //  - consecutiveErrors: 2 failures in a row -> long cooldown (circuit breaker).
  //  - rateLimited: true when the server returned a 429 (exhausted daily quota).
  //  - dailyUsage: {used, limit} for the "X left today" banner.
  const COOLDOWN_MS_AFTER_ERROR = 8000;       // 8s after a single failure
  const COOLDOWN_MS_CIRCUIT = 60000;           // 60s after 2 consecutive failures
  const COOLDOWN_MS_RATE_LIMITED = 60 * 60 * 1000; // 1h lock after 429 (server will still reject)
  const ERROR_THRESHOLD_CIRCUIT = 2;
  // Keep in lock-step with the Edge Function secret DAILY_MESSAGE_LIMIT (default 60).
  const DAILY_LIMIT = Number(process.env.EXPO_PUBLIC_DAILY_MESSAGE_LIMIT ?? 60) || 60;
  const [cooldownUntilMs, setCooldownUntilMs] = useState(0);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [dailyUsage, setDailyUsage] = useState(null); // { used, limit } | null
  const [nowTick, setNowTick] = useState(Date.now()); // drives countdown re-render

  // Load current daily usage on mount / when user changes
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) return;
      const result = await getDailyUsage();
      if (!cancelled && result) {
        setDailyUsage((prev) => ({
          used: result.used,
          limit: prev?.limit ?? DAILY_LIMIT,
        }));
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Tick every second while a cooldown is active so the countdown updates
  useEffect(() => {
    if (cooldownUntilMs <= Date.now()) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldownUntilMs]);

  const cooldownRemainingSec = Math.max(0, Math.ceil((cooldownUntilMs - nowTick) / 1000));
  const isCooldownActive = cooldownRemainingSec > 0;

  const inputBarReason = rateLimited
    ? `הגעת למכסת ההודעות היומית (${dailyUsage?.limit ?? DAILY_LIMIT}). נסה שוב מחר 🌙`
    : isCooldownActive
      ? (consecutiveErrors >= ERROR_THRESHOLD_CIRCUIT
          ? `בודק חיבור... ${cooldownRemainingSec}ש׳`
          : `רגע, ${cooldownRemainingSec}ש׳ לניסיון הבא`)
      : '';

  const inputBarDisabled = rateLimited || isCooldownActive;
  const [chatGenAbortable, setChatGenAbortable] = useState(false);
  const chatGenAbortRef = useRef(null);

  const quotaLimit = dailyUsage?.limit ?? DAILY_LIMIT;
  const quotaUsed = dailyUsage?.used ?? 0;
  const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
  const showQuotaWarningBanner =
    !!user?.id && dailyUsage != null && quotaRemaining > 0 && quotaRemaining <= 3;


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
        
        devLog('[Home] Chat date check - saved:', savedDate, 'effective:', effectiveDate);
        
        if (savedDate !== effectiveDate) {
          // New day (past 3 AM) - reset chat
          devLog('[Home] New day detected - resetting chat');
          await clearMessagesRef.current();
          setPendingFoods([]);
          setPendingRecipe(null);
          setShowConfirmButtons(false);
          hasGreetedRef.current = false;
          setConversationHistory([]);
          setDailyMealPlan(null);
          mealPlanMsgIdRef.current = null;
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
        devLog('Error loading celebrated goals:', e);
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
        devLog('Error saving celebrated goals:', e);
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

  const handleOpenBrachot = useCallback(() => {
    collapseHeader();
    setShowBrachotAskModal(true);
  }, [collapseHeader]);

  const handleOpenBirkatFromBrachotModal = useCallback(() => {
    setShowBrachotAskModal(false);
    navigation.navigate('BirkatHamazon');
  }, [navigation]);

  const handleBrachotSubmit = useCallback(
    (q) => {
      setShowBrachotAskModal(false);
      addUserMessage(`מה לברך: ${q}`);
      setIsTyping(true);
      (async () => {
        try {
          const { reply, afterBlessing, before, after, note } = await askBrachotAssistant(q);
          const uniqueId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const navigable = afterBlessing && afterBlessing !== 'none';
          const b = String(before || '').trim();
          const a = String(after || '').trim();
          const n = String(note || '').trim();
          const hasStructured = Boolean(b || a || n);
          const useBrachotAdvice = navigable || hasStructured;
          addMessage({
            text: reply,
            isBot: true,
            id: uniqueId,
            type: useBrachotAdvice ? 'brachot_advice' : 'text',
            data: {
              ...(navigable ? { afterBlessing } : {}),
              ...(hasStructured ? { before: b, after: a, note: n } : {}),
            },
          });
          setConversationHistory((prev) => [...prev, { role: 'assistant', content: reply }]);
        } catch (e) {
          if (e instanceof RateLimitError) {
            Alert.alert('מכסה יומית', e.message || 'הגעת למגבלה. נסה שוב מחר.');
          } else {
            Alert.alert('שגיאה', e?.message || 'לא הצלחנו לקבל תשובה. נסה שוב.');
          }
        } finally {
          setIsTyping(false);
        }
      })();
    },
    [addMessage, addUserMessage, setConversationHistory],
  );

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
      devLog('Hebrew date error:', e);
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
  const processReadyFood = async (foods, batchMeta = {}) => {
    const { meal_group_id, source_message_text } = batchMeta;
    devLog('[Home] processReadyFood called with:', foods, batchMeta);
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;

    for (const food of foods) {
      totalCalories += food.calories || 0;
      totalProtein += food.protein || 0;
      totalFat += food.fat || 0;
      totalCarbs += food.carbs || 0;
    }

    // Step 1: Bot encouragement message
    const successMsg = getSuccessMessage(totalCalories, (dailyStats?.calories || 0) + totalCalories);
    await addBotMessage(successMsg);

    // Step 2: Update balance (stay collapsed - animations happen in mini rings)
    setTimeout(async () => {
      const newStats = await updateBalanceWithoutGoalCheck(
        totalCalories,
        totalProtein,
        totalFat,
        null,
        totalCarbs
      );
      
      // Step 3: Save each food as a meal to the database (skip stats update - already done above)
      devLog('[Home] processReadyFood: Saving', foods.length, 'meals');
      for (const food of foods) {
        devLog('[Home] processReadyFood: Calling addMeal for:', food.name);
        await addMeal({
          name: food.name || 'ארוחה',
          calories: food.calories || 0,
          protein: food.protein || 0,
          fat: food.fat || 0,
          carbs: food.carbs || 0,
          source: 'chat',
          nutrition_metadata: food.nutrition_metadata || null,
          meal_group_id: meal_group_id ?? null,
          source_message_text: source_message_text ?? null,
        }, true); // skipStatsUpdate = true
      }
      devLog('[Home] processReadyFood: Done saving meals');

      // Reset the inactivity nudge timer.
      updateLastFoodLog();

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
  // Planning + swap logic lives in `src/api/smartMealPlanner.js`.
  // This screen is just orchestration: build a plan, drop it into the
  // chat, and respect the realistic-cap message when the planner says
  // we shouldn't try to close the entire daily gap at this hour.

  const handleGenerateDailyPlan = async () => {
    setIsGeneratingPlan(true);
    setIsTyping(true);

    try {
      const currentHour = new Date().getHours();
      const plan = await buildMealPlan({
        profile,
        dailyStats,
        targets,
        currentHour,
      });

      setIsTyping(false);

      if (plan && plan.meals && plan.meals.length > 0) {
        setDailyMealPlan(plan);
        const introText = buildPlanIntro({ plan, profile });
        const uniqueId = `plan_${Date.now()}`;
        mealPlanMsgIdRef.current = uniqueId;
        addMessage({
          text: introText,
          isBot: true,
          id: uniqueId,
          type: 'meal_plan',
          data: plan,
        });
      } else {
        const fallbackText = plan?.capMessage
          || '😅 לא נשארו הרבה קלוריות להיום. אולי כוס מים?';
        await addBotMessage(fallbackText);
      }
    } catch (error) {
      console.error('Error generating meal plan:', error);
      setIsTyping(false);
      await addBotMessage('הייתה בעיה בבניית התפריט 😅 נסה שוב.');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Returns calorie-matched alternatives for the swap (↔) button.
  const handleRequestMealChange = async (meal /* , mealIndex */) => {
    return swapMeal({
      meal,
      allMeals: dailyMealPlan?.meals || [],
      targets,
      dailyStats,
      profile,
    });
  };

  // Apply the user's chosen alternative; re-scale it down if placing it
  // back into the plan would push projected daily total above the
  // overshoot ceiling.
  const handleSelectAlternative = (alternative, mealIndex) => {
    if (!dailyMealPlan || !dailyMealPlan.meals) return;

    const otherMeals = dailyMealPlan.meals.filter((_, i) => i !== mealIndex);
    const safeAlt = enforceOvershootGuard({
      alternative,
      otherMeals,
      targets,
      dailyStats,
    });

    const updatedMeals = [...dailyMealPlan.meals];
    const originalMeal = updatedMeals[mealIndex];
    updatedMeals[mealIndex] = {
      ...originalMeal,
      name: safeAlt.name,
      items: safeAlt.items,
      totalCalories: safeAlt.totalCalories,
      totalProtein: safeAlt.totalProtein,
      totalFat: safeAlt.totalFat,
    };

    const newPlan = { ...dailyMealPlan, meals: updatedMeals };
    setDailyMealPlan(newPlan);
    setMessages((prev) =>
      prev.map((m) =>
        m.type === 'meal_plan' && m.id === mealPlanMsgIdRef.current
          ? { ...m, data: newPlan }
          : m,
      ),
    );
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

  const updateBalanceWithoutGoalCheck = async (
    calories,
    protein,
    fat,
    waterGlasses = null,
    carbDelta = 0
  ) => {
    devLog('[Home] updateBalanceWithoutGoalCheck:', { calories, protein, fat, waterGlasses, carbDelta });
    // Round values to avoid floating point precision issues
    const newStats = {
      calories: Math.round((dailyStats?.calories || 0) + calories),
      protein: Math.round(((dailyStats?.protein || 0) + protein) * 10) / 10,
      fat: Math.round(((dailyStats?.fat || 0) + fat) * 10) / 10,
      carbs: Math.round(((dailyStats?.carbs || 0) + (carbDelta || 0)) * 10) / 10,
      water_glasses: waterGlasses !== null ? waterGlasses : (dailyStats?.water_glasses || 0),
    };

    devLog('[Home] New stats to save:', newStats);
    // setDailyStats now automatically syncs to Supabase via AppContext
    await setDailyStats(newStats);

    return newStats;
  };

  const updateBalance = async (calories, protein, fat, waterGlasses = null, carbDelta = 0) => {
    const newStats = await updateBalanceWithoutGoalCheck(
      calories,
      protein,
      fat,
      waterGlasses,
      carbDelta
    );
    checkGoalReached(newStats);
    return newStats;
  };

  // Ref to prevent double processing
  const isProcessingRef = useRef(false);

  const handleStopChatGeneration = () => {
    chatGenAbortRef.current?.abort();
  };

  // ============================================================
  // NEW SMART CHATBOT - Context-Aware Message Handler
  // ============================================================
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    if (!user?.id) {
      await addBotMessage('התחבר/י כדי לשלוח הודעות לבוט.');
      return;
    }

    // Hard blocks: quota exhausted or cooling down after errors.
    if (rateLimited) {
      devLog('⚠️ Send blocked: daily rate limit reached');
      return;
    }
    if (cooldownUntilMs > Date.now()) {
      devLog('⚠️ Send blocked: cooldown active');
      return;
    }

    // Prevent double processing
    if (isProcessingRef.current) {
      devLog('⚠️ Already processing, skipping...');
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
    const ac = new AbortController();
    chatGenAbortRef.current = ac;
    setChatGenAbortable(true);

    try {
      // Build context for smart chatbot.
      // IMPORTANT: structured UI cards (portion_confirm/food_card/recipe_card/meal_plan/brachot_advice)
      // carry long Hebrew template text the model can mimic, breaking JSON-mode replies.
      // Replace those with a short placeholder so the LLM doesn't echo our UI copy back as plain text.
      const STRUCTURED_BOT_TYPES = new Set([
        'portion_confirm',
        'food_card',
        'recipe_card',
        'recipe_save_banner',
        'meal_plan',
        'brachot_advice',
      ]);
      const placeholderForType = (t) => {
        switch (t) {
          case 'portion_confirm':
            return '[ממשק: הוצג כרטיס אישור מנה (כפתור הוסף / לא)]';
          case 'food_card':
            return '[ממשק: הוצג כרטיס מנה שנרשמה]';
          case 'recipe_card':
            return '[ממשק: הוצג כרטיס מתכון]';
          case 'recipe_save_banner':
            return '[ממשק: הוצעה שמירת מתכון]';
          case 'meal_plan':
            return '[ממשק: הוצגה תפריט יומי]';
          case 'brachot_advice':
            return '[ממשק: הוצגה ברכה]';
          default:
            return '';
        }
      };

      // Older sessions saved plain-text bot bubbles that contain the same UI
      // template (e.g. "לחצו על הכפתור הירוק הוסף", "תיפתח שקופית עם סרגל").
      // If we feed that back, the LLM mimics it and stops returning JSON.
      // Strip / shorten any bot text that smells like UI copy.
      const UI_LEAK_PATTERNS = [
        /לחצו\s*על\s*הכפתור/i,
        /תיפתח\s*שקופית/i,
        /רוצה\s*לוודא\s*איתכם/i,
        /הכפתור\s*הירוק/i,
      ];
      const sanitizeBotText = (raw) => {
        const t = String(raw || '').trim();
        if (!t) return '';
        if (UI_LEAK_PATTERNS.some((re) => re.test(t))) {
          return '[ממשק: הוצג כרטיס אישור מנה (כפתור הוסף / לא)]';
        }
        return t.length > 280 ? `${t.slice(0, 280)}…` : t;
      };

      const context = {
        conversationHistory: messages
          .slice(-10)
          .map((m) => {
            if (m.isBot && STRUCTURED_BOT_TYPES.has(m.type)) {
              return { isBot: true, text: placeholderForType(m.type) };
            }
            if (m.isBot) {
              return { isBot: true, text: sanitizeBotText(m.text) };
            }
            return { isBot: false, text: String(m.text || '').slice(0, 500) };
          })
          .filter((m) => m.text && m.text.length > 0),
        pendingAction: pendingFoods.length > 0 ? {
          type: 'waiting_quantity',
          foods: pendingFoods,
        } : null,
        dailyStats: dailyStats || {},
        targets: targets || {},
        userName: profile?.first_name || '',
        goal: profile?.goal || 'maintain', // User goal: cut, maintain, bulk, lean_bulk
        signal: ac.signal,
      };

      // Call smart chatbot
      const result = await processUserMessage(userText, context);
      setIsTyping(false);

      devLog('🤖 Smart Bot Result:', result.intent, result.action?.type);

      // Success: reset the error streak and bump the local usage counter so
      // the "X left today" banner updates without an extra DB round-trip.
      setConsecutiveErrors(0);
      setDailyUsage((prev) => {
        if (prev) return { ...prev, used: (prev.used || 0) + 1 };
        return { used: 1, limit: DAILY_LIMIT };
      });

      await handleSmartBotAction(result, userText);

    } catch (error) {
      setIsTyping(false);

      if (error?.code === 'USER_CANCEL') {
        return;
      }

      // Daily quota exhausted -> lock the input and show the server's message.
      if (error instanceof RateLimitError || error?.name === 'RateLimitError') {
        console.warn('🚫 Rate limited:', error.message);
        setRateLimited(true);
        setCooldownUntilMs(Date.now() + COOLDOWN_MS_RATE_LIMITED);
        setDailyUsage({
          used: error.used ?? dailyUsage?.used ?? 0,
          limit: error.limit ?? dailyUsage?.limit ?? DAILY_LIMIT,
        });
        await addBotMessage(
          error.message || `הגעת למכסה היומית של ההודעות (${error.limit ?? DAILY_LIMIT}). נסה שוב מחר 🌙`
        );
        return;
      }

      // Generic failure -> short cooldown, escalate to circuit breaker on repeats.
      console.error('Smart chatbot error:', error);
      const newErrorCount = consecutiveErrors + 1;
      setConsecutiveErrors(newErrorCount);
      const cooldown = newErrorCount >= ERROR_THRESHOLD_CIRCUIT
        ? COOLDOWN_MS_CIRCUIT
        : COOLDOWN_MS_AFTER_ERROR;
      setCooldownUntilMs(Date.now() + cooldown);
      const cooldownSec = Math.round(cooldown / 1000);
      await addBotMessage(
        newErrorCount >= ERROR_THRESHOLD_CIRCUIT
          ? `נתקלתי בכמה תקלות ברצף. ממתין ${cooldownSec} שניות לפני שננסה שוב 🛠️`
          : `אופס, משהו השתבש 😅 ננסה שוב בעוד ${cooldownSec} שניות.`
      );
    } finally {
      // Single source of truth: the processing lock is released here
      // regardless of which code path finished. handleSmartBotAction's
      // own reset is kept as a no-op for safety.
      isProcessingRef.current = false;
      chatGenAbortRef.current = null;
      setChatGenAbortable(false);
    }
  };

  // Handle actions from smart chatbot
  const handleSmartBotAction = async (result, lastUserText = '') => {
    const { intent, response, action } = result;

    const quantityCueInMessage =
      typeof lastUserText === 'string' && userMessageImpliesFoodQuantity(lastUserText);

    const skipResponseBubble =
      (action?.type === 'ask_quantity' && !quantityCueInMessage) ||
      action?.type === 'confirm_portions';

    if (response && !skipResponseBubble) {
      await addBotMessage(response);
    }

    // Handle specific actions
    if (action) {
      switch (action.type) {
        case 'add_food':
          if (action.data?.foods?.length > 0) {
            const incoming = action.data.foods;
            if (
              pendingFoods.length > 0 &&
              portionPendingOverlapsIncoming(pendingFoods, incoming)
            ) {
              setPendingFoods([]);
            }
            setTimeout(async () => {
              await processReadyFood(action.data.foods, {
                meal_group_id: action.data.meal_group_id,
                source_message_text: action.data.source_message_text,
              });
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

        case 'confirm_portions':
          if (action.data?.items?.length > 0) {
            setPendingFoods(action.data.items);
            const intro = buildPortionConfirmIntro(action.data.items);
            const uniqueId = `portion_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            addMessage({
              text: intro,
              isBot: true,
              id: uniqueId,
              type: 'portion_confirm',
              data: {
                items: action.data.items,
                batchMeta: {
                  source_message_text: action.data.source_message_text ?? null,
                  water_glasses: Number(action.data.water_glasses) || 0,
                },
              },
            });
          }
          break;

        case 'ask_quantity':
          if (quantityCueInMessage) {
            devLog('[Home] Skipping portion card: user message includes quantity cues');
            if (response && String(response).trim()) {
              await addBotMessage(response);
            } else {
              await addBotMessage(
                'לא הצלחתי לסיים את הרישום מההודעה. נסה לשלוח שוב.'
              );
            }
            break;
          }
          if (action.data?.foods?.length > 0) {
            try {
              const hinted = await prefillAskQuantityHints(action.data.foods);
              const withGuesses = attachPortionGuesses(hinted);
              setPendingFoods(withGuesses);
              const intro = buildPortionConfirmIntro(withGuesses);
              const uniqueId = `portion_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
              addMessage({
                text: intro,
                isBot: true,
                id: uniqueId,
                type: 'portion_confirm',
                data: { items: withGuesses },
              });
            } catch (e) {
              console.warn('[Home] prefillAskQuantityHints:', e);
              const fallback = attachPortionGuesses(action.data.foods);
              setPendingFoods(fallback);
              const intro = buildPortionConfirmIntro(fallback);
              addMessage({
                text: intro,
                isBot: true,
                id: `portion_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                type: 'portion_confirm',
                data: { items: fallback },
              });
            }
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
        devLog('[Home] CONFIRM intent, pendingFoods:', pendingFoods.length);
        if (pendingFoods.length > 0) {
          const currentPendingFoods = [...pendingFoods];
          setPendingFoods([]);
          
          // Check if foods have direct calories or need calculation from per_100g
          devLog('[Home] Processing foods for confirmation:', currentPendingFoods);
          const processedFoods = currentPendingFoods.map(food => {
            if (food.calories !== undefined) {
              // Already has calculated calories (from 3D or other source)
              return food;
            } else if (food.calories_per_100g !== undefined) {
              // Need to calculate from per_100g values (from image recognition)
              const grams =
                food.estimated_portion_grams ??
                defaultTotalGramsForFood(food) ??
                100;
              const multiplier = grams / 100;
              return {
                name: food.name,
                grams,
                calories: Math.round(food.calories_per_100g * multiplier),
                protein: Math.round((food.protein_per_100g || 0) * multiplier * 10) / 10,
                fat: Math.round((food.fat_per_100g || 0) * multiplier * 10) / 10,
                carbs: Math.round((food.carbs_per_100g || 0) * multiplier * 10) / 10,
              };
            }
            return food;
          });
          
          await processReadyFood(processedFoods);
        }
        break;

      case INTENTS.PROVIDE_QUANTITY:
        if (pendingFoods.length > 0) {
          const ad = result.action?.data;
          const pickFiniteGrams = (n) => {
            const g = Number(n);
            return Number.isFinite(g) && g > 0 ? Math.round(g) : null;
          };

          const fromArray = [];
          if (Array.isArray(ad?.foods)) {
            for (const row of ad.foods) {
              const g = pickFiniteGrams(row?.grams ?? row?.gram);
              if (g != null) fromArray.push(g);
            }
          }
          if (Array.isArray(ad?.grams)) {
            for (const val of ad.grams) {
              const g = pickFiniteGrams(val);
              if (g != null) fromArray.push(g);
            }
          }

          /** @type {number[]} */
          let gramsList = [...fromArray];

          if (!gramsList.length && typeof result.response === 'string') {
            const gramHits = [...result.response.matchAll(/(\d+(?:[\.,]\d+)?)\s*גרם/gi)];
            for (const m of gramHits) {
              const g = pickFiniteGrams(m[1].replace(',', '.'));
              if (g != null) gramsList.push(g);
            }
          }

          if (!gramsList.length && typeof result.response === 'string') {
            gramsList = [...result.response.matchAll(/\b\d{2,4}\b/g)]
              .map((m) => pickFiniteGrams(m[0]))
              .filter((g) => g != null);
          }

          if (gramsList.length > 0) {
            const processedFoods = [];
            const currentPendingFoods = [...pendingFoods];
            setPendingFoods([]);

            for (let i = 0; i < currentPendingFoods.length; i++) {
              const food = currentPendingFoods[i];
              const grams = gramsList[i] ?? gramsList[0];
              const multiplier = grams / 100;

              processedFoods.push({
                name: food.name,
                grams,
                calories: Math.round((food.calories_per_100g || 100) * multiplier),
                protein: Math.round((food.protein_per_100g || 5) * multiplier * 10) / 10,
                fat: Math.round((food.fat_per_100g || 3) * multiplier * 10) / 10,
                carbs: Math.round((food.carbs_per_100g || 15) * multiplier * 10) / 10,
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
      devLog('Error saving recipe:', error);
    }
    setPendingRecipe(null);
  };

  const dismissRecipeSave = () => {
    setPendingRecipe(null);
  };

  const pickImage = async (source) => {
    devLog('📷 pickImage called with source:', source);
    devLog('📷 ImagePicker object:', ImagePicker ? 'exists' : 'null');
    devLog('📷 launchCameraAsync:', typeof ImagePicker?.launchCameraAsync);
    devLog('📷 launchImageLibraryAsync:', typeof ImagePicker?.launchImageLibraryAsync);

    try {
      let result;
      if (source === 'camera') {
        devLog('📷 Requesting camera permissions...');
        const permResult = await ImagePicker.requestCameraPermissionsAsync();
        devLog('📷 Camera permission result:', JSON.stringify(permResult));
        if (permResult.status !== 'granted') {
          Alert.alert('שגיאה', 'נדרשת הרשאה למצלמה. אנא אשר בהגדרות המכשיר.');
          return;
        }
        devLog('📷 Launching camera NOW...');
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
          base64: true,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
        devLog('📷 Camera result received:', JSON.stringify(result));
      } else {
        devLog('🖼️ Requesting gallery permissions...');
        const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        devLog('🖼️ Gallery permission result:', JSON.stringify(permResult));
        if (permResult.status !== 'granted') {
          Alert.alert('שגיאה', 'נדרשת הרשאה לגלריה. אנא אשר בהגדרות המכשיר.');
          return;
        }
        devLog('🖼️ Launching gallery NOW...');
        result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
          base64: true,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
        devLog('🖼️ Gallery result received:', JSON.stringify(result));
      }

      devLog('📷 Checking result...');
      if (result && !result.canceled && result.assets && result.assets[0]) {
        devLog('✅ Got image, uploading...');
        await handleImageUpload(result.assets[0]);
      } else {
        devLog('⚠️ No image selected or canceled');
      }
    } catch (error) {
      devLog('❌ pickImage Error:', error);
      devLog('❌ Error message:', error?.message);
      devLog('❌ Error stack:', error?.stack);
      Alert.alert('שגיאה', `אירעה שגיאה: ${error?.message || 'לא ידוע'}`);
    }
  };

  const showImagePicker = useCallback(() => {
    if (!SHOW_CHAT_CAMERA_CAPTURE_IN_UI) return;
    devLog('📸 showImagePicker called');
    setShowImageModal(true);
  }, []);

  const handleImageChoice = useCallback((type) => {
    devLog('🎯 handleImageChoice called with:', type);
    setShowImageModal(false);
    // Wait for modal to fully close before opening picker
    setTimeout(() => {
      devLog('⏰ Timeout fired, calling pickImage...');
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
    devLog('🔄 handleImageUpload: Setting isTyping to true');
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
      devLog('Analysis Error:', error);
      await addBotMessage('הייתה בעיה בניתוח התמונה. נסה שוב.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmFood = async (food) => {
    devLog('[Home] handleConfirmFood called with:', food);
    setShowFoodModal(false);

    // Bot confirmation message
    await addBotMessage(`✅ ${food.name} נרשם! מעדכן את המאזן...`);

    // Update balance (stay collapsed - mini rings animate)
    setTimeout(async () => {
      const newStats = await updateBalanceWithoutGoalCheck(
        food.calories,
        food.protein,
        food.fat,
        null,
        food.carbs || 0
      );
      
      // Save meal to database (skip stats update - already done above)
      await addMeal({
        name: food.name || 'ארוחה',
        calories: food.calories || 0,
        protein: food.protein || 0,
        fat: food.fat || 0,
        carbs: food.carbs || 0,
        source: 'photo',
      }, true);

      // Reset the inactivity nudge timer.
      updateLastFoodLog();

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
            data={
              dailyMealPlan && msg.id === mealPlanMsgIdRef.current
                ? dailyMealPlan
                : msg.data
            }
            onRequestMealChange={handleRequestMealChange}
            onSelectAlternative={handleSelectAlternative}
            isLoading={isGeneratingPlan}
          />
        </View>
      );
    }

    if (msg.type === 'portion_confirm' && msg.data?.items?.length) {
      return (
        <View key={msg.id || `msg_${index}`} style={{ gap: 8 }}>
          <PortionConfirmCard
            introText={msg.text || ''}
            items={msg.data.items}
            locked={!!appliedPortionIds[msg.id]}
            onApplied={async (foods) => {
              setAppliedPortionIds((prev) => ({ ...prev, [msg.id]: true }));
              setPendingFoods([]);
              const meta = msg.data?.batchMeta || {};
              await processReadyFood(foods, {
                meal_group_id: newMealGroupId(),
                source_message_text: meta.source_message_text ?? null,
              });
              const wg = Number(meta.water_glasses) || 0;
              for (let w = 0; w < wg; w++) {
                await contextAddWater();
              }
            }}
          />
        </View>
      );
    }

    if (msg.type === 'brachot_advice' && msg.text) {
      const nav = BRACHOT_AFTER_NAV[msg.data?.afterBlessing];
      const db = typeof msg.data?.before === 'string' ? msg.data.before.trim() : '';
      const da = typeof msg.data?.after === 'string' ? msg.data.after.trim() : '';
      const dn = typeof msg.data?.note === 'string' ? msg.data.note.trim() : '';
      const hasLayout = Boolean(db || da || dn);
      return (
        <ChatMessage
          key={msg.id || `msg_${index}`}
          message={hasLayout ? '' : msg.text}
          brachotLayout={
            hasLayout
              ? { before: db, after: da, note: dn }
              : null
          }
          isBot={true}
          actionButton={
            nav
              ? {
                  label: nav.label,
                  onPress: () =>
                    navigation.navigate('BirkatHamazon', { initialPrayer: nav.prayer }),
                }
              : undefined
          }
        />
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
              <GrayIconChip>
                <View style={styles.menuLine} />
                <View style={styles.menuLine} />
                <View style={styles.menuLine} />
              </GrayIconChip>
            </TouchableOpacity>
          </View>
        </View>

        {showQuotaWarningBanner && (
          <View style={styles.quotaWarningBanner} accessibilityRole="text">
            <Text style={styles.quotaWarningText}>
              נותרו {quotaRemaining} הודעות AI להיום (מתוך {quotaLimit})
            </Text>
          </View>
        )}

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

        {/* Input Area + AI disclaimer under it (white strip at bottom) */}
        {!show3DModal && !showBrachotAskModal && (
          <>
            <InputBar
              inputText={inputText}
              onChangeText={setInputText}
              onSend={handleSendMessage}
              onCameraPress={
                SHOW_CHAT_CAMERA_CAPTURE_IN_UI ? showImagePicker : undefined
              }
              onWater={addWater}
              onFocus={collapseHeader}
              onDailyPlanPress={handleGenerateDailyPlan}
              onBrachotPress={handleOpenBrachot}
              on3DPress={() => setShow3DModal(true)}
              disabled={inputBarDisabled}
              disabledReason={inputBarDisabled ? inputBarReason : ''}
              isBusy={!inputBarDisabled && isTyping}
              canStop={chatGenAbortable}
              onStop={handleStopChatGeneration}
            />
            <View style={styles.aiBottomDisclaimer} accessibilityRole="text">
              <Text style={styles.aiBottomDisclaimerText}>
                תשובות וניתוחי בינה מלאכותית עלולים לטעות; אין להחליף ייעוץ מקצועי.{' '}
                <Text
                  style={styles.aiBottomDisclaimerLink}
                  onPress={() => navigation.navigate('Sources')}
                  accessibilityRole="link"
                >
                  אודות ומקורות
                </Text>
              </Text>
            </View>
          </>
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

        <BrachotAskModal
          visible={showBrachotAskModal}
          onClose={() => setShowBrachotAskModal(false)}
          onOpenFullTexts={handleOpenBirkatFromBrachotModal}
          onSubmit={handleBrachotSubmit}
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
                {SHOW_CHAT_CAMERA_CAPTURE_IN_UI ? (
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
                ) : null}

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
  quotaWarningBanner: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FEF9C3',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  quotaWarningText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#854D0E',
    textAlign: 'center',
  },
  aiBottomDisclaimer: {
    paddingHorizontal: 10,
    // אנכי אסימטרי: מעט מרווח מתחת לקלט, מעט יותר לתחתית המסך (בטוח + קריאות)
    paddingTop: 2,
    paddingBottom: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  aiBottomDisclaimerText: {
    fontSize: 8.5,
    lineHeight: 12,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  aiBottomDisclaimerLink: {
    fontSize: 8.5,
    color: '#6B7280',
    textDecorationLine: 'underline',
    fontWeight: '600',
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
  /** Same hit area as InputBar `iconBtn` (32px chip inside 38). */
  menuBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLine: {
    width: 16,
    height: 2,
    backgroundColor: '#4B5563',
    borderRadius: 1,
    marginVertical: 2,
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
