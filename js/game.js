// ============================================
// game.js - Core Game Logic
// ============================================

const PHASES = {
  IDLE: 'idle',
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown'
};

class Game {
  constructor() {
    this.players = [];
    this.deck = new Deck();
    this.communityCards = [];
    this.pot = 0;
    this.phase = PHASES.IDLE;
    this.currentBet = 0;
    this.dealerIndex = 0;
    this.activePlayerIndex = 0;
    this.roundNumber = 0;
    this.smallBlind = 50;
    this.bigBlind = 100;
    this.minRaise = 100;
    this.lastRaiseSize = 0;
    this.playerActedThisRound = [];
    this.resolvePlayerAction = null;
  }

  saveProgress() {
    localStorage.setItem('playerChips', this.players[0].chips.toString());
  }

  loadProgress() {
    const saved = localStorage.getItem('playerChips');
    return saved && parseInt(saved) > 0 ? parseInt(saved) : null;
  }

  init(startingChips) {
    this.needsRecharge = false;
    localStorage.removeItem('needsRecharge');
    const chips = startingChips !== undefined ? startingChips : (this.loadProgress() || 10000);
    // Player 0 = human, 1-3 = AI
    this.players = [
      { name: '你', chips: chips, holeCards: [], bet: 0, totalBet: 0, folded: false, isHuman: true, isDealer: false, isActive: false, allIn: false, ai: null },
      { name: AI_NAMES[0], chips: chips, holeCards: [], bet: 0, totalBet: 0, folded: false, isHuman: false, isDealer: false, isActive: false, allIn: false, ai: new AIPlayer(AI_NAMES[0], 'balanced') },
      { name: AI_NAMES[1], chips: chips, holeCards: [], bet: 0, totalBet: 0, folded: false, isHuman: false, isDealer: false, isActive: false, allIn: false, ai: new AIPlayer(AI_NAMES[1], 'aggressive') },
      { name: AI_NAMES[2], chips: chips, holeCards: [], bet: 0, totalBet: 0, folded: false, isHuman: false, isDealer: false, isActive: false, allIn: false, ai: new AIPlayer(AI_NAMES[2], 'tight') }
    ];
    this.dealerIndex = Math.floor(Math.random() * 4);
    this.roundNumber = 0;
  }

