// ============================================
// network.js - Socket.IO Client
// ============================================

const Network = {
  socket: null,
  connected: false,

  getPlayerId() {
    return App.loggedInUsername || null;
  },

  init() {
    this.socket = io();

    this.socket.on('connect', () => {
      this.connected = true;
      this.updateStatusDot(true);
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this.updateStatusDot(false);
      console.log('Disconnected from server');
    });

    this.setupGameEvents();
  },

  updateStatusDot(connected) {
    const dot = document.querySelector('.status-dot');
    const label = document.querySelector('.status-label');
    if (dot) dot.classList.toggle('disconnected', !connected);
    if (label) label.textContent = connected ? '已连接' : '已断开';
  },

  // Auth operations
  register(username, password, cb) {
    this.socket.emit('register', { username, password }, cb);
  },

  login(username, password, cb) {
    this.socket.emit('login', { username, password }, cb);
  },

  autoLogin(username, token, cb) {
    this.socket.emit('autoLogin', { username, token }, cb);
  },

  logout(username) {
    this.socket.emit('logout', { username });
  },

  // Room operations
  createRoom(playerName, cb) {
    this.socket.emit('createRoom', { playerName, playerId: this.getPlayerId() }, cb);
  },

  joinRoom(roomId, playerName, cb) {
    this.socket.emit('joinRoom', { roomId, playerName, playerId: this.getPlayerId() }, cb);
  },

  quickMatch(playerName, cb) {
    this.socket.emit('quickMatch', { playerName, playerId: this.getPlayerId() }, cb);
  },

  startGame() {
    this.socket.emit('startGame');
  },

  sendAction(decision) {
    this.socket.emit('action', decision);
  },

  requestNewGame() {
    this.socket.emit('newGame');
  },

  requestNewGameFull() {
    this.socket.emit('newGameFull');
  },

  // Setup game event listeners
  setupGameEvents() {
    const s = this.socket;

    s.on('playerJoined', (data) => {
      App.onPlayerJoined(data);
    });

    s.on('playerLeft', (data) => {
      App.onPlayerLeft(data);
    });

    s.on('roundStart', (data) => {
      App.onRoundStart(data);
    });

    s.on('blindsPosted', (data) => {
      App.onBlindsPosted(data);
    });

    s.on('cardsDealt', (data) => {
      App.onCardsDealt(data);
    });

    s.on('holeCards', (data) => {
      App.onHoleCards(data);
    });

    s.on('community', (data) => {
      App.onCommunity(data);
    });

    s.on('activePlayer', (data) => {
      App.onActivePlayer(data);
    });

    s.on('yourTurn', (data) => {
      App.onYourTurn(data);
    });

    s.on('playerAction', (data) => {
      App.onPlayerAction(data);
    });

    s.on('bettingDone', (data) => {
      App.onBettingDone(data);
    });

    s.on('showCards', (data) => {
      App.onShowCards(data);
    });

    s.on('roundEnd', (data) => {
      App.onRoundEnd(data);
    });

    s.on('gameOver', (data) => {
      App.onGameOver(data);
    });

    s.on('needsRecharge', (data) => {
      App.onNeedsRecharge(data);
    });
  }
};
