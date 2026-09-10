/**
 * Rannabanna Servings Scaler Utility
 * Handles ingredient quantity scaling, smart rounding, unit upconversion,
 * and non-linear time adjustment for the servings selector feature.
 */

// Units that indicate a non-scaling (fixed) ingredient
const NON_SCALING_UNITS = new Set([
  'to taste', 'pinch', 'for frying', 'for caramelization',
  'for garnish', 'as needed', 'split use'
]);

/**
 * Determine if an ingredient should scale with servings.
 * @param {{ unit: string, quantity: number }} ingredient
 * @returns {boolean}
 */
export function shouldScale(ingredient) {
  if (!ingredient) return false;
  const unit = (ingredient.unit || '').toLowerCase().trim();
  if (NON_SCALING_UNITS.has(unit)) return false;
  if (ingredient.quantity === 0 || ingredient.quantity == null) return false;
  return true;
}

/**
 * Scale a quantity from base servings to target servings.
 * @param {number} baseQuantity
 * @param {number} baseServings
 * @param {number} targetServings
 * @returns {number}
 */
export function scaleQuantity(baseQuantity, baseServings, targetServings) {
  if (!baseServings || baseServings <= 0) return baseQuantity;
  if (!targetServings || targetServings <= 0) return baseQuantity;
  return baseQuantity * (targetServings / baseServings);
}

/**
 * Smart-round a value based on the unit for practical cooking amounts.
 * @param {number} value
 * @param {string} unit
 * @returns {number}
 */
export function smartRound(value, unit) {
  if (value <= 0) return 0;
  const u = (unit || '').toLowerCase().trim();

  // Whole-unit items: eggs, pieces, large, unit, cloves, sprigs, steaks, slices, can
  const wholeUnits = new Set([
    'pieces', 'piece', 'large', 'medium', 'small', 'unit',
    'cloves', 'clove', 'sprigs', 'sprig', 'steaks', 'steak',
    'slices', 'slice', 'can', 'cans', 'handful'
  ]);
  if (wholeUnits.has(u)) {
    // Round to nearest 0.5 for small counts, nearest 1 for larger
    if (value <= 6) return Math.round(value * 2) / 2;
    return Math.round(value);
  }

  // Fine measurements: tsp, tbsp — round to nearest 0.25
  if (u === 'tsp' || u === 'tbsp') {
    return Math.round(value * 4) / 4;
  }

  // Weight/volume: g, ml — round to nearest 5
  if (u === 'g' || u === 'ml') {
    return Math.round(value / 5) * 5;
  }

  // kg, L — round to nearest 0.1
  if (u === 'kg' || u === 'l' || u === 'liter' || u === 'liters') {
    return Math.round(value * 10) / 10;
  }

  // Cups — round to nearest 0.25
  if (u === 'cup' || u === 'cups') {
    return Math.round(value * 4) / 4;
  }

  // Default: round to 2 decimal places
  return Math.round(value * 100) / 100;
}

/**
 * Convert units upward where sensible to avoid large small-unit counts.
 * @param {number} quantity
 * @param {string} unit
 * @returns {{ quantity: number, unit: string }}
 */
export function upconvertUnit(quantity, unit) {
  const u = (unit || '').toLowerCase().trim();

  // 3 tsp → 1 tbsp
  if (u === 'tsp' && quantity >= 3) {
    return { quantity: quantity / 3, unit: 'tbsp' };
  }

  // 16 tbsp → 1 cup
  if (u === 'tbsp' && quantity >= 12) {
    return { quantity: quantity / 16, unit: 'cup' };
  }

  // 1000g → 1 kg
  if (u === 'g' && quantity >= 1000) {
    return { quantity: quantity / 1000, unit: 'kg' };
  }

  // 1000ml → 1 L
  if (u === 'ml' && quantity >= 1000) {
    return { quantity: quantity / 1000, unit: 'L' };
  }

  // --- Down-conversions for small quantities when scaling down ---

  // ≤ 0.25 cup → tbsp (1 cup = 16 tbsp)
  if (u === 'cup' && quantity > 0 && quantity <= 0.25) {
    return { quantity: quantity * 16, unit: 'tbsp' };
  }

  // < 0.5 tbsp → tsp (1 tbsp = 3 tsp)
  if (u === 'tbsp' && quantity > 0 && quantity < 0.5) {
    return { quantity: quantity * 3, unit: 'tsp' };
  }

  // < 100g → stays g (no down-conversion needed), but convert kg → g when tiny
  if (u === 'kg' && quantity > 0 && quantity < 0.1) {
    return { quantity: quantity * 1000, unit: 'g' };
  }

  // < 100ml → stays ml, but convert L → ml when tiny
  if ((u === 'l' || u === 'liter' || u === 'liters') && quantity > 0 && quantity < 0.1) {
    return { quantity: quantity * 1000, unit: 'ml' };
  }

  return { quantity, unit };
}

