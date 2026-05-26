# 🍳 Rannabanna: Global Ingredient-Based Cooking Platform
## Master Project Index, Executive Summary, & Complete System Blueprints

Welcome to the central repository for **Rannabanna** — the next-generation, ingredient-first culinary discovery engine. Rannabanna eliminates food waste and inspires global culinary exploration by intelligently connecting the ingredients in a user's kitchen to recipes from every corner of the world.

This document serves as the **Grand Entrance Index** and **Product Manager Wrapper** for the entire project, providing high-level business pitches, UI/UX interaction specifications, and a detailed developer implementation roadmap to build the platform from scratch using our generated blueprints.

---

## 1. Project Executive Summary & Pitch Outline

### 🚨 The Problem: Kitchen Friction & Ingredient Waste
1.  **Ingredient-First Inefficiency:** Every day, millions of home cooks open their refrigerators, see a collection of random ingredients, and ask: *"What can I make with this?"* Traditional recipe platforms are designed around a **dish-first search paradigm** (e.g., searching for "Chicken Tikka Masala"), forcing users to buy additional ingredients and leading to food waste.
2.  **Cross-Cuisine Naming Fragmentation:** Recipes on the web are highly localized. A Bangladeshi site refers to Coriander as **"Dhania Pata"**; a Western site calls it **"Cilantro"**; a Chinese site lists it as **"Xiang Cai"**; a Thai site terms it **"Phak Chi"**. Scrapers and search engines fail to map these overlapping ingredients, creating duplicate records and broken search matches.

### 💡 The Solution: Rannabanna's Core Innovation
Rannabanna solves this through an automated, data-driven semantic normalization pipeline:
-   **The Global Ingredient Vault (GIV):** A unified, botanically-aligned master database of ingredients mapping all localized names and script variations (e.g., Bengali, Hindi, Chinese, Thai, Spanish) to singular, unique database IDs.
-   **The Data Normalization Layer (DNL):** An intelligent, serverless data pipeline that extracts recipe data from 11 target platforms, parses quantity-unit strings, scales densities, and standardizes ingredients to GIV IDs.

### 💎 Value Proposition: Scalability vs. Static Archives

```
+-------------------------------------------------------------------------+
|                    STATIC RECIPE ARCHIVES                               |
| - Hardcoded database entries                                            |
| - Inflexible search (strict keyword matching only)                      |
| - Duplicated ingredient records (Cilantro vs. Dhania Pata)              |
| - Scales linearly (More recipes = more manual editorial work)            |
+-------------------------------------------------------------------------+
                                   vs
+-------------------------------------------------------------------------+
|                     RANNABANNA PLATFORM SCALE                           |
| - Unified GIV botanical index resolves aliases automatically            |
| - Automated DNL pipeline ingests & standardizes recipes at scale        |
| - Weighted scoring (Core vs. Staples) ensures accurate partial matches  |
| - Scales exponentially (Automated ingestion from 11 premium sites)      |
+-------------------------------------------------------------------------+
```

---

## 2. UI/UX Visual Layout & User Flow Specification

Rannabanna's visual architecture is clean, modern, and highly interactive. It uses a **dark-mode-first aesthetic**, **glassmorphism panels** with blur backdrops, and **vibrant accents** (warm orange-to-pink gradients `#FF6B35` → `#E91E63`) to create a premium, premium feel.

### 2.1 The Ingredient Selection Vault
The primary homepage hub, optimized for both Desktop and Mobile viewports.

```
+-------------------------------------------------------------------------+
|                               🍳 Rannabanna                             |
+-------------------------------------------------------------------------+
|                                                                         |
|                Cook the World with What You Have                        |
|                                                                         |
|   [ 🥫 Selected: Chicken Breast x  |  Mustard Oil x  |  Add +          ] |
|                                                                         |
|   +-----------------------------------------------------------------+   |
|   | 🔍 Type to search... (e.g. garlic, chili, cumin)                |   |
|   +-----------------------------------------------------------------+   |
|                                                                         |
|   [ All ]  [ Proteins ]  [ Vegetables ]  [ Grains ]  [ Spices ]         |
|   +-------------------+ +-------------------+ +-------------------+   |
|   | 🍗 Chicken Breast | | 🥦 Broccoli       | | 🌾 Basmati Rice   |   |
|   |    [Selected]     | |    [Add]          | |    [Add]          |   |
|   +-------------------+ +-------------------+ +-------------------+   |
|                                                                         |
|                       [  Find Recipes (2) →  ]                          |
|                                                                         |
+-------------------------------------------------------------------------+
```

