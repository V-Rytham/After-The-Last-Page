import express from 'express';
import cors from 'cors';
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
  console.error('[UnhandledRejection]', reason);
});

process.on('uncaughtException', (error) => {
  logger.error({ error: error?.message, stack: error?.stack }, 'Uncaught exception');
  console.error('[UncaughtException]', error);
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
  allowedHeaders: ['Content-Type', 'X-Book-Action-Id', 'X-Book-Action-Name', 'X-User-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 600,
  credentials: true,
}));
app.use(securityHeaders);
app.use(requestTracing);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'success')) {
      console.info('[API] final API response', {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        success: Boolean(payload.success),
      });
      return originalJson(payload);
    }

    if (res.statusCode >= 400) {
      const message = String(payload?.message || 'Request failed.');
      const normalizedError = { success: false, message };
      if (payload && typeof payload === 'object') {
        Object.entries(payload).forEach(([key, value]) => {
          if (key !== 'message') normalizedError[key] = value;
        });
      }
      console.info('[API] final API response', {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        success: false,
      });
      return originalJson(normalizedError);
    }

    const normalizedSuccess = { success: true, data: payload };
    console.info('[API] final API response', {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      success: true,
    });
    return originalJson(normalizedSuccess);
  };
  next();
});
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

app.get('/api/health', (_req, res) => res.status(200).json({ status: 'ok' }));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error({ port: PORT }, 'Port already in use');
    console.error(`[ServerError] Port ${PORT} already in use.`);
    return;
  }

  logger.error({ error: error?.message, stack: error?.stack }, 'Fatal server error');
  console.error('[ServerError]', error);
});

try {
  await connectDB();
} catch (error) {
  logger.warn({ error: error?.message || error }, 'Starting in degraded mode without database');
}


try {
  const redisClient = await connectRedis();
  if (redisClient) {
    logger.info('Redis connected');
  } else {
    logger.warn('Redis disabled. Continuing in degraded mode.');
  }
} catch (error) {
  logger.warn({ error: error?.message || error }, 'Failed to connect Redis. Continuing in degraded mode.');
}

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'Nexus core listening');
});
