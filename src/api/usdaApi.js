// ============================================================
// USDA FoodData Central API
// ============================================================
// Official USDA database for accurate nutritional information

const USDA_API_KEY = 'idqs90mNRifq90dmbvCNpCvVPgRNn6ZgVnsyP1c2';
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

// ============================================================
// Search for foods by name
// ============================================================
export const searchFood = async (query, pageSize = 5) => {
  try {
    const response = await fetch(
      `${USDA_BASE_URL}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=${pageSize}&dataType=Foundation,SR Legacy`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`);
    }

    const data = await response.json();
    return parseUSDAResults(data.foods || []);
  } catch (error) {
    console.error('USDA search error:', error);
    return null;
  }
};

// ============================================================
// Get specific food by FDC ID
// ============================================================
export const getFoodById = async (fdcId) => {
  try {
    const response = await fetch(
      `${USDA_BASE_URL}/food/${fdcId}?api_key=${USDA_API_KEY}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`);
    }

    const data = await response.json();
    return parseSingleFood(data);
  } catch (error) {
    console.error('USDA get food error:', error);
    return null;
  }
};

// ============================================================
// Parse USDA search results to simple format
// ============================================================
const parseUSDAResults = (foods) => {
  return foods.map(food => parseSingleFood(food)).filter(f => f !== null);
};

// ============================================================
// Parse single food item
// ============================================================
const parseSingleFood = (food) => {
  if (!food) return null;

  const nutrients = food.foodNutrients || [];
  
  // Find specific nutrients by their nutrient ID or name
  const findNutrient = (names) => {
    for (const name of names) {
      const nutrient = nutrients.find(n => 
        (n.nutrientName && n.nutrientName.toLowerCase().includes(name.toLowerCase())) ||
        (n.name && n.name.toLowerCase().includes(name.toLowerCase()))
      );
      if (nutrient) {
        return nutrient.value || nutrient.amount || 0;
      }
    }
    return 0;
  };

  const calories = findNutrient(['energy', 'calories', 'kcal']);
  const protein = findNutrient(['protein']);
  const fat = findNutrient(['total lipid', 'fat', 'total fat']);
  const carbs = findNutrient(['carbohydrate', 'carbs']);
  const fiber = findNutrient(['fiber', 'dietary fiber']);
  const sugar = findNutrient(['sugar', 'total sugars']);

  return {
    fdcId: food.fdcId,
    name: food.description || food.lowercaseDescription || 'Unknown',
    nameHebrew: translateFoodName(food.description),
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
    sugar: Math.round(sugar * 10) / 10,
    servingSize: 100, // USDA values are per 100g
    unit: 'g',
  };
};

// ============================================================
// Translate common food names to Hebrew
// ============================================================
const translateFoodName = (englishName) => {
  if (!englishName) return '';
  
  const translations = {
    'pasta': 'פסטה',
    'rice': 'אורז',
    'bread': 'לחם',
    'chicken': 'עוף',
    'beef': 'בקר',
    'fish': 'דג',
    'salmon': 'סלמון',
    'tuna': 'טונה',
    'egg': 'ביצה',
    'eggs': 'ביצים',
    'milk': 'חלב',
    'cheese': 'גבינה',
    'yogurt': 'יוגורט',
    'apple': 'תפוח',
    'banana': 'בננה',
    'orange': 'תפוז',
    'tomato': 'עגבנייה',
    'potato': 'תפוח אדמה',
    'sweet potato': 'בטטה',
    'carrot': 'גזר',
    'cucumber': 'מלפפון',
    'lettuce': 'חסה',
    'spinach': 'תרד',
    'broccoli': 'ברוקולי',
    'avocado': 'אבוקדו',
    'almonds': 'שקדים',
    'walnuts': 'אגוזי מלך',
    'peanuts': 'בוטנים',
    'peanut butter': 'חמאת בוטנים',
    'olive oil': 'שמן זית',
    'butter': 'חמאה',
    'sugar': 'סוכר',
    'honey': 'דבש',
    'oats': 'שיבולת שועל',
    'quinoa': 'קינואה',
    'lentils': 'עדשים',
    'chickpeas': 'חומוס',
    'hummus': 'חומוס',
    'tahini': 'טחינה',
    'cottage cheese': 'קוטג\'',
  };

  const lowerName = englishName.toLowerCase();
  for (const [eng, heb] of Object.entries(translations)) {
    if (lowerName.includes(eng)) {
      return heb;
    }
  }
  return englishName;
};

// ============================================================
// Get nutrition for a specific food and quantity
// ============================================================
export const getNutritionForFood = async (foodName, grams = 100) => {
  const results = await searchFood(foodName, 1);
  
  if (!results || results.length === 0) {
    return null;
  }

  const food = results[0];
  const multiplier = grams / 100;

  return {
    name: food.nameHebrew || food.name,
    grams: grams,
    calories: Math.round(food.calories * multiplier),
    protein: Math.round(food.protein * multiplier * 10) / 10,
    fat: Math.round(food.fat * multiplier * 10) / 10,
    carbs: Math.round(food.carbs * multiplier * 10) / 10,
    caloriesPer100g: food.calories,
  };
};

// ============================================================
// Calculate equivalent quantity for same calories
// ============================================================
export const calculateEquivalentQuantity = async (originalFood, originalGrams, alternativeFood) => {
  const [original, alternative] = await Promise.all([
    searchFood(originalFood, 1),
    searchFood(alternativeFood, 1),
  ]);

  if (!original?.[0] || !alternative?.[0]) {
    return null;
  }

  const originalCalories = original[0].calories * (originalGrams / 100);
  const alternativeCalsPer100g = alternative[0].calories;

  if (alternativeCalsPer100g === 0) return null;

  const equivalentGrams = Math.round((originalCalories / alternativeCalsPer100g) * 100);

  return {
    originalFood: original[0].nameHebrew || original[0].name,
    originalGrams: originalGrams,
    originalCalories: Math.round(originalCalories),
    alternativeFood: alternative[0].nameHebrew || alternative[0].name,
    alternativeGrams: equivalentGrams,
    alternativeCalories: Math.round(originalCalories), // Same calories
    alternativeProtein: Math.round(alternative[0].protein * (equivalentGrams / 100) * 10) / 10,
    alternativeFat: Math.round(alternative[0].fat * (equivalentGrams / 100) * 10) / 10,
    alternativeCarbs: Math.round(alternative[0].carbs * (equivalentGrams / 100) * 10) / 10,
  };
};

// ============================================================
// Get alternatives with equivalent calories
// ============================================================
export const getEquivalentAlternatives = async (foodName, grams, alternativeNames) => {
  const alternatives = [];

  for (const altName of alternativeNames) {
    const equiv = await calculateEquivalentQuantity(foodName, grams, altName);
    if (equiv) {
      alternatives.push(equiv);
    }
  }

  return alternatives;
};

export default {
  searchFood,
  getFoodById,
  getNutritionForFood,
  calculateEquivalentQuantity,
  getEquivalentAlternatives,
};

