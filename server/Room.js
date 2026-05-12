// ============================================
// server/Room.js - Room Management
// ============================================
const { ServerGame } = require('./ServerGame');

class Room {
  constructor(id, io) {
    this.id = id;
    this.io = io;
    this.game = new ServerGame(this);
    this.sockets = new Map(); // socketId -> socket
    this.maxPlayers = 4;
  }

  get playerCount() {
    return this.game.players.filter(p => !p.isAI).length;
  }

  get isFull() {
    return this.game.players.length >= this.maxPlayers;
  }

  addSocket(socket, playerName) {
    if (this.game.running) return { ok: false, reason: '游戏进行中，无法加入' };
    if (this.game.players.length >= this.maxPlayers) return { ok: false, reason: '房间已满' };

    this.sockets.set(socket.id, socket);
    socket.join(this.id);
    this.game.addPlayer(socket.id, playerName, socket.id);

    // Notify everyone
    this.broadcast('playerJoined', {
      name: playerName,
      players: this.game.getPublicPlayers(),
      playerCount: this.game.players.length
    });

    return { ok: true };
  }

  removeSocket(socketId) {
    this.sockets.delete(socketId);
    this.game.removePlayer(socketId);

    this.broadcast('playerLeft', {
      players: this.game.getPublicPlayers(),
      playerCount: this.playerCount
    });
  }

  startGame() {
    if (this.game.running) return;
    // Fill remaining seats with AI
    this.game.fillWithAI();
    this.game.dealerIndex = Math.floor(Math.random() * this.game.players.length);
    this.game.startRound();
  }

  broadcast(event, data) {
    this.io.to(this.id).emit(event, data);
  }

  emitTo(socketId, event, data) {
    const socket = this.sockets.get(socketId);
    if (socket) socket.emit(event, data);
  }

  isEmpty() {
    return this.playerCount === 0;
  }
}

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  createRoom() {
    const id = this.generateId();
    const room = new Room(id, this.io);
    this.rooms.set(id, room);
    return room;
  }

  getRoom(id) {
    return this.rooms.get(id);
  }

  deleteRoom(id) {
    this.rooms.delete(id);
  }

  // Quick match: find a room that's waiting or create new
  quickMatch() {
    for (const [id, room] of this.rooms) {
      if (!room.game.running && !room.isFull && room.playerCount > 0) {
        return room;
      }
    }
    return this.createRoom();
  }

  getRoomList() {
    const list = [];
    for (const [id, room] of this.rooms) {
      if (!room.isEmpty()) {
        list.push({
          id,
          playerCount: room.playerCount,
          maxPlayers: room.maxPlayers,
          running: room.game.running
        });
      }
    }
    return list;
  }

  cleanEmpty() {
    for (const [id, room] of this.rooms) {
      if (room.isEmpty()) this.rooms.delete(id);
    }
  }

  generateId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }
}

module.exports = { Room, RoomManager };
