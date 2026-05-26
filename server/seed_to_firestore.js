import { db, isFirebaseInitialized } from './models/firebase.js';
import { cuisines } from '../src/data/cuisines.js';
import { ingredients } from '../src/data/ingredients.js';
import { recipes } from '../src/data/recipes.js';
import { newRecipes } from './new_recipes.js';
import { expansionRecipes } from './expansion_recipes.js';
import { subcontinentalRecipes } from './subcontinental_recipes.js';
import { restRecipes } from './rest_recipes.js';
import { sauceRecipes } from './sauce_recipes.js';
import { 
  decorateRecipeTranslations, 
  ingredientTranslations, 
  cuisineTranslations 
} from './utils/translation_engine.js';

if (!isFirebaseInitialized) {
  console.error('❌ Cannot seed: Firebase is not initialized. Please verify your "server/config/service-account.json" private key.');
  process.exit(1);
}

async function seed() {
  console.log('🌱 Starting Cloud Firestore seeding pipeline for rannabanna-chef...');

  // 1. Seed Cuisines (Bilingual)
  console.log('🛸 Seeding Cuisines...');
  const cuisinesBatch = db.batch();
  for (const item of cuisines) {
    const trans = cuisineTranslations[item.id] || {};
    const decoratedCuisine = {
      ...item,
      nameBn: trans.nameBn || item.name,
      regionBn: trans.regionBn || item.region,
      descriptionBn: trans.descriptionBn || item.description
    };
    const docRef = db.collection('cuisines').doc(item.id);
    cuisinesBatch.set(docRef, decoratedCuisine);
  }
  await cuisinesBatch.commit();
  console.log(`✅ Seeded ${cuisines.length} cuisines.`);

  // 2. Seed Ingredients (Bilingual)
  console.log('🧂 Seeding Ingredients...');
  const activeIngredients = ingredients.map(ing => {
    const nameBn = ingredientTranslations[ing.id] || ing.name;
    return {
      ...ing,
      nameBn
    };
  });

  const ingredientChunks = [];
  for (let i = 0; i < activeIngredients.length; i += 400) {
    ingredientChunks.push(activeIngredients.slice(i, i + 400));
  }
  for (let i = 0; i < ingredientChunks.length; i++) {
    const batch = db.batch();
    for (const item of ingredientChunks[i]) {
      const docRef = db.collection('ingredients').doc(item.id);
      batch.set(docRef, item);
    }
    await batch.commit();
  }
  console.log(`✅ Seeded ${activeIngredients.length} GIV ingredients.`);

  // 3. Seed Recipes (Bilingual)
  console.log('🥘 Seeding Recipes...');
  const rawRecipes = [...recipes, ...newRecipes, ...expansionRecipes, ...subcontinentalRecipes, ...restRecipes, ...sauceRecipes];
  const allRecipes = rawRecipes.map(r => decorateRecipeTranslations(r));

  const recipeChunks = [];
  for (let i = 0; i < allRecipes.length; i += 400) {
    recipeChunks.push(allRecipes.slice(i, i + 400));
  }
  for (let i = 0; i < recipeChunks.length; i++) {
    const batch = db.batch();
    for (const item of recipeChunks[i]) {
      const docRef = db.collection('recipes').doc(item.id);
      batch.set(docRef, item);
    }
    await batch.commit();
  }
  console.log(`✅ Seeded ${allRecipes.length} recipes.`);

  console.log('\n🎉 Cloud Firestore database seeding completed successfully with full bilingual fields!');
  process.exit(0);
}

seed().catch(err => {
  console.error('\n❌ Seeding failed:', err);
  process.exit(1);
});
