// ============================================
// sound.js - Web Audio API Sound Effects
// ============================================

const Sound = {
  ctx: null,
  enabled: true,
  volume: 0.4,

  init() {
    // Create AudioContext on first user interaction (browser policy)
    const unlock = () => {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
  },

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  },

  // --- Core synthesis helpers ---

  _osc(type, freq, duration, vol = 1) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(this.volume * vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },

  _noise(duration, vol = 0.3) {
    if (!this.ctx || !this.enabled) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = this.volume * vol;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();
  },

  // --- Game sound effects ---

  // Card dealing sound - short crisp snap
  cardDeal() {
    this._noise(0.06, 0.5);
    this._osc('sine', 2800, 0.03, 0.2);
  },

  // Card flip sound
  cardFlip() {
    if (!this.ctx || !this.enabled) return;
    setTimeout(() => this._noise(0.04, 0.35), 0);
    setTimeout(() => this._osc('sine', 3200, 0.025, 0.15), 20);
  },

  // Chip bet sound - metallic clink
  chipBet() {
    this._osc('sine', 1200, 0.08, 0.3);
    this._osc('sine', 2400, 0.06, 0.15);
    setTimeout(() => this._osc('sine', 1800, 0.05, 0.1), 30);
  },

  // Chip stack / pot collection
  chipStack() {
    if (!this.ctx || !this.enabled) return;
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this._osc('sine', 1100 + Math.random() * 600, 0.06, 0.2);
      }, i * 40);
    }
  },

  // Check / tap sound
  check() {
    this._osc('sine', 600, 0.1, 0.2);
    this._osc('triangle', 800, 0.08, 0.1);
  },

  // Fold sound - descending
  fold() {
    this._osc('sine', 400, 0.15, 0.2);
    setTimeout(() => this._osc('sine', 300, 0.12, 0.15), 60);
  },

  // Raise / bet sound - ascending + chips
  raise() {
    this._osc('sine', 800, 0.1, 0.25);
    setTimeout(() => this._osc('sine', 1100, 0.1, 0.2), 60);
    setTimeout(() => this.chipBet(), 120);
  },

  // All-in dramatic sound
  allIn() {
    if (!this.ctx || !this.enabled) return;
    const freqs = [600, 800, 1000, 1200, 1600];
    freqs.forEach((f, i) => {
      setTimeout(() => this._osc('sine', f, 0.15, 0.2), i * 50);
    });
    setTimeout(() => this.chipStack(), 280);
  },

  // Your turn notification - gentle alert
  yourTurn() {
    this._osc('sine', 880, 0.15, 0.3);
    setTimeout(() => this._osc('sine', 1100, 0.2, 0.25), 150);
  },

  // Community card reveal
  communityCard() {
    this._osc('triangle', 500, 0.12, 0.2);
    setTimeout(() => this._noise(0.05, 0.3), 50);
  },

  // Win fanfare
  win() {
    if (!this.ctx || !this.enabled) return;
    const melody = [523, 659, 784, 1047]; // C5-E5-G5-C6
    melody.forEach((f, i) => {
      setTimeout(() => this._osc('sine', f, 0.25, 0.3), i * 120);
    });
    setTimeout(() => this.chipStack(), 500);
    setTimeout(() => this.chipStack(), 650);
  },

  // Lose / game over
  lose() {
    if (!this.ctx || !this.enabled) return;
    const melody = [400, 350, 300, 250];
    melody.forEach((f, i) => {
      setTimeout(() => this._osc('sine', f, 0.3, 0.2), i * 200);
    });
  },

  // Round start
  roundStart() {
    this._osc('sine', 660, 0.12, 0.2);
    setTimeout(() => this._osc('sine', 880, 0.15, 0.25), 100);
  },

  // Button click
  click() {
    this._osc('sine', 1000, 0.05, 0.15);
  },

  // Timer tick warning
  tick() {
    this._osc('square', 600, 0.03, 0.1);
  }
};
