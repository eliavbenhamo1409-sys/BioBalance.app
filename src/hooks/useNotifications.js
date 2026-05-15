// ============================================================
// Notifications Hook - Daily Meal Reminders + Weekly Check-in
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Default reminder times
const DEFAULT_REMINDERS = [
  {
    id: 'breakfast',
    title: '🌅 בוקר טוב!',
    body: 'מה אכלת לארוחת בוקר? ספר לי ואעדכן את המאזן שלך',
    hour: 9,
    minute: 0,
    enabled: true,
  },
  {
    id: 'lunch',
    title: '☀️ צהריים טובים!',
    body: 'הגיע הזמן לעדכן את ארוחת הצהריים. מה היה בתפריט?',
    hour: 13,
    minute: 30,
    enabled: true,
  },
  {
    id: 'dinner',
    title: '🌙 ערב טוב!',
    body: 'איך עבר היום? עדכן אותי מה אכלת לארוחת ערב',
    hour: 19,
    minute: 30,
    enabled: true,
  },
];

const STORAGE_KEY = '@biobalance_reminders';
const LAST_ACTIVITY_KEY = '@biobalance_last_activity';
export const LAST_FOOD_LOG_KEY = '@biobalance_last_food_log';
const LAST_WEEKLY_CHECKIN_PING_KEY = '@biobalance_last_weekly_checkin_ping';

// ------------------------------------------------------------
// INACTIVITY NUDGE TUNING
// ------------------------------------------------------------
const INACTIVITY_HOURS = 3.5;
const INACTIVITY_SECONDS = Math.round(INACTIVITY_HOURS * 60 * 60);
const QUIET_START_HOUR = 9;
const QUIET_END_HOUR   = 22;
const INACTIVITY_ID = 'inactivity_3h5';

// ------------------------------------------------------------
// WEEKLY CHECK-IN
// ------------------------------------------------------------
// Once-a-week nudge so the user reacts to their AI summary.
// Defaults: Sunday 20:00 local time. We refuse to fire more than
// once every 6 days.
const WEEKLY_CHECKIN_ID = 'weekly_checkin_v1';
const WEEKLY_CHECKIN_DOW = 0; // 0 = Sunday
const WEEKLY_CHECKIN_HOUR = 20;
const WEEKLY_CHECKIN_MIN_DAYS_BETWEEN = 6;

const triggerAfterSeconds = (seconds) => ({
  type: 'timeInterval',
  seconds,
});

// ------------------------------------------------------------
// SMART MESSAGE POOL
// ------------------------------------------------------------
const SMART_MESSAGES = {
  noActivity: [
    { title: '👋 היי, איפה נעלמת?',     body: 'לא ראיתי אותך הרבה זמן — בוא נעדכן יחד את המאזן' },
    { title: '🤔 מה נשמע?',              body: 'עבר זמן מאז שדיברנו. מה אכלת היום?' },
    { title: '💪 חוזרים למסלול?',         body: 'אני פה, ברגע שאתה רוצה — נמשיך לעקוב יחד' },
  ],
  noFoodLog: [
    { title: '💚 אני כאן בשבילך',         body: 'אני כאן כדי לעזור לך להקפיד על הארוחות. תזין לי מה אכלת ונמשיך' },
    { title: '✨ נשלים יחד',              body: 'לא ראיתי הזנה מזה זמן — בוא נשלים יחד, אפילו ארוחה קטנה עוזרת' },
    { title: '🍽️ זה הזמן לאכול',          body: 'אפילו נשנוש קטן מקדם אותך ליעד. מה תרצה לאכול עכשיו?' },
    { title: '🌱 תזכורת חברית',          body: 'הגוף עובד טוב כשמזינים אותו. עדכן אותי מה היה בתפריט?' },
    { title: '🤝 שקט בצ׳אט',             body: 'אני איתך — עדכן אותי מה אכלת ונחזור למסלול' },
    { title: '💬 רק רגע אחד',             body: 'תהיה כן עם עצמך — מה אכלת ב-3 השעות האחרונות?' },
    { title: '🎯 ביחד לוקחים את זה',      body: 'הצעדים הקטנים הם שמנצחים. תזין ארוחה קטנה ונמשיך מכאן' },
  ],
  weekly: [
    { title: '🧭 סיכום שבועי קצר',       body: 'יש לי סיכום של השבוע — דקה ותגיד אם הוא מדויק' },
    { title: '✨ איך עבר השבוע?',         body: 'הכנתי דוח שבועי. בוא נראה יחד וקבל פידבק לשבוע הבא' },
    { title: '📊 דוח שבועי מחכה',        body: 'מספרים, מגמות ותובנות מהשבוע — דקה מהיום שלך' },
  ],
};

