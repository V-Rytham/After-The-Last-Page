import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB } from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import bookRoutes from './routes/bookRoutes.js';
import threadRoutes from './routes/threadRoutes.js';
import recommenderRoutes from './routes/recommenderRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import registerSocketEvents from './socket/socketHandler.js';
import { Book } from './models/Book.js';
import { defaultBooks } from './seed/defaultBooks.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      const allowList = new Set([
        process.env.CLIENT_URL,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ].filter(Boolean));

      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowList.has(origin)) {
        callback(null, true);
        return;
      }

      try {
        const parsed = new URL(origin);
        const hostname = parsed.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        const isPrivateLan = hostname.startsWith('192.168.')
          || hostname.startsWith('10.')
          || /^172\\.(1[6-9]|2\\d|3[0-1])\\./.test(hostname);

        if ((isLocalhost || isPrivateLan) && parsed.port === '5173') {
          callback(null, true);
          return;
        }
      } catch {
        // Fallthrough to reject.
      }

      callback(new Error(`Socket origin not allowed: ${origin}`));
    },
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Register Socket Events
registerSocketEvents(io);

// Routes
app.use('/api/users', userRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/recommender', recommenderRoutes);
app.use('/api/agent', agentRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Nexus Core Online' });
});

const PORT = process.env.PORT || 5000;

httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[SERVER] Port ${PORT} is already in use. Is the server already running?`);
    process.exit(1);
  }

  console.error('[SERVER] Fatal error:', error);
  process.exit(1);
});

const seedBooksIfEmpty = async () => {
  if (process.env.DISABLE_STARTUP_SEED === 'true') {
    return;
  }

  if (!defaultBooks.length) {
    return;
  }

  const existingBooks = await Book.find({ gutenbergId: { $exists: true, $ne: null } }).select('gutenbergId');
  const existingGutenbergIds = new Set(
    existingBooks
      .map((book) => Number(book.gutenbergId))
      .filter((id) => Number.isFinite(id)),
  );

  const missingBooks = defaultBooks.filter((book) => {
    const gutenbergId = Number(book.gutenbergId);
    return Number.isFinite(gutenbergId) && !existingGutenbergIds.has(gutenbergId);
  });

  if (!missingBooks.length) {
    return;
  }

  await Book.insertMany(missingBooks, { ordered: false });
  console.log(`[SEED] Inserted ${missingBooks.length} missing starter books.`);
};

await connectDB();
await seedBooksIfEmpty();

httpServer.listen(PORT, () => {
  console.log(`[SERVER] Nexus core listening on port ${PORT}`);
});
