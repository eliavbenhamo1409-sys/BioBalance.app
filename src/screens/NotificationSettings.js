// ============================================================
// Notification Settings Screen - Meal Reminders
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNotifications } from '../hooks/useNotifications';

const REMINDER_ICONS = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
};

const REMINDER_NAMES = {
  breakfast: 'ארוחת בוקר',
  lunch: 'ארוחת צהריים',
  dinner: 'ארוחת ערב',
};

export default function NotificationSettings() {
  const navigation = useNavigation();
  const {
    reminders,
    hasPermission,
    isLoading,
    requestPermission,
    toggleReminder,
    updateReminderTime,
    resetToDefaults,
    addCustomReminder,
    deleteReminder,
  } = useNotifications();

  const [showTimePicker, setShowTimePicker] = useState(null);
  const [tempTime, setTempTime] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderBody, setNewReminderBody] = useState('');

  // Format time for display
  const formatTime = (hour, minute) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // Handle time picker change
  const handleTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(null);
    }

    if (selectedTime && showTimePicker) {
      setTempTime(selectedTime);
      
      if (Platform.OS === 'android') {
        // On Android, save immediately
        const hour = selectedTime.getHours();
        const minute = selectedTime.getMinutes();
        updateReminderTime(showTimePicker, hour, minute);
      }
    }
  };

  // Confirm time selection (iOS)
  const confirmTimeSelection = () => {
    if (showTimePicker && tempTime) {
      const hour = tempTime.getHours();
      const minute = tempTime.getMinutes();
      updateReminderTime(showTimePicker, hour, minute);
    }
    setShowTimePicker(null);
  };

  // Open time picker
  const openTimePicker = (reminderId, currentHour, currentMinute) => {
    const date = new Date();
    date.setHours(currentHour, currentMinute, 0, 0);
    setTempTime(date);
    setShowTimePicker(reminderId);
  };

  // Handle permission request
  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      Alert.alert('מעולה! 🎉', 'התראות הופעלו בהצלחה. תקבל תזכורות לדווח על הארוחות שלך.');
    }
  };

  // Handle reset
  const handleReset = () => {
    Alert.alert(
      'איפוס הגדרות',
      'האם לאפס את כל התזכורות לברירת המחדל?',
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'אפס', onPress: resetToDefaults, style: 'destructive' },
      ]
    );
  };

  // Handle add custom reminder
  const handleAddReminder = async () => {
    if (!newReminderTitle.trim()) {
      Alert.alert('שגיאה', 'נא להזין כותרת לתזכורת');
      return;
    }

    const hour = tempTime.getHours();
    const minute = tempTime.getMinutes();

    await addCustomReminder({
      title: newReminderTitle.trim(),
      body: newReminderBody.trim() || 'הגיע הזמן לעדכן את הארוחה שלך',
      hour,
      minute,
    });

    // Reset form
    setShowAddModal(false);
    setNewReminderTitle('');
    setNewReminderBody('');
    setTempTime(new Date());

    Alert.alert('מעולה! ✅', 'התזכורת נוספה בהצלחה');
  };

  // Handle delete reminder
  const handleDeleteReminder = (reminderId) => {
    Alert.alert(
      'מחיקת תזכורת',
      'האם למחוק את התזכורת?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          onPress: async () => {
            const success = await deleteReminder(reminderId);
            if (success) {
              Alert.alert('נמחק! 🗑️', 'התזכורת נמחקה בהצלחה');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  // Check if reminder is custom (not default)
  const isCustomReminder = (reminderId) => {
    return reminderId.startsWith('custom_');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>טוען...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-forward" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>תזכורות ארוחות</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Permission Banner */}
        {!hasPermission && (
          <TouchableOpacity style={styles.permissionBanner} onPress={handleRequestPermission}>
            <View style={styles.permissionContent}>
              <Ionicons name="notifications-outline" size={32} color="#4CAF50" />
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>הפעל תזכורות</Text>
                <Text style={styles.permissionSubtitle}>
                  קבל תזכורות יומיות לדווח על הארוחות שלך
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-back" size={24} color="#4CAF50" />
          </TouchableOpacity>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#4CAF50" />
          <Text style={styles.infoText}>
            תזכורות יומיות יעזרו לך לזכור לדווח על הארוחות ולעקוב אחרי המאזן התזונתי שלך
          </Text>
        </View>

        {/* Reminders List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>תזכורות יומיות</Text>
            {hasPermission && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddModal(true)}
              >
                <Ionicons name="add-circle" size={28} color="#4CAF50" />
              </TouchableOpacity>
            )}
          </View>
          
          {reminders.map((reminder) => {
            const isDefault = !isCustomReminder(reminder.id);
            const displayName = isDefault ? REMINDER_NAMES[reminder.id] : reminder.title.replace(/[🌅☀️🌙⏰]/g, '').trim();
            const icon = isDefault ? REMINDER_ICONS[reminder.id] : '⏰';

            return (
              <View key={reminder.id} style={styles.reminderCard}>
                <View style={styles.reminderHeader}>
                  <View style={styles.reminderInfo}>
                    <Text style={styles.reminderIcon}>{icon}</Text>
                    <View style={styles.reminderTextContainer}>
                      <Text style={styles.reminderName}>{displayName}</Text>
                      <Text style={styles.reminderBody} numberOfLines={2}>
                        {reminder.body}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.reminderActions}>
                    {isCustomReminder(reminder.id) && (
                      <TouchableOpacity
                        onPress={() => handleDeleteReminder(reminder.id)}
                        style={styles.deleteButton}
                      >
                        <Ionicons name="trash-outline" size={20} color="#F44336" />
                      </TouchableOpacity>
                    )}
                    <Switch
                      value={reminder.enabled}
                      onValueChange={() => toggleReminder(reminder.id)}
                      trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
                      thumbColor={reminder.enabled ? '#4CAF50' : '#BDBDBD'}
                      disabled={!hasPermission}
                    />
                  </View>
                </View>
                
                {reminder.enabled && (
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => openTimePicker(reminder.id, reminder.hour, reminder.minute)}
                    disabled={!hasPermission}
                  >
                    <Ionicons name="time-outline" size={20} color="#4CAF50" />
                    <Text style={styles.timeText}>
                      {formatTime(reminder.hour, reminder.minute)}
                    </Text>
                    <Text style={styles.changeText}>שנה</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* Reset Button */}
        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <Ionicons name="refresh" size={20} color="#666" />
          <Text style={styles.resetText}>אפס לברירת מחדל</Text>
        </TouchableOpacity>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Time Picker Modal (iOS) */}
      {showTimePicker && Platform.OS === 'ios' && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => setShowTimePicker(null)}>
                <Text style={styles.pickerCancel}>ביטול</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>בחר שעה</Text>
              <TouchableOpacity onPress={confirmTimeSelection}>
                <Text style={styles.pickerDone}>אישור</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempTime}
              mode="time"
              display="spinner"
              onChange={handleTimeChange}
              locale="he"
            />
          </View>
        </View>
      )}

      {/* Android Time Picker */}
      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempTime}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}

      {/* Add Reminder Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalCancel}>ביטול</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>תזכורת חדשה</Text>
              <TouchableOpacity onPress={handleAddReminder}>
                <Text style={styles.modalSave}>שמור</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Title Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>כותרת התזכורת *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newReminderTitle}
                  onChangeText={setNewReminderTitle}
                  placeholder="לדוגמה: ארוחת עשר"
                  placeholderTextColor="#999"
                  textAlign="right"
                  maxLength={30}
                />
              </View>

              {/* Body Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>תוכן ההתראה</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={newReminderBody}
                  onChangeText={setNewReminderBody}
                  placeholder="לדוגמה: זכור לעדכן את הארוחה שלך"
                  placeholderTextColor="#999"
                  textAlign="right"
                  multiline
                  numberOfLines={3}
                  maxLength={100}
                />
              </View>

              {/* Time Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>שעת התזכורת</Text>
                <View style={styles.timeDisplayContainer}>
                  <Ionicons name="time-outline" size={24} color="#4CAF50" />
                  <Text style={styles.timeDisplay}>
                    {formatTime(tempTime.getHours(), tempTime.getMinutes())}
                  </Text>
                </View>
                <DateTimePicker
                  value={tempTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedTime) => {
                    if (selectedTime) {
                      setTempTime(selectedTime);
                    }
                  }}
                  locale="he"
                  style={styles.timePicker}
                />
              </View>

              <View style={styles.modalInfoBox}>
                <Ionicons name="information-circle" size={20} color="#4CAF50" />
                <Text style={styles.modalInfoText}>
                  התזכורת תופיע כל יום בשעה שבחרת
                </Text>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 36,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  permissionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  permissionText: {
    marginLeft: 12,
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    textAlign: 'right',
  },
  permissionSubtitle: {
    fontSize: 13,
    color: '#4CAF50',
    marginTop: 2,
    textAlign: 'right',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    textAlign: 'right',
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  addButton: {
    padding: 4,
  },
  reminderCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reminderIcon: {
    fontSize: 32,
    marginLeft: 12,
  },
  reminderTextContainer: {
    flex: 1,
  },
  reminderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  reminderBody: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    textAlign: 'right',
  },
  reminderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 4,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  timeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
    marginHorizontal: 8,
  },
  changeText: {
    fontSize: 14,
    color: '#4CAF50',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 8,
  },
  resetText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  pickerCancel: {
    fontSize: 16,
    color: '#666',
  },
  pickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalCancel: {
    fontSize: 16,
    color: '#666',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  modalContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'right',
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#333',
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  timeDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  timeDisplay: {
    fontSize: 24,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 8,
  },
  timePicker: {
    width: '100%',
  },
  modalInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  modalInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#4CAF50',
    marginLeft: 8,
    textAlign: 'right',
  },
});

