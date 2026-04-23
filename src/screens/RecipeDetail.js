import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

export default function RecipeDetail() {
  const navigation = useNavigation();
  const route = useRoute();
  const { recipe } = route.params;

  // Parse the recipe content into sections
  const parsedRecipe = useMemo(() => {
    if (!recipe?.content) return { ingredients: [], instructions: [], tips: [] };

    const content = recipe.content;
    const lines = content.split('\n').filter(line => line.trim());

    let ingredients = [];
    let instructions = [];
    let tips = [];
    let currentSection = 'intro';

    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      // Detect sections
      if (lowerLine.includes('מצרכים') || lowerLine.includes('חומרים')) {
        currentSection = 'ingredients';
        continue;
      }
      if (lowerLine.includes('הוראות') || lowerLine.includes('אופן הכנה') || lowerLine.includes('הכנה')) {
        currentSection = 'instructions';
        continue;
      }
      if (lowerLine.includes('טיפ') || lowerLine.includes('הערה')) {
        currentSection = 'tips';
        continue;
      }
      if (lowerLine.includes('ערכים תזונתיים')) {
        currentSection = 'nutrition';
        continue;
      }

      // Clean the line
      let cleanLine = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
      if (!cleanLine) continue;

      // Add to appropriate section
      switch (currentSection) {
        case 'ingredients':
          if (cleanLine.length > 2) ingredients.push(cleanLine);
          break;
        case 'instructions':
          if (cleanLine.length > 5) instructions.push(cleanLine);
          break;
        case 'tips':
          if (cleanLine.length > 5) tips.push(cleanLine);
          break;
      }
    }

    // If parsing failed, just show the content as instructions
    if (ingredients.length === 0 && instructions.length === 0) {
      instructions = lines.filter(l => l.trim().length > 5);
    }

    return { ingredients, instructions, tips };
  }, [recipe]);

  const shareRecipe = async () => {
    try {
      await Share.share({
        message: `${recipe.title}\n\n${recipe.content}`,
        title: recipe.title,
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with gradient */}
      <LinearGradient
        colors={['#16A34A', '#15803D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={shareRecipe} style={styles.shareBtn}>
            <Text style={styles.shareIcon}>↗</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.titleEmoji}>🍽️</Text>
          <Text style={styles.title}>{recipe.title}</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Ingredients Section */}
        {parsedRecipe.ingredients.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>🥗</Text>
              <Text style={styles.sectionTitle}>מצרכים</Text>
            </View>
            <View style={styles.ingredientsList}>
              {parsedRecipe.ingredients.map((item, index) => (
                <View key={index} style={styles.ingredientItem}>
                  <View style={styles.ingredientBullet} />
                  <Text style={styles.ingredientText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Instructions Section */}
        {parsedRecipe.instructions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>👨‍🍳</Text>
              <Text style={styles.sectionTitle}>אופן הכנה</Text>
            </View>
            <View style={styles.instructionsList}>
              {parsedRecipe.instructions.map((step, index) => (
                <View key={index} style={styles.instructionItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.instructionText}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Tips Section */}
        {parsedRecipe.tips.length > 0 && (
          <View style={styles.section}>
            <View style={styles.tipCard}>
              <Text style={styles.tipIcon}>💡</Text>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>טיפ</Text>
                {parsedRecipe.tips.map((tip, index) => (
                  <Text key={index} style={styles.tipText}>{tip}</Text>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Full Content Fallback */}
        {parsedRecipe.ingredients.length === 0 && parsedRecipe.instructions.length === 0 && (
          <View style={styles.section}>
            <Text style={styles.fullContent}>{recipe.content}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Header - Green gradient instead of dark
  headerGradient: {
    paddingTop: 10,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  titleContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  titleEmoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // Content
  content: {
    flex: 1,
    marginTop: -15,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 10,
  },
  sectionIcon: {
    fontSize: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Ingredients - Green bullets, RTL
  ingredientsList: {
    gap: 12,
  },
  ingredientItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  ingredientBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    textAlign: 'right',
    lineHeight: 24,
  },

  // Instructions - Green step numbers, RTL
  instructionsList: {
    gap: 18,
  },
  instructionItem: {
    flexDirection: 'row-reverse',
    gap: 14,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  instructionText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    textAlign: 'right',
    lineHeight: 24,
  },

  // Tips - Green themed
  tipCard: {
    flexDirection: 'row-reverse',
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  tipIcon: {
    fontSize: 24,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16A34A',
    marginBottom: 6,
    textAlign: 'right',
  },
  tipText: {
    fontSize: 14,
    color: '#166534',
    textAlign: 'right',
    lineHeight: 22,
  },

  // Full content fallback
  fullContent: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'right',
    lineHeight: 24,
  },
});

