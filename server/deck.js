// ============================================
// server/deck.js - Server-side Deck (CommonJS)
// ============================================

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUIT_SYMBOLS = { hearts:'♥', diamonds:'♦', clubs:'♣', spades:'♠' };
const SUIT_COLORS = { hearts:'red', diamonds:'red', clubs:'black', spades:'black' };
const RANK_VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.value = RANK_VALUES[rank];
    this.symbol = SUIT_SYMBOLS[suit];
    this.color = SUIT_COLORS[suit];
  }
  toString() { return `${this.rank}${this.symbol}`; }
  id() { return `${this.rank}_${this.suit}`; }
  toJSON() { return { suit: this.suit, rank: this.rank, value: this.value, symbol: this.symbol, color: this.color }; }
}

class Deck {
  constructor() { this.cards = []; this.reset(); }
  reset() {
    this.cards = [];
    for (const suit of SUITS) for (const rank of RANKS) this.cards.push(new Card(suit, rank));
    this.shuffle();
  }
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }
  deal() { return this.cards.pop(); }
  dealMultiple(n) { const h = []; for (let i = 0; i < n; i++) h.push(this.deal()); return h; }
}

module.exports = { Card, Deck, RANK_VALUES };
