import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  iconicRecipeTranslations, 
  staticRecipeTranslations, 
  ingredientTranslations 
} from '../utils/translation_engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const cacheFile = path.resolve(__dirname, '../data/translation_cache.json');

// 1. Initialize Translation Cache
let cache = {};
if (fs.existsSync(cacheFile)) {
  try {
    cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    console.log(`📦 Loaded existing cache with ${Object.keys(cache).length} entries.`);
  } catch (err) {
    console.warn('⚠️ Could not parse existing cache file, starting fresh.');
  }
}

function saveCache() {
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf8');
}

// 2. Bengali Polishing Helpers
function toBengaliDigits(str) {
  if (!str) return '';
  return str.replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
}

function polishBengali(str, isTitleOrShort = false) {
  if (!str) return '';
  let res = str.trim();

  // Culinary term fixes
  const culinaryFixes = [
    [/চুনের রস/g, 'লেবুর রস'],
    [/চুন রস/g, 'লেবুর রস'],
    [/কাঁচা চুনের রস/g, 'তাজা লেবুর রস'],
    [/সরিষার বীজ/g, 'সরিষা দানা'],
    [/তিলের বীজ/g, 'তিল'],
    [/পোস্ত বীজ/g, 'পোস্ত দানা'],
    [/জিরা বীজ/g, 'আস্ত জিরা'],
    [/মৌরির বীজ/g, 'মৌরি'],
    [/মেথির বীজ/g, 'মেথি'],
    [/কালোজিরা বীজ/g, 'কালোজিরা'],
    [/ধনে বীজ/g, 'আস্ত ধনিয়া'],
    [/ধনিয়ার বীজ/g, 'আস্ত ধনিয়া'],
    [/এলাচের বীজ/g, 'এলাচ দানা'],
    [/গোলমরিচের বীজ/g, 'আস্ত গোলমরিচ'],
    [/স্লাইস এবং কিমা/g, 'কুচি ও মিহি করে কেটে নিন']
  ];

  for (const [regex, replacement] of culinaryFixes) {
    res = res.replace(regex, replacement);
  }

  // Punctuation formatting for instructions and descriptions
  if (!isTitleOrShort) {
    res = res.replace(/\.\s*$/g, '।');
    res = res.replace(/\.\s+/g, '। ');
    if (!res.endsWith('।') && !res.endsWith('?') && !res.endsWith('!')) {
      res += '।';
    }
  }

  // Convert digits to Bengali digits
  res = toBengaliDigits(res);

  // Clean extra spaces
  res = res.replace(/\s+/g, ' ').trim();
  return res;
}

