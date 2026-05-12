// ============================================
// ai.js - AI Strategy Engine
// ============================================

const AI_STYLES = ['tight', 'aggressive', 'balanced'];
const AI_NAMES = ['Alice', 'Bob', 'Charlie'];

class AIPlayer {
  constructor(name, style) {
    this.name = name;
    this.style = style || AI_STYLES[Math.floor(Math.random() * AI_STYLES.length)];
  }

  decide(gameState) {
    const { holeCards, communityCards, currentBet, playerBet, pot, chips, minRaise, bigBlind } = gameState;
    const toCall = currentBet - playerBet;
    const strength = handStrength(holeCards, communityCards);
    const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;

    // Add randomness
    const noise = (Math.random() - 0.5) * 0.15;
    const adjustedStrength = Math.min(1, Math.max(0, strength + noise + this.styleBonus()));

    // All-in if very short stacked
    if (chips <= bigBlind * 3 && adjustedStrength > 0.3) {
      return { action: 'allin' };
    }

    if (toCall === 0) {
      // No bet to call (can check or raise)
      if (adjustedStrength > 0.7) {
        const raiseAmt = this.calcRaise(strength, pot, minRaise, chips, bigBlind);
        return { action: 'raise', amount: raiseAmt };
      }
      if (adjustedStrength > 0.45 && Math.random() < 0.3) {
        const raiseAmt = this.calcRaise(strength * 0.7, pot, minRaise, chips, bigBlind);
        return { action: 'raise', amount: raiseAmt };
      }
      return { action: 'check' };
    }

    // There's a bet to call
    if (adjustedStrength > 0.8) {
      if (Math.random() < 0.6) {
        const raiseAmt = this.calcRaise(strength, pot, minRaise, chips, bigBlind);
        return { action: 'raise', amount: raiseAmt };
      }
      return { action: 'call' };
    }

    if (adjustedStrength > 0.5) {
      if (potOdds < adjustedStrength * 0.6) {
        return { action: 'call' };
      }
      if (Math.random() < 0.25) {
        return { action: 'call' };
      }
      return { action: 'fold' };
    }

    if (adjustedStrength > 0.35) {
      // Marginal hand
      if (potOdds < 0.2 && Math.random() < 0.5) {
        return { action: 'call' };
      }
      // Bluff sometimes
      if (this.style === 'aggressive' && Math.random() < 0.15) {
        const raiseAmt = this.calcRaise(0.6, pot, minRaise, chips, bigBlind);
        return { action: 'raise', amount: raiseAmt };
      }
      return { action: 'fold' };
    }

    // Weak hand - usually fold, sometimes bluff
    if (this.style === 'aggressive' && Math.random() < 0.08) {
      const raiseAmt = this.calcRaise(0.5, pot, minRaise, chips, bigBlind);
      return { action: 'raise', amount: raiseAmt };
    }

    return { action: 'fold' };
  }

  styleBonus() {
    switch (this.style) {
      case 'aggressive': return 0.08;
      case 'tight': return -0.06;
      default: return 0;
    }
  }

  calcRaise(strength, pot, minRaise, chips, bigBlind) {
    let amount;
    if (strength > 0.85) {
      amount = Math.floor(pot * (0.8 + Math.random() * 0.7));
    } else if (strength > 0.65) {
      amount = Math.floor(pot * (0.4 + Math.random() * 0.4));
    } else {
      amount = minRaise + Math.floor(Math.random() * bigBlind * 2);
    }
    amount = Math.max(minRaise, amount);
    amount = Math.min(chips, amount);
    return amount;
  }
}
