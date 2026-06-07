// ============================================
// credits.js - Unified Balance & VIP/Shop System
// ============================================

const Credits = {
  balance: 0,
  walletAddress: null,
  isConnecting: false,
  isVIP: false,
  vipExpiry: null,
  DAILY_FREE: 10000,
  VIP_PRICE_ETH: 0.1,

  // ETH to Credits exchange rates
  packages: [
    { id: 'pkg1', eth: 0.001, credits: 10000, label: '10,000', popular: false, bonus: '' },
    { id: 'pkg2', eth: 0.005, credits: 50000, label: '50,000', popular: true, bonus: '' },
    { id: 'pkg3', eth: 0.01, credits: 120000, label: '120,000', popular: false, bonus: '+20%' },
    { id: 'pkg4', eth: 0.05, credits: 700000, label: '700,000', popular: false, bonus: '+40%' },
  ],

  RECEIVE_ADDRESS: '0xF6e5C1Ef10B1e4E37Bfca423F5d08bEb42B881f1',

  init() {
    this.loadVIPStatus();
    this.renderCreditsDisplay();
    this.setupModal();
    this.checkWalletConnection();
    this._pendingRestartCallback = null;
  },

  // ---- Load balance from server (call after login) ----
  loadFromServer() {
    if (!App.loggedInUsername || !Network.socket) return;
    Network.fetchBalance((res) => {
      if (res && res.balance !== undefined) {
        this.balance = Math.max(0, res.balance);
        this.updateDisplay();
        this.updateDailyClaimUI();
        this.updateModalDailyBtn();
      }
    });
  },

  // ---- VIP Logic ----
  loadVIPStatus() {
    const expiry = localStorage.getItem('poker_vip_expiry');
    if (expiry) {
      const expiryDate = new Date(parseInt(expiry));
      if (expiryDate > new Date()) {
        this.isVIP = true;
        this.vipExpiry = expiryDate;
      } else {
        this.isVIP = false;
        this.vipExpiry = null;
        localStorage.removeItem('poker_vip_expiry');
      }
    }
  },

  activateVIP() {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    this.isVIP = true;
    this.vipExpiry = endOfMonth;
    localStorage.setItem('poker_vip_expiry', endOfMonth.getTime().toString());
  },

  getVIPDaysLeft() {
    if (!this.isVIP || !this.vipExpiry) return 0;
    const now = new Date();
    return Math.max(0, Math.ceil((this.vipExpiry - now) / 86400000));
  },

  // ---- Local daily claim hint (server enforces the real check) ----
  canClaimDaily() {
    const lastClaim = localStorage.getItem('poker_daily_claim');
    if (!lastClaim) return true;
    const lastDate = new Date(parseInt(lastClaim));
    const now = new Date();
    return lastDate.toDateString() !== now.toDateString();
  },

  claimDaily(callback) {
    if (!Network.socket || !Network.connected) {
      this.showPurchaseError('未连接到服务器');
      if (callback) callback(false);
      return;
    }
    Network.claimDaily((res) => {
      if (res && res.ok) {
        this.balance = res.balance;
        localStorage.setItem('poker_daily_claim', Date.now().toString());
        this.updateDisplay();
        this.updateDailyClaimUI();
        this.updateModalDailyBtn();
        this.showPurchaseSuccess(this.DAILY_FREE, true);
        // Auto-restart game if waiting after game over
        if (this._pendingRestartCallback) {
          const cb = this._pendingRestartCallback;
          this._pendingRestartCallback = null;
          setTimeout(cb, 500);
        }
        if (callback) callback(true);
      } else {
        const reason = (res && res.reason) || '领取失败';
        this.showPurchaseError(reason);
        if (callback) callback(false);
      }
    });
  },

  getNextClaimTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow - now;
  },

  formatCountdown(ms) {
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hours}小时${mins}分钟`;
  },

  addCredits(amount) {
    this.balance += amount;
    this.updateDisplay();
  },

  getBalance() {
    return this.balance;
  },

  // ---- UI Rendering ----
  renderCreditsDisplay() {
    const lobbyContent = document.querySelector('.lobby-content');
    if (!lobbyContent) return;

    const creditsBar = document.createElement('div');
    creditsBar.className = 'credits-bar';
    creditsBar.id = 'credits-bar';

    const canClaim = this.canClaimDaily();
    const vipBadge = this.isVIP
      ? `<span class="vip-badge-inline">👑 VIP · 剩余${this.getVIPDaysLeft()}天</span>`
      : '';

    creditsBar.innerHTML = `
      <div class="credits-info">
        <span class="credits-icon">💰</span>
        <span class="credits-label">积分 Credits</span>
        <span class="credits-amount" id="credits-amount">${this.isVIP ? '∞' : this.balance.toLocaleString()}</span>
        ${vipBadge}
      </div>
      <div class="credits-actions">
        <button class="daily-claim-btn ${canClaim ? '' : 'claimed'}" id="btn-daily-claim">
          <span class="claim-icon">🎁</span>
          <span class="claim-text" id="daily-claim-text">${canClaim ? '每日积分 Daily Bonus' : '已领取 Claimed'}</span>
        </button>
        <button class="buy-credits-btn" id="btn-buy-credits">
          <span class="eth-icon">
            <svg width="14" height="14" viewBox="0 0 256 417" xmlns="http://www.w3.org/2000/svg">
              <path fill="#fff" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" opacity=".6"/>
              <path fill="#fff" d="M127.962 0L0 212.32l127.962 75.639V154.158z"/>
              <path fill="#fff" d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.601L256 236.587z" opacity=".6"/>
              <path fill="#fff" d="M127.962 416.905v-104.72L0 236.585z"/>
            </svg>
          </span>
          充值商店 Shop
        </button>
      </div>
    `;

    const actions = lobbyContent.querySelector('.lobby-actions');
    if (actions) {
      lobbyContent.insertBefore(creditsBar, actions);
    }

    // Daily claim button event (lobby)
    document.getElementById('btn-daily-claim').addEventListener('click', () => {
      Sound.click();
      if (this.canClaimDaily()) {
        this.claimDaily();
      } else {
        const remaining = this.getNextClaimTime();
        this.showPurchaseError(`今日已领取，${this.formatCountdown(remaining)}后可再次领取`);
      }
    });

    if (!canClaim) {
      this.startClaimCountdown();
    }
  },

  updateDailyClaimUI() {
    const btn = document.getElementById('btn-daily-claim');
    const text = document.getElementById('daily-claim-text');
    if (btn && text) {
      if (this.canClaimDaily()) {
        btn.classList.remove('claimed');
        text.textContent = '每日积分 Daily Bonus';
      } else {
        btn.classList.add('claimed');
        text.textContent = '已领取 Claimed';
        this.startClaimCountdown();
      }
    }
  },

  startClaimCountdown() {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    this._countdownTimer = setInterval(() => {
      if (this.canClaimDaily()) {
        this.updateDailyClaimUI();
        this.updateModalDailyBtn();
        clearInterval(this._countdownTimer);
      }
    }, 60000);
  },

  setupModal() {
    const modal = document.createElement('div');
    modal.className = 'credits-modal hidden';
    modal.id = 'credits-modal';

    const vipStatusHTML = this.isVIP
      ? `<div class="vip-active-banner">
           <span class="vip-crown">👑</span>
           <div class="vip-active-info">
             <strong>月度VIP已激活 · VIP Active</strong><br>
             有效期至: ${this.vipExpiry ? this.vipExpiry.toLocaleDateString('zh-CN') : '本月'}
           </div>
         </div>`
      : `<div class="vip-card" id="vip-card">
           <div class="vip-card-glow"></div>
           <div class="vip-card-content">
             <div class="vip-card-header">
               <span class="vip-crown-icon">👑</span>
               <div>
                 <div class="vip-card-title">月度 VIP · Monthly VIP</div>
                 <div class="vip-card-desc">当月积分无限 · Unlimited credits</div>
               </div>
             </div>
             <div class="vip-card-price">
               <svg width="16" height="16" viewBox="0 0 256 417" xmlns="http://www.w3.org/2000/svg">
                 <path fill="currentColor" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" opacity=".6"/>
                 <path fill="currentColor" d="M127.962 0L0 212.32l127.962 75.639V154.158z"/>
               </svg>
               <span>${this.VIP_PRICE_ETH} ETH / 月 mo.</span>
             </div>
             <button class="vip-buy-btn" id="btn-buy-vip">立即开通 Subscribe</button>
           </div>
         </div>`;

    const canClaim = this.canClaimDaily();

    modal.innerHTML = `
      <div class="credits-modal-backdrop" id="credits-modal-backdrop"></div>
      <div class="credits-modal-content">
        <button class="credits-modal-close" id="credits-modal-close">✕</button>

        <div class="credits-modal-header">
          <div class="eth-logo-wrapper">
            <svg class="eth-logo-svg" width="40" height="40" viewBox="0 0 256 417" xmlns="http://www.w3.org/2000/svg">
              <path fill="#627EEA" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z"/>
              <path fill="#8C9EFF" d="M127.962 0L0 212.32l127.962 75.639V154.158z"/>
              <path fill="#627EEA" d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.601L256 236.587z"/>
              <path fill="#8C9EFF" d="M127.962 416.905v-104.72L0 236.585z"/>
            </svg>
          </div>
          <h2>充值商店 Credit Shop</h2>
          <p class="credits-modal-subtitle">购买积分或开通VIP · Buy Credits or VIP</p>
        </div>

        <!-- Daily Claim Card (inside modal) -->
        <div class="modal-daily-card" id="modal-daily-card">
          <div class="modal-daily-left">
            <span class="modal-daily-icon">🎁</span>
            <div class="modal-daily-text">
              <div class="modal-daily-title">每日免费积分 Free Daily Bonus</div>
              <div class="modal-daily-amount">+${this.DAILY_FREE.toLocaleString()} 积分 Credits</div>
            </div>
          </div>
          <button class="modal-daily-btn ${canClaim ? '' : 'claimed'}" id="modal-daily-btn">
            <span id="modal-daily-btn-text">${canClaim ? '领取 Claim' : '已领取 Claimed'}</span>
          </button>
        </div>

        <div class="wallet-section" id="wallet-section">
          <button class="connect-wallet-btn" id="btn-connect-wallet">
            <span class="wallet-icon">🦊</span>
            连接钱包 Connect Wallet
          </button>
          <div class="wallet-connected hidden" id="wallet-connected">
            <span class="wallet-status-dot"></span>
            <span class="wallet-addr" id="wallet-addr"></span>
          </div>
        </div>

        ${vipStatusHTML}

        <div class="section-label">积分充值 Top Up Credits</div>

        <div class="packages-grid" id="packages-grid">
          ${this.packages.map(pkg => `
            <div class="credit-package ${pkg.popular ? 'popular' : ''}" data-pkg-id="${pkg.id}">
              ${pkg.popular ? '<div class="popular-badge">🔥 最受欢迎</div>' : ''}
              ${pkg.bonus ? `<div class="bonus-badge">${pkg.bonus}</div>` : ''}
              <div class="pkg-credits">${pkg.label}</div>
              <div class="pkg-credits-label">积分 Credits</div>
              <div class="pkg-divider"></div>
              <div class="pkg-price">
                <svg class="pkg-eth-icon" width="14" height="14" viewBox="0 0 256 417" xmlns="http://www.w3.org/2000/svg">
                  <path fill="currentColor" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" opacity=".6"/>
                  <path fill="currentColor" d="M127.962 0L0 212.32l127.962 75.639V154.158z"/>
                </svg>
                ${pkg.eth} ETH
              </div>
              <button class="pkg-buy-btn" data-pkg-id="${pkg.id}">购买 Buy</button>
            </div>
          `).join('')}
        </div>

        <div class="purchase-status hidden" id="purchase-status">
          <div class="purchase-spinner"></div>
          <span class="purchase-status-text" id="purchase-status-text">处理中...</span>
        </div>

        <div class="credits-modal-footer">
          <div class="current-balance">
            当前余额 Balance: <span class="balance-highlight" id="modal-balance">${this.isVIP ? '∞ (VIP)' : this.balance.toLocaleString()}</span> 积分 Credits
          </div>
          <div class="daily-info">
            <span class="daily-info-icon">ℹ️</span> 每日可免费领取 ${this.DAILY_FREE.toLocaleString()} 积分 · Free daily bonus, buy more or go VIP
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('btn-buy-credits').addEventListener('click', () => {
      Sound.click();
      this.openModal();
    });

    document.getElementById('credits-modal-backdrop').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('credits-modal-close').addEventListener('click', () => {
      Sound.click();
      this.closeModal();
    });

    document.getElementById('btn-connect-wallet').addEventListener('click', () => {
      Sound.click();
      this.connectWallet();
    });

    // VIP buy button
    const vipBtn = document.getElementById('btn-buy-vip');
    if (vipBtn) {
      vipBtn.addEventListener('click', () => {
        Sound.click();
        this.purchaseVIP();
      });
    }

    // Modal daily claim button
    document.getElementById('modal-daily-btn').addEventListener('click', () => {
      Sound.click();
      if (this.canClaimDaily()) {
        this.claimDaily();
      } else {
        const remaining = this.getNextClaimTime();
        this.showPurchaseError(`今日已领取，${this.formatCountdown(remaining)}后可再次领取`);
      }
    });

    // Package buy buttons
    document.querySelectorAll('.pkg-buy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        Sound.click();
        const pkgId = e.target.getAttribute('data-pkg-id');
        this.purchasePackage(pkgId);
      });
    });
  },

  openModal(onClaimed) {
    this._pendingRestartCallback = onClaimed || null;
    const modal = document.getElementById('credits-modal');
    if (modal) {
      modal.classList.remove('hidden');
      this.updateModalBalance();
      this.updateModalDailyBtn();
    }
  },

  closeModal() {
    this._pendingRestartCallback = null;
    const modal = document.getElementById('credits-modal');
    if (modal) modal.classList.add('hidden');
  },

  updateDisplay() {
    const el = document.getElementById('credits-amount');
    if (el) {
      el.textContent = this.isVIP ? '∞' : this.balance.toLocaleString();
      el.classList.add('credits-updated');
      setTimeout(() => el.classList.remove('credits-updated'), 600);
    }
    this.updateModalBalance();
  },

  updateModalBalance() {
    const el = document.getElementById('modal-balance');
    if (el) el.textContent = this.isVIP ? '∞ (VIP)' : this.balance.toLocaleString();
  },

  updateModalDailyBtn() {
    const btn = document.getElementById('modal-daily-btn');
    const text = document.getElementById('modal-daily-btn-text');
    if (btn && text) {
      if (this.canClaimDaily()) {
        btn.classList.remove('claimed');
        text.textContent = '领取 Claim';
      } else {
        btn.classList.add('claimed');
        text.textContent = '已领取 Claimed';
      }
    }
  },

  refreshCreditsBar() {
    const oldBar = document.getElementById('credits-bar');
    if (oldBar) oldBar.remove();
    this.renderCreditsDisplay();
  },

  // ---- Wallet & Purchase (unchanged) ----
  async checkWalletConnection() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          this.walletAddress = accounts[0];
          this.showWalletConnected();
        }
      } catch (err) {
        console.log('Wallet check failed:', err);
      }
    }
  },

  async connectWallet() {
    if (this.isConnecting) return;
    if (typeof window.ethereum === 'undefined') {
      this.showPurchaseError('请安装 MetaMask 钱包扩展 Please install MetaMask');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }
    this.isConnecting = true;
    const btn = document.getElementById('btn-connect-wallet');
    btn.textContent = '连接中 Connecting...';
    btn.disabled = true;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        this.walletAddress = accounts[0];
        this.showWalletConnected();
      }
    } catch (err) {
      console.error('Wallet connection failed:', err);
      if (err.code === 4001) {
        this.showPurchaseError('用户拒绝了连接请求 Connection rejected');
      } else {
        this.showPurchaseError('连接钱包失败 Wallet connection failed');
      }
    } finally {
      this.isConnecting = false;
      btn.innerHTML = '<span class="wallet-icon">🦊</span> 连接钱包 Connect Wallet';
      btn.disabled = false;
    }
  },

  showWalletConnected() {
    const connectBtn = document.getElementById('btn-connect-wallet');
    const connectedDiv = document.getElementById('wallet-connected');
    const addrSpan = document.getElementById('wallet-addr');
    if (connectBtn) connectBtn.classList.add('hidden');
    if (connectedDiv) connectedDiv.classList.remove('hidden');
    if (addrSpan && this.walletAddress) {
      addrSpan.textContent = this.walletAddress.slice(0, 6) + '...' + this.walletAddress.slice(-4);
    }
  },

  // ---- Purchase VIP ----
  async purchaseVIP() {
    if (!this.walletAddress) {
      await this.connectWallet();
      if (!this.walletAddress) return;
    }
    const statusDiv = document.getElementById('purchase-status');
    const statusText = document.getElementById('purchase-status-text');
    statusDiv.classList.remove('hidden');
    statusText.textContent = '正在发起VIP交易...';
    try {
      const weiAmount = BigInt(Math.round(this.VIP_PRICE_ETH * 1e18));
      const hexValue = '0x' + weiAmount.toString(16);
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: this.walletAddress, to: this.RECEIVE_ADDRESS, value: hexValue }],
      });
      statusText.textContent = '交易已提交，等待确认 Transaction submitted, confirming...';
      await this.waitForConfirmation(txHash);
      this.activateVIP();
      this.updateDisplay();
      statusDiv.classList.add('hidden');
      this.showVIPSuccess();
      this.closeModal();
      const oldModal = document.getElementById('credits-modal');
      if (oldModal) oldModal.remove();
      this.setupModal();
      this.refreshCreditsBar();
      if (Network.socket) {
        Network.socket.emit('vipPurchased', {
          txHash, walletAddress: this.walletAddress, expiresAt: this.vipExpiry.getTime()
        });
      }
    } catch (err) {
      statusDiv.classList.add('hidden');
      console.error('VIP purchase failed:', err);
      if (err.code === 4001) {
        this.showPurchaseError('交易被用户取消');
      } else {
        this.showPurchaseError('交易失败: ' + (err.message || '未知错误'));
      }
    }
  },

  showVIPSuccess() {
    const toast = document.createElement('div');
    toast.className = 'credits-toast success vip-toast';
    toast.innerHTML = `<span class="toast-icon">👑</span><span>恭喜！月度VIP已激活，当月积分无限！</span>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 300); }, 4000);
  },

  // ---- Purchase Credits Package ----
  async purchasePackage(pkgId) {
    const pkg = this.packages.find(p => p.id === pkgId);
    if (!pkg) return;
    if (!this.walletAddress) {
      await this.connectWallet();
      if (!this.walletAddress) return;
    }
    const statusDiv = document.getElementById('purchase-status');
    const statusText = document.getElementById('purchase-status-text');
    statusDiv.classList.remove('hidden');
    statusText.textContent = '正在发起交易...';
    try {
      const weiAmount = BigInt(Math.round(pkg.eth * 1e18));
      const hexValue = '0x' + weiAmount.toString(16);
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: this.walletAddress, to: this.RECEIVE_ADDRESS, value: hexValue }],
      });
      statusText.textContent = '交易已提交，等待确认 Transaction submitted, confirming...';
      await this.waitForConfirmation(txHash);
      this.addCredits(pkg.credits);
      statusDiv.classList.add('hidden');
      this.showPurchaseSuccess(pkg.credits, false);
      if (Network.socket) {
        Network.socket.emit('creditsPurchased', {
          credits: pkg.credits, txHash, walletAddress: this.walletAddress
        });
      }
    } catch (err) {
      statusDiv.classList.add('hidden');
      console.error('Purchase failed:', err);
      if (err.code === 4001) {
        this.showPurchaseError('交易被用户取消');
      } else {
        this.showPurchaseError('交易失败: ' + (err.message || '未知错误'));
      }
    }
  },

  async waitForConfirmation(txHash) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 60;
      const checkReceipt = async () => {
        try {
          const receipt = await window.ethereum.request({
            method: 'eth_getTransactionReceipt', params: [txHash],
          });
          if (receipt) {
            if (receipt.status === '0x1') resolve(receipt);
            else reject(new Error('交易执行失败'));
            return;
          }
          attempts++;
          if (attempts >= maxAttempts) { resolve(null); return; }
          setTimeout(checkReceipt, 3000);
        } catch (err) {
          attempts++;
          if (attempts >= maxAttempts) { resolve(null); return; }
          setTimeout(checkReceipt, 3000);
        }
      };
      checkReceipt();
    });
  },

  showPurchaseSuccess(credits, isDaily) {
    const toast = document.createElement('div');
    toast.className = 'credits-toast success';
    toast.innerHTML = `
      <span class="toast-icon">✅</span>
      <span>${isDaily ? '每日积分领取成功 Daily bonus claimed!' : '购买成功 Purchase successful!'} +<strong>${credits.toLocaleString()}</strong> 积分 Credits</span>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 300); }, 3000);
  },

  showPurchaseError(message) {
    const toast = document.createElement('div');
    toast.className = 'credits-toast error';
    toast.innerHTML = `<span class="toast-icon">❌</span><span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 300); }, 3000);
  }
};
