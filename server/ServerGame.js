// ============================================
// server/ServerGame.js - Server-side Game Engine
// ============================================
const { Deck } = require('./deck');
const { evaluateHand, compareHandResult } = require('./hand');
const { AIPlayer } = require('./ai');
const { getPlayer, updatePlayer } = require('./persistence');

class ServerGame {
  constructor(room) {
    this.room = room;
    this.players = []; // {id, name, chips, holeCards, bet, folded, allIn, isAI, ai, socketId}
    this.deck = null;
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.dealerIndex = 0;
    this.activeIndex = -1;
    this.phase = 'idle';
    this.roundNumber = 0;
    this.smallBlind = 50;
    this.bigBlind = 100;
    this.minRaise = 100;
    this.lastRaiseSize = 0;
    this.playerActed = [];
    this.resolveAction = null;
    this.actionTimer = null;
    this.running = false;
  }

  addPlayer(pid, name, socketId) {
    if (this.players.length >= 4) return false;
    // Load chips from persistent database
    const saved = getPlayer(pid);
    const chips = (saved && saved.chips !== undefined && saved.chips !== null) ? saved.chips : 10000;
    this.players.push({
      pid, id: pid, name, chips, holeCards: [], bet: 0, totalBet: 0,
      folded: false, allIn: false, isAI: false, ai: null, socketId
    });
    return true;
  }

  fillWithAI() {
    const aiNames = ['Alice', 'Bob', 'Charlie'];
    const aiStyles = ['balanced', 'aggressive', 'tight'];
    let idx = 0;
    while (this.players.length < 4 && idx < 3) {
      const name = aiNames[idx];
      const ai = new AIPlayer(name, aiStyles[idx]);
      this.players.push({
        id: ai.id, name, chips: 10000, holeCards: [], bet: 0, totalBet: 0,
        folded: false, allIn: false, isAI: true, ai, socketId: null
      });
      idx++;
    }
  }

  removePlayer(socketId) {
    const idx = this.players.findIndex(p => p.socketId === socketId);
    if (idx === -1) return;
    const p = this.players[idx];
    if (this.running) {
      // Replace with AI mid-game
      const ai = new AIPlayer(p.name, 'balanced');
      p.isAI = true;
      p.ai = ai;
      p.socketId = null;
      p.id = ai.id;
    } else {
      this.players.splice(idx, 1);
    }
  }

  getPlayerBySocket(socketId) {
    return this.players.find(p => p.socketId === socketId);
  }

  // Broadcast to all human players in room
  broadcast(event, data) {
    this.room.broadcast(event, data);
  }

  emitTo(socketId, event, data) {
    this.room.emitTo(socketId, event, data);
  }

