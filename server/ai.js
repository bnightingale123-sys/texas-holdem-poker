// ============================================
// server/ai.js - Server-side AI Player
// ============================================
const { handStrength } = require('./hand');

const AI_STYLES = ['tight', 'aggressive', 'balanced'];

class AIPlayer {
  constructor(name, style) {
    this.name = name;
    this.style = style || AI_STYLES[Math.floor(Math.random() * AI_STYLES.length)];
    this.id = 'ai_' + name.toLowerCase();
    this.isAI = true;
  }

  decide(gameState) {
    const { holeCards, communityCards, currentBet, playerBet, pot, chips, minRaise, bigBlind } = gameState;
    const toCall = currentBet - playerBet;
    const strength = handStrength(holeCards, communityCards);
    const noise = (Math.random() - 0.5) * 0.15;
    const adj = Math.min(1, Math.max(0, strength + noise + this.styleBonus()));

    if (chips <= bigBlind * 3 && adj > 0.3) return { action: 'allin' };

    if (toCall === 0) {
      if (adj > 0.7) return { action: 'raise', amount: this.calcRaise(strength, pot, minRaise, chips, bigBlind) };
      if (adj > 0.45 && Math.random() < 0.3) return { action: 'raise', amount: this.calcRaise(strength*0.7, pot, minRaise, chips, bigBlind) };
      return { action: 'check' };
    }

    if (adj > 0.8) {
      if (Math.random() < 0.6) return { action: 'raise', amount: this.calcRaise(strength, pot, minRaise, chips, bigBlind) };
      return { action: 'call' };
    }
    if (adj > 0.5) {
      if (toCall / (pot + toCall) < adj * 0.6) return { action: 'call' };
      if (Math.random() < 0.25) return { action: 'call' };
      return { action: 'fold' };
    }
    if (adj > 0.35) {
      if (toCall / (pot + toCall) < 0.2 && Math.random() < 0.5) return { action: 'call' };
      if (this.style === 'aggressive' && Math.random() < 0.15) return { action: 'raise', amount: this.calcRaise(0.6, pot, minRaise, chips, bigBlind) };
      return { action: 'fold' };
    }
    if (this.style === 'aggressive' && Math.random() < 0.08) return { action: 'raise', amount: this.calcRaise(0.5, pot, minRaise, chips, bigBlind) };
    return { action: 'fold' };
  }

  styleBonus() {
    return this.style === 'aggressive' ? 0.08 : this.style === 'tight' ? -0.06 : 0;
  }

  calcRaise(str, pot, minR, chips, bb) {
    let a;
    if (str > 0.85) a = Math.floor(pot * (0.8 + Math.random()*0.7));
    else if (str > 0.65) a = Math.floor(pot * (0.4 + Math.random()*0.4));
    else a = minR + Math.floor(Math.random() * bb * 2);
    return Math.min(chips, Math.max(minR, a));
  }
}

module.exports = { AIPlayer };
