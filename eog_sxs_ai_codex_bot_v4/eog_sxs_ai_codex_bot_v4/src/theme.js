export const BRAND = {
  name: 'Sword x Staff AI Codex',
  color: Number(process.env.BOT_COLOR || '0x8B5CF6'),
  footer: 'EOG.GG sources • AI answer generated from retrieved page content',
  logo: null
};

export const CATEGORY_META = {
  overview: { label: 'Overview', emoji: '🧭', description: 'Start here: game overview and core systems.' },
  'tier-list': { label: 'Tier List', emoji: '🏆', description: 'Rankings, meta picks, and recommendations.' },
  guides: { label: 'Guides', emoji: '📘', description: 'How-to guides and explainers.' },
  builds: { label: 'Builds', emoji: '⚔️', description: 'Class builds, roles, stats, and comps.' },
  database: { label: 'Database', emoji: '🗃️', description: 'Skills, Fantomons, companions, items, and systems.' },
  roadmap: { label: 'Roadmap', emoji: '🗺️', description: 'Upcoming updates and future features.' },
  codes: { label: 'Codes', emoji: '🎁', description: 'Redeem codes, rewards, and code updates.' },
  verdict: { label: 'Verdict', emoji: '✅', description: 'Reviews, impressions, and recommendations.' },
  other: { label: 'Other', emoji: '🔎', description: 'Extra Sword x Staff pages found on EOG.' }
};

export function categoryLabel(category) {
  const meta = CATEGORY_META[category] || CATEGORY_META.other;
  return `${meta.emoji} ${meta.label}`;
}

export function categoryDescription(category) {
  return (CATEGORY_META[category] || CATEGORY_META.other).description;
}

export function trimForDiscord(text, max = 1000) {
  if (!text) return 'Not found.';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
