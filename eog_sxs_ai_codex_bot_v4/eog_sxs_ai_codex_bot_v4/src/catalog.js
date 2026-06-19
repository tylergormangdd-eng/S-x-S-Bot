import fs from 'fs/promises';
import path from 'path';
import { crawlEog } from './crawler.js';
import { buildVectorIndex, hasVectorIndex } from './vectorIndex.js';

const BASE_URL = process.env.EOG_BASE_URL || 'https://eog.gg/games/sword-x-staff/';
const CACHE_MINUTES = Number(process.env.CACHE_MINUTES || 30);
const CACHE_MS = CACHE_MINUTES * 60 * 1000;
const DATA_DIR = path.resolve('data');
const CATALOG_PATH = path.join(DATA_DIR, 'catalog.json');

let catalog = {
  sourceUrl: BASE_URL,
  updatedAt: null,
  items: []
};

const CATEGORY_ORDER = ['overview', 'tier-list', 'guides', 'builds', 'database', 'roadmap', 'codes', 'verdict', 'other'];

export async function getCatalog() {
  await loadCatalogFromDisk();

  const stale = !catalog.updatedAt || Date.now() - new Date(catalog.updatedAt).getTime() > CACHE_MS;
  if (stale) await refreshAll(false);

  return catalog;
}

export async function refreshAll(force = false) {
  await loadCatalogFromDisk();

  const stale = !catalog.updatedAt || Date.now() - new Date(catalog.updatedAt).getTime() > CACHE_MS;

  if (force || stale || !catalog.items.length) {
    catalog = await crawlEog(BASE_URL);
    await saveCatalogToDisk(catalog);
  }

  if (force || !(await hasVectorIndex())) {
    await buildVectorIndex(catalog);
  }

  return catalog;
}

export function getCategories() {
  const available = new Set(catalog.items.map(item => item.category));
  return CATEGORY_ORDER.filter(category => available.has(category));
}

export function getItemsByCategory(category) {
  return catalog.items.filter(item => item.category === category).sort((a, b) => a.title.localeCompare(b.title));
}

export function getItemById(id) {
  return catalog.items.find(item => item.id === id);
}

export async function searchCatalog(query, limit = 10) {
  await getCatalog();

  const terms = tokenize(query);

  return catalog.items
    .map(item => {
      const haystack = [item.title, item.summary, item.category, ...(item.tags || []), ...(item.headings || []), item.text].join(' ').toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (item.title.toLowerCase().includes(term)) score += 12;
        if ((item.tags || []).join(' ').toLowerCase().includes(term)) score += 8;
        if (haystack.includes(term)) score += 2;
      }
      return { item, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map(result => result.item);
}

async function loadCatalogFromDisk() {
  if (catalog.items.length) return;
  try {
    const raw = await fs.readFile(CATALOG_PATH, 'utf8');
    catalog = JSON.parse(raw);
  } catch {
    // no cached catalog yet
  }
}

async function saveCatalogToDisk(value) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CATALOG_PATH, JSON.stringify(value, null, 2), 'utf8');
}

function tokenize(query) {
  const stop = new Set(['the', 'a', 'an', 'for', 'to', 'is', 'are', 'what', 'which', 'how', 'do', 'i', 'get', 'info', 'about']);
  return query.toLowerCase().split(/\W+/).filter(word => word.length > 2 && !stop.has(word));
}