  async startRound() {
    this.running = true;
    this.roundNumber++;
    this.deck = new Deck();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.phase = 'preflop';

    for (const p of this.players) {
      p.holeCards = [];
      p.bet = 0;
      p.totalBet = 0;
      p.folded = p.chips <= 0;
      p.allIn = false;
    }

    this.dealerIndex = this.nextActive(this.dealerIndex);

    this.broadcast('roundStart', {
      round: this.roundNumber,
      dealerIndex: this.dealerIndex,
      players: this.getPublicPlayers(),
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind
    });

    await this.sleep(1000);

    // Blinds
    const sbIdx = this.nextActive(this.dealerIndex);
    const bbIdx = this.nextActive(sbIdx);
    this.postBlind(sbIdx, this.smallBlind);
    this.postBlind(bbIdx, this.bigBlind);
    this.currentBet = this.bigBlind;
    this.minRaise = this.bigBlind;
    this.lastRaiseSize = this.bigBlind;

    this.broadcast('blindsPosted', {
      sbIndex: sbIdx, sbAmount: Math.min(this.smallBlind, this.players[sbIdx].chips + this.players[sbIdx].bet),
      bbIndex: bbIdx, bbAmount: Math.min(this.bigBlind, this.players[bbIdx].chips + this.players[bbIdx].bet),
      players: this.getPublicPlayers(), pot: this.pot
    });

    // Deal hole cards
    for (const p of this.players) {
      if (!p.folded) p.holeCards = this.deck.dealMultiple(2);
    }

    // Send each player their own cards
    for (const p of this.players) {
      if (!p.folded && !p.isAI && p.socketId) {
        const idx = this.players.indexOf(p);
        this.emitTo(p.socketId, 'holeCards', { cards: p.holeCards.map(c => c.toJSON()), yourIndex: idx });
      }
    }
    this.broadcast('cardsDealt', { players: this.getPublicPlayers() });

    await this.sleep(600);

    // Pre-flop
    const firstActor = this.nextActive(bbIdx);
    await this.bettingRound(firstActor);
    if (this.countActive() <= 1) { await this.endRound(); return; }

    // Flop
    this.phase = 'flop';
    this.resetBets();
    this.communityCards.push(...this.deck.dealMultiple(3));
    this.broadcast('community', { phase: 'flop', cards: this.communityCards.map(c=>c.toJSON()), pot: this.pot });
    await this.sleep(800);
    await this.bettingRound(this.nextActive(this.dealerIndex));
    if (this.countActive() <= 1) { await this.endRound(); return; }

    // Turn
    this.phase = 'turn';
    this.resetBets();
    this.communityCards.push(this.deck.deal());
    this.broadcast('community', { phase: 'turn', cards: this.communityCards.map(c=>c.toJSON()), pot: this.pot });
    await this.sleep(800);
    await this.bettingRound(this.nextActive(this.dealerIndex));
    if (this.countActive() <= 1) { await this.endRound(); return; }

    // River
    this.phase = 'river';
    this.resetBets();
    this.communityCards.push(this.deck.deal());
    this.broadcast('community', { phase: 'river', cards: this.communityCards.map(c=>c.toJSON()), pot: this.pot });
    await this.sleep(800);
    await this.bettingRound(this.nextActive(this.dealerIndex));

    await this.endRound();
  }

  postBlind(idx, amount) {
    const p = this.players[idx];
    const actual = Math.min(amount, p.chips);
    p.chips -= actual;
    p.bet = actual;
    p.totalBet += actual;
    this.pot += actual;
    if (p.chips === 0) p.allIn = true;
  }

  async bettingRound(startIdx) {
    this.playerActed = new Array(this.players.length).fill(false);
    let cur = startIdx;

    while (true) {
      const p = this.players[cur];
      if (p.folded || p.allIn || p.chips <= 0) {
        cur = this.nextActive(cur);
        if (this.isRoundDone()) break;
        continue;
      }

      this.activeIndex = cur;
      this.broadcast('activePlayer', { index: cur, players: this.getPublicPlayers(), pot: this.pot, currentBet: this.currentBet, minRaise: this.minRaise });

      let decision;
      if (p.isAI) {
        await this.sleep(800 + Math.random() * 700);
        decision = p.ai.decide({
          holeCards: p.holeCards, communityCards: this.communityCards,
          currentBet: this.currentBet, playerBet: p.bet,
          pot: this.pot, chips: p.chips, minRaise: this.minRaise, bigBlind: this.bigBlind
        });
      } else {
        this.emitTo(p.socketId, 'yourTurn', {
          currentBet: this.currentBet, playerBet: p.bet,
          chips: p.chips, minRaise: this.minRaise, pot: this.pot
        });
        decision = await this.waitForAction(p.socketId);
      }

      this.execAction(cur, decision);
      this.playerActed[cur] = true;
      cur = this.nextActive(cur);
      if (this.countActive() <= 1) break;
      if (this.isRoundDone()) break;
    }

    this.activeIndex = -1;
    this.broadcast('bettingDone', { players: this.getPublicPlayers(), pot: this.pot });
  }

