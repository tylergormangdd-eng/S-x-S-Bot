import OpenAI from 'openai';
import { retrieveRelevantChunks } from './vectorIndex.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';

export async function answerWithAI(question) {
  const chunks = await retrieveRelevantChunks(question);
  const sources = dedupeSources(chunks);

  const context = chunks.map((chunk, i) => {
    return `SOURCE ${i + 1}\nTitle: ${chunk.title}\nURL: ${chunk.url}\nCategory: ${chunk.category}\nRelevance: ${chunk.score.toFixed(3)}\nText: ${chunk.text}`;
  }).join('\n\n---\n\n');

  const prompt = `
Player question:
${question}

Retrieved EOG.GG context:
${context}

Answer the player using only the retrieved EOG.GG context. Be concise, helpful, and game-focused.
If the context does not contain the answer, say you could not find it in the EOG sources.
Do not invent stats, codes, builds, or patch info.
Use bullet points when useful.
Mention when the answer is based on a best matching source rather than an exact source.
`;

  const response = await openai.responses.create({
    model: MODEL,
    instructions: 'You are a Sword x Staff Discord assistant. You answer from EOG.GG source context only. You are concise, organized, and helpful to players.',
    input: prompt
  });

  return {
    text: response.output_text || 'I could not generate an answer from the retrieved EOG context.',
    confidence: confidenceFromScore(chunks[0]?.score || 0),
    sources
  };
}

function dedupeSources(chunks) {
  const map = new Map();

  for (const chunk of chunks) {
    if (!map.has(chunk.url)) {
      map.set(chunk.url, {
        title: chunk.title,
        url: chunk.url,
        image: chunk.image,
        category: chunk.category,
        score: chunk.score
      });
    }
  }

  return [...map.values()].slice(0, 4);
}

function confidenceFromScore(score) {
  if (score >= 0.78) return 'High';
  if (score >= 0.68) return 'Good';
  if (score >= 0.55) return 'Possible match';
  return 'Low / best available source';
}
