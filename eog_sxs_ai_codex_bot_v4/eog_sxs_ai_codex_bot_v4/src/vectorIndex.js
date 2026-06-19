import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';

const DATA_DIR = path.resolve('data');
const INDEX_PATH = path.join(DATA_DIR, 'vector-index.json');
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function hasVectorIndex() {
  try {
    const raw = await fs.readFile(INDEX_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.chunks) && parsed.chunks.length > 0;
  } catch {
    return false;
  }
}

export async function buildVectorIndex(catalog) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to build the AI vector index.');
  }

  const chunks = [];

  for (const item of catalog.items) {
    for (const [index, text] of chunkText(item).entries()) {
      chunks.push({
        id: `${item.id}-${index}`,
        itemId: item.id,
        title: item.title,
        url: item.url,
        image: item.image,
        category: item.category,
        text
      });
    }
  }

  const embedded = [];

  for (let i = 0; i < chunks.length; i += 32) {
    const batch = chunks.slice(i, i + 32);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch.map(chunk => chunk.text),
      encoding_format: 'float'
    });

    response.data.forEach((entry, idx) => {
      embedded.push({
        ...batch[idx],
        embedding: entry.embedding
      });
    });
  }

  const index = {
    createdAt: new Date().toISOString(),
    model: EMBEDDING_MODEL,
    chunks: embedded
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(INDEX_PATH, JSON.stringify(index), 'utf8');

  return index;
}

export async function retrieveRelevantChunks(question, topK = Number(process.env.TOP_K_CONTEXT || 6)) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for AI answers.');
  }

  const index = await loadIndex();
  if (!index.chunks.length) {
    throw new Error('Vector index is empty. Run /sxs-refresh.');
  }

  const queryEmbeddingResponse = await openai.embeddings.create({
    model: index.model || EMBEDDING_MODEL,
    input: question,
    encoding_format: 'float'
  });

  const queryEmbedding = queryEmbeddingResponse.data[0].embedding;

  return index.chunks
    .map(chunk => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

async function loadIndex() {
  const raw = await fs.readFile(INDEX_PATH, 'utf8');
  return JSON.parse(raw);
}

function chunkText(item) {
  const sections = [
    `Title: ${item.title}`,
    `Category: ${item.category}`,
    `Summary: ${item.summary || ''}`,
    `Tags: ${(item.tags || []).join(', ')}`,
    `Headings: ${(item.headings || []).join(' | ')}`,
    `Notes: ${(item.tldr || []).join(' | ')}`,
    `Body: ${item.text || ''}`
  ].join('\n');

  const words = sections.split(/\s+/).filter(Boolean);
  const chunks = [];
  const size = 450;
  const overlap = 80;

  for (let i = 0; i < words.length; i += size - overlap) {
    chunks.push(words.slice(i, i + size).join(' '));
  }

  return chunks.filter(chunk => chunk.length > 120);
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