  async startRound() {
    this.roundNumber++;
    this.deck = new Deck();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.phase = PHASES.PREFLOP;

    // Reset players
    for (const p of this.players) {
      p.holeCards = [];
      p.bet = 0;
      p.totalBet = 0;
      p.folded = p.chips <= 0;
      p.isActive = false;
      p.isWinner = false;
      p.allIn = false;
    }

    UI.clearTable();
    this.updateAllUI();

    // Move dealer
    this.dealerIndex = this.nextActivePlayer(this.dealerIndex);
    this.players.forEach((p, i) => p.isDealer = (i === this.dealerIndex));

    UI.updateGameInfo({ round: this.roundNumber, smallBlind: this.smallBlind, bigBlind: this.bigBlind });
    await UI.showMessage(`第 ${this.roundNumber} 轮`, 1000);

    // Post blinds
    const sbIndex = this.nextActivePlayer(this.dealerIndex);
    const bbIndex = this.nextActivePlayer(sbIndex);
    this.postBlind(sbIndex, this.smallBlind);
    this.postBlind(bbIndex, this.bigBlind);
    this.currentBet = this.bigBlind;
    this.minRaise = this.bigBlind;
    this.lastRaiseSize = this.bigBlind;

    UI.addLog(`<span class="log-action">${this.players[sbIndex].name}</span> 小盲 <span class="log-amount">$${this.smallBlind}</span>`);
    UI.addLog(`<span class="log-action">${this.players[bbIndex].name}</span> 大盲 <span class="log-amount">$${this.bigBlind}</span>`);

    // Deal hole cards
    for (const p of this.players) {
      if (!p.folded) {
        p.holeCards = this.deck.dealMultiple(2);
      }
    }

    // Show cards
    this.players.forEach((p, i) => {
      if (!p.folded && p.holeCards.length > 0) {
        UI.renderPlayerHand(i, p.holeCards, p.isHuman);
      }
    });
    this.updateAllUI();

    await this.sleep(600);

    // Pre-flop betting (starts after big blind)
    const firstActor = this.nextActivePlayer(bbIndex);
    await this.bettingRound(firstActor);

    if (this.countActivePlayers() <= 1) {
      await this.endRound();
      return;
    }

    // Flop
    this.phase = PHASES.FLOP;
    this.resetBets();
    this.communityCards.push(...this.deck.dealMultiple(3));
    UI.renderCommunityCards(this.communityCards);
    await UI.showMessage('翻牌', 800);
    await this.bettingRound(this.nextActivePlayer(this.dealerIndex));

    if (this.countActivePlayers() <= 1) {
      await this.endRound();
      return;
    }

    // Turn
    this.phase = PHASES.TURN;
    this.resetBets();
    this.communityCards.push(this.deck.deal());
    UI.renderCommunityCards(this.communityCards);
    await UI.showMessage('转牌', 800);
    await this.bettingRound(this.nextActivePlayer(this.dealerIndex));

    if (this.countActivePlayers() <= 1) {
      await this.endRound();
      return;
    }

    // River
    this.phase = PHASES.RIVER;
    this.resetBets();
    this.communityCards.push(this.deck.deal());
    UI.renderCommunityCards(this.communityCards);
    await UI.showMessage('河牌', 800);
    await this.bettingRound(this.nextActivePlayer(this.dealerIndex));

    // Showdown
    await this.endRound();
  }

  postBlind(index, amount) {
    const p = this.players[index];
    const actual = Math.min(amount, p.chips);
    p.chips -= actual;
    p.bet = actual;
    p.totalBet += actual;
    this.pot += actual;
    if (p.chips === 0) p.allIn = true;
    UI.showPlayerBet(index, actual);
    this.updateAllUI();
  }

  async bettingRound(startIndex) {
    this.playerActedThisRound = new Array(this.players.length).fill(false);
    let currentIndex = startIndex;
    let consecutiveChecks = 0;
    let playersToAct = this.countCanAct();

    while (true) {
      const player = this.players[currentIndex];

      if (player.folded || player.allIn || player.chips <= 0) {
        currentIndex = this.nextActivePlayer(currentIndex);
        if (this.isRoundComplete()) break;
        continue;
      }

      // Set active
      this.players.forEach(p => p.isActive = false);
      player.isActive = true;
      this.activePlayerIndex = currentIndex;
      this.updateAllUI();

      let action;
      if (player.isHuman) {
        action = await this.getPlayerAction(currentIndex);
      } else {
        await this.sleep(800 + Math.random() * 700);
        action = this.getAIAction(currentIndex);
      }

      this.executeAction(currentIndex, action);
      this.playerActedThisRound[currentIndex] = true;

      currentIndex = this.nextActivePlayer(currentIndex);

      if (this.countActivePlayers() <= 1) break;
      if (this.isRoundComplete()) break;
    }

    this.players.forEach(p => p.isActive = false);
    this.updateAllUI();
  }

  getAIAction(index) {
    const p = this.players[index];
    const state = {
      holeCards: p.holeCards,
      communityCards: this.communityCards,
      currentBet: this.currentBet,
      playerBet: p.bet,
      pot: this.pot,
      chips: p.chips,
      minRaise: this.minRaise,
      bigBlind: this.bigBlind
    };
    return p.ai.decide(state);
  }

  getPlayerAction(index) {
    const p = this.players[index];
    const toCall = this.currentBet - p.bet;

    UI.updateControls({
      isPlayerTurn: true,
      currentBet: this.currentBet,
      playerBet: p.bet,
      playerChips: p.chips,
      minRaise: this.minRaise
    });

    return new Promise(resolve => {
      this.resolvePlayerAction = resolve;
    });
  }

