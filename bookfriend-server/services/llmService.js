import { resolveLlmProvider } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { cachedRequest, hashRequestBody } from './httpClient.js';

const getGroqApiKey = () => process.env.GROQ_API_KEY || process.env.BOOKFRIEND_GROQ_API_KEY;

const buildUserPrompt = ({ bookMeta, retrievedChunks, history, userMessage }) => {
  const formattedChunks = (retrievedChunks || [])
    .map((chunk, index) => `(${index + 1}) [chapter ${chunk.chapterIndex ?? 'unknown'}] ${chunk.text}`)
    .join('\n\n');

  const formattedHistory = (history || [])
    .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
    .join('\n');

  return `Book metadata:\n${JSON.stringify(bookMeta, null, 2)}\n\nRelevant excerpts:\n${formattedChunks || 'No excerpts available.'}\n\nRecent conversation:\n${formattedHistory || 'No prior messages.'}\n\nReader message:\n${userMessage}`;
};

const buildMockResponse = ({ userMessage, bookMeta }) => {
  const trimmed = String(userMessage || '').trim();
  const seed = trimmed.toLowerCase();

  if (seed.length <= 8) {
    return `I like where you're going with that. In ${bookMeta.title}, what feeling does that moment leave with you right now?`;
  }

  if (seed.includes('?')) {
    return 'Great question. A lot depends on how we read the characters\' motivations in that scene. Which character choice feels most important to you there?';
  }

  return `That's an insightful take. I can see why that would stand out in ${bookMeta.title}. Do you think that moment changes how we should view the main character's decisions?`;
};

const buildMessages = (systemPrompt, prompt) => ([
  { role: 'system', content: systemPrompt },
  { role: 'user', content: prompt },
]);

export const generateAgentReply = async ({ systemPrompt, bookMeta, retrievedChunks, history, userMessage }) => {
  const { provider, source } = resolveLlmProvider();
  logger.info({ provider, source }, 'Resolved LLM provider');

  const prompt = buildUserPrompt({ bookMeta, retrievedChunks, history, userMessage });

  if (provider === 'mock') {
    return buildMockResponse({ userMessage, bookMeta });
  }

  const providerRequests = {
    ollama: () => {
      const body = {
        model: process.env.BOOKFRIEND_OLLAMA_MODEL || 'llama3.1:8b-instruct-q4_K_M',
        stream: false,
        options: { temperature: 0.8 },
        messages: buildMessages(systemPrompt, prompt),
      };

      return cachedRequest({
        cacheKey: `bookfriend:llm:ollama:${hashRequestBody(body)}`,
        cacheTtlSeconds: 60,
        url: process.env.BOOKFRIEND_OLLAMA_URL || 'http://127.0.0.1:11434/api/chat',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    },
    groq: () => {
      const apiKey = getGroqApiKey();
      const body = {
        model: process.env.BOOKFRIEND_GROQ_MODEL || 'llama-3.1-8b-instant',
        temperature: 0.8,
        messages: buildMessages(systemPrompt, prompt),
      };

      return cachedRequest({
        cacheKey: `bookfriend:llm:groq:${hashRequestBody(body)}`,
        cacheTtlSeconds: 60,
        url: process.env.BOOKFRIEND_GROQ_BASE_URL || 'https://api.groq.com/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body,
      });
    },
    openai: () => {
      const body = {
        model: process.env.BOOKFRIEND_OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.8,
        messages: buildMessages(systemPrompt, prompt),
      };

      return cachedRequest({
        cacheKey: `bookfriend:llm:openai:${hashRequestBody(body)}`,
        cacheTtlSeconds: 60,
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body,
      });
    },
  };

  if (provider === 'groq' && !getGroqApiKey()) {
    throw new Error('GROQ_API_KEY is missing for BOOKFRIEND_LLM_PROVIDER=groq.');
  }

  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is missing for BOOKFRIEND_LLM_PROVIDER=openai.');
  }

  const requester = providerRequests[provider];
  if (!requester) {
    throw new Error(`Unsupported BOOKFRIEND_LLM_PROVIDER="${provider}".`);
  }

  const data = await requester();
  return data?.message?.content?.trim()
    || data?.choices?.[0]?.message?.content?.trim()
    || buildMockResponse({ userMessage, bookMeta });
};
