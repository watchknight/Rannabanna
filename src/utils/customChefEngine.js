// Rule-Based Expert Culinary System for Custom Recipe Generation (Zero-Lag Fallback)

export function generateLocalCustomRecipe(selectedIngredients, requestedCuisine = 'any') {
  if (!selectedIngredients || selectedIngredients.length === 0) {
    return null;
  }

  // 1. Identify primary star ingredient (Proteins first, then Vegetables, then Grains, then first selected)
  const proteins = selectedIngredients.filter(i => i.category === 'Proteins');
  const vegetables = selectedIngredients.filter(i => i.category === 'Vegetables' || i.category === 'Gourd');
  const grains = selectedIngredients.filter(i => i.category === 'Grains & Starches');

  const starProtein = proteins.length > 0 ? proteins[0] : null;
  const starVeg = vegetables.length > 0 ? vegetables[0] : null;
  const starGrain = grains.length > 0 ? grains[0] : null;
  const star = starProtein || starVeg || starGrain || selectedIngredients[0];

  // 2. Score selected ingredients to identify the most authentic cuisine match
  const scores = {
    bengali: 0,
    'north-indian': 0,
    pakistani: 0,
    chinese: 0,
    thai: 0,
    italian: 0,
    mexican: 0
  };

  const idSet = new Set(selectedIngredients.map(i => i.id));

  for (const id of idSet) {
    if (['mustard-oil', 'panch-phoron', 'hilsa-fish', 'rohita-fish', 'jaggery'].includes(id)) scores.bengali += 5;
    if (['ghee', 'paneer', 'garam-masala', 'cumin-seeds'].includes(id)) scores['north-indian'] += 5;
    if (['pomegranate-seeds-dry', 'lamb-chop', 'mutton-cubes'].includes(id)) scores.pakistani += 5;
    if (['soy-sauce', 'sesame-oil', 'chili-bean-paste', 'five-spice', 'shaoxing-wine'].includes(id)) scores.chinese += 5;
    if (['fish-sauce', 'coconut-milk', 'basil-thai', 'lemongrass', 'galangal'].includes(id)) scores.thai += 5;
    if (['olive-oil', 'basil-sweet', 'parmesan-cheese', 'mozzarella-cheese', 'spaghetti'].includes(id)) scores.italian += 5;
    if (['corn-tortilla', 'avocado', 'beans-black', 'beans-kidney'].includes(id)) scores.mexican += 5;
  }

  let matchedCuisine = requestedCuisine !== 'any' ? requestedCuisine : 'bengali';
  if (requestedCuisine === 'any') {
    let maxScore = -1;
    for (const c in scores) {
      if (scores[c] > maxScore) {
        maxScore = scores[c];
        matchedCuisine = c;
      }
    }
  }

  // 3. Pre-define lists of common staples
  const allStaples = [
    { ingredientId: 'salt', quantity: 1, unit: 'tsp', preparation: 'to taste', isEssential: true, group: 'Seasoning' },
    { ingredientId: 'garlic', quantity: 3, unit: 'cloves', preparation: 'minced', isEssential: true, group: 'Aromatics' },
    { ingredientId: 'ginger', quantity: 1, unit: 'tsp', preparation: 'minced', isEssential: false, group: 'Aromatics' }
  ];

  // Helper to scale quantities and units logically
  const getNaturalQuantityAndUnit = (ing) => {
    const id = ing.id;
    const cat = ing.category;
    const sub = ing.subCategory;

    if (cat === 'Proteins') {
      return { quantity: 500, unit: 'g', prep: 'bite-sized pieces' };
    }
    if (cat === 'Vegetables' || cat === 'Gourd') {
      if (sub === 'Alliums' || id === 'garlic' || id === 'onion-red') {
        return { quantity: 1, unit: 'medium', prep: 'finely chopped' };
      }
      return { quantity: 2, unit: 'whole', prep: 'sliced' };
    }
    if (cat === 'Grains & Starches') {
      if (id === 'spaghetti' || sub === 'Pasta') {
        return { quantity: 400, unit: 'g', prep: 'boiled' };
      }
      if (id === 'basmati-rice' || id === 'rice') {
        return { quantity: 2, unit: 'cups', prep: 'washed & drained' };
      }
      return { quantity: 2, unit: 'cups', prep: '' };
    }
    if (sub === 'Spices' || sub === 'Herbs' || sub === 'Seasoning') {
      if (id === 'mustard-oil' || id === 'ghee' || id === 'olive-oil' || id === 'oil') {
        return { quantity: 2, unit: 'tbsp', prep: '' };
      }
      if (id === 'lime' || id === 'lemon') {
        return { quantity: 1, unit: 'whole', prep: 'juiced' };
      }
      return { quantity: 1, unit: 'tsp', prep: '' };
    }
    if (sub === 'Sauces & Condiments') {
      return { quantity: 1.5, unit: 'tbsp', prep: '' };
    }
    return { quantity: 1, unit: 'unit', prep: '' };
  };

  // Populate dynamic ingredients list
  const ingredientsInRecipe = selectedIngredients.map(ing => {
    const cul = getNaturalQuantityAndUnit(ing);
    return {
      ingredientId: ing.id,
      quantity: cul.quantity,
      unit: cul.unit,
      preparation: cul.prep,
      isEssential: true,
      group: 'Main'
    };
  });

  // Inject staples if missing
  if (!idSet.has('salt')) ingredientsInRecipe.push(allStaples[0]);
  if (!idSet.has('garlic')) ingredientsInRecipe.push(allStaples[1]);

  // 4. Expert system to pair context-specific titles, descriptions, and steps
  const recipe = {
    title: `Dynamic ${star.name} Sauté`,
    cuisineId: matchedCuisine,
    difficulty: 'intermediate',
    prepTime: 15,
    cookTime: 20,
    servings: 4,
    calories: 320,
    description: `A custom recipe crafted around the rich flavor profile of ${star.name}, matching your unique selection of fresh ingredients.`,
    culturalNote: `Our chef engine analyzed the properties of ${star.name} and paired it with traditional aromatics to create this custom delight.`,
    imageEmoji: star.emoji || '🍛',
    mealType: ['lunch', 'dinner'],
    dietaryTags: ['gluten-free'],
    ingredients: ingredientsInRecipe,
    steps: []
  };

  if (matchedCuisine === 'bengali') {
    if (idSet.has('mustard-oil') && (idSet.has('hilsa-fish') || idSet.has('rohita-fish'))) {
      recipe.title = `Traditional Shorshe ${star.name} Jhol`;
      recipe.description = `A gourmet, highly authentic Bengali fish delicacy showcasing tender ${star.name} simmered in a sharp, pungent mustard-oil gravy.`;
      recipe.culturalNote = `Shorshe Maach represents the absolute peak of Bengali home cooking, celebrating freshwater rivers and sharp local cold-pressed mustard seeds.`;
      recipe.imageEmoji = '🐟';
    } else {
      recipe.title = `Bespoke ${star.name} Bhuna`;
      recipe.description = `An authentic, slow-cooked Bengali curry featuring ${star.name} tossed with warm regional spices and caramelized red onions.`;
      recipe.culturalNote = `Bhuna is a signature cooking technique in Bengal, where spices are slowly roasted to draw out their essential oils and form a dense cling-on gravy.`;
      recipe.imageEmoji = '🍛';
    }
    recipe.steps = [
      { step: 1, instruction: `Gently prep the ${star.name}, washing and slicing it into uniform, bite-sized portions.`, duration: 5, technique: 'preparation' },
      { step: 2, instruction: `Heat mustard oil or ghee in a heavy pot until shimmering. Toss in green chilies or whole spices to release their fragrance.`, duration: 3, technique: 'tempering' },
      { step: 3, instruction: `Add chopped onions, minced garlic, and ginger, cooking until sweet and richly caramelized.`, duration: 5, technique: 'sautéing' },
      { step: 4, instruction: `Incorporate the ${star.name} into the pot, stirring well to coat completely with the aromatic base.`, duration: 4, technique: 'roasting' },
      { step: 5, instruction: `Add a splash of water, cover, and let simmer on low heat until the ${star.name} is incredibly tender and flavorful.`, duration: 15, technique: 'simmering' }
    ];
  } 
  else if (matchedCuisine === 'north-indian' || matchedCuisine === 'pakistani') {
    if (idSet.has('ghee') && idSet.has('garam-masala')) {
      recipe.title = `Royal ${star.name} Makhani Masala`;
      recipe.description = `A luxurious Mughlai-style curry featuring tender ${star.name} simmered in a deeply aromatic, velvet cashew and ghee gravy.`;
      recipe.culturalNote = `Mughlai cuisine represents the rich historical synthesis of Central Asian cooking styles with Indian spice-craft, defined by rich, slow-simmered gravies.`;
      recipe.imageEmoji = '🍲';
    } else {
      recipe.title = `Aromatic ${star.name} Jalfrezi`;
      recipe.description = `A vibrant, slightly dry Indian curry featuring spiced ${star.name} stir-fried with bell peppers, fresh onions, and green chilies.`;
      recipe.culturalNote = `Jalfrezi was popularized during the British Raj as a spicy stir-fry combining fresh green chilies with local vegetables and meats.`;
      recipe.imageEmoji = '🍲';
    }
    recipe.steps = [
      { step: 1, instruction: `Chop the ${star.name} and vegetables into neat, even strips.`, duration: 5, technique: 'preparation' },
      { step: 2, instruction: `Heat ghee in a pan and toast cumin seeds until dark and fragrant.`, duration: 2, technique: 'tempering' },
      { step: 3, instruction: `Add onions, ginger, and garlic, sautéing until translucent. Stir in tomato paste and warm spices.`, duration: 4, technique: 'sautéing' },
      { step: 4, instruction: `Add the ${star.name} and sauté on medium-high heat until the edges are beautifully browned.`, duration: 6, technique: 'sautéing' },
      { step: 5, instruction: `Stir in a splash of water, cover, and simmer until tender. Garnish with fresh cilantro before serving.`, duration: 8, technique: 'simmering' }
    ];
  } 
  else if (matchedCuisine === 'chinese') {
    if (idSet.has('soy-sauce') && idSet.has('sesame-oil')) {
      recipe.title = `Gourmet Wok-Fried ${star.name} in Garlic-Soy`;
      recipe.description = `A classic high-heat stir-fry of ${star.name} coated in a savory, slightly sweet scallion soy glaze.`;
      recipe.culturalNote = `Chinese stir-frying focuses on flash-cooking ingredients under high wok-heir to lock in their natural crunch and lock in deep umami properties.`;
      recipe.imageEmoji = '🥢';
    } else {
      recipe.title = `Homestyle ${star.name} Stir-Fry`;
      recipe.description = `A comforting everyday Chinese stir-fry combining tender ${star.name} with fresh ginger, garlic, and green onions.`;
      recipe.culturalNote = `Homestyle Chinese dishes prioritize clean, balanced, and rapid preparations designed for busy family dinners.`;
      recipe.imageEmoji = '🥢';
    }
    recipe.steps = [
      { step: 1, instruction: `Slice the ${star.name} into thin, bite-sized pieces for rapid stir-frying.`, duration: 5, technique: 'slicing' },
      { step: 2, instruction: `Mix soy sauce, sugar, and a splash of water in a small bowl to create a smooth glaze.`, duration: 2, technique: 'mixing' },
      { step: 3, instruction: `Heat a tablespoon of oil in a hot wok. Flash-fry minced ginger, garlic, and green onions for 30 seconds.`, duration: 1, technique: 'stir-frying' },
      { step: 4, instruction: `Toss in the ${star.name} and stir-fry rapidly on high heat until cooked through.`, duration: 4, technique: 'stir-frying' },
      { step: 5, instruction: `Pour in the soy glaze around the edges of the wok, tossing constantly until it thickens and glosses the ${star.name}.`, duration: 2, technique: 'tossing' }
    ];
  } 
  else if (matchedCuisine === 'thai') {
    if (idSet.has('coconut-milk') && idSet.has('fish-sauce')) {
      recipe.title = `Rich Thai ${star.name} Coconut Curry`;
      recipe.description = `An exceptionally aromatic Southern Thai curry featuring ${star.name} simmered in rich coconut milk and fresh herbs.`;
      recipe.culturalNote = `Thai curries are derived from hand-pounded herb pastes and coconut milk, balancing sweet, sour, salty, and spicy elements seamlessly.`;
      recipe.imageEmoji = '🍛';
    } else {
      recipe.title = `Bespoke Thai ${star.name} Chili Stir-Fry`;
      recipe.description = `A quick, fiery Thai stir-fry of ${star.name} infused with fish sauce, sweet basil, and fresh bird's eye chilies.`;
      recipe.culturalNote = `A staple of street food stalls across Bangkok, this preparation is beloved for its intense herbal warmth and rapid fire sears.`;
      recipe.imageEmoji = '🍛';
    }
    recipe.steps = [
      { step: 1, instruction: `Finely slice or chop the ${star.name} into small, uniform portions.`, duration: 5, technique: 'slicing' },
      { step: 2, instruction: `Crush garlic and green chilies in a mortar to release their aromatic essential oils.`, duration: 2, technique: 'pounding' },
      { step: 3, instruction: `Heat oil in a wok. Fry the garlic-chili paste until highly fragrant.`, duration: 1, technique: 'stir-frying' },
      { step: 4, instruction: `Add the ${star.name} and toss on high heat. Add soy sauce, sugar, and a touch of fish sauce.`, duration: 3, technique: 'stir-frying' },
      { step: 5, instruction: `Remove from heat, throw in fresh herbs, and toss until just wilted.`, duration: 1, technique: 'tossing' }
    ];
  } 
  else if (matchedCuisine === 'italian') {
    if (idSet.has('spaghetti') && idSet.has('tomato')) {
      recipe.title = `Gourmet ${star.name} Spaghetti al Pomodoro`;
      recipe.description = `An elegant Italian classic where fresh pasta is tossed with sweet tomatoes, garlic, and ${star.name} simmered in extra virgin olive oil.`;
      recipe.culturalNote = `Italian pasta cooking centers around 'al dente' texture and emulsions, letting high-quality olive oil bind the pasta and ingredients.`;
      recipe.imageEmoji = '🍝';
    } else {
      recipe.title = `Rustic ${star.name} al Pomodoro`;
      recipe.description = `An elegant Italian classic where ${star.name} is gently simmered in a rustic garlic-tomato sauce with fresh sweet basil.`;
      recipe.culturalNote = `Italian cooking focuses on quality and simplicity, using olive oil and fresh basil to enhance natural, rustic flavors.`;
      recipe.imageEmoji = '🍝';
    }
    recipe.steps = [
      { step: 1, instruction: `Chop the ${star.name} and mince the fresh garlic.`, duration: 5, technique: 'preparation' },
      { step: 2, instruction: `Warm olive oil in a wide pan and sauté the garlic until tender and golden.`, duration: 2, technique: 'sautéing' },
      { step: 3, instruction: `Pour in crushed tomatoes or tomato paste with a pinch of salt, simmering for 10 minutes.`, duration: 10, technique: 'simmering' },
      { step: 4, instruction: `Slide in the ${star.name} and cook on low heat until juicy and fully cooked.`, duration: 5, technique: 'simmering' },
      { step: 5, instruction: `Garnish with fresh sweet basil leaves and a drizzle of extra virgin olive oil.`, duration: 1, technique: 'plating' }
    ];
  } 
  else {
    // Mexican default
    if (idSet.has('avocado') || idSet.has('corn-tortilla')) {
      recipe.title = `Vibrant ${star.name} Street Tacos`;
      recipe.description = `Vibrant street-style tacos packed with highly seasoned ${star.name}, creamy avocado slices, and zesty lime.`;
      recipe.culturalNote = `Mexican street tacos represent centuries of history, blending nixtamalized corn culture with sizzling hot grill sears.`;
      recipe.imageEmoji = '🌮';
    } else {
      recipe.title = `Sizzling ${star.name} Fajitas`;
      recipe.description = `A sizzling skillet medley of ${star.name} tossed with sweet onions, green peppers, cumin, and fresh cilantro.`;
      recipe.culturalNote = `Fajitas represent a classic Tex-Mex tradition, featuring quick sears on screaming-hot cast iron griddles.`;
      recipe.imageEmoji = '🌮';
    }
    recipe.steps = [
      { step: 1, instruction: `Slice the ${star.name} into thin strips and coat with cumin, chili powder, and salt.`, duration: 5, technique: 'marinating' },
      { step: 2, instruction: `Heat a cast iron skillet until smoking hot. Sear the seasoned ${star.name} until charred and tender.`, duration: 6, technique: 'searing' },
      { step: 3, instruction: `Sauté sliced onions and peppers in the skillet alongside the ${star.name}.`, duration: 3, technique: 'sautéing' },
      { step: 4, instruction: `Warm corn tortillas on a dry griddle until soft.`, duration: 2, technique: 'griddling' },
      { step: 5, instruction: `Fill tortillas with the hot ${star.name}, topping with fresh coriander and a squeeze of lime.`, duration: 2, technique: 'assembling' }
    ];
  }

  // 5. Decorate with high-fidelity Bengali translations dynamically
  const starNameBn = star.nameBn || star.name;
  
  if (matchedCuisine === 'bengali') {
    if (idSet.has('mustard-oil') && (idSet.has('hilsa-fish') || idSet.has('rohita-fish'))) {
      recipe.titleBn = `ঐতিহ্যবাহী সরিষা ${starNameBn} ঝোল`;
      recipe.descriptionBn = `ঝাল সরিষা বাটা ও কাঁচা মরিচের গ্রেভিতে তৈরি চমৎকার ও খাঁটি ${starNameBn} এর একটি ঐতিহ্যবাহী সুস্বাদু রেসিপি।`;
      recipe.culturalNoteBn = `সরিষা বাটা ও খাঁটি সরিষার তেলের চমৎকার সমন্বয় বাঙালির রন্ধনশিল্পের অন্যতম সেরা কৃতি।`;
      recipe.steps[0].instructionBn = `প্রথমে ${starNameBn} ভালো করে ধুয়ে রান্নার উপযোগী সমান টুকরো করে কেটে নিন।`;
      recipe.steps[1].instructionBn = `একটি কড়াইয়ে সরিষার তেল বা ঘি গরম করুন। কাঁচা মরিচ বা আস্ত মশলা ফোড়ন দিয়ে চমৎকার সুবাস তৈরি করুন।`;
      recipe.steps[2].instructionBn = `কুচানো পেঁয়াজ, রসুন ও আদা বাটা দিয়ে পেঁয়াজ সোনালী হওয়া পর্যন্ত সাঁতলে নিন।`;
      recipe.steps[3].instructionBn = `কড়াইয়ে প্রস্তুতকৃত ${starNameBn} যোগ করুন এবং মশলার মিশ্রণের সাথে ভালো করে নেড়েচেড়ে মিশিয়ে নিন।`;
      recipe.steps[4].instructionBn = `সামান্য পানি যোগ করে ঢাকনা দিয়ে হালকা আঁচে রান্না করুন যতক্ষণ না ${starNameBn} একদম নরম ও সুস্বাদু হচ্ছে।`;
    } else {
      recipe.titleBn = `অনন্য কাস্টম ${starNameBn} ভুনা`;
      recipe.descriptionBn = `ঘরোয়া মশলা ও ভাজা পেঁয়াজের সুগন্ধযুক্ত খাঁটি এবং চমৎকার ${starNameBn} ভুনা রেসিপি।`;
      recipe.culturalNoteBn = `ভুনা একটি সিগনেচার পদ্ধতি যেখানে মশলা ও উপকরণকে ধীরে ধীরে কষিয়ে ঘন ঝোল তৈরি করা হয়।`;
      recipe.steps[0].instructionBn = `প্রথমে ${starNameBn} ভালো করে ধুয়ে রান্নার উপযোগী সমান টুকরো করে কেটে নিন।`;
      recipe.steps[1].instructionBn = `একটি কড়াইয়ে সরিষার তেল বা ঘি গরম করুন। কাঁচা মরিচ বা আস্ত মশলা ফোড়ন দিয়ে চমৎকার সুবাস তৈরি করুন।`;
      recipe.steps[2].instructionBn = `কুচানো পেঁয়াজ, রসুন ও আদা বাটা দিয়ে পেঁয়াজ সোনালী হওয়া পর্যন্ত সাঁতলে নিন।`;
      recipe.steps[3].instructionBn = `কড়াইয়ে প্রস্তুতকৃত ${starNameBn} যোগ করুন এবং মশলার মিশ্রণের সাথে ভালো করে নেড়েচেড়ে মিশিয়ে নিন।`;
      recipe.steps[4].instructionBn = `সামান্য পানি যোগ করে ঢাকনা দিয়ে হালকা আঁচে রান্না করুন যতক্ষণ না ${starNameBn} একদম নরম ও সুস্বাদু হচ্ছে।`;
    }
  } 
  else if (matchedCuisine === 'north-indian' || matchedCuisine === 'pakistani') {
    if (idSet.has('ghee') && idSet.has('garam-masala')) {
      recipe.titleBn = `শাহী ${starNameBn} মাখনি মশলা`;
      recipe.descriptionBn = `মাখন, সুগন্ধি মশলা ও কাজুবাদামের ক্রিমি গ্রেভিতে রান্না করা চমৎকার শাহী ${starNameBn} রেসিপি।`;
      recipe.culturalNoteBn = `শাহী মোগলাই রন্ধনশৈলী তার সুগন্ধি গ্রেভি ও রাজকীয় স্বাদের জন্য বিশ্বজুড়ে অত্যন্ত সমাদৃত।`;
    } else {
      recipe.titleBn = `সুগন্ধি ${starNameBn} জালফ্রেজি`;
      recipe.descriptionBn = `ক্যাপসিকাম ও পেঁয়াজের সাথে সতেজ কাঁচা মরিচ দিয়ে কষানো চমৎকার ও ঝাল ${starNameBn} জালফ্রেজি।`;
      recipe.culturalNoteBn = `জালফ্রেজি হলো একটি জনপ্রিয় ঝাল ফ্রাই যা সতেজ সবজি ও মশলার সাথে মিশিয়ে দ্রুত রান্না করা হয়।`;
    }
    recipe.steps[0].instructionBn = `প্রথমে ${starNameBn} এবং সবজিগুলো সমান টুকরো করে কেটে নিন।`;
    recipe.steps[1].instructionBn = `প্যানে ঘি গরম করে জিরা ফোঁড়ন দিন যতক্ষণ না সুন্দর সুবাস বের হচ্ছে।`;
    recipe.steps[2].instructionBn = `পেঁয়াজ, আদা ও রসুন বাটা দিয়ে সাঁতলান। টমেটো পেস্ট ও গরম মশলা দিয়ে ভালো করে কষিয়ে নিন।`;
    recipe.steps[3].instructionBn = `এবার ${starNameBn} যোগ করে মাঝারি আঁচে ভাজুন যতক্ষণ না টুকরোগুলো সুন্দর বাদামী হচ্ছে।`;
    recipe.steps[4].instructionBn = `সামান্য পানি দিয়ে ঢেকে মৃদু আঁচে রান্না করুন। সবশেষে ধনেপাতা কুচি ছড়িয়ে গরম গরম পরিবেশন করুন।`;
  }
  else if (matchedCuisine === 'chinese') {
    if (idSet.has('soy-sauce') && idSet.has('sesame-oil')) {
      recipe.titleBn = `গার্লিক-সয়া সসে ফ্রাইড ${starNameBn}`;
      recipe.descriptionBn = `সয়া সস, তিলের তেল ও রসুনের সুগন্ধযুক্ত অত্যন্ত সুস্বাদু চীনা স্টাইলের ফ্রাইড ${starNameBn}।`;
      recipe.culturalNoteBn = `চীনা ফ্রাই সাধারণত উচ্চ আঁচে দ্রুত রান্না করা হয় যাতে উপকরণগুলোর সতেজতা ও প্রাকৃতিক পুষ্টি বজায় থাকে।`;
    } else {
      recipe.titleBn = `হোমস্টাইল ${starNameBn} স্টির-ফ্রাই`;
      recipe.descriptionBn = `আদা, রসুন ও সতেজ পেঁয়াজ পাতা দিয়ে ভাজা সহজ ও পুষ্টিকর চীনা হোমস্টাইল ${starNameBn} স্টির-ফ্রাই।`;
      recipe.culturalNoteBn = `চীনা হোমস্টাইল রান্না সাধারণত খুবই সাধারণ ও প্রাকৃতিক ফ্লেভারের ওপর ভিত্তি করে তৈরি হয়।`;
    }
    recipe.steps[0].instructionBn = `সহজে ও দ্রুত ভাজার জন্য প্রথমে ${starNameBn} পাতলা টুকরো করে কেটে নিন।`;
    recipe.steps[1].instructionBn = `একটি ছোট বাটিতে সয়া সস, সামান্য চিনি ও পানি মিশিয়ে গ্লেজ তৈরি করুন।`;
    recipe.steps[2].instructionBn = `কড়াইয়ে তেল গরম করে আদা, রসুন ও পেঁয়াজ পাতা কুচি দিয়ে ৩০ সেকেন্ড দ্রুত ভেজে নিন।`;
    recipe.steps[3].instructionBn = `এবার প্রস্তুতকৃত ${starNameBn} যোগ করুন এবং উচ্চ আঁচে নাড়াচাড়া করে ভালো করে ভেজে নিন।`;
    recipe.steps[4].instructionBn = `বাটিতে রাখা সয়া গ্লেজটি ঢেলে দিন এবং ঘন হওয়া পর্যন্ত ভালোভাবে নাড়তে থাকুন যাতে ${starNameBn} এর সাথে মিশে যায়।`;
  }
  else if (matchedCuisine === 'thai') {
    if (idSet.has('coconut-milk') && idSet.has('fish-sauce')) {
      recipe.titleBn = `নারকেলের দুধে থাই ${starNameBn} কারি`;
      recipe.descriptionBn = `নারকেলের দুধ, লেমনগ্রাস ও থাই ভেষজ মশলার সতেজ সুবাসে তৈরি অসাধারণ ক্রিমি ${starNameBn} কারি।`;
      recipe.culturalNoteBn = `থাই কারি সাধারণত তাজা ভেষজ ও নারকেলের দুধের সমন্বয়ে মিষ্টি, টক ও ঝাল ফ্লেভারের এক অপূর্ব মেলবন্ধন ঘটায়।`;
    } else {
      recipe.titleBn = `থাই স্টাইল ঝাল ${starNameBn} স্টির-ফ্রাই`;
      recipe.descriptionBn = `ফিশ সস, তাজা মরিচ ও সতেজ থাই তুলসী পাতার মেলবন্ধনে তৈরি দারুণ সুস্বাদু ও ঝাল ${starNameBn} স্টির-ফ্রাই।`;
      recipe.culturalNoteBn = `ব্যাংককের স্ট্রিট ফুডের অন্যতম সেরা আকর্ষণ হলো এই ধরণের দ্রুত এবং উচ্চ আঁচে ভাজা ঝাল খাবারসমূহ।`;
    }
    recipe.steps[0].instructionBn = `দ্রুত রান্নার সুবিধার্থে প্রথমে ${starNameBn} ছোট ও সমান টুকরো করে কেটে নিন।`;
    recipe.steps[1].instructionBn = `হামানদিস্তায় রসুন ও কাঁচা মরিচ ছেঁচে নিয়ে সতেজ ফ্লেভার বের করে নিন।`;
    recipe.steps[2].instructionBn = `কড়াইয়ে সামান্য তেল গরম করে ছেঁচে রাখা রসুন-মরিচের পেস্টটি সুবাস বের হওয়া পর্যন্ত ভাজুন।`;
    recipe.steps[3].instructionBn = `এবার ${starNameBn} যোগ করুন। সয়া সস, সামান্য চিনি ও ফিশ সস দিয়ে উচ্চ আঁচে নাড়াচাড়া করুন।`;
    recipe.steps[4].instructionBn = `আঁচ বন্ধ করে সতেজ তুলসী বা ধনেপাতা ছড়িয়ে দিন এবং নামিয়ে নিয়ে পরিবেশন করুন।`;
  }
  else if (matchedCuisine === 'italian') {
    if (idSet.has('spaghetti') && idSet.has('tomato')) {
      recipe.titleBn = `গৌরমেট ${starNameBn} স্প্যাগেটি আল পোমোদোরো`;
      recipe.descriptionBn = `মিষ্টি টমেটো, অলিভ অয়েল, তাজা তুলসী পাতা ও রসুন দিয়ে তৈরি ঐতিহ্যবাহী ইতালীয় ${starNameBn} স্প্যাগেটি।`;
      recipe.culturalNoteBn = `ইতালীয় রন্ধনশৈলীতে পাস্তা রান্নার মূল চাবিকাঠি হলো আল দেন্তে (হালকা শক্ত) টেক্সচার বজায় রাখা।`;
    } else {
      recipe.titleBn = `রুস্টিক ${starNameBn} আল পোমোদোরো`;
      recipe.descriptionBn = `রসুন, তাজা টমেটো সস ও তুলসী পাতার সাথে মৃদু আঁচে সেদ্ধ করা চমৎকার ইতালীয় ${starNameBn}।`;
      recipe.culturalNoteBn = `ইতালীয় রান্নায় সরলতা ও সতেজ উপকরণ ব্যবহার করে মূল উপাদানের স্বাদ ফুটিয়ে তোলা হয়।`;
    }
    recipe.steps[0].instructionBn = `প্রথমে ${starNameBn} কেটে নিন এবং রসুন মিহি কুচি করে প্রস্তুত করুন।`;
    recipe.steps[1].instructionBn = `প্যানে অলিভ অয়েল গরম করে রসুন কুচি হালকা সোনালী করে সাঁতলে নিন।`;
    recipe.steps[2].instructionBn = `টমেটো পেস্ট বা কুচি এবং সামান্য লবণ দিয়ে মাঝারি আঁচে ১০ মিনিট জ্বাল দিন।`;
    recipe.steps[3].instructionBn = `এবার প্যানে ${starNameBn} যোগ করুন এবং রসালো ও সেদ্ধ হওয়া পর্যন্ত মৃদু আঁচে রান্না করুন।`;
    recipe.steps[4].instructionBn = `নামানোর আগে সতেজ তুলসী পাতা এবং সামান্য এক্সট্রা ভার্জিন অলিভ অয়েল ছড়িয়ে দিন।`;
  }
  else {
    if (idSet.has('avocado') || idSet.has('corn-tortilla')) {
      recipe.titleBn = `মেক্সিকান ${starNameBn} স্ট্রিট ট্যাকোস`;
      recipe.descriptionBn = `ভুট্টার ট্যাকোর ভেতর তাজা অ্যাভোকাডো ও লেবুর রসে মাখানো মশলাদার এবং সতেজ ${starNameBn} এর একটি চমৎকার মেক্সিকান রেসিপি।`;
      recipe.culturalNoteBn = `মেক্সিকান ট্যাকো রান্নার অন্যতম ঐতিহ্য হলো গরম ও সতেজ ভুট্টার রুটির (টর্টিয়া) ব্যবহার।`;
    } else {
      recipe.titleBn = `মেক্সিকান ফাজিটাস ${starNameBn}`;
      recipe.descriptionBn = `পেঁয়াজ, ক্যাপসিকাম, জিরা ও সতেজ ধনেপাতার সাথে ভাজা গরম গরম এবং সুস্বাদু মেক্সিকান ফাজিটাস ${starNameBn}।`;
      recipe.culturalNoteBn = `ফাজিটাস সাধারণত জ্বলন্ত গরম কাস্ট আয়রন প্যানে পরিবেশন করা হয় যার ধোঁয়াটে ফ্লেভার দারুণ আকর্ষণীয়।`;
    }
    recipe.steps[0].instructionBn = `প্রথমে ${starNameBn} পাতলা ফালি করে কেটে জিরা, মরিচ গুঁড়ো ও লবণ মাখিয়ে মেরিনেট করুন।`;
    recipe.steps[1].instructionBn = `কাস্ট আয়রন প্যান বা তাওয়া অতিরিক্ত গরম করে মশলা মাখানো ${starNameBn} ভালো করে ভেজে নিন।`;
    recipe.steps[2].instructionBn = `প্যানে একইসাথে পেঁয়াজ ও ক্যাপসিকাম ফালি যোগ করে হালকা নরম করে সাঁতলে নিন।`;
    recipe.steps[3].instructionBn = `শুকনো প্যানে ভুট্টার টর্টিয়া (রুটি) হালকা গরম ও নরম করে নিন।`;
    recipe.steps[4].instructionBn = `টর্টিয়ার মাঝে প্রস্তুতকৃত ${starNameBn} দিন এবং ওপর থেকে ধনেপাতা ও লেবুর রস ছড়িয়ে পরিবেশন করুন।`;
  }

  return recipe;
}
