import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import agentRoutes from './routes/agentRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'bookfriend-agent-server' });
});

app.use('/agent', agentRoutes);

const port = process.env.PORT || 5050;

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`[BOOKFRIEND] Agent server listening on ${port}`);
    });
  })
  .catch((error) => {
    console.error('[BOOKFRIEND] Failed to boot:', error.message);
    process.exit(1);
  });
