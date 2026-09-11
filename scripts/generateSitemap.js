import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { recipes } from '../src/data/recipes.js';
import { cuisines } from '../src/data/cuisines.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const DOMAIN = 'https://rannabanna.onrender.com';
const TODAY = new Date().toISOString().split('T')[0];

const urls = [];

// 1. Core Platform Pages
urls.push({
  loc: `${DOMAIN}/`,
  lastmod: TODAY,
  changefreq: 'daily',
  priority: '1.0'
});

urls.push({
  loc: `${DOMAIN}/cuisines`,
  lastmod: TODAY,
  changefreq: 'weekly',
  priority: '0.8'
});

urls.push({
  loc: `${DOMAIN}/search`,
  lastmod: TODAY,
  changefreq: 'weekly',
  priority: '0.8'
});

// 2. All Cuisines
for (const cuisine of cuisines) {
  urls.push({
    loc: `${DOMAIN}/cuisine/${cuisine.id}`,
    lastmod: TODAY,
    changefreq: 'weekly',
    priority: '0.8'
  });
}

// 3. All Recipes
for (const recipe of recipes) {
  urls.push({
    loc: `${DOMAIN}/recipe/${recipe.id}`,
    lastmod: TODAY,
    changefreq: 'monthly',
    priority: '0.7'
  });
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

const publicPath = path.join(rootDir, 'public', 'sitemap.xml');
fs.writeFileSync(publicPath, xml, 'utf-8');
console.log(`✅ Generated sitemap with ${urls.length} URLs at ${publicPath}`);

const distPath = path.join(rootDir, 'dist', 'sitemap.xml');
if (fs.existsSync(path.dirname(distPath))) {
  fs.writeFileSync(distPath, xml, 'utf-8');
  console.log(`✅ Synced sitemap to ${distPath}`);
}