export const useNotifications = () => {
  const [reminders, setReminders] = useState(DEFAULT_REMINDERS);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    loadReminders();
    setupNotificationListeners();

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const loadReminders = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setReminders(JSON.parse(stored));
      }
      const { status } = await Notifications.getPermissionsAsync();
      setHasPermission(status === 'granted');
    } catch (error) {
      console.error('Error loading reminders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveReminders = async (newReminders) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newReminders));
      setReminders(newReminders);
    } catch (error) {
      console.error('Error saving reminders:', error);
    }
  };

  const setupNotificationListeners = () => {
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      if (__DEV__) console.log('Notification received:', notification?.request?.content?.title);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      if (__DEV__) console.log('Notification response:', response?.notification?.request?.content?.data);
    });
  };

  const requestPermission = async () => {
    if (!Device.isDevice) {
      Alert.alert('שים לב', 'התראות עובדות רק על מכשיר אמיתי, לא בסימולטור');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert(
        'הרשאת התראות',
        'כדי לקבל תזכורות לארוחות, יש לאשר התראות בהגדרות המכשיר',
        [{ text: 'הבנתי', style: 'default' }]
      );
      setHasPermission(false);
      return false;
    }

    setHasPermission(true);
    await sendTestNotification();
    await scheduleAllReminders();
    await scheduleWeeklyCheckin();
    return true;
  };

  const sendTestNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎉 התראות פעילות!',
          body: 'מעולה! התזכורות שלך מוכנות לעבודה. נתראה בארוחות! 😊',
          sound: true,
        },
        trigger: triggerAfterSeconds(1),
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  };

  const scheduleDailyNotification = async (reminder) => {
    if (!reminder.enabled) return null;

    try {
      await Notifications.cancelScheduledNotificationAsync(reminder.id).catch(() => {});

      const trigger = {
        type: 'daily',
        hour: reminder.hour,
        minute: reminder.minute,
      };

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: reminder.body,
          data: { reminderId: reminder.id },
          sound: true,
        },
        trigger,
      });

      return notificationId;
    } catch (error) {
      console.error(`Error scheduling ${reminder.id}:`, error);
      return null;
    }
  };

  const scheduleAllReminders = async () => {
    if (!hasPermission) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const reminder of reminders) {
      if (reminder.enabled) {
        await scheduleDailyNotification(reminder);
      }
    }
    // Always (re-)arm weekly check-in after wiping schedule.
    await scheduleWeeklyCheckin();
  };

  const updateReminder = async (reminderId, updates) => {
    const newReminders = reminders.map(r =>
      r.id === reminderId ? { ...r, ...updates } : r
    );
    await saveReminders(newReminders);
    const updatedReminder = newReminders.find(r => r.id === reminderId);
    if (updatedReminder) {
      if (updatedReminder.enabled) {
        await scheduleDailyNotification(updatedReminder);
      } else {
        await Notifications.cancelScheduledNotificationAsync(reminderId).catch(() => {});
      }
    }
  };

  const toggleReminder = async (reminderId) => {
    const reminder = reminders.find(r => r.id === reminderId);
    if (reminder) {
      await updateReminder(reminderId, { enabled: !reminder.enabled });
    }
  };

  const updateReminderTime = async (reminderId, hour, minute) => {
    await updateReminder(reminderId, { hour, minute });
  };

  const resetToDefaults = async () => {
    await saveReminders(DEFAULT_REMINDERS);
    await scheduleAllReminders();
  };

  const addCustomReminder = async (reminder) => {
    const newReminder = {
      id: `custom_${Date.now()}`,
      title: reminder.title || '⏰ תזכורת',
      body: reminder.body || 'הגיע הזמן לעדכן את הארוחה שלך',
      hour: reminder.hour,
      minute: reminder.minute,
      enabled: true,
    };

    const newReminders = [...reminders, newReminder];
    await saveReminders(newReminders);

    if (hasPermission) {
      await scheduleDailyNotification(newReminder);
    }

    return newReminder;
  };

  const deleteReminder = async (reminderId) => {
    const defaultIds = DEFAULT_REMINDERS.map(r => r.id);
    if (defaultIds.includes(reminderId)) {
      Alert.alert('שגיאה', 'לא ניתן למחוק תזכורת ברירת מחדל. ניתן רק לבטל אותה.');
      return false;
    }

    const newReminders = reminders.filter(r => r.id !== reminderId);
    await saveReminders(newReminders);
    await Notifications.cancelScheduledNotificationAsync(reminderId).catch(() => {});
    return true;
  };

  const initializeForNewUser = async () => {
    const granted = await requestPermission();
    if (granted) {
      await saveReminders(DEFAULT_REMINDERS);
      await scheduleAllReminders();
      const ts = Date.now().toString();
      await AsyncStorage.setItem(LAST_FOOD_LOG_KEY, ts).catch(() => {});
      await AsyncStorage.setItem(LAST_ACTIVITY_KEY, ts).catch(() => {});
      await scheduleInactivityCheck();
      await scheduleWeeklyCheckin();
      return true;
    }
    return false;
  };

  const getNextNotification = async () => {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    if (scheduled.length === 0) return null;

    const now = new Date();
    let nextTime = null;
    for (const notification of scheduled) {
      const trigger = notification.trigger;
      if (trigger.hour !== undefined) {
        const notificationTime = new Date();
        notificationTime.setHours(trigger.hour, trigger.minute, 0, 0);
        if (notificationTime < now) {
          notificationTime.setDate(notificationTime.getDate() + 1);
        }
        if (!nextTime || notificationTime < nextTime) {
          nextTime = notificationTime;
        }
      }
    }

    return nextTime;
  };

  // ============================================================
  // SMART NOTIFICATIONS - Track activity and send reminders
  // ============================================================

  const updateLastActivity = async () => {
    try {
      await AsyncStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    } catch (e) {
      console.log('Error saving last activity:', e);
    }
  };

  const updateLastFoodLog = async () => {
    try {
      const ts = Date.now().toString();
      await AsyncStorage.setItem(LAST_FOOD_LOG_KEY, ts);
      await AsyncStorage.setItem(LAST_ACTIVITY_KEY, ts);
      await scheduleInactivityCheck();
    } catch (e) {
      console.log('Error saving last food log:', e);
    }
  };

  const getRandomMessage = (category) => {
    const messages = SMART_MESSAGES[category];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const checkAndSendSmartNotification = async () => {
    try {
      const now = Date.now();
      const currentHour = new Date().getHours();

      if (currentHour < QUIET_START_HOUR || currentHour >= QUIET_END_HOUR) {
        return null;
      }

      const lastFoodLog = await AsyncStorage.getItem(LAST_FOOD_LOG_KEY);
      if (lastFoodLog) {
        const hoursSinceFood = (now - parseInt(lastFoodLog, 10)) / (1000 * 60 * 60);
        if (hoursSinceFood >= INACTIVITY_HOURS) {
          const message = getRandomMessage('noFoodLog');
          await sendSmartNotification(message.title, message.body, 'noFoodLog');
          return 'noFoodLog';
        }
      }

      const lastActivity = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
      if (lastActivity) {
        const hoursSinceActivity = (now - parseInt(lastActivity, 10)) / (1000 * 60 * 60);
        if (hoursSinceActivity > 24) {
          const message = getRandomMessage('noActivity');
          await sendSmartNotification(message.title, message.body, 'noActivity');
          return 'noActivity';
        }
      }

      return null;
    } catch (e) {
      console.log('Error checking smart notification:', e);
      return null;
    }
  };

  const sendSmartNotification = async (title, body, type) => {
    try {
      const lastSmartNotif = await AsyncStorage.getItem(`@last_smart_notif_${type}`);
      if (lastSmartNotif) {
        const hoursSinceLast = (Date.now() - parseInt(lastSmartNotif)) / (1000 * 60 * 60);
        if (hoursSinceLast < 3) {
          if (__DEV__) console.log('Smart notification skipped - sent recently');
          return;
        }
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: 'smart', category: type },
          sound: true,
        },
        trigger: triggerAfterSeconds(5),
      });

      await AsyncStorage.setItem(`@last_smart_notif_${type}`, Date.now().toString());
    } catch (e) {
      console.log('Error sending smart notification:', e);
    }
  };

  const scheduleInactivityCheck = async () => {
    try {
      await Notifications.cancelScheduledNotificationAsync(INACTIVITY_ID).catch(() => {});
      await Notifications.cancelScheduledNotificationAsync('inactivity_check').catch(() => {});

      const now = new Date();
      const fireDate = new Date(now.getTime() + INACTIVITY_SECONDS * 1000);

      const fireHour = fireDate.getHours();
      if (fireHour < QUIET_START_HOUR) {
        fireDate.setHours(QUIET_START_HOUR, 0, 0, 0);
      } else if (fireHour >= QUIET_END_HOUR) {
        fireDate.setDate(fireDate.getDate() + 1);
        fireDate.setHours(QUIET_START_HOUR, 0, 0, 0);
      }

      const secondsUntilFire = Math.max(60, Math.round((fireDate.getTime() - now.getTime()) / 1000));
      const message = getRandomMessage('noFoodLog');

      await Notifications.scheduleNotificationAsync({
        content: {
          title: message.title,
          body: message.body,
          data: { type: 'inactivity_3h5' },
          sound: true,
        },
        trigger: triggerAfterSeconds(secondsUntilFire),
        identifier: INACTIVITY_ID,
      });
    } catch (e) {
      console.log('Error scheduling inactivity check:', e);
    }
  };

  // ============================================================
  // WEEKLY CHECK-IN
  // ============================================================
  //
  // Schedules a single notification at the NEXT occurrence of
  // Sunday WEEKLY_CHECKIN_HOUR:00 (skipping this week if we already
  // pinged within MIN_DAYS_BETWEEN). The notification carries
  // `{ type: 'weekly_checkin' }` so the app can open the Insights
  // tab with `openCheckin: true`.
  const scheduleWeeklyCheckin = async () => {
    try {
      await Notifications.cancelScheduledNotificationAsync(WEEKLY_CHECKIN_ID).catch(() => {});

      const lastPing = await AsyncStorage.getItem(LAST_WEEKLY_CHECKIN_PING_KEY);
      const now = new Date();
      let earliestMs = now.getTime();
      if (lastPing) {
        const since = (now.getTime() - parseInt(lastPing, 10)) / (1000 * 60 * 60 * 24);
        if (since < WEEKLY_CHECKIN_MIN_DAYS_BETWEEN) {
          const skipUntil = parseInt(lastPing, 10) + WEEKLY_CHECKIN_MIN_DAYS_BETWEEN * 24 * 60 * 60 * 1000;
          earliestMs = skipUntil;
        }
      }

      // Find the next Sunday at WEEKLY_CHECKIN_HOUR from earliestMs.
      const fireDate = new Date(earliestMs);
      fireDate.setSeconds(0);
      fireDate.setMilliseconds(0);
      fireDate.setMinutes(0);
      fireDate.setHours(WEEKLY_CHECKIN_HOUR);
      while (fireDate.getDay() !== WEEKLY_CHECKIN_DOW || fireDate.getTime() <= now.getTime()) {
        fireDate.setDate(fireDate.getDate() + 1);
      }

      const secondsUntilFire = Math.max(60, Math.round((fireDate.getTime() - now.getTime()) / 1000));
      const msg = getRandomMessage('weekly');

      await Notifications.scheduleNotificationAsync({
        content: {
          title: msg.title,
          body: msg.body,
          data: { type: 'weekly_checkin' },
          sound: true,
        },
        trigger: triggerAfterSeconds(secondsUntilFire),
        identifier: WEEKLY_CHECKIN_ID,
      });

      if (__DEV__) {
        console.log(`[Notifications] Weekly check-in scheduled for ${fireDate.toLocaleString()}`);
      }
    } catch (e) {
      if (__DEV__) console.log('Error scheduling weekly check-in:', e?.message);
    }
  };

  /** Record that the user actually saw a check-in (for spacing). */
  const markWeeklyCheckinShown = async () => {
    try {
      await AsyncStorage.setItem(LAST_WEEKLY_CHECKIN_PING_KEY, Date.now().toString());
      await scheduleWeeklyCheckin();
    } catch (_) {}
  };

  return {
    reminders,
    hasPermission,
    isLoading,
    requestPermission,
    toggleReminder,
    updateReminderTime,
    resetToDefaults,
    addCustomReminder,
    deleteReminder,
    initializeForNewUser,
    scheduleAllReminders,
    getNextNotification,
    sendTestNotification,
    // Smart notifications
    updateLastActivity,
    updateLastFoodLog,
    checkAndSendSmartNotification,
    scheduleInactivityCheck,
    // Weekly check-in
    scheduleWeeklyCheckin,
    markWeeklyCheckinShown,
  };
};

export default useNotifications;
