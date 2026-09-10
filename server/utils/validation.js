/**
 * Custom Input Validation Engine for GIV Recipes.
 */

// Helper to calculate Levenshtein distance for gibberish/spelling suggestions
function getLevenshteinDistance(a, b) {
  const tmp = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

let cachedIngredients = null;
let lastIngredientsFetch = 0;
const INGREDIENTS_CACHE_TTL = 5 * 60 * 1000;

function getAllIngredientsCached(db) {
  const now = Date.now();
  if (!cachedIngredients || (now - lastIngredientsFetch > INGREDIENTS_CACHE_TTL)) {
    cachedIngredients = db.prepare('SELECT id, name, category, subCategory FROM ingredients').all();
    lastIngredientsFetch = now;
  }
  return cachedIngredients;
}

/**
 * Validates custom generation request parameters and catches edge cases.
 * 
 * @param {string[]} ingredientIds 
 * @param {object} preferences 
 * @param {Database.Database} db SQLite instance
 * @returns {object} { isValid: boolean, statusCode: number, message: string, resolution?: string, suggestions?: any[] }
 */
export function validateCustomRecipeInput(ingredientIds = [], preferences = {}, db) {
  // Edge Case 0: Type safety — ingredientIds must be an array
  if (!Array.isArray(ingredientIds)) {
    return {
      isValid: false,
      statusCode: 400,
      message: 'ingredientIds must be an array of ingredient ID strings.'
    };
  }

  // Edge Case 1: Empty list
  if (!ingredientIds || ingredientIds.length === 0) {
    return {
      isValid: false,
      statusCode: 400,
      message: 'Please select at least one ingredient to generate a custom recipe.'
    };
  }

  // Pre-fetch ingredients mapping to assert gibberish/unknown elements (using cache)
  const allIngredients = getAllIngredientsCached(db);
  const allIds = allIngredients.map(i => i.id);
  const idMap = new Map(allIngredients.map(i => [i.id, i]));

  // Edge Case 2: Gibberish/Unknown ingredients
  const unknownIds = ingredientIds.filter(id => !idMap.has(id));
  if (unknownIds.length > 0) {
    const unknown = unknownIds[0];
    
    // Find closest phonetical spelling recommendations
    const recommendations = allIngredients
      .map(ing => ({
        id: ing.id,
        name: ing.name,
        distance: getLevenshteinDistance(unknown, ing.id)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map(r => r.name);

    return {
      isValid: false,
      statusCode: 422,
      message: `Unknown ingredient detected: "${unknown}". It is not recognized in the Global Ingredient Vault (GIV).`,
      resolution: 'Please check the spelling or choose a valid ingredient from the GIV autocomplete list.',
      suggestions: recommendations
    };
  }

  // Compile valid ingredient objects
  const validObjects = ingredientIds.map(id => idMap.get(id));

  // Edge Case 3: Single ingredient selected
  if (ingredientIds.length === 1) {
    const singleIng = validObjects[0];
    const categoryStaples = [];
    
    if (singleIng.category === 'Proteins') {
      categoryStaples.push(
        { id: 'mustard-oil', name: 'Mustard Oil', emoji: '🛢️' },
        { id: 'ghee', name: 'Ghee', emoji: '🧈' },
        { id: 'salt', name: 'Salt', emoji: '🧂' },
        { id: 'garlic', name: 'Garlic', emoji: '🧄' }
      );
    } else {
      categoryStaples.push(
        { id: 'onion-red', name: 'Red Onion', emoji: '🧅' },
        { id: 'salt', name: 'Salt', emoji: '🧂' },
        { id: 'mustard-oil', name: 'Mustard Oil', emoji: '🛢️' },
        { id: 'ghee', name: 'Ghee', emoji: '🧈' }
      );
    }

    return {
      isValid: false,
      statusCode: 400,
      message: `You selected only one ingredient (${singleIng.name}). Standard custom cooking requires at least two ingredients to establish a dynamic dish structure.`,
      resolution: `We highly suggest pairing your ${singleIng.name} with common pantry staples for the best experience.`,
      suggestions: categoryStaples
    };
  }

  // Edge Case 4: Conflicting dietary preferences
  const dietaryTags = preferences.dietary || [];
  const isVegetarian = dietaryTags.includes('vegetarian');
  const isVegan = dietaryTags.includes('vegan');
  const isDairyFree = dietaryTags.includes('dairy-free');

  if (isVegan) {
    const nonVeganIds = [
      'chicken-breast', 'chicken-thigh', 'mutton-cubes', 'lamb-chop', 
      'hilsa-fish', 'rohita-fish', 'salmon', 'cod-fish', 'squid', 
      'beef-cubes', 'beef-ground', 'beef-shank', 'pork-belly', 
      'shrimp', 'shrimp-paste', 'fish-sauce', 'oyster-sauce', 
      'paneer', 'egg', 'ghee', 'butter', 'butter-unsalted', 
      'milk', 'milk-whole', 'heavy-cream', 'yogurt-plain', 
      'parmesan-cheese', 'mozzarella-cheese', 'cheddar-cheese', 'cream-cheese', 'mayonnaise'
    ];
    const conflictingVegan = validObjects.filter(ing => 
      nonVeganIds.includes(ing.id) || (ing.category === 'Proteins' && !['lentils', 'chana-dal', 'tofu-firm', 'tofu-soft'].includes(ing.id))
    );

    if (conflictingVegan.length > 0) {
      const animalList = conflictingVegan.map(m => m.name).join(', ');
      return {
        isValid: false,
        statusCode: 422,
        message: `Dietary Conflict: You requested a Vegan recipe, but selected animal-derived or dairy ingredients: [${animalList}].`,
        resolution: 'To resolve this conflict, please either remove the "vegan" filter preference, or replace animal products with strictly plant-based GIV proteins and vegetables.'
      };
    }
  } else if (isVegetarian) {
    const nonVegIds = [
      'chicken-breast', 'chicken-thigh', 'mutton-cubes', 'lamb-chop', 
      'hilsa-fish', 'rohita-fish', 'salmon', 'cod-fish', 'squid', 
      'beef-cubes', 'beef-ground', 'beef-shank', 'pork-belly', 
      'shrimp', 'shrimp-paste', 'fish-sauce', 'oyster-sauce'
    ];
    const conflictingMeats = validObjects.filter(ing => 
      nonVegIds.includes(ing.id) || (ing.category === 'Proteins' && !['paneer', 'lentils', 'chana-dal', 'egg', 'tofu-firm', 'tofu-soft'].includes(ing.id))
    );

    if (conflictingMeats.length > 0) {
      const meatList = conflictingMeats.map(m => m.name).join(', ');
      return {
        isValid: false,
        statusCode: 422,
        message: `Dietary Conflict: You requested a Vegetarian recipe, but selected non-vegetarian ingredients: [${meatList}].`,
        resolution: 'To resolve this conflict, please either remove the "vegetarian" filter preference, or replace the meats with plant-based GIV proteins like Eggplant, Gourd, lentils, or Paneer.'
      };
    }
  }

  if (isDairyFree) {
    const dairyIds = [
      'ghee', 'paneer', 'mozzarella-cheese', 'parmesan-cheese', 'cheddar-cheese', 
      'butter-unsalted', 'butter', 'milk-whole', 'milk', 'heavy-cream', 
      'yogurt-plain', 'cream-cheese'
    ];
    const conflictingDairy = validObjects.filter(ing => dairyIds.includes(ing.id));

    if (conflictingDairy.length > 0) {
      const dairyList = conflictingDairy.map(d => d.name).join(', ');
      return {
        isValid: false,
        statusCode: 422,
        message: `Dietary Conflict: You requested a Dairy-Free recipe, but selected dairy ingredients: [${dairyList}].`,
        resolution: 'To resolve this conflict, please either disable the "Dairy-Free" filter, or replace the selected items with compatible non-dairy fats/proteins like Mustard Oil or Tofu/Vegetables.'
      };
    }
  }

  return { isValid: true };
}
