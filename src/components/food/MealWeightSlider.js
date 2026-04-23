import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Dimensions,
    Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_HEIGHT = 280; // Match keyboard height

const MealWeightSlider = ({
    visible,
    onClose,
    onConfirm,
    imageUri,
}) => {
    const [grams, setGrams] = useState(250);

    // Animation values
    const translateY = useSharedValue(SLIDER_HEIGHT);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            // Reset to default
            setGrams(250);
            // Animate in
            translateY.value = withSpring(0, {
                damping: 20,
                stiffness: 120,
                mass: 0.8,
            });
            opacity.value = withTiming(1, { duration: 200 });
        } else {
            // Animate out
            translateY.value = withTiming(SLIDER_HEIGHT, {
                duration: 250,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            });
            opacity.value = withTiming(0, { duration: 200 });
        }
    }, [visible]);

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value * 0.4,
    }));

    const handleConfirm = () => {
        onConfirm(grams);
    };

    if (!visible) return null;

    return (
        <View style={styles.overlay}>
            {/* Backdrop */}
            <Animated.View style={[styles.backdrop, backdropStyle]}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    onPress={onClose}
                    activeOpacity={1}
                />
            </Animated.View>

            {/* Slider Container */}
            <Animated.View style={[styles.container, containerStyle]}>
                {/* Drag Handle */}
                <View style={styles.handle} />

                {/* Content */}
                <View style={styles.content}>
                    {/* Image Preview + Title */}
                    <View style={styles.headerRow}>
                        {imageUri && (
                            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                        )}
                        <View style={styles.titleSection}>
                            <Text style={styles.title}>כמה גרם הארוחה?</Text>
                            <Text style={styles.subtitle}>הזז את הסליידר להתאמת המשקל</Text>
                        </View>
                    </View>

                    {/* Grams Display */}
                    <View style={styles.gramsDisplay}>
                        <Text style={styles.gramsValue}>{grams}</Text>
                        <Text style={styles.gramsUnit}>גרם</Text>
                    </View>

                    {/* Slider */}
                    <View style={styles.sliderSection}>
                        <Slider
                            style={styles.slider}
                            minimumValue={50}
                            maximumValue={800}
                            step={10}
                            value={grams}
                            onValueChange={setGrams}
                            minimumTrackTintColor="#22C55E"
                            maximumTrackTintColor="#E5E7EB"
                            thumbTintColor="#16A34A"
                        />
                        <View style={styles.sliderMarkers}>
                            <Text style={styles.markerText}>50g</Text>
                            <Text style={styles.markerText}>800g</Text>
                        </View>
                    </View>

                    {/* Buttons */}
                    <View style={styles.buttons}>
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.cancelText}>ביטול</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.confirmBtn}
                            onPress={handleConfirm}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#22C55E', '#16A34A']}
                                style={styles.confirmGradient}
                            >
                                <Text style={styles.confirmText}>אישור</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        zIndex: 999,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
    },
    container: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: SLIDER_HEIGHT,
        paddingTop: 8,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
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
        marginBottom: 12,
    },
    content: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    imagePreview: {
        width: 56,
        height: 56,
        borderRadius: 12,
        marginLeft: 12,
    },
    titleSection: {
        flex: 1,
        alignItems: 'flex-end',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1F36',
        textAlign: 'right',
    },
    subtitle: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
        textAlign: 'right',
    },
    gramsDisplay: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        marginBottom: 8,
    },
    gramsValue: {
        fontSize: 48,
        fontWeight: '700',
        color: '#22C55E',
    },
    gramsUnit: {
        fontSize: 20,
        fontWeight: '500',
        color: '#6B7280',
        marginRight: 8,
    },
    sliderSection: {
        marginBottom: 16,
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
        justifyContent: 'center',
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    confirmBtn: {
        flex: 2,
        borderRadius: 12,
        overflow: 'hidden',
    },
    confirmGradient: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default MealWeightSlider;