  waitForAction(socketId) {
    return new Promise(resolve => {
      this.resolveAction = resolve;
      // 30 second timeout -> auto fold
      this.actionTimer = setTimeout(() => {
        this.resolveAction = null;
        resolve({ action: 'fold' });
      }, 30000);
    });
  }

  handleAction(socketId, decision) {
    const p = this.getPlayerBySocket(socketId);
    if (!p || p.folded || this.activeIndex === -1) return;
    const idx = this.players.indexOf(p);
    if (idx !== this.activeIndex) return;
    if (this.resolveAction) {
      clearTimeout(this.actionTimer);
      const resolve = this.resolveAction;
      this.resolveAction = null;
      resolve(decision);
    }
  }

  execAction(idx, decision) {
    const p = this.players[idx];
    const { action, amount } = decision;
    let actionLabel = action;
    let actionAmount = 0;

    switch (action) {
      case 'fold':
        p.folded = true;
        break;
      case 'check':
        break;
      case 'call': {
        const toCall = Math.min(this.currentBet - p.bet, p.chips);
        p.chips -= toCall; p.bet += toCall; p.totalBet += toCall; this.pot += toCall;
        if (p.chips === 0) p.allIn = true;
        actionLabel = p.allIn ? 'allin' : 'call';
        actionAmount = toCall;
        break;
      }
      case 'raise': {
        const toCall = this.currentBet - p.bet;
        let raiseAmt = Math.max(amount || this.minRaise, this.minRaise);
        let total = toCall + raiseAmt;
        if (total > p.chips) total = p.chips;
        p.chips -= total; p.bet += total; p.totalBet += total; this.pot += total;
        this.lastRaiseSize = p.bet - this.currentBet;
        this.currentBet = p.bet;
        this.minRaise = Math.max(this.lastRaiseSize, this.bigBlind);
        if (p.chips === 0) p.allIn = true;
        this.playerActed = this.playerActed.map((_, i) => i === idx);
        actionLabel = p.allIn ? 'allin' : 'raise';
        actionAmount = p.bet;
        break;
      }
      case 'allin': {
        const all = p.chips;
        p.bet += all; p.totalBet += all; this.pot += all; p.chips = 0; p.allIn = true;
        if (p.bet > this.currentBet) {
          this.lastRaiseSize = p.bet - this.currentBet;
          this.currentBet = p.bet;
          this.minRaise = Math.max(this.lastRaiseSize, this.bigBlind);
          this.playerActed = this.playerActed.map((_, i) => i === idx);
        }
        actionLabel = 'allin';
        actionAmount = all;
        break;
      }
    }

    this.broadcast('playerAction', {
      index: idx, name: p.name, action: actionLabel, amount: actionAmount,
      bet: p.bet, players: this.getPublicPlayers(), pot: this.pot
    });

    // Live-save after every action
    if (!p.isAI && p.pid) {
      updatePlayer(p.pid, { chips: p.chips, name: p.name });
    }
  }

  resetBets() {
    this.currentBet = 0;
    this.minRaise = this.bigBlind;
    for (const p of this.players) p.bet = 0;
  }

