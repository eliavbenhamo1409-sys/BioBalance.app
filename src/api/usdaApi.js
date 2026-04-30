// ============================================================
// USDA FoodData Central API
// ============================================================
// Official USDA database for accurate nutritional information

const USDA_API_KEY = 'idqs90mNRifq90dmbvCNpCvVPgRNn6ZgVnsyP1c2';
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

const KJ_PER_KCAL = 4.184;

// FDC nutrient ids (common)
const NID_PROTEIN = 1003;
const NID_FAT = 1004;
const NID_CARBS_BY_DIFF = 1005;
const NID_ENERGY_KCAL = 1008;

// ============================================================
// Energy (kcal per 100g) — prefer KCAL rows; convert kJ if needed.
// ============================================================
const resolveEnergyFromNutrients = (nutrients) => {
  if (!nutrients?.length) {
    return {
      calories: 0,
      energyMode: 'missing',
      energyNutrientId: null,
      rawEnergyUnitLabel: null,
    };
  }

  const byId = (id) => nutrients.find((n) => n.nutrientId === id);

  const n1008 = byId(NID_ENERGY_KCAL);
  if (n1008 != null && Number.isFinite(Number(n1008.value))) {
    const kcal = Number(n1008.value);
    return {
      calories: Math.round(kcal),
      energyMode: 'fdc_1008',
      energyNutrientId: NID_ENERGY_KCAL,
      rawEnergyUnitLabel: String(n1008.unitName || 'KCAL'),
    };
  }

  const energyKcalRows = nutrients.filter((n) => {
    const name = (n.nutrientName || '').toLowerCase();
    const unit = (n.unitName || '').toUpperCase();
    if (!name.includes('energy')) return false;
    if (unit === 'KCAL' || unit === 'CAL') return true;
    return false;
  });

  const exactEnergy = energyKcalRows.find((n) => (n.nutrientName || '') === 'Energy');
  if (exactEnergy?.value != null) {
    const kcal = Number(exactEnergy.value);
    return {
      calories: Math.round(kcal),
      energyMode: 'energy_named_kcal',
      energyNutrientId: exactEnergy.nutrientId ?? null,
      rawEnergyUnitLabel: exactEnergy.unitName ?? null,
    };
  }

  const atwater = nutrients.find((n) => [2047, 2048].includes(n.nutrientId));
  if (atwater?.value != null) {
    const kcal = Number(atwater.value);
    return {
      calories: Math.round(kcal),
      energyMode: 'atwater',
      energyNutrientId: atwater.nutrientId ?? null,
      rawEnergyUnitLabel: atwater.unitName ?? null,
    };
  }

  if (energyKcalRows.length > 0) {
    const n = energyKcalRows[0];
    const kcal = Number(n.value);
    if (!Number.isNaN(kcal)) {
      return {
        calories: Math.round(kcal),
        energyMode: 'energy_kcal_fallback',
        energyNutrientId: n.nutrientId ?? null,
        rawEnergyUnitLabel: n.unitName ?? null,
      };
    }
  }

  const kjRow = nutrients.find((n) => {
    const name = (n.nutrientName || '').toLowerCase();
    const unit = (n.unitName || '').toUpperCase();
    return name.includes('energy') && unit === 'KJ';
  });
  if (kjRow?.value != null && Number(kjRow.value) > 0) {
    const kcalRaw = Number(kjRow.value) / KJ_PER_KCAL;
    return {
      calories: Math.round(kcalRaw),
      energyMode: 'kj_converted',
      energyNutrientId: kjRow.nutrientId ?? null,
      rawEnergyUnitLabel: `kj=${kjRow.value}`,
    };
  }

  return {
    calories: 0,
    energyMode: 'missing',
    energyNutrientId: null,
    rawEnergyUnitLabel: null,
  };
};

const findMacroGrams = (nutrients, matchers) => {
  for (const matcher of matchers) {
    const n =
      matcher.id &&
      nutrients.find((x) => x.nutrientId === matcher.id);
    if (n?.value != null) return Number(n.value);

    const byName =
      matcher.names &&
      nutrients.find((x) =>
        matcher.names.some((name) =>
          (x.nutrientName || x.name || '')
            .toLowerCase()
            .includes(name.toLowerCase())));
    if (byName?.value != null) return Number(byName.value);
  }
  return 0;
};

