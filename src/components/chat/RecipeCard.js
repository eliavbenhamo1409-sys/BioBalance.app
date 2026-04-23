import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * RecipeCard - כרטיסיית מתכון נקייה וקריאה
 * 
 * Props:
 * - title: שם המנה
 * - ingredients: מערך של מרכיבים
 * - instructions: מערך של שלבי הכנה
 * - nutrition: אובייקט עם ערכים תזונתיים (calories, protein, fat)
 */
export default function RecipeCard({ title, ingredients = [], instructions = [], nutrition = {} }) {
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerIcon}>
                    <Ionicons name="restaurant" size={20} color="#16A34A" />
                </View>
                <Text style={styles.title}>{title || 'מתכון'}</Text>
            </View>

            {/* Ingredients */}
            {ingredients.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🥗 מצרכים</Text>
                    {ingredients.map((item, index) => (
                        <View key={index} style={styles.listItem}>
                            <View style={styles.bullet} />
                            <Text style={styles.listText}>{item}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Instructions */}
            {instructions.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>👨‍🍳 אופן הכנה</Text>
                    {instructions.map((step, index) => (
                        <View key={index} style={styles.stepItem}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>{index + 1}</Text>
                            </View>
                            <Text style={styles.stepText}>{step}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Nutrition Info */}
            {(nutrition.calories || nutrition.protein || nutrition.fat) && (
                <View style={styles.nutritionSection}>
                    <Text style={styles.nutritionTitle}>📊 ערכים תזונתיים למנה</Text>
                    <View style={styles.nutritionRow}>
                        {nutrition.calories && (
                            <View style={styles.nutritionItem}>
                                <Text style={styles.nutritionValue}>{nutrition.calories}</Text>
                                <Text style={styles.nutritionLabel}>קלוריות</Text>
                            </View>
                        )}
                        {nutrition.protein && (
                            <View style={styles.nutritionItem}>
                                <Text style={styles.nutritionValue}>{nutrition.protein}g</Text>
                                <Text style={styles.nutritionLabel}>חלבון</Text>
                            </View>
                        )}
                        {nutrition.fat && (
                            <View style={styles.nutritionItem}>
                                <Text style={styles.nutritionValue}>{nutrition.fat}g</Text>
                                <Text style={styles.nutritionLabel}>שומן</Text>
                            </View>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginVertical: 8,
        marginHorizontal: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    headerIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#DCFCE7',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    title: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
        textAlign: 'right',
    },

    // Sections
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#16A34A',
        marginBottom: 10,
        textAlign: 'right',
    },

    // Ingredients List - RTL
    listItem: {
        flexDirection: 'row-reverse',
        alignItems: 'flex-start',
        marginBottom: 6,
        paddingLeft: 4,
    },
    bullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#1F2937',
        marginTop: 7,
        marginLeft: 10,
    },
    listText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
        textAlign: 'right',
    },

    // Instructions Steps - RTL
    stepItem: {
        flexDirection: 'row-reverse',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    stepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#16A34A',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    stepNumberText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    stepText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
        lineHeight: 22,
        textAlign: 'right',
    },

    // Nutrition
    nutritionSection: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        marginTop: 8,
    },
    nutritionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 10,
        textAlign: 'right',
    },
    nutritionRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    nutritionItem: {
        alignItems: 'center',
    },
    nutritionValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#16A34A',
    },
    nutritionLabel: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 2,
    },
});
