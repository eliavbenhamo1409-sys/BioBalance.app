import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GRAM_SLIDER_MAX = 400;

const FoodRecognitionModal = ({ isOpen, onClose, foodData, isLoading, onConfirm }) => {
  const [grams, setGrams] = useState(150);

  useEffect(() => {
    if (foodData?.estimated_portion_grams) {
      const g = foodData.estimated_portion_grams;
      setGrams(Math.min(Math.max(g, 0), GRAM_SLIDER_MAX));
    }
  }, [foodData]);

  if (!isOpen) return null;

  const calculateNutrients = () => {
    if (!foodData) return { calories: 0, protein: 0, fat: 0 };
    const multiplier = grams / 100;
    return {
      calories: Math.round((foodData.calories_per_100g || 150) * multiplier),
      protein: Math.round((foodData.protein_per_100g || 10) * multiplier),
      fat: Math.round((foodData.fat_per_100g || 5) * multiplier),
    };
  };

  const nutrients = calculateNutrients();

  const handleConfirm = () => {
    onConfirm({
      name: foodData?.name || 'אוכל',
      grams,
      ...nutrients,
    });
  };

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        
        <View style={styles.container}>
          {/* Drag Handle */}
          <View style={styles.handle} />
          
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#16A34A" />
              <Text style={styles.loadingText}>מנתח תמונה...</Text>
            </View>
          ) : (
            <>
              {/* Image */}
              {foodData?.image_url && (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: foodData.image_url }} style={styles.image} />
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>✓ זוהה</Text>
                  </View>
                </View>
              )}

              {/* Food Name */}
              <Text style={styles.foodName}>{foodData?.name || 'אוכל'}</Text>

              {/* Nutrients */}
              <View style={styles.nutrientsRow}>
                <View style={styles.nutrientItem}>
                  <Text style={styles.nutrientValue}>{nutrients.calories}</Text>
                  <Text style={styles.nutrientLabel}>קלוריות</Text>
                </View>
                <View style={styles.nutrientDivider} />
                <View style={styles.nutrientItem}>
                  <Text style={styles.nutrientValue}>{nutrients.protein}g</Text>
                  <Text style={styles.nutrientLabel}>חלבון</Text>
                </View>
                <View style={styles.nutrientDivider} />
                <View style={styles.nutrientItem}>
                  <Text style={styles.nutrientValue}>{nutrients.fat}g</Text>
                  <Text style={styles.nutrientLabel}>שומן</Text>
                </View>
              </View>

              {/* Grams Slider */}
              <View style={styles.sliderSection}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.sliderLabel}>כמות</Text>
                  <Text style={styles.gramsValue}>{grams}g</Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={GRAM_SLIDER_MAX}
                  step={10}
                  value={grams}
                  onValueChange={setGrams}
                  minimumTrackTintColor="#16A34A"
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor="#16A34A"
                />
                <View style={styles.sliderMarkers}>
                  <Text style={styles.markerText}>0g</Text>
                  <Text style={styles.markerText}>{GRAM_SLIDER_MAX}g</Text>
                </View>
              </View>

              {/* Buttons */}
              <View style={styles.buttons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelText}>ביטול</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                  <Text style={styles.confirmText}>הוסף למאזן</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },

  // Image
  imageContainer: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#22C55E',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Food Name
  foodName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1F36',
    textAlign: 'center',
    marginBottom: 20,
  },

  // Nutrients
  nutrientsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  nutrientItem: {
    alignItems: 'center',
    flex: 1,
  },
  nutrientValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1F36',
  },
  nutrientLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  nutrientDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },

  // Slider
  sliderSection: {
    marginBottom: 24,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 15,
    color: '#6B7280',
  },
  gramsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#16A34A',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  markerText: {
    fontSize: 11,
    color: '#9CA3AF',
  },

  // Buttons
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default FoodRecognitionModal;
