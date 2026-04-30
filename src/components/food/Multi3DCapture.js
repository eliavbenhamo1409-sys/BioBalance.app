import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  Platform,
  Keyboard,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const LOGO_IMAGE = require('../../../assets/logo.png');

// הוראות לכל זווית
const ANGLES = [
  { id: 1, label: 'מלמעלה', icon: 'arrow-up', instruction: 'צלם מלמעלה - מבט על' },
  { id: 2, label: 'מהצד', icon: 'arrow-forward', instruction: 'צלם מהצד - פרופיל' },
  { id: 3, label: 'קרוב', icon: 'add-circle', instruction: 'צלם תקריב - קרוב יותר' },
];

// אנימציית וי ירוק
const GreenCheckmark = ({ visible, large = false, onComplete }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSequence(
        withSpring(1.2, { damping: 10, stiffness: 200 }),
        withSpring(1, { damping: 15 }),
        withDelay(large ? 800 : 400, withTiming(0, { duration: 300 }, () => {
          if (onComplete) runOnJS(onComplete)();
        }))
      );
    } else {
      scale.value = 0;
      opacity.value = 0;
    }
  }, [visible]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.checkmarkOverlay, checkStyle]}>
      <View style={[styles.checkmarkCircle, large && styles.checkmarkCircleLarge]}>
        <Ionicons
          name="checkmark"
          size={large ? 80 : 48}
          color="#FFFFFF"
        />
      </View>
    </Animated.View>
  );
};

// Loading dots for analyzing
const LoadingDot = ({ delay }) => {
  const scale = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.5, { duration: 400 })
        ),
        -1
      )
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  return <Animated.View style={[styles.loadingDot, animStyle]} />;
};

