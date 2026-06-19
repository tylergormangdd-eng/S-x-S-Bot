# Sword x Staff AI Codex Bot V4

This is the upgraded **Version 4 AI Codex Bot**.

It combines:

- EOG.GG Sword x Staff crawler
- Auto-refreshing catalog
- Local vector search using OpenAI embeddings
- AI-generated player answers
- Discord dropdown menus
- Source links and images
- Railway deployment config

## What players can do

```text
/sxs
```

Open the visual Sword x Staff Codex menu.

```text
/ask question:best Sage build for support
/ask question:what Fantomon should Sage use
/ask question:latest codes
/ask question:who is best for PvE
```

The bot searches EOG.GG content, retrieves the most relevant chunks, and answers clearly with sources.

```text
/sxs-search query:sage dark healer
```

Keyword search.

```text
/sxs-refresh
```

Admin-only manual refresh of the EOG catalog and AI index.

## Why this is better than V3

V3 used keyword search.

V4 uses retrieval-augmented generation:

1. Crawl EOG.GG Sword x Staff pages.
2. Split pages into chunks.
3. Create OpenAI embeddings for each chunk.
4. Store embeddings locally in `data/vector-index.json`.
5. When a player asks a question, embed the question.
6. Find the closest EOG chunks.
7. Ask OpenAI to answer only from those sources.
8. Send a polished Discord embed with source buttons/images.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in:

```env
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=...
OPENAI_API_KEY=...
```

Register slash commands:

```bash
npm run deploy
```

Start:

```bash
npm start
```

## Railway

Make sure these files are at the **root** of your GitHub repo:

```text
package.json
index.js
deploy-commands.js
railway.json
nixpacks.toml
src/
```

Railway variables:

```env
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=...
OPENAI_API_KEY=...
EOG_BASE_URL=https://eog.gg/games/sword-x-staff/
CACHE_MINUTES=30
MAX_CRAWL_PAGES=150
BOT_COLOR=0x8B5CF6
OPENAI_MODEL=gpt-5.5
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
TOP_K_CONTEXT=6
```

## Important notes

- This bot uses public EOG.GG pages only.
- It keeps EOG.GG source links attached.
- It does not need Pinecone or a database for small/medium use.
- For a very large server or thousands of pages, upgrade the vector store to Pinecone, Supabase Vector, or Qdrant.