// ============================================================
// Rank raw USDA search hits (before parse)
// ============================================================
const rankUsdARawFoods = (rawFoods, query) => {
  if (!rawFoods?.length) return [];
  const q = String(query || '')
    .toLowerCase()
    .trim();
  const qWords = q.split(/\s+/).filter((w) => w.length > 1);

  return rawFoods.map((food, index) => {
    const desc = (food.description || food.lowercaseDescription || '').toLowerCase();
    let score = -index * 0.5;

    const penalize = [/nugget/, /salami,? cooked/i, /rose\s*-?\s*apple/i, /\bbaby food\b/];
    for (const re of penalize) {
      if (re.test(desc)) score -= 120;
    }

    const badMatch = [/denny'?s|^mcdonald/i];
    for (const re of badMatch) {
      if (re.test(desc)) score -= 40;
    }

    for (const w of qWords) {
      if (desc.includes(w)) score += 12;
      if (new RegExp(`(^|[, ])${w}\\b`).test(desc)) score += 8;
    }

    if (
      /\b(cooked|baked|boiled|fried|dry heat)\b/i.test(q) &&
      /\b(raw)\b/i.test(desc)
    ) {
      score -= 28;
    }
    if (
      /\b(raw)\b/i.test(q) &&
      /\b(cooked)\b/i.test(desc) &&
      !/\b(can|pickles)\b/i.test(desc)
    ) {
      score -= 20;
    }

    return { food, score };
  }).sort((a, b) => b.score - a.score);
};

// ============================================================
// Search for foods by name
// ============================================================
export const searchFood = async (query, pageSize = 20) => {
  try {
    const sz = pageSize == null ? 20 : Math.max(8, Math.min(25, pageSize));
    const response = await fetch(
      `${USDA_BASE_URL}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=${sz}&dataType=Foundation,SR Legacy`,
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
    const rawFoods = data.foods || [];
    const ranked = rankUsdARawFoods(rawFoods, query);
    const orderedRaw = ranked.map((r) => r.food);
    return orderedRaw.map((food) => parseSingleFood(food)).filter((f) => f !== null);
  } catch (error) {
    console.error('USDA search error:', error);
    return null;
  }
};

/**
 * Same ranking as searchFood, but each item includes matchScore from ranking.
 */
export const searchFoodWithScores = async (query, pageSize = 20) => {
  try {
    const sz = pageSize == null ? 20 : Math.max(8, Math.min(25, pageSize));
    const response = await fetch(
      `${USDA_BASE_URL}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=${sz}&dataType=Foundation,SR Legacy`,
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
    const rawFoods = data.foods || [];
    const ranked = rankUsdARawFoods(rawFoods, query);
    const out = [];
    for (const { food, score } of ranked) {
      const p = parseSingleFood(food);
      if (p) {
        const confidence =
          score <= -900 ? 0.2 : Math.min(1, Math.max(0.1, (score + 50) / 150));
        out.push({ ...p, matchScore: Math.round(score * 100) / 100, confidence });
      }
    }
    return out;
  } catch (error) {
    console.error('USDA search (scored) error:', error);
    return [];
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

// Exported for resolver tests / reuse
export const parseSingleFood = (food) => {
  if (!food) return null;

  const nutrients = food.foodNutrients || [];

  const erg = resolveEnergyFromNutrients(nutrients);

  const protein = findMacroGrams(nutrients, [
    { id: NID_PROTEIN },
    { names: ['protein'] },
  ]);

  const fat = findMacroGrams(nutrients, [
    { id: NID_FAT },
    { names: ['total lipid', 'total fat'] },
  ]);

  const carbs = findMacroGrams(nutrients, [
    { id: NID_CARBS_BY_DIFF },
    { names: ['carbohydrate', 'carbs'] },
  ]);

  let fiber =
    nutrients.find((n) =>
      /\bfiber\b/i.test(n.nutrientName || n.name || ''))?.value ??
    nutrients.find((n) => /\bdietary fiber\b/i.test(n.nutrientName || ''))
      ?.value ??
    0;

  fiber = fiber != null ? Number(fiber) : 0;

  let sugar = nutrients.find((n) => /\btotal sugars?\b/i.test(n.nutrientName || ''))?.value;
  sugar = sugar != null ? Number(sugar) : 0;

  return {
    fdcId: food.fdcId,
    name: food.description || food.lowercaseDescription || 'Unknown',
    nameHebrew: translateFoodName(food.description),
    calories: erg.calories,
    energyMode: erg.energyMode,
    energyNutrientId: erg.energyNutrientId,
    rawEnergyUnitLabel: erg.rawEnergyUnitLabel,
    protein: Math.round(protein * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
    sugar: Math.round(sugar * 10) / 10,
    servingSize: 100,
    unit: 'g',
  };
};

// ============================================================
// Translate common food names to Hebrew
// ============================================================
const translateFoodName = (englishName) => {
  if (!englishName) return '';

  const translations = {
    pasta: 'פסטה',
    rice: 'אורז',
    bread: 'לחם',
    chicken: 'עוף',
    beef: 'בקר',
    fish: 'דג',
    salmon: 'סלמון',
    tuna: 'טונה',
    egg: 'ביצה',
    eggs: 'ביצים',
    milk: 'חלב',
    cheese: 'גבינה',
    yogurt: 'יוגורט',
    apple: 'תפוח',
    banana: 'בננה',
    orange: 'תפוז',
    tomato: 'עגבנייה',
    potato: 'תפוח אדמה',
    'sweet potato': 'בטטה',
    carrot: 'גזר',
    cucumber: 'מלפפון',
    lettuce: 'חסה',
    spinach: 'תרד',
    broccoli: 'ברוקולי',
    avocado: 'אבוקדו',
    almonds: 'שקדים',
    walnuts: 'אגוזי מלך',
    peanuts: 'בוטנים',
    'peanut butter': 'חמאת בוטנים',
    'olive oil': 'שמן זית',
    butter: 'חמאה',
    sugar: 'סוכר',
    honey: 'דבש',
    oats: 'שיבולת שועל',
    quinoa: 'קינואה',
    lentils: 'עדשים',
    chickpeas: 'חומוס',
    hummus: 'חומוס',
    tahini: 'טחינה',
    'cottage cheese': "קוטג'",
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
  const results = await searchFood(foodName);

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
    fdcId: food.fdcId,
    englishDescription: food.name,
  };
};

// ============================================================
// Calculate equivalent quantity for same calories
// ============================================================
export const calculateEquivalentQuantity = async (originalFood, originalGrams, alternativeFood) => {
  const [originalList, alternativeList] = await Promise.all([
    searchFood(originalFood),
    searchFood(alternativeFood),
  ]);

  const original = originalList?.[0];
  const alternative = alternativeList?.[0];

  if (!original || !alternative) {
    return null;
  }

  const originalCalories = original.calories * (originalGrams / 100);
  const alternativeCalsPer100g = alternative.calories;

  if (alternativeCalsPer100g === 0) return null;

  const equivalentGrams = Math.round((originalCalories / alternativeCalsPer100g) * 100);

  return {
    originalFood: original.nameHebrew || original.name,
    originalGrams: originalGrams,
    originalCalories: Math.round(originalCalories),
    alternativeFood: alternative.nameHebrew || alternative.name,
    alternativeGrams: equivalentGrams,
    alternativeCalories: Math.round(originalCalories),
    alternativeProtein: Math.round(alternative.protein * (equivalentGrams / 100) * 10) / 10,
    alternativeFat: Math.round(alternative.fat * (equivalentGrams / 100) * 10) / 10,
    alternativeCarbs: Math.round(alternative.carbs * (equivalentGrams / 100) * 10) / 10,
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
  searchFoodWithScores,
  getFoodById,
  getNutritionForFood,
  calculateEquivalentQuantity,
  getEquivalentAlternatives,
  parseSingleFood,
};
