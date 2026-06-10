import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getInstalledAppVersion } from '../utils/compareAppVersion';

const LOGO_IMAGE = require('../../assets/logo.png');

export default function ForceUpdateScreen({ minVersion, storeUrl, message }) {
  const installed = getInstalledAppVersion();

  const openStore = () => {
    const url = storeUrl?.trim();
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>נדרש עדכון</Text>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.versionLine}>
        הגרסה שלך: {installed}
        {minVersion ? ` · נדרשת: ${minVersion} ומעלה` : ''}
      </Text>
      <TouchableOpacity style={styles.button} onPress={openStore} activeOpacity={0.85}>
        <Text style={styles.buttonText}>
          {Platform.OS === 'ios' ? 'עדכון ב-App Store' : 'עדכון ב-Google Play'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 240,
    height: 60,
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 16,
  },
  versionLine: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 32,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#16A34A',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    minWidth: 240,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