  async endRound() {
    this.phase = 'showdown';
    const active = this.players.map((p,i) => ({...p, index:i})).filter(p => !p.folded);

    // Reveal cards
    const revealData = active.map(p => ({
      index: p.index, name: p.name,
      cards: p.holeCards.map(c => c.toJSON())
    }));
    this.broadcast('showCards', { players: revealData });
    await this.sleep(500);

    const winners = [];
    if (active.length === 1) {
      const winner = active[0];
      this.players[winner.index].chips += this.pot;
      winners.push({ name: winner.name, amount: this.pot, handName: null, index: winner.index });
    } else {
      // Evaluate each active player's hand once
      for (const p of active) {
        p.handResult = evaluateHand([...p.holeCards, ...this.communityCards]);
      }

      // Calculate side pots
      const pots = this.calculateSidePots();

      // Resolve each pot independently
      for (const pot of pots) {
        const eligible = active.filter(p => pot.eligible.includes(p.index));
        if (eligible.length === 0) continue;

        let bestHand = eligible[0].handResult;
        let bestPlayers = [eligible[0]];

        for (const p of eligible.slice(1)) {
          const cmp = compareHandResult(p.handResult, bestHand);
          if (cmp > 0) { bestHand = p.handResult; bestPlayers = [p]; }
          else if (cmp === 0) bestPlayers.push(p);
        }

        const share = Math.floor(pot.amount / bestPlayers.length);
        for (const w of bestPlayers) {
          this.players[w.index].chips += share;
          winners.push({ name: w.name, amount: share, handName: w.handResult.name, index: w.index });
        }
      }
    }

    // Merge duplicate winners (same player winning multiple pots)
    const mergedWinners = [];
    const seen = new Set();
    for (const w of winners) {
      if (!seen.has(w.index)) {
        seen.add(w.index);
        const totalAmount = winners
          .filter(x => x.index === w.index)
          .reduce((sum, x) => sum + x.amount, 0);
        mergedWinners.push({ ...w, amount: totalAmount });
      }
    }

    // Persist chips for all human players
    this.saveHumanPlayers();

    this.broadcast('roundEnd', { winners: mergedWinners, players: this.getPublicPlayers() });

    // Check game over
    const alive = this.players.filter(p => p.chips > 0);
    const humansAlive = alive.filter(p => !p.isAI);
    if (alive.length <= 1 || humansAlive.length === 0) {
      this.broadcast('gameOver', { players: this.getPublicPlayers() });
      this.running = false;
      return;
    }

    if (this.roundNumber % 5 === 0) {
      this.smallBlind = Math.floor(this.smallBlind * 1.5);
      this.bigBlind = this.smallBlind * 2;
    }

    await this.sleep(3000);
    setTimeout(() => this.startRound(), 0);
  }

  // Calculate side pots for all-in scenarios
  calculateSidePots() {
    const entries = this.players
      .map((p, i) => ({ index: i, totalBet: p.totalBet, folded: p.folded }))
      .filter(p => p.totalBet > 0)
      .sort((a, b) => a.totalBet - b.totalBet);

    const pots = [];
    let prevBet = 0;

    for (const entry of entries) {
      if (entry.totalBet <= prevBet) continue;

      const diff = entry.totalBet - prevBet;
      const contributorCount = this.players.filter(p => p.totalBet >= entry.totalBet).length;
      const amount = diff * contributorCount;

      const eligible = this.players
        .filter(p => !p.folded && p.totalBet >= entry.totalBet)
        .map(p => this.players.indexOf(p));

      if (amount > 0 && eligible.length > 0) {
        pots.push({ amount, eligible });
      }

      prevBet = entry.totalBet;
    }

    return pots;
  }

  // Helpers
  nextActive(from) {
    let i = (from + 1) % this.players.length;
    const start = i;
    do {
      if (!this.players[i].folded && this.players[i].chips > 0) return i;
      i = (i + 1) % this.players.length;
    } while (i !== start);
    return i; // fallback
  }
  countActive() { return this.players.filter(p => !p.folded).length; }
  isRoundDone() {
    const canAct = this.players.filter(p => !p.folded && !p.allIn && p.chips > 0);
    if (canAct.length === 0) return true;
    return canAct.every(p => { const i = this.players.indexOf(p); return this.playerActed[i] && p.bet === this.currentBet; });
  }

  getPublicPlayers() {
    return this.players.map((p, i) => ({
      index: i, name: p.name, chips: p.chips, bet: p.bet,
      folded: p.folded, allIn: p.allIn, isAI: p.isAI,
      isDealer: i === this.dealerIndex,
      isActive: i === this.activeIndex,
      hasCards: p.holeCards.length > 0
    }));
  }

  // Save all human players' chips to persistent database
  saveHumanPlayers() {
    for (const p of this.players) {
      if (!p.isAI && p.pid) {
        updatePlayer(p.pid, { chips: p.chips, name: p.name });
      }
    }
  }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = { ServerGame };
