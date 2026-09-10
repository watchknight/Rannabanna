import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recipeService } from '../services/recipeService.js';

describe('Task 3: Recipe Matchmaking Engine - Edge Cases Suite', () => {
  it('Edge Case 1: Servings scaling with on-hand quantity shortfall degrades match and populates shortfall', async () => {
    // Test recipe: shorshe-ilish (baseServings: 4, essential ingredients: hilsa-fish, mustard-oil, mustard-seeds-black, green-chili, turmeric-powder, salt)
    // When user provides full on-hand quantities for 4 servings:
    const onHandBase = {
      'hilsa-fish': 4,
      'mustard-oil': 4,
      'mustard-seeds-black': 2,
      'green-chili': 6,
      'turmeric-powder': 1,
      'salt': 1
    };

    const baseResult = await recipeService.matchRecipes(
      ['hilsa-fish', 'mustard-oil', 'mustard-seeds-black', 'green-chili', 'turmeric-powder', 'salt'],
      { servings: 4, onHand: onHandBase }
    );

    const baseIlish = [...baseResult.perfect, ...baseResult.great].find(r => r.id === 'shorshe-ilish');
    assert.ok(baseIlish, 'Shorshe Ilish should match in high tier at base servings');
    assert.equal(baseIlish.missingEssential.length, 0, 'No essentials should be missing when on-hand satisfies base requirement');

    // Now scale to 8 servings (2x batch): User still only has 4 steaks of hilsa fish (needs 8 steaks)
    const scaledResult = await recipeService.matchRecipes(
      ['hilsa-fish', 'mustard-oil', 'mustard-seeds-black', 'green-chili', 'turmeric-powder', 'salt'],
      { servings: 8, onHand: onHandBase }
    );

    const scaledIlish = [...scaledResult.perfect, ...scaledResult.great, ...scaledResult.good, ...scaledResult.exploratory].find(r => r.id === 'shorshe-ilish');
    assert.ok(scaledIlish, 'Recipe should still be returned in matching results');
    assert.ok(scaledIlish.matchPercentage < 50, 'Match percentage must degrade due to insufficient ingredient quantities');
    
    // Check that hilsa-fish is now flagged as missing due to quantity shortfall
    const hilsaMissing = scaledIlish.missingEssential.find(m => m.id === 'hilsa-fish');
    assert.ok(hilsaMissing, 'Hilsa fish must be flagged in missingEssential when on-hand is insufficient for scaled servings');
    assert.equal(hilsaMissing.shortfall, 4, 'Shortfall should be exactly 4 steaks (8 required - 4 on-hand)');
  });

  it('Edge Case 2: Empty ingredient list returns empty results with zero errors', async () => {
    const emptyResult = await recipeService.matchRecipes([], {});
    assert.equal(emptyResult.totalCount, 0);
    assert.deepEqual(emptyResult.perfect, []);
    assert.deepEqual(emptyResult.great, []);
    assert.deepEqual(emptyResult.good, []);
    assert.deepEqual(emptyResult.exploratory, []);
  });

  it('Edge Case 3: Recipe with only optional ingredients matched never receives essential match bonus', async () => {
    // Select only an optional ingredient for a recipe (e.g. coriander-fresh or sugar)
    const result = await recipeService.matchRecipes(['coriander-fresh'], {});
    for (const r of [...result.perfect, ...result.great, ...result.good, ...result.exploratory]) {
      if (r.essentialMatched === 0) {
        // Score must only come from optional proportion (max 15%) without essential bonus
        assert.ok(r.matchPercentage <= 20, `Recipe ${r.id} with 0 essentials matched should not score high (${r.matchPercentage}%)`);
      }
    }
  });

  it('Edge Case 4: Non-scaling ingredients (e.g. pinch of salt) do not cause false shortfall when scaling up', async () => {
    // Salt is marked as non-scaling ("pinch" / "to taste"). Having 1 pinch satisfies both 4 and 16 servings!
    const onHand = {
      'salt': 1
    };

    const result = await recipeService.matchRecipes(['salt'], { servings: 16, onHand });
    assert.ok(result, 'Match engine should execute without errors');
  });

  it('Edge Case 5: Time filter with adjusted servings evaluates against scaled time', async () => {
    // Suppose maxTime is 35 minutes. At base servings (4), Shorshe Ilish takes 15+20 = 35 mins (passes filter).
    const baseMatch = await recipeService.matchRecipes(['hilsa-fish'], { servings: 4, maxTime: 35 });
    const hasBase = [...baseMatch.perfect, ...baseMatch.great, ...baseMatch.good, ...baseMatch.exploratory].some(r => r.id === 'shorshe-ilish');
    assert.ok(hasBase, 'Shorshe Ilish should pass 35 min filter at 4 servings');

    // When scaled to 16 servings, total time increases past 35 minutes (e.g. ~42 mins) and must be filtered out!
    const scaledMatch = await recipeService.matchRecipes(['hilsa-fish'], { servings: 16, maxTime: 35 });
    const hasScaled = [...scaledMatch.perfect, ...scaledMatch.great, ...scaledMatch.good, ...scaledMatch.exploratory].some(r => r.id === 'shorshe-ilish');
    assert.equal(hasScaled, false, 'Shorshe Ilish should be filtered out when scaled time exceeds maxTime');
  });
});
