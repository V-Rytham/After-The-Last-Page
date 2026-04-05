import { logger } from '../utils/logger.js';

export default function registerSocketEvents(io, sessionManager) {
  if (!sessionManager) {
    throw new Error('sessionManager is required');
  }
  let onlineCount = 0;

  const getSearchingCount = () => (
    Array.from(sessionManager.queue.values()).reduce((sum, queue) => sum + (queue?.length || 0), 0)
  );

  const emitStats = () => {
    io.emit('match_stats', {
      online: onlineCount,
      searching: getSearchingCount(),
      updatedAt: new Date().toISOString(),
    });
  };

  io.use((socket, next) => {
    socket.userId = String(socket.handshake?.auth?.userId || socket.handshake?.query?.userId || 'dev-user');
    socket.userRole = 'admin';
    next();
  });

  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id, userId: socket.userId }, 'Socket connected');
    sessionManager.registerSocket({ userId: socket.userId, socketId: socket.id });
    onlineCount += 1;
    emitStats();

    socket.emit('match_stats', {
      online: onlineCount,
      searching: getSearchingCount(),
      updatedAt: new Date().toISOString(),
    });

    socket.on('join_matchmaking', async ({ bookId, prefType }) => {
      try {
        await sessionManager.joinMatchmaking({ userId: socket.userId, bookId, prefType });
      } catch (apiError) {
        socket.emit('access_denied', { message: apiError.message || 'Unable to join matchmaking.' });
      } finally {
        emitStats();
      }
    });

    socket.on('leave_matchmaking', () => {
      sessionManager.leaveMatchmaking({ userId: socket.userId });
      emitStats();
    });

    socket.on('enter_conversation', ({ roomId }) => {
      sessionManager.enterConversation({ userId: socket.userId, roomId });
    });

    socket.on('leave_room', async ({ roomId, reason }) => {
      await sessionManager.leaveRoom({ userId: socket.userId, roomId, reason: reason || 'left' });
      emitStats();
    });

    socket.on('send_message', ({ roomId, message, senderId }) => {
      socket.to(roomId).emit('receive_message', { message, senderId, timestamp: new Date() });
    });

    socket.on('webrtc_offer', ({ roomId, offer }) => {
      socket.to(roomId).emit('webrtc_offer', { offer });
    });

    socket.on('webrtc_answer', ({ roomId, answer }) => {
      socket.to(roomId).emit('webrtc_answer', { answer });
    });

    socket.on('webrtc_ice_candidate', ({ roomId, candidate }) => {
      socket.to(roomId).emit('webrtc_ice_candidate', { candidate });
    });

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id, userId: socket.userId }, 'Socket disconnected');
      onlineCount = Math.max(0, onlineCount - 1);
      sessionManager.unregisterSocket({ socketId: socket.id });
      emitStats();
    });
  });
}
