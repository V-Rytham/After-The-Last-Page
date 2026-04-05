import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB } from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import bookRoutes from './routes/bookRoutes.js';
import threadRoutes from './routes/threadRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import registerSocketEvents from './socket/socketHandler.js';
import accessRoutes from './routes/accessRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import { buildSessionRoutes } from './routes/sessionRoutes.js';
import { buildMatchmakingRoutes } from './routes/matchmakingRoutes.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { rateLimit } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';
import { isProd } from './utils/runtime.js';
import { logger } from './utils/logger.js';
import { connectRedis } from './utils/redisClient.js';
import { success } from './utils/apiResponse.js';
import { RealtimeSessionManager } from './services/realtimeSessionManager.js';
import { requestTracing } from './middleware/requestLogging.js';
import recommenderRoutes from './routes/recommenderRoutes.js';
import { requireDatabase } from './middleware/degradedModeMiddleware.js';
import { attachDevUserContext } from './middleware/devUserContext.js';
import authRoutes from './routes/authRoutes.js';
import { attachAuthContext } from './middleware/auth.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', isProd() ? 1 : 0);

const httpServer = createServer(app);

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ error: error?.message }, 'Uncaught exception');
  process.exit(1);
});

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

const buildCorsOriginValidator = () => {
  const allowList = new Set([
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean));

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowList.has(origin)) {
      callback(null, true);
      return;
    }

    if (!isProd()) {
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
        // ignore parse errors
      }
    }

    callback(new Error('Origin not allowed by CORS.'));
  };
};

app.use(cors({
  origin: buildCorsOriginValidator(),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Book-Action-Id', 'X-Book-Action-Name'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 600,
  credentials: true,
}));
app.use(securityHeaders);
app.use(requestTracing);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(attachAuthContext);

if (String(process.env.DEV_AUTH_BYPASS || '').toLowerCase() === 'true') {
  app.use(attachDevUserContext);
}

// Baseline abuse protection for all endpoints.
app.use(rateLimit({ windowMs: 15 * 60_000, max: 100 }));
// Tighten common abuse targets.
app.use('/api/quiz', rateLimit({ windowMs: 60_000, max: 60 }));
app.use('/api/access', rateLimit({ windowMs: 60_000, max: 90 }));

const sessionManager = new RealtimeSessionManager(io);
// Register Socket Events
registerSocketEvents(io, sessionManager);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/threads', requireDatabase({ status: 503, feature: 'Threads' }), threadRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/session', requireDatabase({ feature: 'Realtime sessions' }), buildSessionRoutes(sessionManager));
app.use('/api/matchmaking', requireDatabase({ feature: 'Meet' }), buildMatchmakingRoutes(sessionManager));
app.use('/api/recommender', requireDatabase({ feature: 'Recommendations' }), recommenderRoutes);

app.get('/api/health', (req, res) => {
  try {
    const dbConnected = mongoose.connection.readyState === 1;

    return success(res, {
      status: dbConnected ? 'ok' : 'degraded',
      db: dbConnected ? 'connected' : 'disconnected',
      uptime: process.uptime(),
    });
  } catch (_ERROR) {
    return success(res, {
      status: 'degraded',
      db: 'unknown',
    });
  }
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error({ port: PORT }, 'Port already in use');
    process.exit(1);
  }

  logger.error({ error: error?.message }, 'Fatal server error');
  process.exit(1);
});

try {
  await connectDB();
} catch (error) {
  logger.warn({ error: error?.message || error }, 'Starting in degraded mode without database');
}


try {
  await connectRedis();
  logger.info('Redis connected');
} catch (error) {
  logger.error({ error: error?.message || error }, 'Failed to connect Redis');
  process.exit(1);
}

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'Nexus core listening');
});