// 3. Translation API with Backoff & Retry
async function fetchGoogleTranslate(text, retryCount = 0) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=bn&dt=t&q=' + encodeURIComponent(text);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const json = await res.json();
    return json[0].map(s => s[0]).join('');
  } catch (err) {
    if (retryCount < 4) {
      const delay = (retryCount + 1) * 1500;
      console.warn(`⏳ Network error on "${text.slice(0, 30)}...". Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return fetchGoogleTranslate(text, retryCount + 1);
    }
    throw err;
  }
}

async function getTranslation(text, isTitleOrShort = false) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (!/[a-zA-Z]/.test(trimmed)) {
    return polishBengali(trimmed, isTitleOrShort);
  }

  if (cache[trimmed]) {
    return cache[trimmed];
  }

  const rawTranslated = await fetchGoogleTranslate(trimmed);
  const polished = polishBengali(rawTranslated, isTitleOrShort);
  cache[trimmed] = polished;
  return polished;
}

// 4. Batch Translation Runner
async function run() {
  console.log('🚀 Starting Offline Automated Batch Translation for Rannabanna...\n');

  const recipeFiles = [
    { relativePath: 'src/data/recipes.js', exportName: 'recipes' },
    { relativePath: 'server/new_recipes.js', exportName: 'newRecipes' },
    { relativePath: 'server/expansion_recipes.js', exportName: 'expansionRecipes' },
    { relativePath: 'server/subcontinental_recipes.js', exportName: 'subcontinentalRecipes' },
    { relativePath: 'server/rest_recipes.js', exportName: 'restRecipes' },
    { relativePath: 'server/sauce_recipes.js', exportName: 'sauceRecipes' }
  ];

  const canonicalIds = new Set(Object.keys(iconicRecipeTranslations));
  console.log(`📌 Found ${canonicalIds.size} canonical recipes with 100% human-curated Bengali steps.`);

  const textQueue = [];
  const queuedSet = new Set();

  function enqueue(text, isTitleOrShort = false) {
    if (!text || typeof text !== 'string') return;
    const trimmed = text.trim();
    if (!trimmed || !/[a-zA-Z]/.test(trimmed)) return;
    if (cache[trimmed]) return;
    if (queuedSet.has(trimmed)) return;

    queuedSet.add(trimmed);
    textQueue.push({ text: trimmed, isTitleOrShort });
  }

  console.log('🔍 Scanning recipe files for untranslated strings...');
  for (const { relativePath, exportName } of recipeFiles) {
    const fullPath = path.join(rootDir, relativePath);
    const mod = await import(`file://${fullPath}`);
    const recipes = mod[exportName] || [];

    for (const r of recipes) {
      if (canonicalIds.has(r.id)) {
        continue;
      }
      enqueue(r.title, true);
      enqueue(r.description, false);
      if (r.culturalNote) enqueue(r.culturalNote, false);
      for (const st of r.steps || []) {
        if (st.instruction) enqueue(st.instruction, false);
      }
    }
  }

  console.log(`📋 Found ${textQueue.length} unique strings needing translation.`);

  const CONCURRENCY = 5;
  const BATCH_PAUSE_MS = 120;
  let completed = 0;

  for (let i = 0; i < textQueue.length; i += CONCURRENCY) {
    const chunk = textQueue.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async ({ text, isTitleOrShort }) => {
        try {
          await getTranslation(text, isTitleOrShort);
          completed++;
        } catch (err) {
          console.error(`❌ Failed translating: "${text.slice(0, 30)}..."`, err.message);
        }
      })
    );

    if (completed % 50 === 0 || completed === textQueue.length) {
      saveCache();
      const pct = ((completed / textQueue.length) * 100).toFixed(1);
      console.log(`⏳ Progress: ${completed}/${textQueue.length} (${pct}%) strings translated & cached.`);
    }

    await new Promise(r => setTimeout(r, BATCH_PAUSE_MS));
  }

  saveCache();
  console.log('✅ Translation cache fully synchronized!\n');

  console.log('🧁 Baking clean Bengali translations into all recipe files...');

  for (const { relativePath, exportName } of recipeFiles) {
    const fullPath = path.join(rootDir, relativePath);
    const mod = await import(`file://${fullPath}`);
    const rawRecipes = mod[exportName] || [];

    const updatedRecipes = rawRecipes.map(r => {
      const isCanonical = canonicalIds.has(r.id);
      const iconic = iconicRecipeTranslations[r.id] || {};
      const staticTrans = staticRecipeTranslations[r.id] || {};

      let titleBn = '';
      if (isCanonical && (staticTrans.titleBn || iconic.titleBn)) {
        titleBn = iconic.titleBn || staticTrans.titleBn;
      } else if (r.title) {
        titleBn = cache[r.title.trim()] || r.titleBn || r.title;
      }

      let descriptionBn = '';
      if (isCanonical && (staticTrans.descriptionBn || iconic.descriptionBn)) {
        descriptionBn = iconic.descriptionBn || staticTrans.descriptionBn;
      } else if (r.description) {
        descriptionBn = cache[r.description.trim()] || r.descriptionBn || r.description;
      }

      let culturalNoteBn = '';
      if (isCanonical && (staticTrans.culturalNoteBn || iconic.culturalNoteBn)) {
        culturalNoteBn = iconic.culturalNoteBn || staticTrans.culturalNoteBn;
      } else if (r.culturalNote) {
        culturalNoteBn = cache[r.culturalNote.trim()] || r.culturalNoteBn || r.culturalNote;
      }

      const curatedSteps = iconic.stepsBn || [];
      const steps = (r.steps || []).map((st, idx) => {
        let instructionBn = '';
        if (isCanonical && curatedSteps[idx]) {
          instructionBn = curatedSteps[idx];
        } else if (st.instruction) {
          instructionBn = cache[st.instruction.trim()] || st.instructionBn || st.instruction;
        }

        return {
          ...st,
          instructionBn
        };
      });

      const ingredients = (r.ingredients || []).map(ing => {
        return {
          ...ing,
          nameBn: ingredientTranslations[ing.ingredientId] || ing.name || ing.ingredientId
        };
      });

      return {
        ...r,
        titleBn,
        descriptionBn,
        culturalNoteBn,
        steps,
        ingredients
      };
    });

    const fileContent = `export const ${exportName} = ${JSON.stringify(updatedRecipes, null, 2)};\n`;
    fs.writeFileSync(fullPath, fileContent, 'utf8');
    console.log(`  ✨ Updated ${relativePath} with clean Bengali.`);
  }

  console.log('\n🎉 ALL RECIPE FILES SUCCESSFULLY BAKED WITH CLEAN BENGALI!');
}

run().catch(err => {
  console.error('Fatal batch translation error:', err);
  process.exit(1);
});
