/**
 * Rannabanna Servings Scaler Utility
 * Handles ingredient quantity scaling, smart rounding, unit upconversion,
 * non-linear time adjustment with per-recipe overrides, and cross-cutting
 * on-hand kitchen quantity satisfaction checking.
 */

// Units and descriptors that indicate a non-scaling (fixed) ingredient
export const NON_SCALING_UNITS = new Set([
  'to taste', 'pinch', 'pinches', 'for frying', 'for caramelization',
  'for garnish', 'as needed', 'split use', 'for serving', 'for dusting',
  'for greasing', 'to serve', 'optional', 'for deep frying', 'for shallow frying',
  'for pan frying', 'for brushing', 'drizzle'
]);

// Whole-unit items that should never display awkward raw decimals
export const WHOLE_UNITS = new Set([
  'pieces', 'piece', 'large', 'medium', 'small', 'unit',
  'cloves', 'clove', 'sprigs', 'sprig', 'steaks', 'steak',
  'slices', 'slice', 'can', 'cans', 'handful', 'handfuls',
  'egg', 'eggs', 'stalk', 'stalks', 'head', 'heads',
  'leaves', 'leaf', 'bay leaves', 'bay leaf', 'chilies', 'chili',
  'pods', 'pod'
]);

/**
 * Determine if an ingredient should scale with servings.
 * @param {{ unit?: string, quantity?: number, scales?: boolean, isFixed?: boolean, tier?: string, nonScaling?: boolean, preparation?: string }} ingredient
 * @returns {boolean}
 */
export function shouldScale(ingredient) {
  if (!ingredient) return false;
  if (ingredient.scales === false || ingredient.isFixed === true || ingredient.tier === 'fixed' || ingredient.nonScaling === true) {
    return false;
  }
  if (ingredient.quantity === 0 || ingredient.quantity == null) return false;

  const unit = (ingredient.unit || '').toLowerCase().trim();
  if (NON_SCALING_UNITS.has(unit)) return false;
  if (unit.includes('taste') || unit.includes('pinch') || unit.includes('as needed') || unit.includes('to serve') || unit.includes('garnish')) {
    return false;
  }

  const prep = (ingredient.preparation || '').toLowerCase().trim();
  if (prep.includes('to taste') || prep.includes('as needed')) {
    return false;
  }

  return true;
}

/**
 * Scale a quantity from base servings to target servings linearly.
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

  // Whole-unit items: eggs, pieces, cloves, etc.
  if (WHOLE_UNITS.has(u)) {
    // Round to nearest 0.5 for small counts, nearest 1 for larger counts
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
 * Convert units upward where sensible to avoid large small-unit counts,
 * and convert downward for very small quantities when scaling down.
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

  // 16 tbsp → 1 cup (or 12 tbsp -> 0.75 cup)
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

  // < 0.1 kg → g (1 kg = 1000g)
  if (u === 'kg' && quantity > 0 && quantity < 0.1) {
    return { quantity: quantity * 1000, unit: 'g' };
  }

  // < 0.1 L → ml (1 L = 1000ml)
  if ((u === 'l' || u === 'liter' || u === 'liters') && quantity > 0 && quantity < 0.1) {
    return { quantity: quantity * 1000, unit: 'ml' };
  }

  return { quantity, unit };
}

/**
 * Format a quantity for display. Converts common fractions to Unicode symbols
 * and shows ranges for non-integer whole-unit amounts (e.g. 2.33 eggs -> "2-3").
 * @param {number} quantity
 * @param {string} unit
 * @returns {string}
 */
