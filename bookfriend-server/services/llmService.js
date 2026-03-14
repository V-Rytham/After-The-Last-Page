import { resolveLlmProvider } from '../config/env.js';

const sanitizeAssistantResponse = (value) => {
  const input = String(value || '').trim();

  const rawJsonMatch = input.match(/^```json\s*([\s\S]*?)\s*```$/i);
  const maybeJson = rawJsonMatch ? rawJsonMatch[1] : input;
  if (maybeJson.startsWith('{') && maybeJson.endsWith('}')) {
    try {
      const parsed = JSON.parse(maybeJson);
      const candidate = parsed?.response || parsed?.message || parsed?.final || parsed?.content;
      if (candidate) {
        return sanitizeAssistantResponse(candidate);
      }
    } catch {
      // Continue with string cleanup path.
    }
  }

  // Remove common chain-of-thought style blocks emitted by some local models.
  const withoutThinkBlocks = input
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, ' ');

  // Remove generic XML/HTML-like tags that should not be shown in the chat UI.
  const withoutMetaBlocks = withoutThinkBlocks
    .replace(/<(meta|debug|payload|context|tool)[^>]*>[\s\S]*?<\/\1>/gi, ' ');

  const withoutTags = withoutMetaBlocks.replace(/<[^>]+>/g, ' ');

  // Remove common prefixed labels.
  const withoutLabels = withoutTags
    .replace(/^\s*(payload|metadata|mode|source)\s*:\s*.*$/gim, ' ')
    .replace(/^\s*(assistant|final|response)\s*:\s*/i, '')
    .trim();

  return withoutLabels.replace(/\s{2,}/g, ' ');
};
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
    return `Great question. A lot depends on how we read the characters' motivations in that scene. Which character choice feels most important to you there?`;
  }

  return `That's an insightful take. I can see why that would stand out in ${bookMeta.title}. Do you think that moment changes how we should view the main character's decisions?`;
};

export const generateAgentReply = async ({ systemPrompt, bookMeta, retrievedChunks, history, userMessage }) => {
  const { provider, source } = resolveLlmProvider();
  const prompt = buildUserPrompt({ bookMeta, retrievedChunks, history, userMessage });

  if (provider === 'ollama') {
    const ollamaUrl = process.env.BOOKFRIEND_OLLAMA_URL || 'http://127.0.0.1:11434/api/chat';
    const response = await fetch(ollamaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.BOOKFRIEND_OLLAMA_MODEL || 'llama3.1:8b-instruct-q4_K_M',
        stream: false,
        options: {
          temperature: 0.8,
        },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama request failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    const content = data?.message?.content;
    const cleaned = sanitizeAssistantResponse(content);
    return cleaned || buildMockResponse({ userMessage, bookMeta });
  }

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is missing for BOOKFRIEND_LLM_PROVIDER=openai.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.BOOKFRIEND_OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.8,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const cleaned = sanitizeAssistantResponse(content);
    return cleaned || buildMockResponse({ userMessage, bookMeta });
  }

  if (provider === 'mock') {
    return sanitizeAssistantResponse(buildMockResponse({ userMessage, bookMeta }));
  }

  throw new Error(
    `Unsupported BOOKFRIEND_LLM_PROVIDER="${provider}" (source: ${source}). Use one of: mock, ollama, openai.`,
  );
};