  handlePlayerAction(action, amount) {
    if (!this.resolvePlayerAction) return;
    const resolve = this.resolvePlayerAction;
    this.resolvePlayerAction = null;

    UI.updateControls({ isPlayerTurn: false });
    resolve({ action, amount });
  }

  executeAction(index, decision) {
    const p = this.players[index];
    const { action, amount } = decision;

    switch (action) {
      case 'fold':
        p.folded = true;
        UI.showActionLabel(index, 'fold');
        UI.addLog(`<span class="log-action">${p.name}</span> 弃牌`);
        break;

      case 'check':
        UI.showActionLabel(index, 'check');
        UI.addLog(`<span class="log-action">${p.name}</span> 过牌`);
        break;

      case 'call': {
        const toCall = Math.min(this.currentBet - p.bet, p.chips);
        p.chips -= toCall;
        p.bet += toCall;
        p.totalBet += toCall;
        this.pot += toCall;
        if (p.chips === 0) p.allIn = true;
        UI.showActionLabel(index, p.allIn ? 'allin' : 'call');
        UI.showPlayerBet(index, p.bet);
        UI.addLog(`<span class="log-action">${p.name}</span> ${p.allIn ? '全押' : '跟注'} <span class="log-amount">$${toCall}</span>`);
        break;
      }

      case 'raise': {
        const toCall = this.currentBet - p.bet;
        let raiseAmount = Math.max(amount || this.minRaise, this.minRaise);
        let totalBet = toCall + raiseAmount;
        if (totalBet > p.chips) totalBet = p.chips;
        p.chips -= totalBet;
        p.bet += totalBet;
        p.totalBet += totalBet;
        this.pot += totalBet;
        const newBet = p.bet;
        this.lastRaiseSize = newBet - this.currentBet;
        this.currentBet = newBet;
        this.minRaise = Math.max(this.lastRaiseSize, this.bigBlind);
        if (p.chips === 0) p.allIn = true;
        // Reset acted flags so others get to act again
        this.playerActedThisRound = this.playerActedThisRound.map((_, i) => i === index);
        UI.showActionLabel(index, p.allIn ? 'allin' : 'raise');
        UI.showPlayerBet(index, p.bet);
        UI.addLog(`<span class="log-action">${p.name}</span> ${p.allIn ? '全押' : '加注到'} <span class="log-amount">$${newBet}</span>`);
        break;
      }

      case 'allin': {
        const allAmount = p.chips;
        p.bet += allAmount;
        p.totalBet += allAmount;
        this.pot += allAmount;
        p.chips = 0;
        p.allIn = true;
        if (p.bet > this.currentBet) {
          this.lastRaiseSize = p.bet - this.currentBet;
          this.currentBet = p.bet;
          this.minRaise = Math.max(this.lastRaiseSize, this.bigBlind);
          this.playerActedThisRound = this.playerActedThisRound.map((_, i) => i === index);
        }
        UI.showActionLabel(index, 'allin');
        UI.showPlayerBet(index, p.bet);
        UI.addLog(`<span class="log-action">${p.name}</span> 全押 <span class="log-amount">$${allAmount}</span>`);
        break;
      }
    }

    this.updateAllUI();
  }

  resetBets() {
    this.currentBet = 0;
    this.minRaise = this.bigBlind;
    this.lastRaiseSize = 0;
    for (const p of this.players) {
      p.bet = 0;
    }
    document.querySelectorAll('.player-bet').forEach(b => b.remove());
  }

