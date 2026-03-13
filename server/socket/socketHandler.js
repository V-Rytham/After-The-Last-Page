export default function registerSocketEvents(io) {
  const queues = {};

  io.on('connection', (socket) => {
    console.log(`[SOCKET] User connected: ${socket.id}`);

    socket.on('join_matchmaking', ({ bookId, prefType }) => {
      const queueKey = `${bookId}_${prefType}`;

      if (!queues[queueKey]) {
        queues[queueKey] = [];
      }

      if (queues[queueKey].length > 0) {
        const partnerSocketId = queues[queueKey].shift();
        const partnerSocket = io.sockets.sockets.get(partnerSocketId);
        if (partnerSocket) {
          const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(7)}`;

          socket.join(roomId);
          partnerSocket.join(roomId);

          socket.emit('match_found', {
            roomId,
            role: 'caller',
            message: 'You have been paired with a fellow reader.',
          });

          partnerSocket.emit('match_found', {
            roomId,
            role: 'callee',
            message: 'You have been paired with a fellow reader.',
          });

          console.log(`[SOCKET] Matched ${socket.id} & ${partnerSocketId} in ${roomId}`);
        } else {
          queues[queueKey].push(socket.id);
        }
      } else {
        queues[queueKey].push(socket.id);
        console.log(`[SOCKET] ${socket.id} added to queue ${queueKey}`);
      }
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
      console.log(`[SOCKET] User disconnected: ${socket.id}`);
      for (const key in queues) {
        queues[key] = queues[key].filter((id) => id !== socket.id);
      }
    });
  });
}
