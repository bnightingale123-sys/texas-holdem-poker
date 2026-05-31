// ============================================
// server.js - Main Express + Socket.IO Server
// ============================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { RoomManager } = require('./server/Room');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  let currentRoom = null;

  // Get room list
  socket.on('getRooms', (cb) => {
    if (typeof cb === 'function') cb(roomManager.getRoomList());
  });

  // Create room
  socket.on('createRoom', ({ playerName }, cb) => {
    if (currentRoom) { currentRoom.removeSocket(socket.id); }
    const room = roomManager.createRoom();
    const result = room.addSocket(socket, playerName || '玩家');
    if (result.ok) {
      currentRoom = room;
      if (typeof cb === 'function') cb({ ok: true, roomId: room.id });
    } else {
      if (typeof cb === 'function') cb({ ok: false, reason: result.reason });
    }
  });

  // Join room
  socket.on('joinRoom', ({ roomId, playerName }, cb) => {
    if (currentRoom) { currentRoom.removeSocket(socket.id); }
    const room = roomManager.getRoom(roomId);
    if (!room) {
      if (typeof cb === 'function') cb({ ok: false, reason: '房间不存在' });
      return;
    }
    const result = room.addSocket(socket, playerName || '玩家');
    if (result.ok) {
      currentRoom = room;
      if (typeof cb === 'function') cb({ ok: true, roomId: room.id, players: room.game.getPublicPlayers() });
    } else {
      if (typeof cb === 'function') cb({ ok: false, reason: result.reason });
    }
  });

  // Quick match
  socket.on('quickMatch', ({ playerName }, cb) => {
    if (currentRoom) { currentRoom.removeSocket(socket.id); }
    const room = roomManager.quickMatch();
    const result = room.addSocket(socket, playerName || '玩家');
    if (result.ok) {
      currentRoom = room;
      if (typeof cb === 'function') cb({ ok: true, roomId: room.id, players: room.game.getPublicPlayers() });
    } else {
      if (typeof cb === 'function') cb({ ok: false, reason: result.reason });
    }
  });

  // Start game (room owner)
  socket.on('startGame', () => {
    if (!currentRoom) return;
    // Only first player (room creator) can start
    const players = currentRoom.game.players;
    if (players.length > 0 && players[0].socketId === socket.id) {
      currentRoom.startGame();
    }
  });

  // Player action
  socket.on('action', (decision) => {
    if (!currentRoom) return;
    currentRoom.game.handleAction(socket.id, decision);
  });

  // Request new round (after game over)
  socket.on('newGame', () => {
    if (!currentRoom || currentRoom.game.running) return;
    // Reset chips
    for (const p of currentRoom.game.players) {
      p.chips = 10000;
      p.folded = false;
      p.allIn = false;
    }
    currentRoom.game.roundNumber = 0;
    currentRoom.game.smallBlind = 50;
    currentRoom.game.bigBlind = 100;
    currentRoom.startGame();
  });

  // Credits purchased via ETH
  socket.on('creditsPurchased', (data) => {
    const { credits, txHash, walletAddress } = data || {};
    console.log(`[Credits] ${socket.id} purchased ${credits} credits | tx: ${txHash} | wallet: ${walletAddress}`);
    // Notify the room so other players can react (e.g. show a VIP crown)
    if (currentRoom) {
      currentRoom.broadcast('playerCreditsUpdated', {
        socketId: socket.id,
        credits
      });
    }
  });

  // VIP purchased via ETH
  socket.on('vipPurchased', (data) => {
    const { txHash, walletAddress, expiresAt } = data || {};
    const expiryStr = expiresAt ? new Date(expiresAt).toLocaleDateString('zh-CN') : '未知';
    console.log(`[VIP] ${socket.id} activated VIP | expires: ${expiryStr} | tx: ${txHash} | wallet: ${walletAddress}`);
    // Broadcast VIP status to the room so other players see the crown
    if (currentRoom) {
      currentRoom.broadcast('playerVIPActivated', {
        socketId: socket.id,
        expiresAt
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    if (currentRoom) {
      currentRoom.removeSocket(socket.id);
      if (currentRoom.isEmpty()) {
        roomManager.deleteRoom(currentRoom.id);
      }
      currentRoom = null;
    }
  });
});

// Clean empty rooms periodically
setInterval(() => roomManager.cleanEmpty(), 60000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🃏 Texas Hold'em Server running on port ${PORT}`);
});
