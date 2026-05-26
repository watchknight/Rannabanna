import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { recipes } from '../src/data/recipes.js';
import { newRecipes } from './new_recipes.js';
import { expansionRecipes } from './expansion_recipes.js';
import { subcontinentalRecipes } from './subcontinental_recipes.js';
import { restRecipes } from './rest_recipes.js';
import { sauceRecipes } from './sauce_recipes.js';

const allRecipes = [
  ...recipes,
  ...newRecipes,
  ...expansionRecipes,
  ...subcontinentalRecipes,
  ...restRecipes,
  ...sauceRecipes
];

console.log(`⚡ Merging a total of ${allRecipes.length} recipes into local static database...`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, '../src/data/recipes.js');
const outputContent = `export const recipes = ${JSON.stringify(allRecipes, null, 2)};\n`;

fs.writeFileSync(outputPath, outputContent, 'utf8');

console.log('✅ Overwrote src/data/recipes.js successfully!');
