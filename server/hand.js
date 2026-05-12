// ============================================
// server/hand.js - Server-side Hand Evaluation
// ============================================

const HAND_RANKS = { ROYAL_FLUSH:10, STRAIGHT_FLUSH:9, FOUR_OF_A_KIND:8, FULL_HOUSE:7, FLUSH:6, STRAIGHT:5, THREE_OF_A_KIND:4, TWO_PAIR:3, ONE_PAIR:2, HIGH_CARD:1 };
const HAND_NAMES = { 10:'皇家同花顺',9:'同花顺',8:'四条',7:'葫芦',6:'同花',5:'顺子',4:'三条',3:'两对',2:'一对',1:'高牌' };

function getCombinations(arr, size) {
  if (size === 0) return [[]];
  if (arr.length === 0) return [];
  const results = [];
  const [first, ...rest] = arr;
  for (const c of getCombinations(rest, size - 1)) results.push([first, ...c]);
  for (const c of getCombinations(rest, size)) results.push(c);
  return results;
}

function checkStraight(values) {
  for (let i = 0; i < values.length - 1; i++) if (values[i] - values[i+1] !== 1) return false;
  return true;
}

function checkLowStraight(values) {
  const s = [...values].sort((a,b) => a - b);
  return s[0]===2 && s[1]===3 && s[2]===4 && s[3]===5 && s[4]===14;
}

function evaluate5Cards(cards) {
  const sorted = [...cards].sort((a,b) => b.value - a.value);
  const values = sorted.map(c => c.value);
  const suits = sorted.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(values);
  const isLowStraight = checkLowStraight(values);
  const counts = {};
  for (const v of values) counts[v] = (counts[v]||0) + 1;
  const groups = Object.entries(counts).sort((a,b) => b[1]-a[1] || b[0]-a[0]);
  let rank, kickers;

  if (isFlush && isStraight && values[0] === 14) { rank = 10; kickers = values; }
  else if (isFlush && (isStraight || isLowStraight)) { rank = 9; kickers = isLowStraight ? [5,4,3,2,1] : values; }
  else if (groups[0][1] === 4) { rank = 8; const q = parseInt(groups[0][0]); kickers = [q, ...values.filter(v=>v!==q)]; }
  else if (groups[0][1] === 3 && groups[1][1] === 2) { rank = 7; kickers = [parseInt(groups[0][0]), parseInt(groups[1][0])]; }
  else if (isFlush) { rank = 6; kickers = values; }
  else if (isStraight || isLowStraight) { rank = 5; kickers = isLowStraight ? [5,4,3,2,1] : values; }
  else if (groups[0][1] === 3) { rank = 4; const t = parseInt(groups[0][0]); kickers = [t, ...values.filter(v=>v!==t)]; }
  else if (groups[0][1] === 2 && groups[1][1] === 2) {
    rank = 3; const p1 = parseInt(groups[0][0]), p2 = parseInt(groups[1][0]);
    kickers = [Math.max(p1,p2), Math.min(p1,p2), values.find(v=>v!==p1&&v!==p2)];
  }
  else if (groups[0][1] === 2) { rank = 2; const pv = parseInt(groups[0][0]); kickers = [pv, ...values.filter(v=>v!==pv)]; }
  else { rank = 1; kickers = values; }

  return { rank, kickers, cards: sorted, name: HAND_NAMES[rank] };
}

function evaluateHand(cards) {
  const combos = getCombinations(cards, 5);
  let best = null;
  for (const c of combos) {
    const r = evaluate5Cards(c);
    if (!best || compareHandResult(r, best) > 0) best = r;
  }
  return best;
}

function compareHandResult(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++)
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  return 0;
}

function handStrength(holeCards, communityCards) {
  const all = [...holeCards, ...communityCards];
  if (all.length < 5) return preFlopStrength(holeCards);
  const r = evaluateHand(all);
  return (r.rank - 1) / 9 * 0.7 + (r.kickers[0] / 14) * 0.3;
}

function preFlopStrength(holeCards) {
  const [c1, c2] = holeCards;
  const high = Math.max(c1.value, c2.value), low = Math.min(c1.value, c2.value);
  const paired = c1.value === c2.value, suited = c1.suit === c2.suit, gap = high - low;
  let s = 0;
  if (paired) { s = 0.5 + (high/14)*0.5; }
  else {
    s = (high+low)/28*0.5;
    if (suited) s += 0.06;
    if (gap <= 2) s += 0.04;
    if (gap <= 1) s += 0.04;
    if (high === 14) s += 0.1;
    if (high === 13 && low >= 10) s += 0.08;
  }
  return Math.min(1, Math.max(0, s));
}

module.exports = { evaluateHand, compareHandResult, handStrength, HAND_NAMES };
