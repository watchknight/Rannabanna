-- ══════════════════════════════════════════════════════════════
-- RANNABANNA POSTGRESQL SCHEMA (SUPABASE)
-- ══════════════════════════════════════════════════════════════

-- 1. Cuisines
CREATE TABLE IF NOT EXISTS cuisines (
    "id" VARCHAR(64) PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "nameBn" VARCHAR(255),
    "region" VARCHAR(100),
    "regionBn" VARCHAR(100),
    "continent" VARCHAR(100),
    "description" TEXT,
    "descriptionBn" TEXT,
    "color" VARCHAR(50),
    "emoji" VARCHAR(50)
);

-- 2. Ingredients
CREATE TABLE IF NOT EXISTS ingredients (
    "id" VARCHAR(64) PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "nameBn" VARCHAR(255),
    "category" VARCHAR(100),
    "subCategory" VARCHAR(100),
    "emoji" VARCHAR(50),
    "sweet" INTEGER DEFAULT 0,
    "salty" INTEGER DEFAULT 0,
    "sour" INTEGER DEFAULT 0,
    "bitter" INTEGER DEFAULT 0,
    "umami" INTEGER DEFAULT 0,
    "spicy" INTEGER DEFAULT 0,
    "isCommon" BOOLEAN DEFAULT FALSE
);

-- 3. Recipes
CREATE TABLE IF NOT EXISTS recipes (
    "id" VARCHAR(64) PRIMARY KEY,
    "title" VARCHAR(255) NOT NULL,
    "titleBn" VARCHAR(255),
    "cuisineId" VARCHAR(64) REFERENCES cuisines("id") ON DELETE SET NULL,
    "difficulty" VARCHAR(32) DEFAULT 'intermediate',
    "prepTime" INTEGER DEFAULT 0,
    "cookTime" INTEGER DEFAULT 0,
    "servings" INTEGER DEFAULT 4,
    "baseServings" INTEGER DEFAULT 4,
    "calories" INTEGER DEFAULT 0,
    "description" TEXT,
    "descriptionBn" TEXT,
    "culturalNote" TEXT,
    "culturalNoteBn" TEXT,
    "imageEmoji" VARCHAR(50)
);

-- 4. Recipe Meal Types
CREATE TABLE IF NOT EXISTS recipe_meal_types (
    "recipeId" VARCHAR(64) REFERENCES recipes("id") ON DELETE CASCADE,
    "mealType" VARCHAR(64),
    PRIMARY KEY ("recipeId", "mealType")
);

-- 5. Recipe Dietary Tags
CREATE TABLE IF NOT EXISTS recipe_dietary_tags (
    "recipeId" VARCHAR(64) REFERENCES recipes("id") ON DELETE CASCADE,
    "dietaryTag" VARCHAR(64),
    PRIMARY KEY ("recipeId", "dietaryTag")
);

-- 6. Recipe Ingredients
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    "id" SERIAL PRIMARY KEY,
    "recipeId" VARCHAR(64) REFERENCES recipes("id") ON DELETE CASCADE,
    "ingredientId" VARCHAR(64) REFERENCES ingredients("id") ON DELETE CASCADE,
    "quantity" NUMERIC(10, 2),
    "unit" VARCHAR(64),
    "preparation" VARCHAR(255),
    "isEssential" BOOLEAN DEFAULT TRUE,
    "ingredientGroup" VARCHAR(64) DEFAULT 'Main'
);

-- 7. Recipe Steps
CREATE TABLE IF NOT EXISTS recipe_steps (
    "id" SERIAL PRIMARY KEY,
    "recipeId" VARCHAR(64) REFERENCES recipes("id") ON DELETE CASCADE,
    "stepNumber" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "instructionBn" TEXT,
    "duration" INTEGER DEFAULT 0,
    "technique" VARCHAR(100)
);

-- 8. Users
CREATE TABLE IF NOT EXISTS users (
    "id" VARCHAR(64) PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users("email");

-- 9. Saved Recipes (Bookmarks)
CREATE TABLE IF NOT EXISTS saved_recipes (
    "id" SERIAL PRIMARY KEY,
    "user_id" VARCHAR(64) NOT NULL REFERENCES users("id") ON DELETE CASCADE,
    "recipe_id" VARCHAR(64) NOT NULL REFERENCES recipes("id") ON DELETE CASCADE,
    "saved_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("user_id", "recipe_id")
);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_user ON saved_recipes("user_id");

-- 10. Generation History
CREATE TABLE IF NOT EXISTS generation_history (
    "id" SERIAL PRIMARY KEY,
    "user_id" VARCHAR(64) REFERENCES users("id") ON DELETE SET NULL,
    "ingredient_ids" TEXT NOT NULL,
    "cuisine_id" VARCHAR(64) DEFAULT 'any',
    "generated_recipe_id" VARCHAR(64) REFERENCES recipes("id") ON DELETE SET NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gen_history_user ON generation_history("user_id");

-- 11. Persistent Translation Cache
CREATE TABLE IF NOT EXISTS translation_cache (
    "id" SERIAL PRIMARY KEY,
    "source_hash" VARCHAR(128) UNIQUE NOT NULL,
    "source_text" TEXT NOT NULL,
    "target_lang" VARCHAR(16) NOT NULL DEFAULT 'bn',
    "translated_text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trans_cache_hash ON translation_cache("source_hash");

-- 12. Persistent AI Custom Recipes Cache
CREATE TABLE IF NOT EXISTS ai_recipes_cache (
    "id" SERIAL PRIMARY KEY,
    "cache_key" VARCHAR(128) UNIQUE NOT NULL,
    "recipe_id" VARCHAR(64) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "recipe_json" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_recipe_cache_key ON ai_recipes_cache("cache_key");