/**
 * Format a quantity for display. Converts common fractions to Unicode symbols
 * and shows ranges for awkward whole-unit amounts.
 * @param {number} quantity
 * @param {string} unit
 * @returns {string}
 */
export function formatQuantity(quantity, unit) {
  if (quantity === 0) return '0';
  if (quantity == null) return '';

  const u = (unit || '').toLowerCase().trim();

  // Whole-unit items that look awkward as decimals
  const wholeUnits = new Set([
    'pieces', 'piece', 'large', 'medium', 'small', 'unit',
    'cloves', 'clove', 'sprigs', 'sprig', 'steaks', 'steak',
    'slices', 'slice', 'can', 'cans', 'handful'
  ]);

  // For whole units with a .5 fraction, show as range (e.g., "2-3")
  if (wholeUnits.has(u)) {
    if (quantity % 1 === 0.5) {
      return `${Math.floor(quantity)}-${Math.ceil(quantity)}`;
    }
    if (quantity % 1 !== 0 && quantity > 1) {
      return `${Math.floor(quantity)}-${Math.ceil(quantity)}`;
    }
    if (quantity % 1 !== 0 && quantity <= 1) {
      return '1';
    }
    return String(quantity);
  }

  // Fraction display for tsp/tbsp/cup
  const fractionMap = [
    [0.25, '¼'], [0.5, '½'], [0.75, '¾'],
    [0.33, '⅓'], [0.67, '⅔']
  ];

  const whole = Math.floor(quantity);
  const frac = Math.round((quantity - whole) * 100) / 100;

  if (frac === 0) return String(whole || quantity);

  for (const [val, symbol] of fractionMap) {
    if (Math.abs(frac - val) < 0.06) {
      return whole > 0 ? `${whole}${symbol}` : symbol;
    }
  }

  // Default decimal display
  const rounded = Math.round(quantity * 100) / 100;
  // Remove trailing zeros
  return String(parseFloat(rounded.toFixed(2)));
}

/**
 * Adjust cooking times non-linearly based on servings change.
 * Prep time scales lightly (sqrt), cook time scales minimally (log).
 * @param {number} basePrepTime - in minutes
 * @param {number} baseCookTime - in minutes
 * @param {number} baseServings
 * @param {number} targetServings
 * @returns {{ prepTime: number, cookTime: number, totalTime: number }}
 */
export function adjustTime(basePrepTime, baseCookTime, baseServings, targetServings) {
  const prep = basePrepTime || 0;
  const cook = baseCookTime || 0;

  if (!baseServings || baseServings <= 0 || !targetServings || targetServings <= 0) {
    return { prepTime: prep, cookTime: cook, totalTime: prep + cook };
  }

  const ratio = targetServings / baseServings;

  // If scaling down or equal, reduce proportionally but not below 60% of original
  // If scaling up, use diminishing returns

  let adjustedPrep, adjustedCook;

  if (ratio <= 1) {
    // Scaling down: prep reduces somewhat, cook stays mostly the same
    adjustedPrep = Math.round(prep * Math.max(0.6, Math.sqrt(ratio)));
    adjustedCook = Math.round(cook * Math.max(0.75, ratio));
  } else {
    // Scaling up: prep scales with sqrt, cook with log
    adjustedPrep = Math.round(Math.min(prep * 1.5, prep * Math.sqrt(ratio)));
    adjustedCook = Math.round(Math.min(cook * 1.3, cook * (1 + 0.15 * Math.log2(ratio))));
  }

  return {
    prepTime: adjustedPrep,
    cookTime: adjustedCook,
    totalTime: adjustedPrep + adjustedCook
  };
}

/**
 * Full pipeline: scale a single ingredient for display.
 * @param {object} ingredient - { quantity, unit, ... }
 * @param {number} baseServings
 * @param {number} targetServings
 * @returns {{ displayQuantity: string, displayUnit: string, isFixed: boolean }}
 */
export function scaleIngredient(ingredient, baseServings, targetServings) {
  if (!shouldScale(ingredient)) {
    return {
      displayQuantity: formatQuantity(ingredient.quantity, ingredient.unit),
      displayUnit: ingredient.unit,
      isFixed: true
    };
  }

  let scaled = scaleQuantity(ingredient.quantity, baseServings, targetServings);
  let unit = ingredient.unit;

  // Apply smart rounding
  scaled = smartRound(scaled, unit);

  // Apply unit upconversion
  const converted = upconvertUnit(scaled, unit);
  scaled = smartRound(converted.quantity, converted.unit);
  unit = converted.unit;

  return {
    displayQuantity: formatQuantity(scaled, unit),
    displayUnit: unit,
    isFixed: false
  };
}