  async endRound() {
    this.phase = PHASES.SHOWDOWN;
    const activePlayers = this.players
      .map((p, i) => ({ ...p, index: i }))
      .filter(p => !p.folded);

    // Reveal all hands
    activePlayers.forEach(p => {
      if (p.holeCards.length > 0) {
        UI.renderPlayerHand(p.index, p.holeCards, true);
      }
    });

    await this.sleep(500);

    const winners = [];

    if (activePlayers.length === 1) {
      // Everyone else folded
      const winner = activePlayers[0];
      this.players[winner.index].chips += this.pot;
      this.players[winner.index].isWinner = true;
      winners.push({ name: winner.name, amount: this.pot, handName: null, index: winner.index });
    } else {
      // Evaluate each active player's hand once
      for (const p of activePlayers) {
        p.handResult = evaluateHand([...p.holeCards, ...this.communityCards]);
      }

      // Calculate side pots
      const pots = this.calculateSidePots();

      // Resolve each pot independently
      for (const pot of pots) {
        const eligible = activePlayers.filter(p => pot.eligible.includes(p.index));
        if (eligible.length === 0) continue;

        // Find best hand among eligible players
        let bestHand = eligible[0].handResult;
        let bestPlayers = [eligible[0]];

        for (const p of eligible.slice(1)) {
          const cmp = compareHandResult(p.handResult, bestHand);
          if (cmp > 0) {
            bestHand = p.handResult;
            bestPlayers = [p];
          } else if (cmp === 0) {
            bestPlayers.push(p);
          }
        }

        const share = Math.floor(pot.amount / bestPlayers.length);
        for (const w of bestPlayers) {
          this.players[w.index].chips += share;
          this.players[w.index].isWinner = true;
          winners.push({ name: w.name, amount: share, handName: w.handResult.name, index: w.index });
        }
      }
    }

    this.updateAllUI();

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

    // Show result modal
    await UI.showRoundResult({ winners: mergedWinners });

    // Save progress so refresh doesn't reset chips
    this.saveProgress();

    // Check game over
    const alivePlayers = this.players.filter(p => p.chips > 0);
    if (this.players[0].chips <= 0 || alivePlayers.length <= 1) {
      const playerChips = this.players[0].chips;

      if (playerChips <= 0) {
        // Player out of chips — show game over with $0, flag for recharge
        this.needsRecharge = true;
        localStorage.setItem('needsRecharge', 'true');
        await UI.showGameOver(playerChips);
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('start-screen').classList.remove('hidden');
        document.getElementById('start-btn').textContent = '充值继续游戏';
        return;
      }

      // Human won (others busted)
      await UI.showGameOver(playerChips);
      document.getElementById('game-screen').classList.add('hidden');
      document.getElementById('start-screen').classList.remove('hidden');
      document.getElementById('start-btn').textContent = '重新开始';
      return;
    }

    // Increase blinds every 5 rounds
    if (this.roundNumber % 5 === 0) {
      this.smallBlind = Math.floor(this.smallBlind * 1.5);
      this.bigBlind = this.smallBlind * 2;
    }

    this.startRound();
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
  nextActivePlayer(from) {
    let idx = (from + 1) % this.players.length;
    let safety = 0;
    while ((this.players[idx].folded || this.players[idx].chips <= 0) && safety < 8) {
      idx = (idx + 1) % this.players.length;
      safety++;
    }
    return idx;
  }

  countActivePlayers() {
    return this.players.filter(p => !p.folded).length;
  }

  countCanAct() {
    return this.players.filter(p => !p.folded && !p.allIn && p.chips > 0).length;
  }

  isRoundComplete() {
    const canAct = this.players.filter((p, i) => !p.folded && !p.allIn && p.chips > 0);
    if (canAct.length === 0) return true;
    // Check if everyone who can act has acted and matched the current bet
    const allActed = canAct.every((p, _, arr) => {
      const idx = this.players.indexOf(p);
      return this.playerActedThisRound[idx] && p.bet === this.currentBet;
    });
    return allActed;
  }

  updateAllUI() {
    this.players.forEach((p, i) => UI.updatePlayerInfo(i, p));
    UI.updatePot(this.pot);
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}
