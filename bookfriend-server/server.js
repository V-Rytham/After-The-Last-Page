import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { loadBookFriendEnv, resolveLlmProvider } from './config/env.js';
import agentRoutes from './routes/agentRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadBookFriendEnv();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  const provider = String(process.env.BOOKFRIEND_LLM_PROVIDER || 'mock')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .toLowerCase();

  const modelByProvider = {
    openai: process.env.BOOKFRIEND_OPENAI_MODEL || 'gpt-4o-mini',
    ollama: process.env.BOOKFRIEND_OLLAMA_MODEL || 'llama3.1:8b-instruct-q4_K_M',
    mock: 'mock',
  };

  res.json({
    status: 'ok',
    service: 'bookfriend-agent-server',
    llm_provider: provider,
    llm_model: modelByProvider[provider] || null,
  });
});

app.use('/agent', agentRoutes);

const port = process.env.PORT || 5050;

connectDB()
  .then(() => {
    const provider = String(process.env.BOOKFRIEND_LLM_PROVIDER || 'mock')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .toLowerCase();

    app.listen(port, () => {
      console.log(`[BOOKFRIEND] Agent server listening on ${port}`);
      console.log(`[BOOKFRIEND] LLM provider: ${provider}`);
    });
  })
  .catch((error) => {
    console.error('[BOOKFRIEND] Failed to boot:', error.message);
    process.exit(1);
  });