*   **Selected Ingredients Bar:** Stretches across the top as a dynamic row of removable, animating "chips". Clicking the "x" on a chip instantly deselects it.
*   **Search Autocomplete Input:** As the user types, a glassmorphic dropdown appears below the search box, displaying matched ingredients grouped by category, with their respective cuisine flags.
*   **Visual Category Grid:** Under the search bar, users can browse categorized grids of ingredients represented by large, friendly emojis and text chips. Selected chips turn into a glowing orange-bordered state.
*   **Mobile Adaptability:** On mobile devices, the category tabs become a horizontally scrollable bar, and the grid scales from a 4-column layout down to 2 columns for comfortable tap targets ($48\text{px}$ minimum height).

### 2.2 The Dynamic Match Results Page
Displays recipes matched against the user's kitchen, categorized by match bands.

```
+-------------------------------------------------------------------------+
|   🔍 2 Ingredients Selected: Chicken Breast, Mustard Oil                |
+-------------------------------------------------------------------------+
|  FILTERS          |  MATCH RESULTS                                      |
|                   |                                                     |
|  [ ] Bengali      |  === Perfect Matches ✨ (100% Core Ingredients) ===  |
|  [ ] Indian       |  +-----------------------------------------------+  |
|  [ ] Thai         |  | 🍛 Shorshe Chicken   [ 100% Match ]            |  |
|                   |  | Coated in mustard paste, simmered in oil...  |  |
|  Meal Type        |  | Missing: None                                 |  |
|  (o) Dinner       |  +-----------------------------------------------+  |
|  ( ) Lunch        |                                                     |
|                   |  === Great Matches 🔥 (70% - 94% Core) ============  |
|  Max Time: 45m    |  +-----------------------------------------------+  |
|  [====o--------]  |  | 🍲 Thai Green Curry  [ 82% Match ]             |  |
|                   |  | Missing: (x) Lemongrass    (x) Thai Basil     |  |
|  Dietary          |  |          [ + Add to Cart ]   [ + Add to Cart ]|  |
|  [x] Gluten-Free  |  +-----------------------------------------------+  |
+-------------------------------------------------------------------------+
```

*   **Filter Panel (Left Sidebar):** A sticky control panel containing checkboxes for cuisines, a horizontal range slider for max ready time, a dropdown for meal type, and toggles for dietary restrictions. On mobile, this collapses into a floating "Filter" button that slides up a full-screen drawer.
*   **Match Quality Sections:** Recipes are grouped into visual sections: *Perfect Matches ✨*, *Great Matches 🔥*, and *Good Matches 👍*.
*   **Color-Coded Missing Ingredients:** If a recipe is missing ingredients, the missing items are displayed in **red text with a leading warning emoji (x)**.
*   **"Quick Add" Shopping Cart Button:** Directly next to each missing ingredient is a tiny, clickable `[ + Add ]` button. Clicking this adds the missing item to the user's persistent digital shopping list in one tap.

### 2.3 The Unified Recipe View
A clean, ad-free, standardized, and print-friendly reading layout for cooking.

```
+-------------------------------------------------------------------------+
|  ← Back to Search                                     [ ❤️ Save Recipe ] |
+-------------------------------------------------------------------------+
|  🍛 Shorshe Chicken (Bengali Mustard Chicken)                           |
|  Cuisine: Bengali  |  ⏱️ 35 Mins  |  🔥 410 Kcal  |  ⭐⭐⭐⭐⭐ (48)         |
|  +-------------------------------------------------------------------+  |
|  | 📜 History: A modern regional twist on traditional fish curries...|  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  INGREDIENTS                           |  INSTRUCTIONS                  |
|  [x] 500g Chicken Breast (Matched)     |  1. Marinate the chicken in    |
|  [x] 3 tbsp Mustard Oil (Matched)      |     mustard oil and spices.    |
|  [ ] (x) 2 tbsp Mustard Seeds          |     [ ⏱️ 10 mins ]             |
|      [ + Add to Grocery Cart ]         |                                |
|  [x] 4 Green Chilies (Matched)         |  2. Temper the whole spices    |
|                                        |     in hot oil. [ ⏱️ 2 mins ]   |
+-------------------------------------------------------------------------+
```

