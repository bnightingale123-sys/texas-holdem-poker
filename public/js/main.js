// ============================================
// main.js - Multiplayer App Controller
// ============================================

const App = {
  myIndex: -1,
  myCards: [],
  roomId: '',
  isOwner: false,
  currentPot: 0,
  currentMinRaise: 100,

  init() {
    Sound.init();
    Network.init();
    this.setupLobbyEvents();
    this.setupGameControls();
    this.setupSoundToggle();
    Credits.init();
    UI.initMobile();
  },

  setupSoundToggle() {
    document.getElementById('sound-toggle').addEventListener('click', () => {
      const on = Sound.toggle();
      document.getElementById('sound-toggle').textContent = on ? '🔊' : '🔇';
      Sound.click();
    });
  },

  setupLobbyEvents() {
    document.getElementById('btn-quick-match').addEventListener('click', () => {
      Sound.click();
      const name = this.getPlayerName();
      Network.quickMatch(name, (res) => {
        if (res.ok) {
          this.roomId = res.roomId;
          this.isOwner = (res.players.length === 1);
          this.showWaitingRoom(res.roomId, res.players);
        } else { UI.showError(res.reason || '匹配失败 Match failed'); }
      });
    });

    document.getElementById('btn-create-room').addEventListener('click', () => {
      Sound.click();
      const name = this.getPlayerName();
      Network.createRoom(name, (res) => {
        if (res.ok) {
          this.roomId = res.roomId;
          this.isOwner = true;
          this.showWaitingRoom(res.roomId, []);
        } else { UI.showError(res.reason); }
      });
    });

    document.getElementById('btn-join-room').addEventListener('click', () => {
      Sound.click();
      const name = this.getPlayerName();
      const code = document.getElementById('room-code-input').value.trim().toUpperCase();
      if (!code) { UI.showError('请输入房间号 Please enter room code'); return; }
      Network.joinRoom(code, name, (res) => {
        if (res.ok) {
          this.roomId = res.roomId;
          this.isOwner = false;
          this.showWaitingRoom(res.roomId, res.players);
        } else { UI.showError(res.reason || '加入失败 Join failed'); }
      });
    });

    document.getElementById('btn-start-game').addEventListener('click', () => {
      Sound.click();
      Network.startGame();
    });
  },

  setupGameControls() {
    document.getElementById('btn-fold').addEventListener('click', () => {
      Sound.fold();
      Network.sendAction({ action: 'fold' });
      UI.updateControls({ isPlayerTurn: false });
    });
    document.getElementById('btn-check').addEventListener('click', () => {
      Sound.check();
      Network.sendAction({ action: 'check' });
      UI.updateControls({ isPlayerTurn: false });
    });
    document.getElementById('btn-call').addEventListener('click', () => {
      Sound.chipBet();
      Network.sendAction({ action: 'call' });
      UI.updateControls({ isPlayerTurn: false });
    });
    document.getElementById('btn-raise').addEventListener('click', () => {
      Sound.raise();
      const amount = parseInt(document.getElementById('raise-input').value) || this.currentMinRaise;
      Network.sendAction({ action: 'raise', amount });
      UI.updateControls({ isPlayerTurn: false });
    });
    document.getElementById('btn-allin').addEventListener('click', () => {
      Sound.allIn();
      Network.sendAction({ action: 'allin' });
      UI.updateControls({ isPlayerTurn: false });
    });

    document.getElementById('raise-half-pot').addEventListener('click', () => {
      Sound.click();
      document.getElementById('raise-input').value = Math.max(this.currentMinRaise, Math.floor(this.currentPot / 2));
    });
    document.getElementById('raise-pot').addEventListener('click', () => {
      Sound.click();
      document.getElementById('raise-input').value = Math.max(this.currentMinRaise, this.currentPot);
    });
    document.getElementById('raise-2x').addEventListener('click', () => {
      Sound.click();
      document.getElementById('raise-input').value = Math.max(this.currentMinRaise, this.currentMinRaise * 2);
    });
  },

  getPlayerName() {
    return document.getElementById('player-name-input').value.trim() || '玩家';
  },

  showWaitingRoom(roomId, players) {
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('waiting-screen').classList.remove('hidden');
    document.getElementById('display-room-id').textContent = roomId;
    UI.updateWaitingList(players);
    const startBtn = document.getElementById('btn-start-game');
    startBtn.style.display = this.isOwner ? 'inline-block' : 'none';
  },

  showGameScreen() {
    document.getElementById('waiting-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
  },

  // ---- Server Event Handlers ----

  onPlayerJoined(data) {
    Sound.click();
    UI.updateWaitingList(data.players);
  },

  onPlayerLeft(data) {
    UI.updateWaitingList(data.players);
  },

  onRoundStart(data) {
    this.showGameScreen();
    this.myIndex = -1;
    Sound.roundStart();
    UI.clearTable();
    data.players.forEach((p, i) => {
      p.isDealer = (i === data.dealerIndex);
      UI.updatePlayerInfo(i, p);
    });
    UI.updateGameInfo({ round: data.round, smallBlind: data.smallBlind, bigBlind: data.bigBlind, roomId: this.roomId });
    UI.showMessage(`第 ${data.round} 轮 · Round ${data.round}`, 1000);
  },

  onBlindsPosted(data) {
    Sound.chipBet();
    data.players.forEach((p, i) => {
      UI.updatePlayerInfo(i, p);
      if (p.bet > 0) UI.showPlayerBet(i, p.bet);
    });
    UI.updatePot(data.pot);
    const sbP = data.players[data.sbIndex];
    const bbP = data.players[data.bbIndex];
    UI.addLog(`<span class="log-action">${sbP.name}</span> 小盲 SB <span class="log-amount">$${data.sbAmount}</span>`);
    UI.addLog(`<span class="log-action">${bbP.name}</span> 大盲 BB <span class="log-amount">$${data.bbAmount}</span>`);
  },

  onCardsDealt(data) {
    data.players.forEach((p, i) => {
      if (p.hasCards && !p.folded && i !== this.myIndex) {
        Sound.cardDeal();
        UI.renderFaceDownCards(i);
      }
    });
  },

  onHoleCards(data) {
    this.myIndex = data.yourIndex;
    this.myCards = data.cards;
    Sound.cardFlip();
    UI.renderPlayerHand(this.myIndex, data.cards, true);
  },

  onCommunity(data) {
    const phaseNames = { flop: '翻牌 Flop', turn: '转牌 Turn', river: '河牌 River' };
    // Play card sounds with delay for each community card
    const newCards = data.phase === 'flop' ? 3 : 1;
    for (let i = 0; i < newCards; i++) {
      setTimeout(() => Sound.communityCard(), i * 150);
    }
    UI.renderCommunityCards(data.cards);
    UI.updatePot(data.pot);
    this.currentPot = data.pot;
    UI.showMessage(phaseNames[data.phase] || data.phase, 800);
  },

  onActivePlayer(data) {
    data.players.forEach((p, i) => {
      UI.updatePlayerInfo(i, p);
      UI.showPlayerBet(i, p.bet);
    });
    UI.updatePot(data.pot);
    this.currentPot = data.pot;
    this.currentMinRaise = data.minRaise;
  },

  onYourTurn(data) {
    Sound.yourTurn();
    UI.updateControls({
      isPlayerTurn: true,
      currentBet: data.currentBet,
      playerBet: data.playerBet,
      playerChips: data.chips,
      minRaise: data.minRaise
    });
    this.currentPot = data.pot;
    this.currentMinRaise = data.minRaise;
  },

  onPlayerAction(data) {
    // Play sound based on action type
    const soundMap = { fold: 'fold', call: 'chipBet', raise: 'raise', check: 'check', allin: 'allIn' };
    const soundFn = soundMap[data.action];
    if (soundFn && data.index !== this.myIndex) Sound[soundFn]();

    UI.showActionLabel(data.index, data.action);
    UI.showPlayerBet(data.index, data.bet);
    data.players.forEach((p, i) => UI.updatePlayerInfo(i, p));
    UI.updatePot(data.pot);
    this.currentPot = data.pot;

    const actionNames = { fold:'弃牌 Fold', call:'跟注 Call', raise:'加注到 Raised to', check:'过牌 Check', allin:'全押 All In' };
    const label = actionNames[data.action] || data.action;
    const amountStr = data.amount > 0 ? ` <span class="log-amount">$${data.amount.toLocaleString()}</span>` : '';
    UI.addLog(`<span class="log-action">${data.name}</span> ${label}${amountStr}`);
  },

  onBettingDone(data) {
    data.players.forEach((p, i) => UI.updatePlayerInfo(i, p));
    UI.updatePot(data.pot);
    document.querySelectorAll('.player-bet').forEach(b => b.remove());
  },

  onShowCards(data) {
    Sound.cardFlip();
    data.players.forEach(p => {
      UI.renderPlayerHand(p.index, p.cards, true);
    });
  },

  onRoundEnd(data) {
    const isMyWin = data.winners.some(w => w.index === this.myIndex);
    if (isMyWin) { Sound.win(); } else { Sound.chipStack(); }

    data.players.forEach((p, i) => {
      p.isWinner = data.winners.some(w => w.index === i);
      UI.updatePlayerInfo(i, p);
    });
    UI.showRoundResult({ winners: data.winners });
  },

  onGameOver(data) {
    const myPlayer = this.myIndex >= 0 ? data.players[this.myIndex] : null;
    const myChips = myPlayer ? myPlayer.chips : 0;
    if (myChips > 0) { Sound.win(); } else { Sound.lose(); }
    UI.showGameOver(myChips).then(() => {
      // Only deduct credits if player lost all chips
      if (myChips <= 0) {
        if (Credits.canAffordGame()) {
          if (!Credits.spendForGame()) {
            UI.showError('积分扣除失败 Deduction failed');
            return;
          }
          Network.requestNewGame();
        } else {
          UI.showError('积分不足！请领取每日积分或充值 · Insufficient credits! Claim daily bonus or top up.');
          setTimeout(() => Credits.openModal(), 600);
        }
      } else {
        // Player still has chips — free restart
        Network.requestNewGame();
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
