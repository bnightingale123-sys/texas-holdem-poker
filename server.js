// ============================================
// server.js - Main Express + Socket.IO Server
// ============================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { RoomManager } = require('./server/Room');
const { updatePlayer } = require('./server/persistence');
const { register, login, verifyToken, logout } = require('./server/auth');

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

  // ---- Auth Events ----

  socket.on('register', ({ username, password }, cb) => {
    const result = register(username, password);
    if (typeof cb === 'function') cb(result);
  });

  socket.on('login', ({ username, password }, cb) => {
    const result = login(username, password);
    if (typeof cb === 'function') cb(result);
  });

  socket.on('autoLogin', ({ username, token }, cb) => {
    const ok = verifyToken(username, token);
    if (typeof cb === 'function') cb({ ok });
  });

  socket.on('logout', ({ username }) => {
    logout(username);
  });

  // ---- Room Events ----
  socket.on('getRooms', (cb) => {
    if (typeof cb === 'function') cb(roomManager.getRoomList());
  });

  // Create room
  socket.on('createRoom', ({ playerName, playerId }, cb) => {
    if (currentRoom) { currentRoom.removeSocket(socket.id); }
    const room = roomManager.createRoom();
    const result = room.addSocket(socket, playerName || '玩家', playerId);
    if (result.ok) {
      currentRoom = room;
      if (typeof cb === 'function') cb({ ok: true, roomId: room.id });
    } else {
      if (typeof cb === 'function') cb({ ok: false, reason: result.reason });
    }
  });

  // Join room
  socket.on('joinRoom', ({ roomId, playerName, playerId }, cb) => {
    if (currentRoom) { currentRoom.removeSocket(socket.id); }
    const room = roomManager.getRoom(roomId);
    if (!room) {
      if (typeof cb === 'function') cb({ ok: false, reason: '房间不存在' });
      return;
    }
    const result = room.addSocket(socket, playerName || '玩家', playerId);
    if (result.ok) {
      currentRoom = room;
      if (typeof cb === 'function') cb({ ok: true, roomId: room.id, players: room.game.getPublicPlayers() });
    } else {
      if (typeof cb === 'function') cb({ ok: false, reason: result.reason });
    }
  });

  // Quick match
  socket.on('quickMatch', ({ playerName, playerId }, cb) => {
    if (currentRoom) { currentRoom.removeSocket(socket.id); }
    const room = roomManager.quickMatch();
    const result = room.addSocket(socket, playerName || '玩家', playerId);
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

  // Request new round (after game over) — preserve human chip counts
  socket.on('newGame', () => {
    if (!currentRoom || currentRoom.game.running) return;

    const game = currentRoom.game;
    const requestingPlayer = game.getPlayerBySocket(socket.id);

    // If the requesting player is broke, reject silently (client should handle this)
    if (requestingPlayer && !requestingPlayer.isAI && requestingPlayer.chips <= 0) {
      socket.emit('needsRecharge', { reason: '积分不足，请充值后继续' });
      return;
    }

    // Reset round state but KEEP human chips intact; only reset AI chips
    for (const p of game.players) {
      p.folded = false;
      p.allIn = false;
      if (p.isAI) {
        // Replenish AI chips if they busted so the game can continue
        if (p.chips <= 0) p.chips = 10000;
      }
      // Human chips are intentionally NOT reset here
    }
    game.roundNumber = 0;
    game.smallBlind = 50;
    game.bigBlind = 100;
    game.saveHumanPlayers();
    currentRoom.startGame();
  });

  // Full game reset with fresh chips (used after recharge / first-time start)
  socket.on('newGameFull', () => {
    if (!currentRoom || currentRoom.game.running) return;
    const game = currentRoom.game;
    for (const p of game.players) {
      p.chips = 10000;
      p.folded = false;
      p.allIn = false;
    }
    game.roundNumber = 0;
    game.smallBlind = 50;
    game.bigBlind = 100;
    game.saveHumanPlayers();
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
      // Save human player chips before removing
      currentRoom.game.saveHumanPlayers();
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