*   **Cultural Context Note:** A stylized banner at the top of the recipe detail page highlights the cultural and historical origin of the dish (e.g. why Hilsa is celebrated or the history of tandoors).
*   **Unified Two-Column Layout:** On desktop, ingredients are displayed on the left, and step-by-step instructions on the right. On mobile, ingredients stack above the instructions.
*   **Interactive Checklist:** Ingredients feature clickable checkboxes. Checking off items dims the text, allowing the cook to keep track of their prep work.
*   **Highlighted Matches:** Ingredients that the user selected on the homepage are highlighted with a soft **green glow** and a "Matched" checkmark to reinforce value. Missing items display a **red alert box** with shopping cart integration.
*   **Technique & Timer Badges:** Each cooking step has explicit duration badges (e.g. `[ ⏱️ 10 mins ]`) and technique tags (`tempering`, `simmering`, `stir-frying`) in brand colors.

---

## 3. Master Project Document Index

The complete **Rannabanna** technical architecture and planning suite consists of the following 7 core files, stored locally in the project repository:

| Document Name & Link | Document Type | Core Contents & Technical Scope |
| :--- | :--- | :--- |
| **1. [README.md](file:///mnt/f167baf2-6b23-4290-9f3f-7f5877784e9f/Projects/Rannabanna/README.md)** *(This Document)* | Grand Project Index | Executive pitch, UI/UX interaction layouts, detailed multi-cuisine scopes, repository file directory map, and step-by-step developer build guide. |
| **2. [implementation_plan.md](file:///home/moayed/.gemini/antigravity/brain/e0bda998-7291-4d1f-9a7a-d197e77eabc7/implementation_plan.md)** | Product Manager Blueprint | Detailed product vision, target user personas, database entity-relationship schemas, target platform specifications, and the three-tier ingredient weighting hierarchy. |
| **3. [dnl_parser_strategy.md](file:///home/moayed/.gemini/antigravity/brain/e0bda998-7291-4d1f-9a7a-d197e77eabc7/dnl_parser_strategy.md)** | Data Normalization Spec | Detailed fraction parsing regex, density weight scaling formulas, alias resolution waterfall strategies, and formal matchmaking scoring engine math (Tier 1 vs. Tier 2 vs. Tier 3 calculations). |
| **4. [scraper_handbook.md](file:///home/moayed/.gemini/antigravity/brain/e0bda998-7291-4d1f-9a7a-d197e77eabc7/scraper_handbook.md)** | Web Scraper Directory | Connection rate limits, JSON-LD Schema paths, custom DOM HTML class selectors, and proxy injection rules for all 11 target cooking domains. |
| **5. [giv_dictionary.json](file:///home/moayed/.gemini/antigravity/brain/e0bda998-7291-4d1f-9a7a-d197e77eabc7/giv_dictionary.json)** | Master Database Seed | A clean baseline JSON dictionary of 150+ canonical ingredients complete with localized language aliases, scientific naming conventions, densities, and allergen flags. |
| **6. [api_specifications.md](file:///home/moayed/.gemini/antigravity/brain/e0bda998-7291-4d1f-9a7a-d197e77eabc7/api_specifications.md)** | Backend API Schema | Structured JSON payloads, endpoints, sequence graphs, and schemas for Scraper Ingestion, GIV Resolver, and Search Discovery APIs. |
| **7. [infrastructure_blueprint.md](file:///home/moayed/.gemini/antigravity/brain/e0bda998-7291-4d1f-9a7a-d197e77eabc7/infrastructure_blueprint.md)** | Systems Deployment Spec | Google Cloud and Firebase architectures, GitHub Actions CI/CD YAML configurations, Redis caching algorithms, PostgreSQL composite indexes, and security models. |

---

## 4. Step-by-Step Developer Implementation Roadmap

For engineering teams looking to initialize, build, and deploy the Rannabanna platform from this blueprint, here is the structured step-by-step execution path:

```
[ Phase 1: Database & GIV Seed ] ──> [ Phase 2: Ingest & Scraper ] ──> [ Phase 3: Matchmaking API ] ──> [ Phase 4: UI & Edge Deploy ]
```

### 🧱 Phase 1: Database Initialization & GIV Dictionary Seeding
*   **Step 1.1: Deploy Database Instance:** Set up a PostgreSQL 15 database instance using the specifications in `infrastructure_blueprint.md`.
*   **Step 1.2: Initialize Schemas:** Execute the relational database schema migrations outlined in `implementation_plan.md` (creating tables for `canonical_ingredients`, `ingredient_aliases`, `recipes`, `recipe_ingredients`, etc.).
*   **Step 1.3: Apply Performance Indexes:** Run the PostgreSQL composite index scripts detailed in `infrastructure_blueprint.md` (e.g. `idx_recipe_ingredients_matching` and `idx_ingredient_aliases_lookup`).
*   **Step 1.4: Seed GIV Dictionary:** Write a migration script to parse the 150+ ingredient objects in `giv_dictionary.json` and populate the `canonical_ingredients` and `ingredient_aliases` tables.

### 🕸️ Phase 2: Building the Scraper & Ingestion Pipeline
*   **Step 2.1: Initialize Scraper Engine:** Set up a Node.js/TypeScript microservice inside a Docker container using GCP Cloud Run.
*   **Step 2.2: Implement Site Scrapers:** Write the target site scrapers using the DOM selectors, request intervals, and JSON-LD paths defined in `scraper_handbook.md`.
*   **Step 2.3: Build Data Normalization Layer (DNL):** Coded using the pseudocode in `dnl_parser_strategy.md`:
    *   Implement `normalize_quantities` to clean strings, decimals, and ranges.
    *   Implement the regex token splitter and the `convert_to_metric` density math.
    *   Implement `resolve_canonical_id` with its 5-layer resolution heuristics.
*   **Step 2.4: Connect Ingestion API:** Build the `POST /api/v1/ingest/recipe` handler specified in `api_specifications.md` to pipe scraped payloads directly into the database. Run the validation checks from Section 4 of `dnl_parser_strategy.md`.

### 🧮 Phase 3: Building the Matchmaking Engine
*   **Step 3.1: Implement Matchmaking API:** Create the `POST /api/v1/recipes/match` endpoint according to the schemas in `api_specifications.md`.
*   **Step 3.2: Code Scoring Algorithm:** Implement the weighted matchmaking logic detailed in Section 6 of `dnl_parser_strategy.md` (calculating Tier 1 Core and Tier 2 Flavor weights, applying GIV substitution offsets, ignoring Tier 3 staples, and applying the +5% perfect core match bonus).
*   **Step 3.3: Configure Redis Cache:** Set up Google Cloud Memorystore (Redis) and implement the hashing cache-key checks described in `infrastructure_blueprint.md` to ensure matching requests resolve under $50\text{ ms}$.

### 🎨 Phase 4: Frontend Development & Deployment
*   **Step 4.1: UI Scaffolding:** Initialize a Next.js (React) web application using the UI/UX visual layout guidelines from Section 2 of this README.
*   **Step 4.2: Build Core Views:** Coded to matches specifications:
    *   Homepage with visual category grids and autocomplete searching.
    *   Search results displaying ranked matched recipes by quality bands (Perfect, Great, Good) and highlighting missing elements in red.
    *   Standardized recipe detail view with interactive checklists and step technique badges.
    *   Cuisines and Cuisine detail pages highlighting trademark ingredients lists.
*   **Step 4.3: Edge Deployment:** Set up continuous integration pipelines using the GitHub Actions `deploy.yml` YAML script in `infrastructure_blueprint.md` to deploy the frontend to Firebase App Hosting and the API to Google Cloud Run.