export default function Multi3DCapture({ visible, onClose, onComplete }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState('camera'); // 'camera' | 'review'
  const [currentAngle, setCurrentAngle] = useState(0);
  const [photos, setPhotos] = useState([null, null, null]);
  const [showCheck, setShowCheck] = useState(false);
  const [showBigCheck, setShowBigCheck] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [flashMode, setFlashMode] = useState('off'); // 'off' | 'on' | 'auto'

  const cameraRef = useRef(null);

  // Toggle flash mode
  const toggleFlash = () => {
    setFlashMode(current => {
      if (current === 'off') return 'on';
      if (current === 'on') return 'auto';
      return 'off';
    });
  };

  // Get flash icon based on current mode
  const getFlashIcon = () => {
    switch (flashMode) {
      case 'on': return 'flash';
      case 'auto': return 'flash-outline';
      default: return 'flash-off';
    }
  };

  // Get flash label for display
  const getFlashLabel = () => {
    switch (flashMode) {
      case 'on': return 'פלאש: פועל';
      case 'auto': return 'פלאש: אוטו';
      default: return 'פלאש: כבוי';
    }
  };

  useEffect(() => {
    if (visible) {
      // סגור מקלדת לפני פתיחת המצלמה
      Keyboard.dismiss();
      setMode('camera');
      setCurrentAngle(0);
      setPhotos([null, null, null]);
      setShowCheck(false);
      setShowBigCheck(false);
      setIsAnalyzing(false);
      setFlashMode('off'); // איפוס הפלאש
    }
  }, [visible]);

  // בקשת הרשאות
  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible, permission]);

  const takePhoto = async () => {
    if (isCapturing || !cameraRef.current) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: true,
      });

      const newPhotos = [...photos];
      newPhotos[currentAngle] = photo;
      setPhotos(newPhotos);

      // הצג וי ירוק
      setShowCheck(true);

      setTimeout(() => {
        setShowCheck(false);

        if (currentAngle < 2) {
          // עבור לזווית הבאה
          setCurrentAngle(prev => prev + 1);
        } else {
          // סיימנו 3 תמונות - עבור ישירות לדשבורד
          setMode('review');
        }
      }, 600);

    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('שגיאה', 'נסה שוב');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleBigCheckComplete = () => {
    setShowBigCheck(false);
    setMode('review');
  };

  const handleRetakePhoto = (index) => {
    setCurrentAngle(index);
    setMode('camera');
    const newPhotos = [...photos];
    newPhotos[index] = null;
    setPhotos(newPhotos);
  };

  const handleAnalyze = async () => {
    const photosBase64 = photos.map(p => p?.base64).filter(Boolean);
    if (photosBase64.length !== 3) {
      Alert.alert('חסרות תמונות', 'צלם את כל 3 התמונות');
      return;
    }

    // הצג את מסך הטעינה
    setIsAnalyzing(true);

    try {
      // השהייה קצרה לטעינת אנימציה
      await new Promise(resolve => setTimeout(resolve, 500));

      // המתן לתשובה מהשרת (Home.js)
      if (onComplete) {
        await onComplete(photosBase64);
      }
    } catch (error) {
      console.error('Analyze error:', error);
      Alert.alert('שגיאה', 'אירעה שגיאה בניתוח התמונות');
    } finally {
      // סגור רק אחרי שיש תשובה
      setIsAnalyzing(false);
      onClose();
    }
  };

  const handleClose = () => {
    setPhotos([null, null, null]);
    setCurrentAngle(0);
    setMode('camera');
    setIsAnalyzing(false);
    onClose();
  };

  const renderContent = () => {
    // בדיקת הרשאות
    if (!permission?.granted) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color="#16A34A" />
            <Text style={styles.permissionTitle}>נדרשת הרשאה למצלמה</Text>
            <Text style={styles.permissionText}>כדי לצלם מנות בתלת-מימד</Text>
            <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
              <Text style={styles.permissionBtnText}>אשר הרשאה</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closePermBtn} onPress={handleClose}>
              <Text style={styles.closePermBtnText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    // מצב צילום - מצלמה עם הוראות
    if (mode === 'camera') {
      const currentInstructions = ANGLES[currentAngle];
      const arrowDirection = currentAngle === 0 ? 'up' : currentAngle === 1 ? 'side' : 'zoom';

      // אייקון להוראות
      const getDirectionIcon = () => {
        switch (arrowDirection) {
          case 'up': return 'eye-outline';
          case 'side': return 'swap-horizontal-outline';
          default: return 'expand-outline';
        }
      };

      return (
        <View style={styles.cameraContainer}>
          {/* כותרת ירוקה בודדת */}
          <View style={styles.featureHeader}>
            <Text style={styles.featureHeaderBrandText}>
              צלם 3 תמונות להערכת משקל חכמה
            </Text>
          </View>

          {/* מסגרת ירוקה סביב המצלמה - גובה קבוע 43% */}
          <View style={[styles.cameraBorderWrapper, { height: SCREEN_HEIGHT * 0.43 }]}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
              flash={flashMode}
            >
              {/* Header - מונה, פלאש ולחצן סגירה - בתוך המצלמה */}
              <SafeAreaView style={styles.cameraHeader}>
                <TouchableOpacity style={styles.cameraCloseBtn} onPress={handleClose}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                {/* כפתור פלאש */}
                <TouchableOpacity style={styles.flashBtn} onPress={toggleFlash}>
                  <Ionicons name={getFlashIcon()} size={22} color={flashMode === 'off' ? '#FFFFFF' : '#FFD700'} />
                  <Text style={[styles.flashText, flashMode !== 'off' && styles.flashTextActive]}>
                    {flashMode === 'off' ? 'כבוי' : flashMode === 'on' ? 'פועל' : 'אוטו'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.counterContainer}>
                  <Text style={styles.counterText}>{currentAngle + 1}/3</Text>
                </View>
              </SafeAreaView>

              {/* אזור ריק - לראות את המנה */}
              <View style={styles.cameraViewArea} />

              {/* תחתית - הוראות מודגשות - עיצוב יוקרתי */}
              <View style={styles.cameraBottom}>
                {/* בועת הוראות מרחפת */}
                <View style={styles.instructionBubble}>
                  <View style={styles.instructionIconCircle}>
                    <Ionicons name={getDirectionIcon()} size={18} color="#FFFFFF" />
                  </View>
                  <Text style={styles.instructionText}>{currentInstructions.instruction}</Text>
                </View>

                {/* מיני תמונות + כפתור צילום */}
                <View style={styles.captureRow}>
                  {/* ... contents ... */}
                  {/* I need to preserve the capture row contents. 
                      I will reuse the existing structure below the instruction bubble replacement.
                      Wait, replace_file_content replaces the whole block I select.
                      I need to be careful not to delete the captureRow contents if I don't copy them.
                  */}
                  <View style={styles.miniPhotosRow}>
                    {[0, 1, 2].map(index => (
                      <View
                        key={index}
                        style={[
                          styles.miniPhotoBox,
                          currentAngle === index && styles.miniPhotoBoxActive,
                          photos[index] && styles.miniPhotoBoxDone
                        ]}
                      >
                        {photos[index] ? (
                          <>
                            <Image source={{ uri: photos[index].uri }} style={styles.miniPhotoImage} />
                            <View style={styles.miniPhotoCheck}>
                              <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                            </View>
                          </>
                        ) : (
                          <Text style={styles.miniPhotoNum}>{index + 1}</Text>
                        )}
                      </View>
                    ))}
                  </View>

                  {/* כפתור צילום */}
                  <TouchableOpacity
                    style={styles.captureBtn}
                    onPress={takePhoto}
                    disabled={isCapturing}
                    activeOpacity={0.8}
                  >
                    <View style={styles.captureBtnInner} />
                  </TouchableOpacity>

                  {/* Placeholder לאיזון */}
                  <View style={styles.miniPhotosRow} />
                </View>
              </View>

              {/* וי ירוק קטן */}
              <GreenCheckmark visible={showCheck} />
            </CameraView>
          </View>
        </View>
      );
    }

    // מצב דשבורד - סקירת תמונות
    return (
      <SafeAreaView style={styles.reviewContainer}>
        {/* Header */}
        <View style={styles.reviewHeader}>
          <TouchableOpacity style={styles.reviewCloseBtn} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <View style={styles.reviewTitleRow}>
            <View style={styles.reviewIconBox}>
              <Ionicons name="cube-outline" size={20} color="#16A34A" />
            </View>
            <Text style={styles.reviewTitle}>אישור תמונות</Text>
          </View>
          <View style={styles.placeholderBtn} />
        </View>

        {/* תמונות */}
        <View style={styles.reviewContent}>
          <Text style={styles.reviewSubtitle}>3 זוויות מוכנות לניתוח</Text>

          <View style={styles.reviewPhotosGrid}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.reviewPhotoCard}>
                <Image source={{ uri: photo?.uri }} style={styles.reviewPhotoImage} />
                <View style={styles.reviewPhotoLabel}>
                  <View style={styles.reviewPhotoCheck}>
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                  <Text style={styles.reviewPhotoText}>{ANGLES[index].label}</Text>
                </View>
                <TouchableOpacity
                  style={styles.retakeBtn}
                  onPress={() => handleRetakePhoto(index)}
                >
                  <Ionicons name="refresh" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* כפתור ניתוח */}
        <View style={styles.reviewBottom}>
          <TouchableOpacity
            style={styles.analyzeBtn}
            onPress={handleAnalyze}
            activeOpacity={0.9}
          >
            <Ionicons name="analytics" size={22} color="#FFFFFF" style={{ marginLeft: 8 }} />
            <Text style={styles.analyzeBtnText}>נתח משקל עכשיו</Text>
          </TouchableOpacity>
        </View>

        {/* Analyzing modal */}
        {isAnalyzing && (
          <View style={styles.analyzingOverlay}>
            <View style={styles.analyzingCard}>
              <Image source={LOGO_IMAGE} style={styles.analyzingLogo} resizeMode="contain" />
              <Text style={styles.analyzingTitle}>מנתח נפח...</Text>
              <View style={styles.loadingDots}>
                <LoadingDot delay={0} />
                <LoadingDot delay={150} />
                <LoadingDot delay={300} />
              </View>
              <Text style={styles.analyzingSubtitle}>מעריך משקל מ-3 זוויות</Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.backdrop} onPress={handleClose} activeOpacity={1} />
        <View style={styles.bottomSheetContent}>
          {renderContent()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  bottomSheetContent: {
    // גובה מינימלי קבוע כדי שהמודל יהיה תמיד גלוי
    minHeight: SCREEN_HEIGHT * 0.50, // גובה מינימלי 50%
    width: '100%',
    backgroundColor: '#FFFFFF', // חזרה ללבן (הדר תחתון יכסה)
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    paddingBottom: 0, // ביטול ריפוד חיצוני כדי שהמצלמה תגיע לקצה
  },

  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Feature Header
  featureHeader: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureHeaderBrandText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#16A34A',
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  // ... (Permission styles skipped for brevity if unchanged, but need to be careful with matching)
  // I will skip to the styles I need to change if possible, or include enough context.
  // Since I blocked 'bottomSheetContent' and 'cameraBottom' is far down, I should do two chunks or one big one? 
  // 'cameraBottom' is around line 580 (in original file, lines shifted).
  // I will assume I can't reach cameraBottom in this chunk easily without huge context.
  // I will do TWO replacements.
  // This first one fixes bottomSheetContent.



  // Permission screen inside modal
  permissionContainer: {
    height: SCREEN_HEIGHT * 0.43, // גובה קבוע כדי שלא יקרוס
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 24,
  },
  permissionBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  permissionBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closePermBtn: {
    padding: 12,
  },
  closePermBtnText: {
    fontSize: 15,
    color: '#6B7280',
  },

  // Camera mode
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraBorderWrapper: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#16A34A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 36 : 0,
    paddingBottom: 12,
  },
  cameraCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  flashText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  flashTextActive: {
    color: '#FFD700',
  },
  explanationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  explanationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  counterContainer: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  counterText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Camera view area - for full visibility
  cameraViewArea: {
    flex: 1,
  },

  // Camera bottom - minimal design
  cameraBottom: {
    paddingBottom: Platform.OS === 'ios' ? 46 : 24, // הוספת Safe Area פנימי לכפתורים
    paddingHorizontal: 16,
    gap: 12,
  },
  // Enhanced Instruction Bubble - Minimal Black Transparent
  instructionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', // שחור שקוף ועדין
    paddingHorizontal: 16, // הקטנתי ריפוד
    paddingVertical: 8,    // הקטנתי גובה
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', // מסגרת דקה מאוד
  },
  instructionIconCircle: {
    // הסרתי את העיגול הצבעוני, רק אייקון נקי
    width: 'auto',
    height: 'auto',
    backgroundColor: 'transparent',
  },
  instructionText: {
    fontSize: 14, // הקטנתי פונט
    fontWeight: '600',
    color: '#FFFFFF', // טקסט לבן
    letterSpacing: 0.2,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniPhotosRow: {
    flexDirection: 'row',
    gap: 8,
    width: 110,
  },
  miniPhotoBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  miniPhotoBoxActive: {
    borderColor: '#16A34A',
    backgroundColor: 'rgba(22,163,74,0.2)',
  },
  miniPhotoBoxDone: {
    borderColor: '#16A34A',
  },
  miniPhotoImage: {
    width: '100%',
    height: '100%',
  },
  miniPhotoCheck: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniPhotoNum: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  captureBtnInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#16A34A',
  },


  // Checkmark overlay
  checkmarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  checkmarkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  checkmarkCircleLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },

  // Review mode
  reviewContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  reviewCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  reviewContent: {
    flex: 1,
    padding: 20,
  },
  reviewSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  reviewPhotosGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  reviewPhotoCard: {
    flex: 1,
    aspectRatio: 0.75,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  reviewPhotoImage: {
    width: '100%',
    height: '100%',
  },
  reviewPhotoLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  reviewPhotoCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewPhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  retakeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewBottom: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  analyzeBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  analyzeBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Analyzing overlay
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    width: SCREEN_WIDTH - 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  analyzingLogo: {
    width: 140,
    height: 42,
    marginBottom: 20,
  },
  analyzingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 20,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  loadingDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#16A34A',
  },
  analyzingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
});
