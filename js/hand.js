// ============================================
// hand.js - Hand Evaluation
// ============================================

const HAND_RANKS = {
  ROYAL_FLUSH: 10,
  STRAIGHT_FLUSH: 9,
  FOUR_OF_A_KIND: 8,
  FULL_HOUSE: 7,
  FLUSH: 6,
  STRAIGHT: 5,
  THREE_OF_A_KIND: 4,
  TWO_PAIR: 3,
  ONE_PAIR: 2,
  HIGH_CARD: 1
};

const HAND_NAMES = {
  10: '皇家同花顺',
  9: '同花顺',
  8: '四条',
  7: '葫芦',
  6: '同花',
  5: '顺子',
  4: '三条',
  3: '两对',
  2: '一对',
  1: '高牌'
};

function evaluateHand(cards) {
  // Get all 5-card combinations from 7 cards (or fewer)
  const combos = getCombinations(cards, 5);
  let bestHand = null;

  for (const combo of combos) {
    const result = evaluate5Cards(combo);
    if (!bestHand || compareHandResult(result, bestHand) > 0) {
      bestHand = result;
    }
  }
  return bestHand;
}

function getCombinations(arr, size) {
  if (size === 0) return [[]];
  if (arr.length === 0) return [];
  const results = [];
  const [first, ...rest] = arr;
  // Include first
  for (const combo of getCombinations(rest, size - 1)) {
    results.push([first, ...combo]);
  }
  // Exclude first
  for (const combo of getCombinations(rest, size)) {
    results.push(combo);
  }
  return results;
}

function evaluate5Cards(cards) {
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const values = sorted.map(c => c.value);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(values);
  const isLowStraight = checkLowStraight(values);

  const counts = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  const groups = Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  let rank, kickers;

  if (isFlush && isStraight && values[0] === 14) {
    rank = HAND_RANKS.ROYAL_FLUSH;
    kickers = values;
  } else if (isFlush && (isStraight || isLowStraight)) {
    rank = HAND_RANKS.STRAIGHT_FLUSH;
    kickers = isLowStraight ? [5, 4, 3, 2, 1] : values;
  } else if (groups[0][1] === 4) {
    rank = HAND_RANKS.FOUR_OF_A_KIND;
    const quadVal = parseInt(groups[0][0]);
    kickers = [quadVal, ...values.filter(v => v !== quadVal)];
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    rank = HAND_RANKS.FULL_HOUSE;
    const tripVal = parseInt(groups[0][0]);
    const pairVal = parseInt(groups[1][0]);
    kickers = [tripVal, pairVal];
  } else if (isFlush) {
    rank = HAND_RANKS.FLUSH;
    kickers = values;
  } else if (isStraight || isLowStraight) {
    rank = HAND_RANKS.STRAIGHT;
    kickers = isLowStraight ? [5, 4, 3, 2, 1] : values;
  } else if (groups[0][1] === 3) {
    rank = HAND_RANKS.THREE_OF_A_KIND;
    const tripVal = parseInt(groups[0][0]);
    kickers = [tripVal, ...values.filter(v => v !== tripVal).sort((a, b) => b - a)];
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    rank = HAND_RANKS.TWO_PAIR;
    const p1 = parseInt(groups[0][0]);
    const p2 = parseInt(groups[1][0]);
    const high = Math.max(p1, p2);
    const low = Math.min(p1, p2);
    const kick = values.find(v => v !== p1 && v !== p2);
    kickers = [high, low, kick];
  } else if (groups[0][1] === 2) {
    rank = HAND_RANKS.ONE_PAIR;
    const pairVal = parseInt(groups[0][0]);
    kickers = [pairVal, ...values.filter(v => v !== pairVal).sort((a, b) => b - a)];
  } else {
    rank = HAND_RANKS.HIGH_CARD;
    kickers = values;
  }

  return { rank, kickers, cards: sorted, name: HAND_NAMES[rank] };
}

function checkStraight(values) {
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] - values[i + 1] !== 1) return false;
  }
  return true;
}

function checkLowStraight(values) {
  // A-2-3-4-5 (wheel)
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[0] === 2 && sorted[1] === 3 && sorted[2] === 4 && sorted[3] === 5 && sorted[4] === 14;
}

function compareHandResult(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}

function compareHands(hand1Cards, hand2Cards) {
  const h1 = evaluateHand(hand1Cards);
  const h2 = evaluateHand(hand2Cards);
  return compareHandResult(h1, h2);
}

// Calculate hand strength as 0-1 value (for AI)
function handStrength(holeCards, communityCards) {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) {
    // Pre-flop: estimate from hole cards
    return preFlopStrength(holeCards);
  }
  const result = evaluateHand(allCards);
  // Normalize rank (1-10) + kicker importance
  return (result.rank - 1) / 9 * 0.7 + (result.kickers[0] / 14) * 0.3;
}

function preFlopStrength(holeCards) {
  const [c1, c2] = holeCards;
  const high = Math.max(c1.value, c2.value);
  const low = Math.min(c1.value, c2.value);
  const paired = c1.value === c2.value;
  const suited = c1.suit === c2.suit;
  const gap = high - low;

  let strength = 0;

  if (paired) {
    strength = 0.5 + (high / 14) * 0.5; // Pairs: 0.5 - 1.0
  } else {
    strength = (high + low) / 28 * 0.5; // Base from card values
    if (suited) strength += 0.06;
    if (gap <= 2) strength += 0.04;
    if (gap <= 1) strength += 0.04;
    // Premium hands boost
    if (high === 14) strength += 0.1; // Ace high
    if (high === 13 && low >= 10) strength += 0.08;
  }

  return Math.min(1, Math.max(0, strength));
}
