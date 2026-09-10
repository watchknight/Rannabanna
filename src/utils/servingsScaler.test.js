/**
 * Unit Test Suite for Rannabanna Servings Scaler
 * Tests:
 * 1. Non-integer scaling & smart rounding (e.g. 4 -> 3 servings with eggs/pieces)
 * 2. Non-scaling ingredients ('to taste', 'pinch', 'for frying', etc.)
 * 3. Unit upconversions (16 tbsp -> 1 cup, 3 tsp -> 1 tbsp, 1000g -> 1 kg)
 * 4. Non-linear cooking time adjustments
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldScale,
  scaleQuantity,
  smartRound,
  upconvertUnit,
  formatQuantity,
  adjustTime,
  scaleIngredient,
  checkQuantitySatisfaction
} from './servingsScaler.js';

describe('Servings Scaler - shouldScale', () => {
  it('identifies scaling vs non-scaling units', () => {
    assert.equal(shouldScale({ quantity: 2, unit: 'cup' }), true);
    assert.equal(shouldScale({ quantity: 1, unit: 'to taste' }), false);
    assert.equal(shouldScale({ quantity: 1, unit: 'pinch' }), false);
    assert.equal(shouldScale({ quantity: 2, unit: 'for frying' }), false);
    assert.equal(shouldScale({ quantity: 0, unit: 'tbsp' }), false);
    assert.equal(shouldScale(null), false);
  });
});

describe('Servings Scaler - scaleQuantity & smartRound', () => {
  it('correctly scales and rounds whole unit counts for non-integer servings', () => {
    // 4 base servings -> 3 target servings (ratio 0.75) with 2 eggs (pieces)
    // 2 * 0.75 = 1.5 -> formatted as "1-2"
    const scaled = scaleIngredient({ quantity: 2, unit: 'pieces' }, 4, 3);
    assert.equal(scaled.displayQuantity, '1-2');
    assert.equal(scaled.displayUnit, 'pieces');
    assert.equal(scaled.isFixed, false);
  });

  it('keeps non-scaling ingredients fixed', () => {
    const scaled = scaleIngredient({ quantity: 1, unit: 'to taste' }, 4, 8);
    assert.equal(scaled.displayQuantity, '1');
    assert.equal(scaled.displayUnit, 'to taste');
    assert.equal(scaled.isFixed, true);
  });
});

describe('Servings Scaler - Unit Upconversion', () => {
  it('converts 16 tbsp to 1 cup', () => {
    // 2 base servings -> 8 target servings (ratio 4x) with 4 tbsp
    // 4 * 4 = 16 tbsp -> 1 cup
    const scaled = scaleIngredient({ quantity: 4, unit: 'tbsp' }, 2, 8);
    assert.equal(scaled.displayQuantity, '1');
    assert.equal(scaled.displayUnit, 'cup');
  });

  it('converts 3 tsp to 1 tbsp', () => {
    const converted = upconvertUnit(3, 'tsp');
    assert.equal(converted.quantity, 1);
    assert.equal(converted.unit, 'tbsp');
  });

  it('converts 1000g to 1 kg', () => {
    const converted = upconvertUnit(1000, 'g');
    assert.equal(converted.quantity, 1);
    assert.equal(converted.unit, 'kg');
  });

  it('converts 1000ml to 1 L', () => {
    const converted = upconvertUnit(1000, 'ml');
    assert.equal(converted.quantity, 1);
    assert.equal(converted.unit, 'L');
  });
});

describe('Servings Scaler - Time Adjustment', () => {
  it('adjusts prep and cook time non-linearly with diminishing returns', () => {
    // 4 base servings -> 8 target servings (2x servings)
    const basePrep = 20;
    const baseCook = 40;
    const times = adjustTime(basePrep, baseCook, 4, 8);

    // Prep time should scale with sqrt(2) ~ 1.414 -> 20 * 1.414 ~ 28 mins
    assert.equal(times.prepTime, 28);

    // Cook time should scale with log: 40 * (1 + 0.15 * log2(2)) = 40 * 1.15 = 46 mins
    assert.equal(times.cookTime, 46);

    // Total time is 28 + 46 = 74 mins (much less than linear 120 mins!)
    assert.equal(times.totalTime, 74);
  });

  it('handles scaling down gracefully', () => {
    const times = adjustTime(20, 40, 4, 2);
    assert.ok(times.prepTime < 20);
    assert.ok(times.cookTime <= 40);
    assert.ok(times.totalTime < 60);
  });
});

describe('Servings Scaler - Unit Down-Conversion', () => {
  it('converts small cup quantities to tbsp when scaling down', () => {
    // 0.125 cup → 2 tbsp (0.125 * 16 = 2)
    const converted = upconvertUnit(0.125, 'cup');
    assert.equal(converted.quantity, 2);
    assert.equal(converted.unit, 'tbsp');
  });

  it('converts small tbsp quantities to tsp when scaling down', () => {
    // 0.25 tbsp → 0.75 tsp (0.25 * 3 = 0.75)
    const converted = upconvertUnit(0.25, 'tbsp');
    assert.equal(converted.quantity, 0.75);
    assert.equal(converted.unit, 'tsp');
  });

  it('converts small kg quantities to g when scaling down', () => {
    // 0.05 kg → 50 g (0.05 * 1000 = 50)
    const converted = upconvertUnit(0.05, 'kg');
    assert.equal(converted.quantity, 50);
    assert.equal(converted.unit, 'g');
  });

  it('converts small L quantities to ml when scaling down', () => {
    // 0.05 L → 50 ml (0.05 * 1000 = 50)
    const converted = upconvertUnit(0.05, 'l');
    assert.equal(converted.quantity, 50);
    assert.equal(converted.unit, 'ml');
  });

  it('integrates down-conversion via scaleIngredient for a real scaling-down case', () => {
    // 1 cup scaled from 8 servings to 1 serving → 0.125 cup → 2 tbsp
    const scaled = scaleIngredient({ quantity: 1, unit: 'cup' }, 8, 1);
    assert.equal(scaled.displayUnit, 'tbsp');
    assert.equal(scaled.isFixed, false);
  });
});

describe('Servings Scaler - Recipe-Level Time Overrides', () => {
  it('respects fixedCookTime override (cook time never scales)', () => {
    // Recipe with fixedCookTime: true (e.g. baking/simmering fixed duration)
    const recipe = {
      prepTime: 20,
      cookTime: 45,
      baseServings: 4,
      timeAdjustment: { fixedCookTime: true }
    };
    const times = adjustTime(recipe, 8);
    assert.equal(times.cookTime, 45); // Cook time remains untouched!
    assert.ok(times.prepTime > 20);   // Prep time still scales lightly
  });

  it('respects custom threshold and cap overrides', () => {
    const customRecipe = {
      prepTime: 15,
      cookTime: 30,
      baseServings: 4,
      timeAdjustment: {
        threshold: 2.0, // Cook time does not start increasing until servings > 2x base
        maxCookMultiplier: 1.15
      }
    };
    // 4 -> 6 servings (ratio 1.5, below threshold 2.0)
    const timesUnderThreshold = adjustTime(customRecipe, 6);
    assert.equal(timesUnderThreshold.cookTime, 30); // Cook time unchanged under threshold!

    // 4 -> 12 servings (ratio 3.0, above threshold)
    const timesOverThreshold = adjustTime(customRecipe, 12);
    assert.ok(timesOverThreshold.cookTime > 30);
    assert.ok(timesOverThreshold.cookTime <= Math.round(30 * 1.15)); // Capped at 1.15x
  });
});

describe('Servings Scaler - Whole Unit Range & Non-Integer Formatting', () => {
  it('formats non-integer eggs and whole items as practical ranges without raw decimals', () => {
    // 3 base servings -> 7 target servings with 1 egg -> 2.33 eggs
    // Must display "2-3", never raw "2.33 eggs"
    const scaledEgg = scaleIngredient({ quantity: 1, unit: 'eggs' }, 3, 7);
    assert.equal(scaledEgg.displayQuantity, '2-3');
    assert.equal(scaledEgg.displayUnit, 'eggs');

    // 4 base servings -> 6 target servings with 1 piece (1.5) -> "1-2"
    const scaledPiece = scaleIngredient({ quantity: 1, unit: 'piece' }, 4, 6);
    assert.equal(scaledPiece.displayQuantity, '1-2');
  });

  it('recognizes explicit non-scaling flags and tiers', () => {
    const fixedByFlag = scaleIngredient({ quantity: 10, unit: 'g', scales: false }, 4, 8);
    assert.equal(fixedByFlag.isFixed, true);
    assert.equal(fixedByFlag.displayQuantity, '10');

    const fixedByTier = scaleIngredient({ quantity: 5, unit: 'g', tier: 'fixed' }, 4, 8);
    assert.equal(fixedByTier.isFixed, true);
    assert.equal(fixedByTier.displayQuantity, '5');

    const pinchOfSalt = scaleIngredient({ quantity: 1, unit: 'pinch', preparation: 'to taste' }, 4, 12);
    assert.equal(pinchOfSalt.isFixed, true);
    assert.equal(pinchOfSalt.displayQuantity, '1');
  });
});

describe('Servings Scaler - Cross-Cutting On-Hand Quantity Check', () => {
  it('satisfies requirement when on-hand quantity meets or exceeds scaled quantity', () => {
    // Recipe needs 200g chicken at 4 servings; scaled to 8 servings -> 400g
    const ing = { ingredientId: 'chicken', quantity: 200, unit: 'g' };
    const checkSufficient = checkQuantitySatisfaction(ing, 500, 4, 8);
    assert.equal(checkSufficient.satisfied, true);
    assert.equal(checkSufficient.missingQuantity, 0);
    assert.equal(checkSufficient.scaledQuantity, 400);
  });

  it('fails satisfaction and calculates shortfall when scaling up exceeds on-hand quantity', () => {
    // User only had 200g chicken (satisfied base recipe 4 servings)
    // Scaled to 8 servings -> needs 400g chicken -> shortfall is 200g
    const ing = { ingredientId: 'chicken', quantity: 200, unit: 'g' };
    const checkInsufficient = checkQuantitySatisfaction(ing, 200, 4, 8);
    assert.equal(checkInsufficient.satisfied, false);
    assert.equal(checkInsufficient.missingQuantity, 200);
    assert.equal(checkInsufficient.scaledQuantity, 400);
  });

  it('keeps non-scaling ingredients satisfied when on-hand meets base quantity', () => {
    const salt = { ingredientId: 'salt', quantity: 1, unit: 'pinch' };
    const checkSalt = checkQuantitySatisfaction(salt, 1, 4, 12);
    assert.equal(checkSalt.satisfied, true);
    assert.equal(checkSalt.isFixed, true);
    assert.equal(checkSalt.missingQuantity, 0);
  });
});

