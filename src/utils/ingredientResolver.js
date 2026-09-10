/**
 * Canonical Ingredient Vault (GIV) Alias & Synonym Resolution Utility.
 * Normalizes colloquial spelling variants, culinary synonyms, and plurals
 * to canonical GIV ingredient IDs.
 */

export const INGREDIENT_ALIASES = {
  'cilantro': 'coriander',
  'coriander leaves': 'coriander',
  'aubergine': 'eggplant',
  'brinjal': 'eggplant',
  'prawn': 'shrimp',
  'prawns': 'shrimp',
  'curd': 'yogurt-plain',
  'dahi': 'yogurt-plain',
  'tok doi': 'yogurt-plain',
  'garbanzo': 'chickpeas',
  'garbanzo beans': 'chickpeas',
  'chickpea': 'chickpeas',
  'scallion': 'scallion',
  'scallions': 'scallion',
  'spring onion': 'scallion',
  'spring onions': 'scallion',
  'green onion': 'scallion',
  'green onions': 'scallion',
  'capsicum': 'bell-pepper-green',
  'green pepper': 'bell-pepper-green',
  'red pepper': 'bell-pepper-red',
  'yellow pepper': 'bell-pepper-yellow',
  'soya sauce': 'soy-sauce',
  'butter': 'butter-unsalted',
  'milk': 'milk-whole',
  'cream': 'heavy-cream',
  'cheese': 'cheddar-cheese',
  'beef': 'beef-cubes',
  'chicken': 'chicken-breast',
  'lamb': 'lamb-chop',
  'mutton': 'mutton-cubes'
};

/**
 * Normalizes query string for ingredient search, resolving aliases and plurals.
 * @param {string} query 
 * @returns {string} Normalized string
 */
export function normalizeIngredientQuery(query) {
  if (!query || typeof query !== 'string') return '';
  const q = query.toLowerCase().trim();
  if (!q) return '';

  if (INGREDIENT_ALIASES[q]) {
    return INGREDIENT_ALIASES[q];
  }

  // Handle common plural endings
  if (q.endsWith('potatoes')) return q.replace('potatoes', 'potato');
  if (q.endsWith('tomatoes')) return q.replace('tomatoes', 'tomato');
  if (q.endsWith('chilies') || q.endsWith('chilis')) return 'green-chili';
  if (q.endsWith('ies') && q.length > 4) {
    const candidate = q.slice(0, -3) + 'y';
    if (INGREDIENT_ALIASES[candidate]) return INGREDIENT_ALIASES[candidate];
    return candidate;
  }
  if (q.endsWith('es') && q.length > 4) {
    const candidate = q.slice(0, -2);
    if (INGREDIENT_ALIASES[candidate]) return INGREDIENT_ALIASES[candidate];
    return candidate;
  }
  if (q.endsWith('s') && !q.endsWith('ss') && q.length > 3) {
    const candidate = q.slice(0, -1);
    if (INGREDIENT_ALIASES[candidate]) return INGREDIENT_ALIASES[candidate];
    return candidate;
  }

  return q;
}

/**
 * Checks if an ingredient matches a search query using literal text, Bengali names, and alias normalization.
 * @param {object} ingredient GIV ingredient record
 * @param {string} rawQuery User typed query
 * @param {string} language Current language ('en' | 'bn')
 * @returns {boolean}
 */
export function matchIngredient(ingredient, rawQuery, language = 'en') {
  if (!ingredient || !rawQuery) return false;
  const q = rawQuery.toLowerCase().trim();
  if (!q) return false;

  const normalized = normalizeIngredientQuery(q);

  const id = (ingredient.id || '').toLowerCase();
  const nameEn = (ingredient.name || '').toLowerCase();
  const nameBn = (ingredient.nameBn || '').toLowerCase();

  return id.includes(q) ||
         nameEn.includes(q) ||
         nameBn.includes(q) ||
         id.includes(normalized) ||
         nameEn.includes(normalized);
}
