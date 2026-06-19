import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

const MAX_CRAWL_PAGES = Number(process.env.MAX_CRAWL_PAGES || 150);

export async function crawlEog(baseUrl) {
  const seen = new Set();
  const queue = [normalizeUrl(baseUrl)];
  const items = [];

  while (queue.length && seen.size < MAX_CRAWL_PAGES) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);

    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      const item = parsePage($, url);
      if (item) items.push(item);

      for (const link of extractInternalLinks($, url, baseUrl)) {
        if (!seen.has(link) && !queue.includes(link)) queue.push(link);
      }
    } catch (error) {
      console.warn(`Failed to crawl ${url}: ${error.message}`);
    }
  }

  return {
    sourceUrl: baseUrl,
    updatedAt: new Date().toISOString(),
    items: dedupeItems(items)
  };
}

async function fetchPage(url) {
  const { data } = await axios.get(url, {
    headers: { 'User-Agent': 'Sword x Staff AI Codex Discord bot; caches public EOG.GG pages respectfully' },
    timeout: 12000
  });
  return data;
}

function parsePage($, url) {
  const title = clean($('h1').first().text()) || clean($('title').first().text()).replace(' - EOG.GG', '') || 'Sword x Staff';
  const bodyText = clean($('body').text());
  if (!bodyText.toLowerCase().includes('sword x staff')) return null;

  const metaDescription = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
  const summary = clean(metaDescription) || firstUsefulParagraph($) || bodyText.slice(0, 280);

  const image = absoluteUrl(
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    $('article img').first().attr('src') ||
    $('img').first().attr('src') ||
    '',
    url
  );

  const headings = $('h2, h3').map((_, el) => clean($(el).text())).get().filter(Boolean).filter(text => text.length <= 120);
  const listItems = $('li').map((_, el) => clean($(el).text())).get().filter(text => text.length > 8 && text.length <= 220);
  const paragraphs = $('p').map((_, el) => clean($(el).text())).get().filter(text => text.length > 40 && text.length <= 300);

  return {
    id: stableId(url),
    title,
    url,
    category: inferCategory(url, title, bodyText),
    summary: summary.slice(0, 700),
    image,
    date: inferDate(bodyText),
    tags: inferTags(title, summary, bodyText, url),
    headings,
    tldr: inferTldr(bodyText, listItems, paragraphs),
    text: bodyText.slice(0, 15000)
  };
}

function extractInternalLinks($, currentUrl, baseUrl) {
  const base = new URL(baseUrl);
  const links = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const abs = normalizeUrl(absoluteUrl(href, currentUrl));
    if (!abs) return;

    const parsed = new URL(abs);
    if (parsed.hostname !== base.hostname) return;
    if (!parsed.pathname.startsWith(base.pathname)) return;
    if (parsed.pathname.includes('/cdn-cgi/')) return;

    links.push(abs);
  });

  return [...new Set(links)];
}

function inferCategory(url, title, text) {
  const path = new URL(url).pathname.toLowerCase();
  const combined = `${title} ${text}`.toLowerCase();

  if (path.endsWith('/games/sword-x-staff/') || path.endsWith('/games/sword-x-staff')) return 'overview';
  if (path.includes('tier') || combined.includes('tier list')) return 'tier-list';
  if (path.includes('build') || (/sage|sorcerer|duelist|knight/.test(combined) && combined.includes('stat focus'))) return 'builds';
  if (path.includes('database') || /skills|fantomons|companions|relics/.test(combined)) return 'database';
  if (path.includes('roadmap')) return 'roadmap';
  if (path.includes('codes') || combined.includes('redeem codes')) return 'codes';
  if (path.includes('verdict') || combined.includes('final verdict')) return 'verdict';
  if (path.includes('guide') || combined.includes('beginner guide')) return 'guides';

  return 'other';
}

function inferTags(title, summary, text, url) {
  const all = `${title} ${summary} ${text} ${url}`.toLowerCase();
  const candidates = [
    'sage', 'sorcerer', 'duelist', 'knight', 'beginner', 'advanced', 'build', 'builds',
    'pvp', 'pve', 'f2p', 'gacha', 'pity', 'fantomons', 'companions', 'relics', 'dungeons',
    'daily', 'food', 'destiny fruit', 'void rifts', 'grand treasure hunt', 'codes',
    'roadmap', 'tier list', 'skills', 'dark', 'fire', 'ice'
  ];
  return candidates.filter(tag => all.includes(tag));
}

function inferDate(text) {
  const updated = text.match(/Updated:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  if (updated) return `Updated ${updated[1]}`;
  const date = text.match(/([A-Za-z]+\s+\d{1,2},\s+\d{4})/);
  return date ? date[1] : null;
}

function inferTldr(bodyText, listItems, paragraphs) {
  const useful = [...listItems, ...paragraphs].filter(line => !/privacy|cookie|advertis|newsletter/i.test(line));
  return useful.slice(0, 10);
}

function firstUsefulParagraph($) {
  return $('p').map((_, el) => clean($(el).text())).get().find(text => text.length > 50) || '';
}

function dedupeItems(items) {
  const map = new Map();
  for (const item of items) if (!map.has(item.url)) map.set(item.url, item);
  return [...map.values()].sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
}

function stableId(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function absoluteUrl(href, base) {
  if (!href) return '';
  try { return new URL(href, base).toString(); } catch { return ''; }
}

function normalizeUrl(url) {
  const parsed = new URL(url);
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString();
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