export function formatQuantity(quantity, unit) {
  if (quantity === 0) return '0';
  if (quantity == null) return '';

  const u = (unit || '').toLowerCase().trim();

  // Whole-unit items that look awkward as raw decimals
  if (WHOLE_UNITS.has(u)) {
    if (quantity % 1 !== 0) {
      if (quantity > 1) {
        return `${Math.floor(quantity)}-${Math.ceil(quantity)}`;
      }
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

  // Default decimal display without trailing zeros
  const rounded = Math.round(quantity * 100) / 100;
  return String(parseFloat(rounded.toFixed(2)));
}

/**
 * Adjust cooking times non-linearly based on servings change.
 * Prep time scales lightly (default sqrt), cook time scales modestly past threshold (logarithmic).
 * Supports recipe-level overrides rather than hardcoded rules.
 *
 * Can be invoked as:
 *   adjustTime(basePrepTime, baseCookTime, baseServings, targetServings, overrides)
 *   OR
 *   adjustTime(recipeObject, targetServings)
 *
 * @param {number|object} basePrepOrRecipe
 * @param {number} baseCookTime
 * @param {number} baseServings
 * @param {number} targetServings
 * @param {object} [recipeOverrides]
 * @returns {{ prepTime: number, cookTime: number, totalTime: number }}
 */
export function adjustTime(basePrepOrRecipe, baseCookTime, baseServings, targetServings, recipeOverrides) {
  let prep, cook, base, target, overrides;

  if (basePrepOrRecipe && typeof basePrepOrRecipe === 'object') {
    const r = basePrepOrRecipe;
    prep = r.prepTime || 0;
    cook = r.cookTime || 0;
    base = r.baseServings || r.servings || 4;
    target = baseCookTime; // second parameter when first is recipe
    overrides = r.timeAdjustment || r.timeScaling || {};
  } else {
    prep = basePrepOrRecipe || 0;
    cook = baseCookTime || 0;
    base = baseServings || 4;
    target = targetServings;
    overrides = recipeOverrides || {};
  }

  if (!base || base <= 0 || !target || target <= 0) {
    return { prepTime: prep, cookTime: cook, totalTime: prep + cook };
  }

  // Support fully custom adjustment function on recipe
  if (typeof overrides.customAdjust === 'function') {
    return overrides.customAdjust(prep, cook, base, target);
  }

  const ratio = target / base;

  // Options and defaults
  const prepScaleFactor = overrides.prepScaleFactor !== undefined ? overrides.prepScaleFactor : 0.5; // sqrt
  const cookScaleFactor = overrides.cookScaleFactor !== undefined ? overrides.cookScaleFactor : 0.15;
  const threshold = overrides.threshold !== undefined ? overrides.threshold : 1.0;
  const maxPrepMultiplier = overrides.maxPrepMultiplier !== undefined ? overrides.maxPrepMultiplier : 1.5;
  const maxCookMultiplier = overrides.maxCookMultiplier !== undefined ? overrides.maxCookMultiplier : 1.3;
  const fixedCookTime = Boolean(overrides.fixedCookTime);
  const fixedPrepTime = Boolean(overrides.fixedPrepTime);

  let adjustedPrep = prep;
  let adjustedCook = cook;

  // 1. Prep Time Adjustment
  if (!fixedPrepTime) {
    if (ratio <= 1) {
      adjustedPrep = Math.round(prep * Math.max(0.6, Math.pow(ratio, prepScaleFactor)));
    } else {
      adjustedPrep = Math.round(Math.min(prep * maxPrepMultiplier, prep * Math.pow(ratio, prepScaleFactor)));
    }
  }

  // 2. Cook Time Adjustment (diminishing returns, modest increase past threshold)
  if (!fixedCookTime) {
    if (ratio <= 1) {
      adjustedCook = Math.round(cook * Math.max(0.75, ratio));
    } else {
      if (ratio > threshold) {
        const effectiveRatio = ratio / threshold;
        const multiplier = Math.min(maxCookMultiplier, 1 + cookScaleFactor * Math.log2(effectiveRatio));
        adjustedCook = Math.round(cook * multiplier);
      } else {
        adjustedCook = cook;
      }
    }
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

  // Apply unit upconversion or downconversion
  const converted = upconvertUnit(scaled, unit);
  scaled = smartRound(converted.quantity, converted.unit);
  unit = converted.unit;

  return {
    displayQuantity: formatQuantity(scaled, unit),
    displayUnit: unit,
    isFixed: false
  };
}

/**
 * Cross-cutting check: Determine if an on-hand quantity satisfies the scaled recipe requirement.
 * @param {object} ingredient - Recipe ingredient object
 * @param {number|null} onHandQty - User's on-hand quantity (if available)
 * @param {number} baseServings - Base servings of the recipe
 * @param {number} targetServings - Target servings
 * @returns {{ satisfied: boolean, scaledQuantity: number, onHandQuantity: number|null, missingQuantity: number, isFixed: boolean }}
 */
export function checkQuantitySatisfaction(ingredient, onHandQty, baseServings, targetServings) {
  if (!ingredient) {
    return { satisfied: false, scaledQuantity: 0, onHandQuantity: 0, missingQuantity: 0, isFixed: false };
  }

  if (!shouldScale(ingredient)) {
    const qty = ingredient.quantity || 0;
    const satisfied = onHandQty == null || onHandQty >= qty;
    return {
      satisfied,
      scaledQuantity: qty,
      onHandQuantity: onHandQty,
      missingQuantity: satisfied ? 0 : Math.max(0, qty - (onHandQty || 0)),
      isFixed: true
    };
  }

  const scaled = scaleQuantity(ingredient.quantity, baseServings, targetServings);
  const roundedScaled = smartRound(scaled, ingredient.unit);
  const satisfied = onHandQty == null || onHandQty >= roundedScaled;
  const missingQuantity = satisfied ? 0 : Math.max(0, roundedScaled - (onHandQty || 0));

  return {
    satisfied,
    scaledQuantity: roundedScaled,
    onHandQuantity: onHandQty,
    missingQuantity,
    isFixed: false
  };
}
