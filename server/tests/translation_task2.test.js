import { test, describe } from 'node:test';
import assert from 'node:assert';
import { 
  translations, 
  toBengaliNumber, 
  translateCategory, 
  translateUnit, 
  translateTechnique, 
  translatePreparation 
} from '../../src/utils/translations.js';
import { recipes } from '../../src/data/recipes.js';
import { ingredients } from '../../src/data/ingredients.js';
import { cuisines } from '../../src/data/cuisines.js';

describe('Task 2 — English to Bangla Translation Verification Suite', () => {

  test('1. toBengaliNumber converts digits to authentic Bengali numerals', () => {
    assert.strictEqual(toBengaliNumber(0), '০');
    assert.strictEqual(toBengaliNumber(12345), '১২৩৪৫');
    assert.strictEqual(toBengaliNumber(6789), '৬৭৮৯');
    assert.strictEqual(toBengaliNumber('1/2'), '১/২');
    assert.strictEqual(toBengaliNumber('0.75'), '০.৭৫');
    assert.strictEqual(toBengaliNumber('10-15'), '১০-১৫');
    assert.strictEqual(toBengaliNumber('+3 more'), '+৩ more');
    assert.strictEqual(toBengaliNumber(null), '');
    assert.strictEqual(toBengaliNumber(undefined), '');
  });

  test('2. Key parity between English and Bangla translation dictionaries', () => {
    const enKeys = Object.keys(translations.en);
    const bnKeys = Object.keys(translations.bn);
    assert.strictEqual(enKeys.length, bnKeys.length, 'English and Bangla should have identical key count');
    
    const missingInBn = enKeys.filter(k => !(k in translations.bn));
    const missingInEn = bnKeys.filter(k => !(k in translations.en));
    assert.deepStrictEqual(missingInBn, [], 'Bangla should not miss any keys present in English');
    assert.deepStrictEqual(missingInEn, [], 'English should not miss any keys present in Bangla');
  });

  test('3. Dynamic Recipe Translation: 100% of recipes have authentic titleBn & descriptionBn', () => {
    const untranslatedTitles = [];
    const untranslatedDesc = [];
    for (const r of recipes) {
      if (!r.titleBn || r.titleBn === r.title) {
        untranslatedTitles.push(r.id);
      }
      if (!r.descriptionBn || r.descriptionBn === r.description) {
        untranslatedDesc.push(r.id);
      }
    }
    assert.strictEqual(untranslatedTitles.length, 0, `All recipes should have titleBn. Untranslated: ${untranslatedTitles.join(', ')}`);
    assert.strictEqual(untranslatedDesc.length, 0, `All recipes should have descriptionBn. Untranslated: ${untranslatedDesc.join(', ')}`);
  });

  test('4. Dynamic Steps Translation: 100% of steps across all recipes have instructionBn', () => {
    let totalSteps = 0;
    let missingStepBn = 0;
    for (const r of recipes) {
      for (const s of (r.steps || [])) {
        totalSteps++;
        if (!s.instructionBn || s.instructionBn.trim() === '') {
          missingStepBn++;
        }
      }
    }
    assert.strictEqual(missingStepBn, 0, `All ${totalSteps} recipe steps must have authentic instructionBn`);
  });

  test('5. Dynamic Ingredients Translation: 100% of GIV ingredients have nameBn', () => {
    const missingIngBn = ingredients.filter(i => !i.nameBn || i.nameBn === i.id);
    assert.strictEqual(missingIngBn.length, 0, `All ${ingredients.length} canonical ingredients must have nameBn`);
  });

  test('6. Dynamic Cuisines Translation: 100% of cuisines have nameBn and descriptionBn', () => {
    const missingCuisines = cuisines.filter(c => !c.nameBn || !c.descriptionBn);
    assert.strictEqual(missingCuisines.length, 0, `All ${cuisines.length} cuisines must have nameBn and descriptionBn`);
  });

  test('7. Coverage Gap: 100% of ingredient groups across all recipes translate to Bengali', () => {
    const untranslatedGroups = new Set();
    for (const r of recipes) {
      for (const ing of (r.ingredients || [])) {
        if (ing.group) {
          const translated = translateCategory(ing.group, 'bn');
          if (translated === ing.group && !['Main', 'সবার জন্য'].includes(ing.group)) {
            untranslatedGroups.add(ing.group);
          }
        }
      }
    }
    assert.strictEqual(untranslatedGroups.size, 0, `Untranslated ingredient groups: ${[...untranslatedGroups].join(', ')}`);
  });

  test('8. Coverage Gap: 100% of measurement units across all recipes translate to Bengali', () => {
    const untranslatedUnits = new Set();
    for (const r of recipes) {
      for (const ing of (r.ingredients || [])) {
        if (ing.unit) {
          const translated = translateUnit(ing.unit, 'bn');
          if (translated === ing.unit && !['g', 'ml'].includes(ing.unit)) {
            untranslatedUnits.add(ing.unit);
          }
        }
      }
    }
    assert.strictEqual(untranslatedUnits.size, 0, `Untranslated units: ${[...untranslatedUnits].join(', ')}`);
  });

  test('9. Coverage Gap: 100% of cooking techniques across all recipes translate to Bengali', () => {
    const untranslatedTechs = new Set();
    for (const r of recipes) {
      for (const s of (r.steps || [])) {
        if (s.technique) {
          const translated = translateTechnique(s.technique, 'bn');
          if (translated === s.technique) {
            untranslatedTechs.add(s.technique);
          }
        }
      }
    }
    assert.strictEqual(untranslatedTechs.size, 0, `Untranslated techniques: ${[...untranslatedTechs].join(', ')}`);
  });

  test('10. Coverage Gap: 100% of all 407 ingredient preparations translate to Bengali', () => {
    const untranslatedPreps = new Set();
    for (const r of recipes) {
      for (const ing of (r.ingredients || [])) {
        if (ing.preparation) {
          const translated = translatePreparation(ing.preparation, 'bn');
          if (translated === ing.preparation) {
            untranslatedPreps.add(ing.preparation);
          }
        }
      }
    }
    assert.strictEqual(untranslatedPreps.size, 0, `Untranslated preparations: ${[...untranslatedPreps].join(', ')}`);
  });

});
