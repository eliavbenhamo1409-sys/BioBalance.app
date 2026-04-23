// ============================================================
// Notifications Hook - Daily Meal Reminders
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
const LAST_FOOD_LOG_KEY = '@biobalance_last_food_log';

// Smart notification messages
const SMART_MESSAGES = {
  noActivity: [
    { title: '👋 היי, איפה נעלמת?', body: 'לא ראיתי אותך הרבה זמן! בוא נעדכן את המאזן' },
    { title: '🤔 מה נשמע?', body: 'עבר זמן מאז שדיברנו. מה אכלת היום?' },
    { title: '💪 חוזרים למסלול?', body: 'היי! מחכה לך כאן. בוא נמשיך לעקוב יחד' },
  ],
  noFoodLog: [
    { title: '🍽️ מה אכלת היום?', body: 'שמתי לב שלא עדכנת. תעדכן אותי!' },
    { title: '📝 שכחת לעדכן?', body: 'עוד לא נרשמה ארוחה היום. ספר לי מה אכלת!' },
    { title: '🥗 עדכון קצר?', body: 'רק רוצה לוודא שאתה זוכר לעדכן. מה היה בתפריט?' },
  ],
};

export const useNotifications = () => {
  const [reminders, setReminders] = useState(DEFAULT_REMINDERS);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const notificationListener = useRef();
  const responseListener = useRef();

  // Load saved reminders on mount
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

  // Load reminders from storage
  const loadReminders = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setReminders(JSON.parse(stored));
      }
      
      // Check permission status
      const { status } = await Notifications.getPermissionsAsync();
      setHasPermission(status === 'granted');
    } catch (error) {
      console.error('Error loading reminders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save reminders to storage
  const saveReminders = async (newReminders) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newReminders));
      setReminders(newReminders);
    } catch (error) {
      console.error('Error saving reminders:', error);
    }
  };

  // Setup notification listeners
  const setupNotificationListeners = () => {
    // Listen for notifications when app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Listen for notification responses (when user taps)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      // Can navigate to specific screen based on notification data
    });
  };

  // Request permission
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
    
    // Send immediate test notification
    await sendTestNotification();
    
    // Schedule default reminders after getting permission
    await scheduleAllReminders();
    
    return true;
  };

  // Send immediate test notification
  const sendTestNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎉 התראות פעילות!',
          body: 'מעולה! התזכורות שלך מוכנות לעבודה. נתראה בארוחות! 😊',
          sound: true,
        },
        trigger: null, // null = send immediately
      });
      console.log('Test notification sent');
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  };

  // Schedule a single daily notification
  const scheduleDailyNotification = async (reminder) => {
    if (!reminder.enabled) return null;

    try {
      // Cancel existing notification with same ID
      await Notifications.cancelScheduledNotificationAsync(reminder.id).catch(() => {});

      // Daily trigger for Expo SDK 54+
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

      console.log(`Scheduled ${reminder.id} notification:`, notificationId);
      return notificationId;
    } catch (error) {
      console.error(`Error scheduling ${reminder.id}:`, error);
      return null;
    }
  };

  // Schedule all reminders
  const scheduleAllReminders = async () => {
    if (!hasPermission) {
      console.log('No permission to schedule notifications');
      return;
    }

    // Cancel all existing
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Schedule each enabled reminder
    for (const reminder of reminders) {
      if (reminder.enabled) {
        await scheduleDailyNotification(reminder);
      }
    }

    console.log('All reminders scheduled');
  };

  // Update a specific reminder
  const updateReminder = async (reminderId, updates) => {
    const newReminders = reminders.map(r => 
      r.id === reminderId ? { ...r, ...updates } : r
    );
    
    await saveReminders(newReminders);
    
    // Reschedule if time or enabled status changed
    const updatedReminder = newReminders.find(r => r.id === reminderId);
    if (updatedReminder) {
      if (updatedReminder.enabled) {
        await scheduleDailyNotification(updatedReminder);
      } else {
        await Notifications.cancelScheduledNotificationAsync(reminderId).catch(() => {});
      }
    }
  };

  // Toggle reminder on/off
  const toggleReminder = async (reminderId) => {
    const reminder = reminders.find(r => r.id === reminderId);
    if (reminder) {
      await updateReminder(reminderId, { enabled: !reminder.enabled });
    }
  };

  // Update reminder time
  const updateReminderTime = async (reminderId, hour, minute) => {
    await updateReminder(reminderId, { hour, minute });
  };

  // Reset to default reminders
  const resetToDefaults = async () => {
    await saveReminders(DEFAULT_REMINDERS);
    await scheduleAllReminders();
  };

  // Add a new custom reminder
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

  // Delete a custom reminder
  const deleteReminder = async (reminderId) => {
    // Prevent deletion of default reminders
    const defaultIds = DEFAULT_REMINDERS.map(r => r.id);
    if (defaultIds.includes(reminderId)) {
      Alert.alert('שגיאה', 'לא ניתן למחוק תזכורת ברירת מחדל. ניתן רק לבטל אותה.');
      return false;
    }

    const newReminders = reminders.filter(r => r.id !== reminderId);
    await saveReminders(newReminders);
    
    // Cancel the scheduled notification
    await Notifications.cancelScheduledNotificationAsync(reminderId).catch(() => {});
    
    return true;
  };

  // Initialize notifications for new user
  const initializeForNewUser = async () => {
    const granted = await requestPermission();
    if (granted) {
      await saveReminders(DEFAULT_REMINDERS);
      await scheduleAllReminders();
      return true;
    }
    return false;
  };

  // Get next scheduled notification time
  const getNextNotification = async () => {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    if (scheduled.length === 0) return null;

    const now = new Date();
    const today = now.getDay();
    
    // Find next notification
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
  
  // Update last activity timestamp
  const updateLastActivity = async () => {
    try {
      await AsyncStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    } catch (e) {
      console.log('Error saving last activity:', e);
    }
  };

  // Update last food log timestamp
  const updateLastFoodLog = async () => {
    try {
      await AsyncStorage.setItem(LAST_FOOD_LOG_KEY, Date.now().toString());
      await AsyncStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    } catch (e) {
      console.log('Error saving last food log:', e);
    }
  };

  // Get random message from category
  const getRandomMessage = (category) => {
    const messages = SMART_MESSAGES[category];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  // Check if should send smart notification
  const checkAndSendSmartNotification = async () => {
    try {
      const now = Date.now();
      const currentHour = new Date().getHours();
      
      // Only send between 9:00 and 21:00
      if (currentHour < 9 || currentHour > 21) {
        return null;
      }

      // Check last food log (more important)
      const lastFoodLog = await AsyncStorage.getItem(LAST_FOOD_LOG_KEY);
      if (lastFoodLog) {
        const hoursSinceFood = (now - parseInt(lastFoodLog)) / (1000 * 60 * 60);
        
        // If more than 5 hours since last food log (and it's daytime)
        if (hoursSinceFood > 5) {
          const message = getRandomMessage('noFoodLog');
          await sendSmartNotification(message.title, message.body, 'noFoodLog');
          return 'noFoodLog';
        }
      }

      // Check last activity
      const lastActivity = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
      if (lastActivity) {
        const hoursSinceActivity = (now - parseInt(lastActivity)) / (1000 * 60 * 60);
        
        // If more than 24 hours since last activity
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

  // Send smart notification
  const sendSmartNotification = async (title, body, type) => {
    try {
      // Don't send if we recently sent one (within last 3 hours)
      const lastSmartNotif = await AsyncStorage.getItem(`@last_smart_notif_${type}`);
      if (lastSmartNotif) {
        const hoursSinceLast = (Date.now() - parseInt(lastSmartNotif)) / (1000 * 60 * 60);
        if (hoursSinceLast < 3) {
          console.log('Smart notification skipped - sent recently');
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
        trigger: {
          seconds: 5, // Send in 5 seconds
        },
      });

      // Record that we sent this notification
      await AsyncStorage.setItem(`@last_smart_notif_${type}`, Date.now().toString());
      console.log('Smart notification sent:', type);
    } catch (e) {
      console.log('Error sending smart notification:', e);
    }
  };

  // Schedule periodic check for inactivity (call this on app start)
  const scheduleInactivityCheck = async () => {
    try {
      // Cancel existing inactivity check
      await Notifications.cancelScheduledNotificationAsync('inactivity_check').catch(() => {});

      // Schedule check in 6 hours
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 תזכורת',
          body: 'זמן לבדוק את המאזן היומי!',
          data: { type: 'inactivity_check' },
        },
        trigger: {
          seconds: 6 * 60 * 60, // 6 hours
        },
        identifier: 'inactivity_check',
      });
    } catch (e) {
      console.log('Error scheduling inactivity check:', e);
    }
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
  };
};

export default useNotifications;

