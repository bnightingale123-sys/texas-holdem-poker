// ============================================
// ui.js - UI Rendering & Animations
// ============================================

const UI = {
  // Create a card DOM element
  createCardElement(card, faceUp = true, small = false) {
    const el = document.createElement('div');
    el.className = `card ${small ? 'small' : ''} ${faceUp ? 'face-up' : 'face-down'} ${faceUp ? card.color : ''}`;
    el.dataset.cardId = card ? card.id() : '';

    if (faceUp && card) {
      el.innerHTML = `
        <span class="card-rank top">${card.rank}</span>
        <span class="card-suit-small top">${card.symbol}</span>
        <span class="card-suit-center">${card.symbol}</span>
        <span class="card-rank bottom">${card.rank}</span>
        <span class="card-suit-small bottom">${card.symbol}</span>
      `;
    }
    return el;
  },

  // Render community cards
  renderCommunityCards(cards) {
    const container = document.getElementById('community-cards');
    container.innerHTML = '';
    cards.forEach((card, i) => {
      const el = this.createCardElement(card, true);
      el.classList.add('dealing');
      el.style.animationDelay = `${i * 0.1}s`;
      container.appendChild(el);
    });
  },

  // Render player hand
  renderPlayerHand(playerIndex, cards, faceUp) {
    const seat = document.querySelector(`.player-seat[data-position="${playerIndex}"]`);
    if (!seat) return;
    const handEl = seat.querySelector('.player-hand');
    handEl.innerHTML = '';
    cards.forEach(card => {
      const el = this.createCardElement(card, faceUp, true);
      el.classList.add('dealing');
      handEl.appendChild(el);
    });
  },

  // Update player info
  updatePlayerInfo(playerIndex, player) {
    const seat = document.querySelector(`.player-seat[data-position="${playerIndex}"]`);
    if (!seat) return;

    const nameEl = seat.querySelector('.player-name');
    const chipsEl = seat.querySelector('.player-chips');

    let nameHTML = player.name;
    if (player.isDealer) {
      nameHTML += ' <span class="dealer-badge">D</span>';
    }
    nameEl.innerHTML = nameHTML;
    chipsEl.textContent = `$${player.chips.toLocaleString()}`;

    // Status classes
    seat.classList.toggle('folded', player.folded);
    seat.classList.toggle('active', player.isActive);
    seat.classList.toggle('winner', player.isWinner || false);
  },

  // Show player bet
  showPlayerBet(playerIndex, amount) {
    const seat = document.querySelector(`.player-seat[data-position="${playerIndex}"]`);
    if (!seat) return;
    let betEl = seat.querySelector('.player-bet');
    if (amount > 0) {
      if (!betEl) {
        betEl = document.createElement('div');
        betEl.className = 'player-bet';
        seat.appendChild(betEl);
      }
      betEl.textContent = `$${amount.toLocaleString()}`;
    } else if (betEl) {
      betEl.remove();
    }
  },

  // Show action label
  showActionLabel(playerIndex, action) {
    const seat = document.querySelector(`.player-seat[data-position="${playerIndex}"]`);
    if (!seat) return;

    // Remove existing
    const old = seat.querySelector('.player-action-label');
    if (old) old.remove();

    if (!action) return;

    const label = document.createElement('div');
    const labels = {
      fold: 'Fold', call: 'Call', raise: 'Raise', check: 'Check', allin: 'All In'
    };
    label.className = `player-action-label ${action}`;
    label.textContent = labels[action] || action;
    seat.appendChild(label);

    setTimeout(() => {
      if (label.parentNode) label.remove();
    }, 2000);
  },

  // Update pot display
  updatePot(amount) {
    const el = document.getElementById('pot-amount');
    if (el) el.textContent = `底池: $${amount.toLocaleString()}`;
  },

  // Update controls
  updateControls(state) {
    const panel = document.getElementById('controls-panel');
    if (!panel) return;

    const btnFold = document.getElementById('btn-fold');
    const btnCheck = document.getElementById('btn-check');
    const btnCall = document.getElementById('btn-call');
    const btnRaise = document.getElementById('btn-raise');
    const btnAllin = document.getElementById('btn-allin');
    const raiseInput = document.getElementById('raise-input');

    if (!state.isPlayerTurn) {
      panel.style.opacity = '0.4';
      panel.style.pointerEvents = 'none';
      return;
    }

    panel.style.opacity = '1';
    panel.style.pointerEvents = 'auto';

    const toCall = state.currentBet - state.playerBet;
    const canCheck = toCall === 0;
    const canCall = toCall > 0 && state.playerChips >= toCall;
    const canRaise = state.playerChips > toCall;

    btnCheck.classList.toggle('hidden', !canCheck);
    btnCall.classList.toggle('hidden', canCheck);
    if (!canCheck) {
      btnCall.textContent = `CALL $${Math.min(toCall, state.playerChips).toLocaleString()}`;
    }
    btnRaise.disabled = !canRaise;
    btnAllin.textContent = `ALL IN $${state.playerChips.toLocaleString()}`;

    if (raiseInput) {
      raiseInput.min = state.minRaise;
      raiseInput.max = state.playerChips;
      raiseInput.value = state.minRaise;
    }
  },

  // Update game info bar
  updateGameInfo(info) {
    const roundEl = document.getElementById('info-round');
    const blindEl = document.getElementById('info-blinds');
    if (roundEl) roundEl.textContent = `#${info.round}`;
    if (blindEl) blindEl.textContent = `$${info.smallBlind}/$${info.bigBlind}`;
  },

  // Show message overlay
  showMessage(text, duration = 1500) {
    const overlay = document.getElementById('message-overlay');
    const textEl = document.getElementById('message-text');
    if (!overlay || !textEl) return;

    textEl.textContent = text;
    overlay.classList.remove('hidden');

    return new Promise(resolve => {
      setTimeout(() => {
        overlay.classList.add('hidden');
        resolve();
      }, duration);
    });
  },

  // Add log entry
  addLog(message) {
    const log = document.getElementById('game-log');
    if (!log) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = message;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;

    // Keep only last 50 entries
    while (log.children.length > 50) {
      log.removeChild(log.firstChild);
    }
  },

  // Clear table for new round
  clearTable() {
    document.getElementById('community-cards').innerHTML = '';
    document.querySelectorAll('.player-hand').forEach(h => h.innerHTML = '');
    document.querySelectorAll('.player-bet').forEach(b => b.remove());
    document.querySelectorAll('.player-action-label').forEach(l => l.remove());
    document.querySelectorAll('.player-seat').forEach(s => {
      s.classList.remove('folded', 'active', 'winner');
    });
  },

  // Show round end modal
  showRoundResult(result) {
    return new Promise(resolve => {
      const modal = document.createElement('div');
      modal.className = 'round-modal';
      modal.id = 'round-modal';

      let winnersHTML = '';
      for (const w of result.winners) {
        winnersHTML += `<div class="round-result">
          <span class="winner-name">${w.name}</span> 赢得
          <span class="win-amount">$${w.amount.toLocaleString()}</span>
          ${w.handName ? `<br><span class="hand-name">${w.handName}</span>` : ''}
        </div>`;
      }

      modal.innerHTML = `
        <div class="round-modal-content">
          <h2>🏆 本轮结束</h2>
          ${winnersHTML}
          <button class="next-round-btn" id="next-round-btn">下一轮</button>
        </div>
      `;

      document.body.appendChild(modal);
      document.getElementById('next-round-btn').addEventListener('click', () => {
        modal.remove();
        resolve();
      });
    });
  },

  // Show game over
  showGameOver(playerChips) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      const won = playerChips > 0;
      overlay.innerHTML = `
        <h1>${won ? '🎉 恭喜你!' : '💔 游戏结束'}</h1>
        <p>${won ? `你赢得了 $${playerChips.toLocaleString()}` : '你的筹码已用完'}</p>
        <button class="restart-btn" id="restart-btn">${won ? '重新开始' : '返回'}</button>
      `;
      document.body.appendChild(overlay);
      document.getElementById('restart-btn').addEventListener('click', () => {
        overlay.remove();
        resolve();
      });
    });
  },

  // Show recharge modal (ETH payment)
  showRechargeModal() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'recharge-overlay';

      const packages = [
        { chips: 10000, eth: '0.01', label: '入门' },
        { chips: 50000, eth: '0.05', label: '热门' },
        { chips: 100000, eth: '0.10', label: '推荐' },
        { chips: 500000, eth: '0.50', label: '至尊' },
      ];

      overlay.innerHTML = `
        <div class="recharge-modal">
          <div class="recharge-header">
            <div class="recharge-icon">⟠</div>
            <h2>筹码不足</h2>
            <p>你的筹码已用完，请选择充值套餐继续游戏</p>
          </div>
          <div class="recharge-packages">
            ${packages.map((pkg, i) => `
              <div class="recharge-package" data-index="${i}">
                <span class="pkg-badge">${pkg.label}</span>
                <div class="pkg-chips">${pkg.chips.toLocaleString()}</div>
                <div class="pkg-chips-label">筹码</div>
                <div class="pkg-price">${pkg.eth} ETH</div>
              </div>
            `).join('')}
          </div>
          <div class="recharge-payment" id="recharge-payment" style="display:none;">
            <div class="payment-header">支付确认</div>
            <div class="payment-info">
              <p style="margin-bottom:12px;">请向以下地址转账 ETH：</p>
              <div class="eth-address" id="eth-address">0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18</div>
              <button class="btn-copy-addr" id="btn-copy-addr">复制地址</button>
              <p class="payment-amount" id="payment-amount"></p>
              <p class="payment-hint">转账后点击下方按钮确认，到账后自动发放筹码</p>
              <button class="btn-pay" id="btn-pay">我已支付</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      let selectedChips = 0;

      // Package selection
      overlay.querySelectorAll('.recharge-package').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.index);
          const pkg = packages[idx];
          selectedChips = pkg.chips;

          // Highlight selected
          overlay.querySelectorAll('.recharge-package').forEach(p => p.classList.remove('selected'));
          el.classList.add('selected');

          // Show payment step (with short delay for visual feedback)
          setTimeout(() => {
            overlay.querySelector('.recharge-packages').style.display = 'none';
            const paymentEl = overlay.querySelector('#recharge-payment');
            paymentEl.style.display = 'block';
            paymentEl.style.animation = 'slideUp 0.4s ease';
            document.getElementById('payment-amount').textContent =
              `支付金额: ${pkg.eth} ETH（${pkg.chips.toLocaleString()} 筹码）`;
          }, 300);
        });
      });

      // Copy address
      document.getElementById('btn-copy-addr').addEventListener('click', () => {
        const addr = document.getElementById('eth-address').textContent;
        navigator.clipboard.writeText(addr).then(() => {
          const btn = document.getElementById('btn-copy-addr');
          btn.textContent = '已复制 ✓';
          setTimeout(() => { btn.textContent = '复制地址'; }, 2000);
        }).catch(() => {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = addr;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        });
      });

      // Confirm payment
      document.getElementById('btn-pay').addEventListener('click', () => {
        if (selectedChips > 0) {
          overlay.remove();
          resolve(selectedChips);
        }
      });
    });
  }
};
