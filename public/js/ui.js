// ============================================
// ui.js - Multiplayer UI Rendering
// ============================================

const UI = {
  createCardElement(card, faceUp, small) {
    const el = document.createElement('div');
    el.className = `card ${small ? 'small' : ''} ${faceUp ? 'face-up' : 'face-down'} ${faceUp ? card.color : ''}`;
    if (faceUp && card) {
      el.innerHTML = `
        <span class="card-rank top">${card.rank}</span>
        <span class="card-suit-small top">${card.symbol}</span>
        <span class="card-suit-center">${card.symbol}</span>
        <span class="card-rank bottom">${card.rank}</span>
        <span class="card-suit-small bottom">${card.symbol}</span>`;
    }
    return el;
  },

  renderCommunityCards(cards) {
    const c = document.getElementById('community-cards');
    c.innerHTML = '';
    cards.forEach((card, i) => {
      const el = this.createCardElement(card, true, false);
      el.classList.add('dealing');
      el.style.animationDelay = `${i * 0.1}s`;
      c.appendChild(el);
    });
  },

  renderPlayerHand(pos, cards, faceUp) {
    const seat = document.querySelector(`.player-seat[data-position="${pos}"]`);
    if (!seat) return;
    const hand = seat.querySelector('.player-hand');
    hand.innerHTML = '';
    if (!cards || cards.length === 0) return;
    cards.forEach(card => {
      const el = this.createCardElement(card, faceUp, true);
      el.classList.add('dealing');
      hand.appendChild(el);
    });
  },

  renderFaceDownCards(pos) {
    const seat = document.querySelector(`.player-seat[data-position="${pos}"]`);
    if (!seat) return;
    const hand = seat.querySelector('.player-hand');
    hand.innerHTML = '';
    for (let i = 0; i < 2; i++) {
      const el = document.createElement('div');
      el.className = 'card small face-down dealing';
      hand.appendChild(el);
    }
  },

  updatePlayerInfo(pos, player) {
    const seat = document.querySelector(`.player-seat[data-position="${pos}"]`);
    if (!seat) return;
    const nameEl = seat.querySelector('.player-name');
    const chipsEl = seat.querySelector('.player-chips');

    let html = player.name;
    if (player.isDealer) html += ' <span class="dealer-badge">D</span>';
    if (player.isAI) html += ' <span style="font-size:0.55rem;color:var(--info);">AI</span>';
    nameEl.innerHTML = html;
    chipsEl.textContent = `$${player.chips.toLocaleString()}`;

    seat.classList.toggle('folded', player.folded || false);
    seat.classList.toggle('active', player.isActive || false);
    seat.classList.toggle('winner', player.isWinner || false);
    seat.style.display = 'flex';
  },

  hidePlayer(pos) {
    const seat = document.querySelector(`.player-seat[data-position="${pos}"]`);
    if (seat) seat.style.display = 'none';
  },

  showPlayerBet(pos, amount) {
    const seat = document.querySelector(`.player-seat[data-position="${pos}"]`);
    if (!seat) return;
    let betEl = seat.querySelector('.player-bet');
    if (amount > 0) {
      if (!betEl) { betEl = document.createElement('div'); betEl.className = 'player-bet'; seat.appendChild(betEl); }
      betEl.textContent = `$${amount.toLocaleString()}`;
    } else if (betEl) { betEl.remove(); }
  },

  showActionLabel(pos, action) {
    const seat = document.querySelector(`.player-seat[data-position="${pos}"]`);
    if (!seat) return;
    const old = seat.querySelector('.player-action-label');
    if (old) old.remove();
    if (!action) return;
    const labels = { fold:'弃牌 Fold', call:'跟注 Call', raise:'加注 Raise', check:'过牌 Check', allin:'全押 All In' };
    const label = document.createElement('div');
    label.className = `player-action-label ${action}`;
    label.textContent = labels[action] || action;
    seat.appendChild(label);
    setTimeout(() => { if (label.parentNode) label.remove(); }, 2500);
  },

  updatePot(amount) {
    const el = document.getElementById('pot-amount');
    if (el) el.textContent = `底池 Pot: $${amount.toLocaleString()}`;
  },

  updateControls(state) {
    const panel = document.getElementById('controls-panel');
    if (!panel) return;
    if (!state.isPlayerTurn) {
      panel.style.opacity = '0.4';
      panel.style.pointerEvents = 'none';
      return;
    }
    panel.style.opacity = '1';
    panel.style.pointerEvents = 'auto';

    const toCall = state.currentBet - state.playerBet;
    const canCheck = toCall === 0;
    document.getElementById('btn-check').classList.toggle('hidden', !canCheck);
    document.getElementById('btn-call').classList.toggle('hidden', canCheck);
    if (!canCheck) {
      document.getElementById('btn-call').textContent = `CALL 跟注 $${Math.min(toCall, state.playerChips).toLocaleString()}`;
    }
    document.getElementById('btn-allin').textContent = `ALL IN 全押 $${state.playerChips.toLocaleString()}`;
    const ri = document.getElementById('raise-input');
    if (ri) { ri.min = state.minRaise; ri.max = state.playerChips; ri.value = state.minRaise; }
  },

  updateGameInfo(info) {
    const r = document.getElementById('info-round');
    const b = document.getElementById('info-blinds');
    const rm = document.getElementById('info-room');
    if (r) r.textContent = `#${info.round}`;
    if (b) b.textContent = `$${info.smallBlind}/$${info.bigBlind}`;
    if (rm) rm.textContent = info.roomId || '';
  },

  showMessage(text, duration = 1500) {
    const overlay = document.getElementById('message-overlay');
    const textEl = document.getElementById('message-text');
    if (!overlay || !textEl) return Promise.resolve();
    textEl.textContent = text;
    overlay.classList.remove('hidden');
    return new Promise(resolve => {
      setTimeout(() => { overlay.classList.add('hidden'); resolve(); }, duration);
    });
  },

  addLog(message) {
    const log = document.getElementById('game-log');
    if (!log) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = message;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    while (log.children.length > 50) log.removeChild(log.firstChild);
  },

  clearTable() {
    document.getElementById('community-cards').innerHTML = '';
    document.querySelectorAll('.player-hand').forEach(h => h.innerHTML = '');
    document.querySelectorAll('.player-bet').forEach(b => b.remove());
    document.querySelectorAll('.player-action-label').forEach(l => l.remove());
    document.querySelectorAll('.player-seat').forEach(s => {
      s.classList.remove('folded', 'active', 'winner');
    });
  },

  showRoundResult(result) {
    return new Promise(resolve => {
      const modal = document.createElement('div');
      modal.className = 'round-modal';
      let html = '';
      for (const w of result.winners) {
        html += `<div class="round-result">
          <span class="winner-name">${w.name}</span> 赢得
          <span class="win-amount">$${w.amount.toLocaleString()}</span>
          ${w.handName ? `<br><span class="hand-name">${w.handName}</span>` : ''}
        </div>`;
      }
      modal.innerHTML = `<div class="round-modal-content"><h2>🏆 本轮结束 <span style="font-size:0.6em;opacity:0.7">Round Over</span></h2>${html}
        <button class="next-round-btn" id="next-round-btn">继续 Next Round</button></div>`;
      document.body.appendChild(modal);
      document.getElementById('next-round-btn').addEventListener('click', () => { modal.remove(); resolve(); });
      // Auto close after 5s
      setTimeout(() => { if (modal.parentNode) { modal.remove(); resolve(); } }, 5000);
    });
  },

  showGameOver(myChips) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      const won = myChips > 0;

      // Show credit status
      const balance = Credits.getBalance();
      const isVIP = Credits.isVIP;
      let creditStatus = '';
      let btnText = won ? '重新开始 Restart' : '';

      if (!won) {
        if (isVIP) {
          creditStatus = '<p class="credit-status vip">👑 VIP 积分无限 · Unlimited credits</p>';
          btnText = '继续游戏 Continue';
        } else if (balance >= Credits.COST_PER_GAME) {
          creditStatus = `<p class="credit-status sufficient">💰 积分余额: ${balance.toLocaleString()} · 可继续游戏</p>`;
          btnText = '继续游戏 Continue';
        } else {
          creditStatus = `<p class="credit-status insufficient">⚠️ 积分不足，需充值才能继续<br><span style="font-size:0.8em;opacity:0.7">余额 ${balance.toLocaleString()} / 需要 ${Credits.COST_PER_GAME.toLocaleString()}</span></p>`;
          btnText = '前往充值 Recharge';
        }
      }

      overlay.innerHTML = `
        <h1>${won ? '🎉 恭喜! Congratulations!' : '💔 游戏结束 Game Over'}</h1>
        <p>${won ? `你赢得了 You won <strong>$${myChips.toLocaleString()}</strong>` : '你的筹码已用完 You ran out of chips'}</p>
        ${creditStatus}
        <button class="restart-btn" id="restart-btn">${btnText}</button>`;
      document.body.appendChild(overlay);
      document.getElementById('restart-btn').addEventListener('click', () => {
        overlay.remove();
        resolve();
      });
    });
  },

  showError(msg) {
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
  },

  updateWaitingList(players) {
    const list = document.getElementById('player-list');
    if (!list) return;
    list.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const li = document.createElement('li');
      if (i < players.length) {
        const p = players[i];
        li.innerHTML = `<span class="seat-num">座位 Seat ${i+1}</span><span class="player-tag">${p.name}</span>`;
        if (p.isAI) li.classList.add('ai-player');
      } else {
        li.className = 'empty';
        li.innerHTML = `<span class="seat-num">座位 Seat ${i+1}</span><span>等待加入 Waiting...</span>`;
      }
      list.appendChild(li);
    }
  },

  // ---- Mobile Enhancements ----
  initMobile() {
    // Only apply on touch devices
    if (!('ontouchstart' in window)) return;

    // 1. Prevent context menu on long-press (interferes with game buttons)
    document.addEventListener('contextmenu', e => e.preventDefault());

    // 2. Inject floating log toggle button (only shows on ≤480px via CSS)
    const logToggle = document.createElement('button');
    logToggle.id = 'mobile-log-toggle';
    logToggle.innerHTML = '📋';
    logToggle.title = '游戏日志';
    document.body.appendChild(logToggle);

    const gameLog = document.getElementById('game-log');
    let logVisible = false;
    logToggle.addEventListener('click', () => {
      logVisible = !logVisible;
      if (gameLog) {
        gameLog.style.display = logVisible ? 'block' : '';
        logToggle.innerHTML = logVisible ? '✕' : '📋';
        logToggle.classList.toggle('active', logVisible);
      }
    });

    // 4. Show log toggle only during game
    const observer = new MutationObserver(() => {
      const inGame = document.getElementById('game-screen') &&
        !document.getElementById('game-screen').classList.contains('hidden');
      logToggle.style.display = inGame ? '' : 'none';
    });
    const gameScreen = document.getElementById('game-screen');
    if (gameScreen) observer.observe(gameScreen, { attributes: true, attributeFilter: ['class'] });
    logToggle.style.display = 'none'; // Hidden until game starts
  }
};
