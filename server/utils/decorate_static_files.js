import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  decorateRecipeTranslations, 
  ingredientTranslations, 
  cuisineTranslations 
} from './translation_engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '../../');

async function decorateCuisines() {
  console.log('🛸 Decorating cuisines.js...');
  const filePath = path.join(rootDir, 'src/data/cuisines.js');
  const { cuisines } = await import(`file://${filePath}`);
  
  const decorated = cuisines.map(item => {
    const trans = cuisineTranslations[item.id] || {};
    return {
      ...item,
      nameBn: trans.nameBn || item.name,
      regionBn: trans.regionBn || item.region,
      descriptionBn: trans.descriptionBn || item.description
    };
  });

  const content = `export const cuisines = ${JSON.stringify(decorated, null, 2)};\n`;
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('✅ cuisines.js successfully decorated!');
}

async function decorateIngredients() {
  console.log('🧂 Decorating ingredients.js...');
  const filePath = path.join(rootDir, 'src/data/ingredients.js');
  const { ingredients } = await import(`file://${filePath}`);
  
  const decorated = ingredients.map(item => {
    const nameBn = ingredientTranslations[item.id] || item.name;
    return {
      ...item,
      nameBn
    };
  });

  const content = `export const ingredients = ${JSON.stringify(decorated, null, 2)};\n`;
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('✅ ingredients.js successfully decorated!');
}

async function decorateRecipeFile(relativeFilePath, exportName) {
  console.log(`🥘 Decorating ${relativeFilePath}...`);
  const filePath = path.join(rootDir, relativeFilePath);
  const module = await import(`file://${filePath}`);
  const recipesList = module[exportName];
  
  const decorated = recipesList.map(r => decorateRecipeTranslations(r));

  const content = `export const ${exportName} = ${JSON.stringify(decorated, null, 2)};\n`;
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`✅ ${relativeFilePath} successfully decorated!`);
}

async function run() {
  try {
    await decorateCuisines();
    await decorateIngredients();
    
    // Decorate all recipe databases (static and server files)
    await decorateRecipeFile('src/data/recipes.js', 'recipes');
    await decorateRecipeFile('server/new_recipes.js', 'newRecipes');
    await decorateRecipeFile('server/expansion_recipes.js', 'expansionRecipes');
    await decorateRecipeFile('server/subcontinental_recipes.js', 'subcontinentalRecipes');
    await decorateRecipeFile('server/rest_recipes.js', 'restRecipes');
    await decorateRecipeFile('server/sauce_recipes.js', 'sauceRecipes');

    console.log('\n🎉 ALL STATIC FILES DECORATED WITH HIGH-FIDELITY BILINGUAL FIELDS!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Decoration failed:', error);
    process.exit(1);
  }
}

run();
